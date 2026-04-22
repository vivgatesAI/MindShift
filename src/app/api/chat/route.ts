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

    if (!response || response.trim().length === 0) {
      return NextResponse.json({
        content: "I'm here. Could you say that again? Sometimes I need a second try.",
      });
    }

    // Clean the response of field markers for display
    const cleanResponse = response.replace(/\[FIELD:[^\]]+\]/gi, '').trim();

    return NextResponse.json({
      content: cleanResponse || "I'm here. Could you say that again?",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat API error:', message);
    
    // Return user-friendly error message
    const userMessage = message.includes('wait') || message.includes('unavailable') 
      ? message 
      : 'Unable to process your message right now. Please try again.';
    
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}