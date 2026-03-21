export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json({ sessionNumber: settings?.sessionNumber ?? 1 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { sessionNumber } = body;

  if (
    typeof sessionNumber !== 'number' ||
    !Number.isInteger(sessionNumber) ||
    sessionNumber < 1 ||
    sessionNumber > 10
  ) {
    return NextResponse.json(
      { error: 'sessionNumber must be an integer between 1 and 10' },
      { status: 400 }
    );
  }

  const updated = await prisma.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, sessionNumber },
    update: { sessionNumber },
  });

  return NextResponse.json({ sessionNumber: updated.sessionNumber });
}
