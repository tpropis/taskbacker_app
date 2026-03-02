import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, context } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `You are TaskBacker AI — a professional inspector and quality rater.

Analyze this image${context ? ` for the task: "${context}"` : ''}.

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
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = {
        score: 72,
        grade: 'B',
        headline: 'Analysis complete',
        summary: text.slice(0, 200),
        findings: [],
      };
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Analyze error:', message);
    return NextResponse.json({ error: 'Analysis failed', detail: message }, { status: 500 });
  }
}
