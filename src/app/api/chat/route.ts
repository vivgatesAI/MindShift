import { NextRequest, NextResponse } from 'next/server';
import { veniceChat } from '@/lib/venice';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    const response = await veniceChat(messages, userId || 'anonymous');

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
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to get response', details: error.message },
      { status: 500 }
    );
  }
}