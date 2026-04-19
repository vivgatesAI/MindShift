import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ totalRecords: 0, thisWeek: 0, streak: 0, topDistortions: [] });
    }

    const userId = user.id;
    const totalRecords = await prisma.thoughtRecord.count({
      where: { userId },
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = await prisma.thoughtRecord.count({
      where: { userId, date: { gte: weekAgo } },
    });

    // Calculate streak
    const records = await prisma.thoughtRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    let streak = 0;
    if (records.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daySet = new Set<number>();
      for (const r of records) {
        const d = new Date(r.date);
        d.setHours(0, 0, 0, 0);
        daySet.add(d.getTime());
      }
      const uniqueDays = Array.from(daySet).sort((a: number, b: number) => b - a);

      for (let i = 0; i < uniqueDays.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        if (uniqueDays[i] === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }
    }

    // Get most common distortions
    const recentRecords = await prisma.thoughtRecord.findMany({
      where: { userId, cognitiveDistortions: { not: null } },
      orderBy: { date: 'desc' },
      take: 20,
      select: { cognitiveDistortions: true },
    });

    const distortionCounts: Record<string, number> = {};
    for (const r of recentRecords) {
      try {
        const distortions: string[] = JSON.parse(r.cognitiveDistortions || '[]');
        for (const d of distortions) {
          distortionCounts[d] = (distortionCounts[d] || 0) + 1;
        }
      } catch {
        // skip malformed entries
      }
    }

    const topDistortions = Object.entries(distortionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      totalRecords,
      thisWeek,
      streak,
      topDistortions,
    });
  } catch (error: unknown) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}