import { NextResponse } from "next/server";
import { lookupOpenSeaCollections } from "@/lib/collection-lookup";
import { parseOpenSeaCollectionInputs } from "@/lib/parse-collection-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SLUGS = 20;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      input?: string;
      slugs?: string[];
    };

    const slugs = [
      ...new Set([
        ...(Array.isArray(body.slugs) ? body.slugs : []),
        ...(typeof body.input === "string"
          ? parseOpenSeaCollectionInputs(body.input)
          : []),
      ]),
    ]
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, MAX_SLUGS);

    if (!slugs.length) {
      return NextResponse.json(
        {
          error:
            "Add OpenSea collection slug(s) or URLs (e.g. pixcapes or opensea.io/collection/pixcapes)",
        },
        { status: 400 }
      );
    }

    const results = await lookupOpenSeaCollections(slugs);
    const collections = results
      .map((r) => r.collection)
      .filter(Boolean);
    const errors = results
      .filter((r) => r.error)
      .map((r) => `${r.slug}: ${r.error}`);

    return NextResponse.json({
      collections,
      errors,
      requested: slugs.length,
      added: collections.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
