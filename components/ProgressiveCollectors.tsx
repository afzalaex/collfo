"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CollectionSummary, CollectorSummary } from "@/lib/types";
import { CollectorsTable } from "@/components/CollectorsTable";
import { CollectionsTable } from "@/components/CollectionsTable";
import { shortenAddress } from "@/lib/address";
import { evmNowAddressUrl } from "@/lib/evm-now";
import {
  buildTweetText,
  captureElementPng,
  copyImageToClipboard,
  downloadDataUrl,
  MARKETING_URL,
  openTweetIntent,
  shareFilename,
} from "@/lib/share-card";

export type ArtistWalletLabel = {
  address: string;
  ens: string | null;
};

type Props = {
  artist: string;
  artistEns: string | null;
  wallets: ArtistWalletLabel[];
  collections: CollectionSummary[];
  /** Sum of per-collection owner counts from stats (not unique) */
  totalOwnersSum: number;
};

type Phase =
  | "idle"
  | "counting"
  | "counted"
  | "detailing"
  | "detailed"
  | "paused_count"
  | "paused_detail";

type DetailRow = {
  collectionCount: number;
  tokenCount: number;
  chains: Set<string>;
  collections: Set<string>;
  ens: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initial: collections + stats owner counts (fast).
 * Then two separate jobs:
 *  A) Unique collectors — Set of wallets only (number)
 *  B) Collector details — full rows + ENS + paginated table
 */
export function ProgressiveCollectors({
  artist,
  artistEns,
  wallets,
  collections: initial,
  totalOwnersSum: initialOwnersSum,
}: Props) {
  const [collections, setCollections] = useState(initial);
  const [totalOwnersSum, setTotalOwnersSum] = useState(initialOwnersSum);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const [addingMissed, setAddingMissed] = useState(false);
  const collectionsSectionRef = useRef<HTMLElement | null>(null);

  /** Unique-only pass */
  const uniqueSetRef = useRef(new Set<string>());
  const countDoneRef = useRef(new Set<string>());

  /** Full detail pass */
  const detailMapRef = useRef(new Map<string, DetailRow>());
  const detailDoneRef = useRef(new Set<string>());
  const ensDoneRef = useRef(new Set<string>());

  const abortRef = useRef(false);
  const runningRef = useRef(false);

  const total = collections.length;
  const ownersKnown = collections.filter((c) => c.uniqueOwners != null).length;

  const uniqueCount = useMemo(() => {
    void version;
    return uniqueSetRef.current.size;
  }, [version]);

  const artistLabel = useMemo(() => {
    if (wallets.length > 1) return `${wallets.length} wallets`;
    return artistEns ?? shortenAddress(artist, 6);
  }, [artist, artistEns, wallets]);

  const captureShareCard = useCallback(async () => {
    const el = shareCardRef.current;
    if (!el) throw new Error("Share card not ready");
    return captureElementPng(el);
  }, []);

  const onSaveImage = useCallback(async () => {
    setSharing(true);
    setShareNote(null);
    try {
      const dataUrl = await captureShareCard();
      downloadDataUrl(dataUrl, shareFilename(artistLabel));
      setShareNote("Image saved");
    } catch (err) {
      setShareNote(err instanceof Error ? err.message : "Could not save image");
    } finally {
      setSharing(false);
    }
  }, [artistLabel, captureShareCard]);

  const scrollToCollections = useCallback(() => {
    collectionsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  /** Returns a status note for the collections table UI */
  const onAddMissedCollections = useCallback(
    async (inputRaw: string): Promise<string | null> => {
      const input = inputRaw.trim();
      if (!input || addingMissed) return null;
      if (phase === "counting" || phase === "detailing") {
        return "Pause the current job before adding collections";
      }

      setAddingMissed(true);
      try {
        const res = await fetch("/api/collection/lookup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input }),
        });
        const data = (await res.json()) as {
          error?: string;
          collections?: CollectionSummary[];
          errors?: string[];
        };

        if (!res.ok) {
          return data.error || "Could not look up collections";
        }

        const found = data.collections ?? [];
        if (!found.length) {
          return data.errors?.length
            ? data.errors.join(" · ")
            : "No collections found";
        }

        const existing = new Set(
          collections
            .map((c) => c.openseaSlug?.toLowerCase())
            .filter(Boolean) as string[]
        );

        const fresh = found.filter((c) => {
          const slug = c.openseaSlug?.toLowerCase();
          return slug && !existing.has(slug);
        });
        const skipped = found.length - fresh.length;

        if (!fresh.length) {
          return skipped
            ? `Already listed (${skipped} duplicate${skipped === 1 ? "" : "s"})`
            : "Nothing new to add";
        }

        setCollections((prev) => [...prev, ...fresh]);
        setTotalOwnersSum(
          (sum) =>
            sum +
            fresh.reduce(
              (acc, c) =>
                acc +
                (typeof c.uniqueOwners === "number" ? c.uniqueOwners : 0),
              0
            )
        );

        if (uniqueSetRef.current.size > 0 || detailMapRef.current.size > 0) {
          setPhase("idle");
        }

        const errTail = data.errors?.length
          ? ` · ${data.errors.slice(0, 3).join(" · ")}`
          : "";
        return `Added ${fresh.length} collection${fresh.length === 1 ? "" : "s"}${
          skipped ? ` · ${skipped} already listed` : ""
        }${errTail}`;
      } catch (err) {
        return err instanceof Error ? err.message : "Add failed";
      } finally {
        setAddingMissed(false);
      }
    },
    [addingMissed, phase, collections]
  );

  const onTweet = useCallback(async () => {
    setSharing(true);
    setShareNote(null);
    try {
      const dataUrl = await captureShareCard();
      downloadDataUrl(dataUrl, shareFilename(artistLabel));
      const copied = await copyImageToClipboard(dataUrl);
      openTweetIntent(
        buildTweetText({
          label: artistLabel,
          collections: total,
          owners: totalOwnersSum,
          unique: uniqueCount,
        }),
        MARKETING_URL
      );
      setShareNote(
        copied
          ? "Image saved & copied — paste it into your tweet"
          : "Image saved — attach it to your tweet"
      );
    } catch (err) {
      setShareNote(err instanceof Error ? err.message : "Could not prepare tweet");
    } finally {
      setSharing(false);
    }
  }, [artistLabel, captureShareCard, total, totalOwnersSum, uniqueCount]);

  const collectors: CollectorSummary[] = useMemo(() => {
    void version;
    return [...detailMapRef.current.entries()]
      .map(([address, row]) => ({
        address,
        ens: row.ens,
        collectionCount: row.collectionCount,
        tokenCount: Math.round(row.tokenCount * 1000) / 1000,
        chains: [...row.chains].sort(),
        collections: [...row.collections],
      }))
      .sort((a, b) => {
        if (b.collectionCount !== a.collectionCount) {
          return b.collectionCount - a.collectionCount;
        }
        return b.tokenCount - a.tokenCount;
      });
  }, [version]);

  const countProgress = useMemo(() => {
    void version;
    return countDoneRef.current.size;
  }, [version]);

  const detailProgress = useMemo(() => {
    void version;
    return detailDoneRef.current.size;
  }, [version]);

  const mergeUnique = useCallback((holders: Array<{ address: string }>) => {
    for (const h of holders) {
      uniqueSetRef.current.add(h.address);
    }
    setVersion((v) => v + 1);
  }, []);

  const mergeDetail = useCallback(
    (
      slug: string,
      chainKey: string,
      holders: Array<{ address: string; quantity: number }>
    ) => {
      const colKey = `slug:${slug}`;
      const map = detailMapRef.current;
      for (const holder of holders) {
        let row = map.get(holder.address);
        if (!row) {
          row = {
            collectionCount: 0,
            tokenCount: 0,
            chains: new Set(),
            collections: new Set(),
            ens: null,
          };
          map.set(holder.address, row);
        }
        if (!row.collections.has(colKey)) {
          row.collectionCount += 1;
          row.collections.add(colKey);
        }
        row.tokenCount += holder.quantity;
        row.chains.add(chainKey);
        // Keep unique set in sync if they only run details
        uniqueSetRef.current.add(holder.address);
      }
      setVersion((v) => v + 1);
    },
    []
  );

  const resolveEnsBatch = useCallback(async () => {
    const map = detailMapRef.current;
    const addresses = [...map.entries()]
      .sort((a, b) => b[1].collectionCount - a[1].collectionCount)
      .map(([a]) => a)
      .filter((a) => !ensDoneRef.current.has(a))
      .slice(0, 400);
    if (!addresses.length) return;

    try {
      const res = await fetch("/api/ens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ addresses }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ens?: Record<string, string | null>;
      };
      if (!data.ens) return;
      for (const address of addresses) {
        const row = map.get(address);
        if (!row) continue;
        row.ens = data.ens[address] ?? null;
        ensDoneRef.current.add(address);
      }
      setVersion((v) => v + 1);
    } catch {
      /* optional */
    }
  }, []);

  const fetchHolders = useCallback(
    async (
      slug: string
    ): Promise<{
      holders: Array<{ address: string; quantity: number }>;
      uniqueOwners: number;
      truncated?: boolean;
    } | null> => {
      let lastError = "network error";
      for (let attempt = 1; attempt <= 8 && !abortRef.current; attempt++) {
        try {
          const response = await fetch(
            `/api/artist/${encodeURIComponent(artist)}/holders?slug=${encodeURIComponent(slug)}`
          );

          if (response.ok) {
            return (await response.json()) as {
              holders: Array<{ address: string; quantity: number }>;
              uniqueOwners: number;
              truncated?: boolean;
            };
          }

          const body = await response.json().catch(() => ({}));
          lastError =
            (body as { error?: string }).error || `HTTP ${response.status}`;
          const retryable =
            response.status === 429 || response.status >= 500;
          if (!retryable || attempt === 8) break;

          const wait = Math.min(60_000, 1_500 * 2 ** (attempt - 1));
          setStatusLine(
            `${response.status === 429 ? "Rate limited" : "OpenSea error"}. Waiting ${Math.round(wait / 1000)}s… (${attempt}/8)`
          );
          await sleep(wait);
        } catch (e) {
          lastError = e instanceof Error ? e.message : "network error";
          if (attempt === 8) break;
          await sleep(Math.min(60_000, 1_500 * 2 ** (attempt - 1)));
        }
      }
      setErrors((prev) => [...prev.slice(-7), `${slug}: ${lastError}`]);
      return null;
    },
    [artist]
  );

  /** Job A: unique count only */
  const runUniqueCount = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    abortRef.current = false;
    setPhase("counting");
    setErrors([]);

    try {
      for (let i = 0; i < collections.length; i++) {
        if (abortRef.current) {
          setPhase("paused_count");
          setCurrentName(null);
          setStatusLine(
            `Paused unique count · ${uniqueSetRef.current.size.toLocaleString()} so far · ${countDoneRef.current.size}/${collections.length} collections`
          );
          return;
        }

        const col = collections[i]!;
        const slug = col.openseaSlug;
        if (!slug || countDoneRef.current.has(slug)) continue;

        setCurrentName(col.name ?? slug);
        setStatusLine(
          `Unique count · ${i + 1}/${collections.length}: ${col.name ?? slug} · ${uniqueSetRef.current.size.toLocaleString()} wallets so far`
        );

        const data = await fetchHolders(slug);
        if (data) {
          mergeUnique(data.holders ?? []);
          countDoneRef.current.add(slug);
          if (data.truncated) {
            setErrors((e) => [
              ...e.slice(-7),
              `${slug}: partial holders (page cap) — count may be low`,
            ]);
          }
        }

        if (i < collections.length - 1 && !abortRef.current) {
          await sleep(900);
        }
      }

      if (abortRef.current) return;

      setPhase("counted");
      setCurrentName(null);
      setStatusLine(
        `Unique collectors: ${uniqueSetRef.current.size.toLocaleString()} (de-duplicated across ${countDoneRef.current.size} collections).`
      );
      setVersion((v) => v + 1);
    } finally {
      runningRef.current = false;
    }
  }, [collections, fetchHolders, mergeUnique]);

  /** Job B: full collector details */
  const runDetails = useCallback(async () => {
    if (runningRef.current) return;

    const remaining = collections.filter(
      (c) => c.openseaSlug && !detailDoneRef.current.has(c.openseaSlug)
    );
    if (!remaining.length && detailMapRef.current.size > 0) {
      setPhase("detailed");
      setStatusLine(
        `Collector details ready · ${detailMapRef.current.size.toLocaleString()} wallets.`
      );
      return;
    }

    const estimated =
      totalOwnersSum > 0
        ? `Σ owners ≈ ${totalOwnersSum.toLocaleString()} (upper bound). `
        : "";
    const ok = window.confirm(
      [
        "Load full collector details?",
        "",
        `Collections: ${collections.length}`,
        estimated + "This walks every holder and builds the full wallet list (addresses, ENS, ranking).",
        "Can take many minutes for large artists. OpenSea rate limits apply.",
        "",
        "Continue?",
      ].join("\n")
    );
    if (!ok) return;

    runningRef.current = true;
    abortRef.current = false;
    setPhase("detailing");
    setErrors([]);

    try {
      for (let i = 0; i < collections.length; i++) {
        if (abortRef.current) {
          setPhase("paused_detail");
          setCurrentName(null);
          setStatusLine(
            `Paused details · ${detailMapRef.current.size.toLocaleString()} wallets · ${detailDoneRef.current.size}/${collections.length} collections`
          );
          return;
        }

        const col = collections[i]!;
        const slug = col.openseaSlug;
        if (!slug || detailDoneRef.current.has(slug)) continue;

        setCurrentName(col.name ?? slug);
        setStatusLine(
          `Details · ${i + 1}/${collections.length}: ${col.name ?? slug} · ${detailMapRef.current.size.toLocaleString()} wallets`
        );

        const data = await fetchHolders(slug);
        if (data) {
          mergeDetail(slug, col.chainKey, data.holders ?? []);
          // Keep unique count in sync if they skipped job A
          countDoneRef.current.add(slug);
          detailDoneRef.current.add(slug);
          setCollections((prev) =>
            prev.map((item) =>
              item.openseaSlug === slug
                ? {
                    ...item,
                    uniqueOwners: data.truncated
                      ? item.uniqueOwners
                      : data.uniqueOwners,
                  }
                : item
            )
          );
          if (data.truncated) {
            setErrors((e) => [
              ...e.slice(-7),
              `${slug}: partial holders (page cap)`,
            ]);
          }
        }

        if (i < collections.length - 1 && !abortRef.current) {
          await sleep(900);
        }
        if ((i + 1) % 3 === 0) await resolveEnsBatch();
      }

      if (abortRef.current) return;

      setPhase("detailed");
      setCurrentName(null);
      setStatusLine(
        `Collector details ready · ${detailMapRef.current.size.toLocaleString()} unique wallets.`
      );
      await resolveEnsBatch();
      setVersion((v) => v + 1);
    } finally {
      runningRef.current = false;
    }
  }, [
    collections,
    fetchHolders,
    mergeDetail,
    resolveEnsBatch,
    totalOwnersSum,
  ]);

  function pause() {
    abortRef.current = true;
    setStatusLine("Pausing after the current request…");
  }

  const busy = phase === "counting" || phase === "detailing";
  const countPct =
    total === 0 ? 100 : Math.round((countProgress / Math.max(1, total)) * 100);
  const detailPct =
    total === 0 ? 100 : Math.round((detailProgress / Math.max(1, total)) * 100);
  const activePct =
    phase === "counting" || phase === "paused_count"
      ? countPct
      : phase === "detailing" || phase === "paused_detail" || phase === "detailed"
        ? detailPct
        : 0;

  const artistEvmUrl = evmNowAddressUrl(artist, 1);

  return (
    <div className="progressive">
      {/* Capture target: artist identity + stats */}
      <div ref={shareCardRef} className="share-card">
        <div className="share-card__brand">collectorfo</div>

        <p className="page-eyebrow share-card__eyebrow">
          {wallets.length > 1 ? `Artist · ${wallets.length} wallets` : "Artist"}
        </p>

        <h1 className="page-title share-card__title">
          {wallets.length > 1 ? (
            <>
              <span className="ens-name">{wallets.length} wallets</span>
              <span className="wallet-sub mono">
                {wallets
                  .map((w) => w.ens ?? shortenAddress(w.address, 4))
                  .join(" · ")}
              </span>
            </>
          ) : artistEns ? (
            <>
              <span className="ens-name">{artistEns}</span>
              <span className="wallet-sub mono">
                {artistEvmUrl ? (
                  <a
                    href={artistEvmUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open on evm.now"
                  >
                    {artist}
                  </a>
                ) : (
                  artist
                )}
              </span>
            </>
          ) : (
            <span className="mono">
              {artistEvmUrl ? (
                <a
                  href={artistEvmUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open on evm.now"
                >
                  {artist}
                </a>
              ) : (
                artist
              )}
            </span>
          )}
        </h1>

        {wallets.length > 1 && (
          <ul className="wallet-list share-card__wallets">
            {wallets.map((w) => {
              const url = evmNowAddressUrl(w.address, 1);
              return (
                <li key={w.address} className="wallet-list__item mono">
                  {w.ens ? (
                    <>
                      <span className="ens-name">{w.ens}</span>
                      <span className="muted"> · </span>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open on evm.now"
                        >
                          {w.address}
                        </a>
                      ) : (
                        w.address
                      )}
                    </>
                  ) : url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open on evm.now"
                    >
                      {w.address}
                    </a>
                  ) : (
                    w.address
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="stats-row share-card__stats">
          <div className="stat-cell">
            <span className="stat-cell__label">Collections</span>
            <span className="stat-cell__value">{total}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">Owners</span>
            <span className="stat-cell__value">
              {totalOwnersSum > 0 ? totalOwnersSum.toLocaleString() : "—"}
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">Unique collectors</span>
            <span className="stat-cell__value">
              {uniqueCount > 0
                ? uniqueCount.toLocaleString()
                : phase === "counting"
                  ? "…"
                  : "—"}
            </span>
          </div>
        </div>

        <p className="share-card__footer">{MARKETING_URL.replace(/^https?:\/\//, "")}</p>
      </div>

      <div className="share-actions">
        <button
          type="button"
          className="share-text-link"
          disabled={sharing}
          onClick={() => void onSaveImage()}
        >
          {sharing ? "Working…" : "Save image"}
        </button>
        <span className="share-actions__sep" aria-hidden>
          ·
        </span>
        <button
          type="button"
          className="share-text-link"
          disabled={sharing}
          onClick={() => void onTweet()}
        >
          Share on X
        </button>
      </div>
      {shareNote && (
        <p className="filter-meta share-note">{shareNote}</p>
      )}

      {(busy ||
        phase === "paused_count" ||
        phase === "paused_detail" ||
        phase === "counted" ||
        phase === "detailed") && (
        <div className="load-bar-wrap">
          <div className="load-bar" style={{ width: `${activePct}%` }} />
        </div>
      )}

      {/* Job actions — buttons only */}
      <div className="load-actions load-actions--center" style={{ marginBottom: 16, gap: 10 }}>
        {phase === "counting" || phase === "detailing" ? (
          <button type="button" className="search-button" onClick={pause}>
            Pause
          </button>
        ) : null}

        {phase === "paused_count" ? (
          <button
            type="button"
            className="search-button"
            onClick={() => void runUniqueCount()}
          >
            Resume unique count
          </button>
        ) : phase !== "counting" && phase !== "detailing" ? (
          <button
            type="button"
            className="search-button"
            disabled={busy}
            onClick={() => void runUniqueCount()}
          >
            {countProgress > 0 && countProgress < total
              ? "Continue unique count"
              : uniqueCount > 0
                ? "Recalculate unique"
                : "Calculate unique collectors"}
          </button>
        ) : null}

        {phase === "paused_detail" ? (
          <button
            type="button"
            className="search-button"
            onClick={() => void runDetails()}
          >
            Resume details
          </button>
        ) : phase !== "counting" && phase !== "detailing" ? (
          <button
            type="button"
            className="search-button"
            disabled={busy}
            onClick={() => void runDetails()}
          >
            {detailProgress > 0 && detailProgress < total
              ? "Continue details"
              : collectors.length > 0
                ? "Reload collector details"
                : "Get collector details"}
          </button>
        ) : null}

        <button
          type="button"
          className="search-button"
          onClick={scrollToCollections}
        >
          Browse collections
        </button>
      </div>

      <p className="filter-meta job-note">
        To save you time, unique collectors and collector details aren&apos;t
        calculated on the initial load — you can run them now. Note: if you have
        a large audience, collector details can take longer.
      </p>

      {(statusLine || (currentName && busy)) && (
        <p className="filter-meta" style={{ marginBottom: 20 }}>
          {statusLine}
          {currentName && busy ? (
            <span className="muted"> · {currentName}</span>
          ) : null}
        </p>
      )}

      {errors.length > 0 && (
        <div className="empty-state" style={{ marginBottom: 16 }}>
          {errors.slice(-4).map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}

      <section
        ref={collectionsSectionRef}
        id="collections"
        className="collections-section"
      >
        <h2 className="section-title">Created collections</h2>
        <p className="filter-meta">
          {ownersKnown}/{total} with OpenSea owner counts
          {totalOwnersSum > 0
            ? ` · Σ ${totalOwnersSum.toLocaleString()} (not unique)`
            : ""}
        </p>
        <CollectionsTable
          collections={collections}
          canAdd={phase !== "counting" && phase !== "detailing"}
          addingMissed={addingMissed}
          onAddMissed={onAddMissedCollections}
        />
      </section>

      <h2 className="section-title">Collectors</h2>
      {collectors.length === 0 ? (
        <div className="empty-state">
          {phase === "detailing" || phase === "paused_detail" ? (
            "Detail rows appear as each collection finishes…"
          ) : uniqueCount > 0 ? (
            <>
              Unique total is <strong>{uniqueCount.toLocaleString()}</strong>.
              Run <strong>Get collector details</strong> for the full wallet
              table (ENS, ranking, export-friendly list).
            </>
          ) : (
            <>
              Initial results are collections + owner counts only. Use{" "}
              <strong>Calculate unique collectors</strong> for the number, or{" "}
              <strong>Get collector details</strong> for the full list.
            </>
          )}
        </div>
      ) : (
        <>
          <p className="filter-meta">
            {collectors.length.toLocaleString()} wallets · 100 per page
            {phase === "detailing" ? " · still growing" : ""}
          </p>
          <CollectorsTable collectors={collectors} pageSize={100} />
        </>
      )}
    </div>
  );
}
