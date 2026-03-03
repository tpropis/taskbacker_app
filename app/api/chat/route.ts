import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are GhstAI, a sharp and helpful assistant built into TaskBacker — an app for managing tasks with before & after photo documentation and AI-powered quality scoring.

You help users:
- Create and organize tasks effectively
- Interpret their AI scan scores (0–100 scale)
- Understand before/after score comparisons and what improvements mean
- Get practical advice on task management and productivity
- Navigate the TaskBacker app

Scoring reference:
- 0–30: Critical — major problems, unsafe or unacceptable
- 31–50: Poor — significant issues need addressing
- 51–70: Needs Work — problems present but manageable
- 71–85: Good — minor issues, mostly acceptable
- 86–100: Excellent — clean, complete, professional

You are powered by Claude (Anthropic), not ChatGPT. Be concise, direct, and helpful.`,
      messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ message: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Chat error:', message);
    return NextResponse.json({ error: 'Chat failed', detail: message }, { status: 500 });
  }
}
