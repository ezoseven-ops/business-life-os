import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCleanup } from '@/lib/session-cleanup'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    // Opportunistic session cleanup (throttled, won't run more than once/min)
    const cleaned = await runCleanup()

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      sessionsCleanedUp: cleaned,
    })
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Database unreachable' },
      { status: 503 },
    )
  }
}
