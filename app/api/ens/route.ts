import { NextResponse } from "next/server";
import { resolveEnsForAddresses } from "@/lib/collectors";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { addresses: string[] } → { ens: Record<address, name|null> } */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { addresses?: string[] };
    const addresses = Array.isArray(body.addresses) ? body.addresses : [];
    if (!addresses.length) {
      return NextResponse.json({ ens: {} });
    }
    const ens = await resolveEnsForAddresses(
      addresses,
      LIMITS.maxEnsLookups
    );
    return NextResponse.json({ ens });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ENS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
