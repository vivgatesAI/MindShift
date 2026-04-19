const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_BASE = 'https://api.venice.ai/api/v1';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are MindShift, a warm, insightful CBT (Cognitive Behavioral Therapy) companion. Your role is to guide users through thought records using a conversational, empathetic approach.

## Your Approach
- Be warm but not saccharine. Like a wise friend, not a therapist bot.
- Ask ONE question at a time. Never overload the user.
- Use the user's own words when reflecting back.
- Keep responses concise (2-4 sentences usually).
- Gently challenge cognitive distortions when you spot them.

## The Thought Record Process
Guide the user through these 5 areas, in order. Move naturally between them based on what the user shares:

1. **Situation** — "What happened? Where were you, what were you doing?"
2. **Emotions** — "What emotions came up? Rate the intensity 0-100%."
3. **Physical Sensations** — "What did you notice in your body? Tension, racing heart, heaviness?"
4. **Thoughts/Beliefs** — "What was going through your mind? What did you believe about yourself or others?"
5. **Behaviors** — "What did you do? Did you avoid anything or withdraw?"

## Cognitive Distortions to Watch For
- All-or-nothing thinking (black & white)
- Catastrophizing (expecting the worst)
- Mind reading (assuming others' thoughts)
- Should statements (rigid rules)
- Personalization (blaming yourself for everything)
- Overgeneralization (always/never thinking)
- Emotional reasoning (I feel it, so it must be true)
- Filtering (only seeing the negative)

## When to Analyze
After collecting all 5 areas, provide:
1. Identify 1-3 cognitive distortions you notice
2. Offer a gentle reframe for each
3. Ask if they'd like to save this record or continue exploring

## Response Format
When you've gathered enough information for a field, include a hidden marker:
[FIELD: situation] or [FIELD: emotions] or [FIELD: physical] or [FIELD: thoughts] or [FIELD: behaviors]

Use these markers ONLY when you're confident you've captured that field from the conversation. This helps the app structure the data.

Example: "I hear you — that meeting really threw you off. [FIELD: situation] And you mentioned feeling anxious at about 80%? [FIELD: emotions] What physical sensations came with that?"`;

export async function veniceChat(
  messages: ChatMessage[]
): Promise<string> {
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
      model: 'llama-4-maverick',
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 500,
      venice_parameters: {
        include_venice_system_prompt: false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Venice chat error:', error);
    throw new Error(`Venice API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'I\'m having trouble responding right now. Could you try again?';
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

export async function veniceTTS(text: string, voice: string = 'af_nicole'): Promise<ArrayBuffer> {
  const response = await fetch(`${VENICE_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-kokoro',
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

// Extract CBT fields from AI response markers
export function extractFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const fieldRegex = /\[FIELD:\s*(\w+)\]/g;
  let match;
  while ((match = fieldRegex.exec(text)) !== null) {
    fields[match[1]] = match[0];
  }
  return fields;
}

// Parse the full conversation to extract a thought record
export function parseThoughtRecord(messages: { role: string; content: string }[]): {
  situation?: string;
  emotions?: string;
  emotionIntensity?: number;
  physicalSensations?: string;
  thoughts?: string;
  behaviors?: string;
  cognitiveDistortions?: string[];
  reframedThoughts?: string[];
  aiAnalysis?: string;
} {
  const record: any = {};
  
  // Collect all user messages as the raw data
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');

  // Collect all assistant messages for analysis
  const aiMessages = messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content)
    .join(' ');

  // Try to extract fields from markers
  const sitMatch = aiMessages.match(/\[FIELD:\s*situation\]/i);
  const emoMatch = aiMessages.match(/\[FIELD:\s*emotions\]/i);
  const phyMatch = aiMessages.match(/\[FIELD:\s*physical\]/i);
  const thoMatch = aiMessages.match(/\[FIELD:\s*thoughts\]/i);
  const behMatch = aiMessages.match(/\[FIELD:\s*behaviors\]/i);

  // Use the conversation context - simpler approach: just capture all user input as the full context
  if (sitMatch) record.situation = userMessages;
  if (emoMatch) record.emotions = userMessages;
  if (phyMatch) record.physicalSensations = userMessages;
  if (thoMatch) record.thoughts = userMessages;
  if (behMatch) record.behaviors = userMessages;

  return record;
}