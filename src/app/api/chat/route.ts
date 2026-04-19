import { NextRequest, NextResponse } from 'next/server';
import { veniceChat } from '@/lib/venice';

const VENICE_API_KEY = process.env.VENICE_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    if (!VENICE_API_KEY) {
      console.error('VENICE_API_KEY not set');
      return NextResponse.json(
        { error: 'Server configuration error: API key missing' },
        { status: 500 }
      );
    }

    const response = await veniceChat(messages);

    // Extract CBT fields from markers
    const fieldRegex = /\[FIELD:\s*(\w+)\]/gi;
    const fields: Record<string, string> = {};
    let match;
    while ((match = fieldRegex.exec(response)) !== null) {
      fields[match[1].toLowerCase()] = 'detected';
    }

    // Clean the response of markers for display
    const cleanResponse = response.replace(/\[FIELD:\s*\w+\]/gi, '').trim();

    return NextResponse.json({
      content: cleanResponse,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat API error:', message);
    return NextResponse.json(
      { error: 'Failed to get response', details: message },
      { status: 500 }
    );
  }
}