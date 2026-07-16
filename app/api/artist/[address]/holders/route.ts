import { NextResponse } from "next/server";
import { fetchHoldersForCollection } from "@/lib/collectors";
import { LIMITS } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** One collection can still be large (many holder pages) */
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ address: string }>;
};

/**
 * Holders for a single collection slug.
 * Query: ?slug=opepen-edition
 *
 * Loaded one collection at a time from the UI to respect OpenSea rate limits.
 */
export async function GET(request: Request, context: RouteContext) {
  // address reserved for future auth / ownership checks
  await context.params;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim();

  if (!slug) {
    return NextResponse.json({ error: "Missing ?slug=" }, { status: 400 });
  }

  try {
    const data = await fetchHoldersForCollection(slug, {
      maxPages: LIMITS.maxHolderPages,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("429") ? 429 : 500;
    return NextResponse.json({ error: message, slug }, { status });
  }
}
