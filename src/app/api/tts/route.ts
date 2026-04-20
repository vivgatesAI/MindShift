import { NextRequest, NextResponse } from 'next/server';
import { veniceTTS } from '@/lib/venice';

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    const audioBuffer = await veniceTTS(text, voice || 'ara');

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mp3',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'TTS failed', details: error.message },
      { status: 500 }
    );
  }
}