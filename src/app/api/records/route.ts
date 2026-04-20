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

    // Get or create default user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { name: 'User' } });
    }

    // Extract fields from [FIELD: pillar|summary] markers in the conversation
    const fields = extractFields(messages || []);

    // Use AI to fill in any gaps and generate analysis
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

    // Ask AI to analyze the conversation for distortions, reframes, and any missing fields
    const analysisPrompt = `Analyze this CBT conversation and extract a structured thought record. Return ONLY valid JSON (no markdown, no code blocks) with these fields:
- situation: string or null (what happened)
- emotions: string or null (emotions felt, e.g. "anxious, overwhelmed")
- emotionIntensity: number 0-100 or null
- physicalSensations: string or null (body sensations)
- thoughts: string or null (the thoughts/beliefs expressed)
- behaviors: string or null (what the person did or avoided)
- cognitiveDistortions: string[] (labels from: "All-or-Nothing Thinking", "Catastrophizing", "Mind Reading", "Should Statements", "Personalization", "Overgeneralization", "Emotional Reasoning", "Mental Filtering", "Labeling", "Magnification/Minimization")
- reframedThoughts: string[] (healthier alternative perspectives for each distortion)
- summary: string (one sentence summary)

Only fill fields that the user actually discussed. Use null for fields with no information.

Conversation:
${JSON.stringify(messages, null, 2)}`;

    try {
      const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VENICE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google-gemma-4-31b-it',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.2,
          max_tokens: 800,
          venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Merge: use conversation-extracted fields first, fall back to AI-extracted
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
    return NextResponse.json(
      { error: 'Failed to create record', details: error.message },
      { status: 500 }
    );
  }
}