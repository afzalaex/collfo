import { NextResponse } from "next/server";
import { discoverArtist } from "@/lib/collectors";
import { parseWalletsFromPath } from "@/lib/wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ address: string }>;
};

/** Discovery only — holders load collection-by-collection via /holders */
export async function GET(_request: Request, context: RouteContext) {
  const { address } = await context.params;
  const wallets = parseWalletsFromPath(address);

  try {
    const data = await discoverArtist(wallets.length ? wallets : [address]);
    const status = data.status === "error" ? 400 : 200;
    return NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        artist: wallets[0] ?? address,
        artistEns: null,
        wallets: [],
        openseaUsername: null,
        status: "error",
        message,
        collections: [],
        notes: [],
        totalOwnersSum: 0,
      },
      { status: 500 }
    );
  }
}
