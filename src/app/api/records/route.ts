import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/records — List all thought records
export async function GET() {
  try {
    const records = await prisma.thoughtRecord.findMany({
      orderBy: { date: 'desc' },
      take: 100,
    });

    return NextResponse.json({ records });
  } catch (error: any) {
    console.error('Get records error:', error);
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
  }
}

// POST /api/records — Create a thought record
export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json();

    // For MVP, we'll use a default user or create one
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { name: 'User' },
      });
    }

    // Parse record from conversation using a dedicated analysis prompt
    const analysisPrompt = `Analyze this CBT conversation and extract a structured thought record. Return ONLY valid JSON with these fields:
- situation: string (what happened)
- emotions: string (emotions felt, e.g. "anxious, overwhelmed")
- emotionIntensity: number (0-100, estimated from conversation)
- physicalSensations: string (body sensations described)
- thoughts: string (the thoughts/beliefs expressed)
- behaviors: string (what the person did or avoided)
- cognitiveDistortions: string[] (list any cognitive distortions you detect, using these labels: "All-or-Nothing Thinking", "Catastrophizing", "Mind Reading", "Should Statements", "Personalization", "Overgeneralization", "Emotional Reasoning", "Mental Filtering", "Labeling", "Magnification/Minimization")
- reframedThoughts: string[] (list healthier alternative perspectives)
- summary: string (one sentence summary of the record)

If a field wasn't discussed, use null. Be empathetic but analytical.

Conversation messages:
${JSON.stringify(messages, null, 2)}`;

    const VENICE_API_KEY = process.env.VENICE_API_KEY;
    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-4-maverick',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 1000,
        venice_parameters: { include_venice_system_prompt: false },
      }),
    });

    const data = await response.json();
    let analysisText = data.choices?.[0]?.message?.content || '{}';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Save to database
    const record = await prisma.thoughtRecord.create({
      data: {
        userId: user.id,
        situation: analysis.situation,
        emotions: analysis.emotions,
        emotionIntensity: analysis.emotionIntensity,
        physicalSensations: analysis.physicalSensations,
        thoughts: analysis.thoughts,
        behaviors: analysis.behaviors,
        cognitiveDistortions: analysis.cognitiveDistortions ? JSON.stringify(analysis.cognitiveDistortions) : null,
        reframedThoughts: analysis.reframedThoughts ? JSON.stringify(analysis.reframedThoughts) : null,
        aiAnalysis: analysisText,
        summary: analysis.summary,
      },
    });

    // Format for frontend
    const formattedRecord = {
      id: record.id,
      date: record.date.toISOString(),
      situation: record.situation,
      emotions: record.emotions,
      emotionIntensity: record.emotionIntensity,
      physicalSensations: record.physicalSensations,
      thoughts: record.thoughts,
      behaviors: record.behaviors,
      cognitiveDistortions: record.cognitiveDistortions ? JSON.parse(record.cognitiveDistortions) : [],
      reframedThoughts: record.reframedThoughts ? JSON.parse(record.reframedThoughts) : [],
      aiAnalysis: record.aiAnalysis,
      summary: record.summary,
    };

    return NextResponse.json({ record: formattedRecord });
  } catch (error: any) {
    console.error('Create record error:', error);
    return NextResponse.json(
      { error: 'Failed to create record', details: error.message },
      { status: 500 }
    );
  }
}