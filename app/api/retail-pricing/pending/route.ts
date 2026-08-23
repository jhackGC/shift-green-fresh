import { resolvePendingRetailChange } from 'lib/retail-pricing/store';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Approves or rejects one pending retail price change (see lib/retail-pricing/store.ts). Approve
 * swaps in the whole proposed row (price, and any label/note changes the re-ingest made) into
 * current.json; reject discards the proposal and keeps whatever's currently live. Either way it's
 * removed from pending.json.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { id, retailerCode, action } = body as {
    id?: string;
    retailerCode?: string;
    action?: 'approve' | 'reject';
  };

  if (!id || !retailerCode || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json(
      { error: 'Expected { id, retailerCode, action: "approve" | "reject" }.' },
      { status: 400 }
    );
  }

  try {
    const updated = resolvePendingRetailChange(retailerCode, id, action);
    return NextResponse.json({ action, updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 }
    );
  }
}
