import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractFields } from '@/lib/venice';

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

// POST /api/records — Create a thought record from conversation
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { name: 'User' } });
    }

    const fields = extractFields(messages || []);
    const VENICE_API_KEY = process.env.VENICE_API_KEY;

    let analysis = {
      situation: fields.situation || null,
      emotions: fields.emotions || null,
      emotionIntensity: null as number | null,
      physicalSensations: fields.physicalSensations || null,
      thoughts: fields.thoughts || null,
      behaviors: fields.behaviors || null,
      cognitiveDistortions: [] as string[],
      reframedThoughts: [] as string[],
      summary: fields.situation || 'Thought Record',
    };

    const analysisPrompt = `Analyze this CBT conversation and extract a structured thought record. Return ONLY valid JSON (no markdown, no code blocks) with these fields:
- situation: string or null
- emotions: string or null (e.g. "anxious, overwhelmed")
- emotionIntensity: number 0-100 or null
- physicalSensations: string or null
- thoughts: string or null
- behaviors: string or null
- cognitiveDistortions: string[] (from: "All-or-Nothing Thinking", "Catastrophizing", "Mind Reading", "Should Statements", "Personalization", "Overgeneralization", "Emotional Reasoning", "Mental Filtering", "Labeling", "Magnification/Minimization")
- reframedThoughts: string[]
- summary: string (one sentence)

Only fill fields that the user actually discussed. Use null for fields with no information.

Conversation:
${JSON.stringify(messages, null, 2)}`;

    try {
      const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${VENICE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google-gemma-4-31b-it',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.2, max_tokens: 800,
          venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          analysis.situation = analysis.situation || parsed.situation || null;
          analysis.emotions = analysis.emotions || parsed.emotions || null;
          analysis.emotionIntensity = parsed.emotionIntensity || null;
          analysis.physicalSensations = analysis.physicalSensations || parsed.physicalSensations || null;
          analysis.thoughts = analysis.thoughts || parsed.thoughts || null;
          analysis.behaviors = analysis.behaviors || parsed.behaviors || null;
          analysis.cognitiveDistortions = Array.isArray(parsed.cognitiveDistortions) ? parsed.cognitiveDistortions : [];
          analysis.reframedThoughts = Array.isArray(parsed.reframedThoughts) ? parsed.reframedThoughts : [];
          analysis.summary = parsed.summary || analysis.situation || 'Thought Record';
        }
      }
    } catch (err) {
      console.error('AI analysis failed, using field extraction only:', err);
    }

    const record = await prisma.thoughtRecord.create({
      data: {
        userId: user.id,
        situation: analysis.situation,
        emotions: analysis.emotions,
        emotionIntensity: analysis.emotionIntensity,
        physicalSensations: analysis.physicalSensations,
        thoughts: analysis.thoughts,
        behaviors: analysis.behaviors,
        cognitiveDistortions: JSON.stringify(analysis.cognitiveDistortions),
        reframedThoughts: JSON.stringify(analysis.reframedThoughts),
        aiAnalysis: JSON.stringify(analysis),
        summary: analysis.summary,
      },
    });

    return NextResponse.json({
      record: {
        id: record.id,
        date: record.date.toISOString(),
        situation: record.situation,
        emotions: record.emotions,
        emotionIntensity: record.emotionIntensity,
        physicalSensations: record.physicalSensations,
        thoughts: record.thoughts,
        behaviors: record.behaviors,
        cognitiveDistortions: analysis.cognitiveDistortions,
        reframedThoughts: analysis.reframedThoughts,
        summary: record.summary,
      }
    });
  } catch (error: any) {
    console.error('Create record error:', error);
    return NextResponse.json({ error: 'Failed to create record', details: error.message }, { status: 500 });
  }
}

// PATCH /api/records — Update a thought record
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'Record ID required' }, { status: 400 });

    // Only allow updating the 5 pillar fields + summary
    const allowed = ['situation', 'emotions', 'emotionIntensity', 'physicalSensations', 'thoughts', 'behaviors', 'cognitiveDistortions', 'reframedThoughts', 'summary'];
    const data: Record<string, any> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        data[key] = key === 'cognitiveDistortions' || key === 'reframedThoughts'
          ? JSON.stringify(updates[key])
          : updates[key];
      }
    }

    const record = await prisma.thoughtRecord.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      record: {
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
        summary: record.summary,
      }
    });
  } catch (error: any) {
    console.error('Update record error:', error);
    return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
  }
}

// DELETE /api/records — Delete a thought record
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Record ID required' }, { status: 400 });

    await prisma.thoughtRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete record error:', error);
    return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
  }
}