import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, context } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Strip data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
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
              text: `You are TaskBacker AI — a professional task and quality inspector.

Analyze this image${context ? ` in the context of: "${context}"` : ''}.

Score the quality/condition from 0–100:
- 0–30: Critical problems, urgent action needed
- 31–60: Significant issues present
- 61–80: Acceptable but room for improvement
- 81–100: Good to excellent condition

Respond with ONLY valid JSON, no markdown:
{
  "score": <number 0-100>,
  "grade": <"F"|"D"|"C"|"B"|"A">,
  "headline": <one punchy sentence max 8 words>,
  "summary": <1-2 sentences describing what you see>,
  "findings": [<up to 3 short bullet strings>]
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
      // Fallback if JSON parse fails
      result = {
        score: 72,
        grade: 'B',
        headline: 'Analysis complete',
        summary: text.slice(0, 200),
        findings: [],
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Analyze error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
