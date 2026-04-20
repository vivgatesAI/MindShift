const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_BASE = 'https://api.venice.ai/api/v1';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are MindShift, a warm, insightful CBT (Cognitive Behavioral Therapy) companion. You guide users through the 5 pillars of a thought record via natural conversation.

## Your Approach
- Be warm but not saccharine. Like a wise friend, not a therapist bot.
- Ask ONE question at a time. Never overload the user.
- Use the user's own words when reflecting back.
- Keep responses concise (2-4 sentences usually).
- Gently challenge cognitive distortions when you spot them.

## The 5 Pillars (Guide through ALL of these)
You must systematically cover every pillar. Only move past a pillar once you have a clear answer. Keep circling back if needed.

1. **Situation** — What happened? Where were you, what were you doing?
2. **Emotions** — What emotions came up? Name them specifically and rate intensity 0-100%.
3. **Physical Sensations** — What did you notice in your body? Tension, racing heart, heaviness, shallow breathing?
4. **Thoughts** — What was going through your mind? What did you believe about yourself, others, or the situation?
5. **Behaviors** — What did you do? Did you avoid anything, withdraw, or act on impulse?

## Cognitive Distortions to Watch For
- All-or-nothing thinking, Catastrophizing, Mind reading, Should statements
- Personalization, Overgeneralization, Emotional reasoning
- Mental filtering, Labeling, Magnification/Minimization

## When All 5 Pillars Are Collected
1. Identify 1-3 cognitive distortions you notice
2. Offer a gentle reframe for each
3. Suggest saving the record

## CRITICAL: Response Format
After the user answers a pillar question, include a hidden extraction marker on its own line. The marker MUST contain a brief summary of what the user said for that pillar:

[FIELD: situation|The user described...]
[FIELD: emotions|Anxious 80%, overwhelmed 60%]
[FIELD: physical|Tension in shoulders, racing heart]
[FIELD: thoughts|"I'm not good enough" and "Everyone will judge me"]
[FIELD: behaviors|Withdrew from the conversation, avoided follow-up]

These markers let us save structured data. ALWAYS include a brief summary after the pipe character. Example:

"I hear you — that meeting really threw you off."
[FIELD: situation|Had a stressful team meeting where the manager criticized the user's proposal]
"And you mentioned feeling anxious at about 80%?"
[FIELD: emotions|Anxious 80%, embarrassed 60%]

DO NOT include these markers if the user hasn't provided a real answer for that pillar yet.`;

export async function veniceChat(messages: ChatMessage[]): Promise<string> {
  const allMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  const response = await fetch(`${VENICE_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google-gemma-4-31b-it',
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 500,
      venice_parameters: {
        include_venice_system_prompt: false,
        strip_thinking_response: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Venice chat error:', response.status, errorText);
    throw new Error(`Venice API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I'm having trouble responding right now. Could you try again?";
}

export async function veniceTranscribe(audioBuffer: Buffer, filename: string = 'recording.webm'): Promise<string> {
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(audioBuffer)]), filename);
  formData.append('model', 'openai/whisper-large-v3');

  const response = await fetch(`${VENICE_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Venice transcription error:', error);
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}

export async function veniceTTS(text: string, voice: string = 'ara'): Promise<ArrayBuffer> {
  const response = await fetch(`${VENICE_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-xai-v1',
      input: text,
      voice: voice,
      response_format: 'mp3',
      speed: 1.0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Venice TTS error:', error);
    throw new Error(`TTS failed: ${response.status}`);
  }

  return response.arrayBuffer();
}

// Extract structured thought record from conversation messages
export function extractFields(messages: { role: string; content: string }[]): {
  situation?: string;
  emotions?: string;
  physicalSensations?: string;
  thoughts?: string;
  behaviors?: string;
} {
  const fields: Record<string, string> = {};
  const allText = messages.map(m => m.content).join('\n');

  // Match [FIELD: pillar|summary] markers from both user and assistant messages
  const fieldRegex = /\[FIELD:\s*(situation|emotions|physical|thoughts|behaviors)\s*\|\s*([^\]]+)\]/gi;
  let match;
  while ((match = fieldRegex.exec(allText)) !== null) {
    const pillar = match[1].toLowerCase();
    const summary = match[2].trim();
    if (pillar === 'physical') {
      fields['physicalSensations'] = summary;
    } else {
      fields[pillar] = summary;
    }
  }

  return {
    situation: fields.situation,
    emotions: fields.emotions,
    physicalSensations: fields.physicalSensations,
    thoughts: fields.thoughts,
    behaviors: fields.behaviors,
  };
}