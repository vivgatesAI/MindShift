import { NextRequest, NextResponse } from 'next/server';
import { veniceTranscribe } from '@/lib/venice';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const text = await veniceTranscribe(audioBuffer, audioFile.name || 'recording.webm');

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: 'Transcription failed', details: error.message },
      { status: 500 }
    );
  }
}