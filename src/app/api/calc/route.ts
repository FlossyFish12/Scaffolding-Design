import { NextResponse } from 'next/server'
import { runCalc } from '@/lib/calc'
import { calculateMto } from '@/lib/calc/mto'
import { calculateDensity } from '@/lib/calc/density'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const mode = body.mode ?? 'tg20'
    if (mode === 'density') {
      const result = calculateDensity(body)
      return NextResponse.json(result)
    }
    // TG20 path
    const result = runCalc(body)
    const mto = body.includeMto !== false ? calculateMto(body as any) : null
    return NextResponse.json({ ...result, mto })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
