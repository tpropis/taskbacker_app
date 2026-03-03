import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

const PROMPT_BODY = (context?: string, depthMeta?: DepthMeta) => `You are TaskBacker AI — a professional inspector and quality rater.

Analyze this image${context ? ` for the task: "${context}"` : ''}.${depthMeta ? `

LiDAR depth data was captured alongside this photo:
- Nearest detected surface: ${depthMeta.minDepth.toFixed(2)}m
- Furthest detected surface: ${depthMeta.maxDepth.toFixed(2)}m
- Average scene depth: ${depthMeta.avgDepth.toFixed(2)}m
- Depth source: ${depthMeta.source}
Use this spatial context to improve your assessment (e.g. estimating object sizes, distances, or structural gaps).` : ''}

Score the overall quality/condition from 0–100:
- 0–30: Critical — major problems, unsafe or unacceptable
- 31–50: Poor — significant issues need addressing
- 51–70: Needs work — problems present but manageable
- 71–85: Good — minor issues, mostly acceptable
- 86–100: Excellent — clean, complete, professional

Be specific and precise. Look at cleanliness, completeness, safety, workmanship, and condition.

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "score": <integer 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "headline": <concise verdict, max 8 words>,
  "summary": <2-3 sentences describing exactly what you see and why you gave this score>,
  "findings": [<5 specific observations about what is good or bad, each 1 short sentence>]
}`;

type DepthMeta = { minDepth: number; maxDepth: number; avgDepth: number; source: string };

function friendlyError(err: unknown): { message: string; status: number } {
  // Check Anthropic SDK status codes first — more reliable than keyword matching
  if (err && typeof err === 'object' && 'status' in err) {
    const httpStatus = (err as { status: number }).status;
    if (httpStatus === 429) return { message: 'Rate limit reached — please wait a moment and try again.', status: 429 };
    if (httpStatus === 402) return { message: 'API quota exceeded. Check your Anthropic account credits.', status: 402 };
    if (httpStatus === 401 || httpStatus === 403) return { message: 'Invalid or missing ANTHROPIC_API_KEY. Set it in your Vercel environment.', status: 401 };
    if (httpStatus === 529 || httpStatus === 503 || httpStatus === 500) return { message: 'Anthropic API is temporarily overloaded. Try again in a moment.', status: 503 };
  }

  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('rate_limit') || lower.includes('rate limit') || lower.includes('429')) {
    return { message: 'Rate limit reached — please wait a moment and try again.', status: 429 };
  }
  if (lower.includes('quota') || lower.includes('credit') || lower.includes('billing')) {
    return { message: 'API quota exceeded. Check your Anthropic account credits.', status: 402 };
  }
  if (lower.includes('api_key') || lower.includes('api key') || lower.includes('auth') || lower.includes('401')) {
    return { message: 'Invalid or missing ANTHROPIC_API_KEY. Set it in your Vercel environment.', status: 401 };
  }
  if (lower.includes('overloaded') || lower.includes('529') || lower.includes('service')) {
    return { message: 'Anthropic API is temporarily overloaded. Try again in a moment.', status: 503 };
  }
  return { message: raw, status: 500 };
}

async function callAPI(base64Data: string, context?: string, depthMeta?: DepthMeta) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
          },
          { type: 'text', text: PROMPT_BODY(context, depthMeta) },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    return { score: 72, grade: 'B', headline: 'Analysis complete', summary: text.slice(0, 200), findings: [] };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, context, depthMeta } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Retry once on rate-limit (429) with a short backoff
    let result;
    try {
      result = await callAPI(base64Data, context, depthMeta);
    } catch (firstErr: unknown) {
      const httpStatus = (firstErr && typeof firstErr === 'object' && 'status' in firstErr)
        ? (firstErr as { status: number }).status
        : 0;
      const raw = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const isRetryable = httpStatus === 429 || httpStatus === 529
        || raw.toLowerCase().includes('rate_limit') || raw.toLowerCase().includes('rate limit');
      if (isRetryable) {
        await new Promise((r) => setTimeout(r, 3000));
        result = await callAPI(base64Data, context, depthMeta);
      } else {
        throw firstErr;
      }
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const { message, status } = friendlyError(err);
    console.error('Analyze error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}
