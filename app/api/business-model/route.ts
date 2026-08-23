import { loadBusinessModel, saveBusinessModel } from 'lib/business-model/store';
import type { BoxMixEntry, BusinessAssumptions } from 'lib/business-model/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(loadBusinessModel());
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as { assumptions?: BusinessAssumptions; boxMix?: BoxMixEntry[] };
  if (!body.assumptions || !Array.isArray(body.boxMix)) {
    return NextResponse.json({ error: 'Expected { assumptions, boxMix }.' }, { status: 400 });
  }
  const saved = saveBusinessModel({ assumptions: body.assumptions, boxMix: body.boxMix });
  return NextResponse.json(saved);
}
