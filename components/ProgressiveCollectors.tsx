"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CollectionSummary, CollectorSummary } from "@/lib/types";
import { CollectorsTable } from "@/components/CollectorsTable";
import { CollectionsTable } from "@/components/CollectionsTable";
import { shortenAddress } from "@/lib/address";
import { evmNowAddressUrl } from "@/lib/evm-now";
import { formatMultiWalletTitle, formatWalletLabel } from "@/lib/wallets";
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
  input?: string;
};

type Props = {
  artist: string;
  artistEns: string | null;
  openseaUsername: string | null;
  wallets: ArtistWalletLabel[];
  collections: CollectionSummary[];
  /** Sum of per-collection owner counts from stats (not unique) */
  totalOwnersSum: number;
};

type Phase = "idle" | "running" | "paused" | "done";

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
 * One job walks holders once → unique count + full collector details / CSV.
 */
export function ProgressiveCollectors({
  artist,
  artistEns,
  openseaUsername,
  wallets,
  collections: initial,
  totalOwnersSum: initialOwnersSum,
}: Props) {
  const [customLabel, setCustomLabel] = useState<string | null>(null);
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
  const collectorsSectionRef = useRef<HTMLElement | null>(null);

  const [dialog, setDialog] = useState<{
    type: "confirm" | "prompt";
    title: string;
    message?: string;
    defaultValue?: string;
    okText?: string;
    cancelText?: string;
    resolve: (val: any) => void;
  } | null>(null);

  const confirmAction = useCallback((title: string, message?: string, okText = "OK", cancelText = "Cancel") => {
    return new Promise<boolean>((resolve) => {
      setDialog({ type: "confirm", title, message, okText, cancelText, resolve });
    });
  }, []);

  const promptAction = useCallback((title: string, defaultValue: string, okText = "OK", cancelText = "Cancel") => {
    return new Promise<string | null>((resolve) => {
      setDialog({ type: "prompt", title, defaultValue, okText, cancelText, resolve });
    });
  }, []);

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

  const uniqueCount = useMemo(() => {
    void version;
    return uniqueSetRef.current.size;
  }, [version]);

  const artistLabel = useMemo(() => {
    if (customLabel) return customLabel;
    if (wallets.length > 1) return formatMultiWalletTitle(wallets);
    return artistEns ?? openseaUsername ?? shortenAddress(artist, 6);
  }, [customLabel, artist, artistEns, openseaUsername, wallets]);

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

  const scrollToCollectors = useCallback(() => {
    collectorsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const onRemoveAddedCollection = useCallback((slug: string) => {
    const key = slug.toLowerCase();
    const target = collections.find(
      (c) =>
        c.discovery === "user_added" &&
        c.openseaSlug?.toLowerCase() === key
    );
    if (!target) return;

    if (typeof target.uniqueOwners === "number") {
      setTotalOwnersSum((sum) => Math.max(0, sum - target.uniqueOwners!));
    }
    setCollections((prev) =>
      prev.filter(
        (c) =>
          !(
            c.discovery === "user_added" &&
            c.openseaSlug?.toLowerCase() === key
          )
      )
    );
    countDoneRef.current.delete(key);
    detailDoneRef.current.delete(key);
    // Unique/detail totals may include this collection — re-run jobs to refresh
    if (uniqueSetRef.current.size > 0 || detailMapRef.current.size > 0) {
      setPhase("idle");
    }
  }, [collections]);

  /** Returns a status note for the collections table UI */
  const onAddMissedCollections = useCallback(
    async (inputRaw: string): Promise<string | null> => {
      const input = inputRaw.trim();
      if (!input || addingMissed) return null;
      if (phase === "running") {
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
      const copied = await copyImageToClipboard(dataUrl);

      const proceed = await confirmAction(
        copied ? "Image is copied" : "Image saved",
        copied ? "Paste in your post" : "Attach it to your post",
        "Post"
      );

      if (proceed) {
        openTweetIntent(
          buildTweetText({
            label: artistLabel,
            collections: total,
            owners: totalOwnersSum,
            unique: uniqueCount,
          }),
          MARKETING_URL
        );
      }
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

  const jobProgress = useMemo(() => {
    void version;
    return detailDoneRef.current.size;
  }, [version]);

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

  /**
   * Load every holder for a slug by requesting server chunks until OpenSea is done.
   * Avoids the old hard page-cap under-count on huge collections (SuperRare, big OEs).
   */
  const fetchHolders = useCallback(
    async (
      slug: string,
      onProgress?: (loaded: number, chunk: number) => void
    ): Promise<{
      holders: Array<{ address: string; quantity: number }>;
      uniqueOwners: number;
      complete: boolean;
    } | null> => {
      const all: Array<{ address: string; quantity: number }> = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      let chunk = 0;
      // ~5000 pages * 100 = 500k wallets safety (LIMITS.maxHolderPagesTotal)
      const maxChunks = 200;

      while (chunk < maxChunks && !abortRef.current) {
        chunk += 1;
        let lastError = "network error";
        let chunkOk:
          | {
              holders: Array<{ address: string; quantity: number }>;
              hasMore?: boolean;
              nextCursor?: string | null;
              truncated?: boolean;
            }
          | null = null;

        for (let attempt = 1; attempt <= 8 && !abortRef.current; attempt++) {
          try {
            const params = new URLSearchParams({ slug });
            if (cursor) params.set("cursor", cursor);
            const response = await fetch(
              `/api/artist/${encodeURIComponent(artist)}/holders?${params}`
            );

            if (response.ok) {
              chunkOk = (await response.json()) as {
                holders: Array<{ address: string; quantity: number }>;
                hasMore?: boolean;
                nextCursor?: string | null;
                truncated?: boolean;
              };
              break;
            }

            const body = await response.json().catch(() => ({}));
            lastError =
              (body as { error?: string }).error || `HTTP ${response.status}`;
            const retryable =
              response.status === 429 || response.status >= 500;
            if (!retryable || attempt === 8) break;

            const wait = Math.min(60_000, 1_500 * 2 ** (attempt - 1));
            setStatusLine(
              `${response.status === 429 ? "Rate limited" : "OpenSea error"}. Waiting ${Math.round(wait / 1000)}s… (${attempt}/8) · ${slug}`
            );
            await sleep(wait);
          } catch (e) {
            lastError = e instanceof Error ? e.message : "network error";
            if (attempt === 8) break;
            await sleep(Math.min(60_000, 1_500 * 2 ** (attempt - 1)));
          }
        }

        if (!chunkOk) {
          setErrors((prev) => [...prev.slice(-7), `${slug}: ${lastError}`]);
          // Return what we have so far only if something loaded — else null
          if (!all.length) return null;
          return {
            holders: all,
            uniqueOwners: all.length,
            complete: false,
          };
        }

        for (const h of chunkOk.holders ?? []) {
          if (seen.has(h.address)) continue;
          seen.add(h.address);
          all.push(h);
        }

        onProgress?.(all.length, chunk);

        const hasMore =
          chunkOk.hasMore === true ||
          (chunkOk.truncated === true && Boolean(chunkOk.nextCursor));
        const next = chunkOk.nextCursor ?? null;

        if (!hasMore || !next) {
          return {
            holders: all,
            uniqueOwners: all.length,
            complete: true,
          };
        }

        cursor = next;
        // Brief gap between chunks (server already paced pages inside the chunk)
        await sleep(200);
      }

      if (chunk >= maxChunks) {
        setErrors((prev) => [
          ...prev.slice(-7),
          `${slug}: hit absolute safety cap — contact if this collection is larger`,
        ]);
        return {
          holders: all,
          uniqueOwners: all.length,
          complete: false,
        };
      }

      return {
        holders: all,
        uniqueOwners: all.length,
        complete: !abortRef.current,
      };
    },
    [artist]
  );

  /**
   * One walk: unique collectors + full details (table / CSV) together.
   */
  const runCollectors = useCallback(async () => {
    if (runningRef.current) return;

    const slugged = collections.filter((c) => c.openseaSlug);
    const remaining = slugged.filter(
      (c) => !detailDoneRef.current.has(c.openseaSlug!)
    );
    const isResume =
      phase === "paused" ||
      (detailDoneRef.current.size > 0 && remaining.length > 0);

    if (!isResume) {
      const estimated =
        totalOwnersSum > 0
          ? `Estimated total owners: ${totalOwnersSum.toLocaleString("en-US")} (not unique). `
          : "";
      const ok = await confirmAction(
        "Load unique collectors + full details?",
        [
          `Collections: ${collections.length}`,
          estimated +
            "One walk builds the unique count and the full wallet list (ENS, ranking, CSV).",
          "Can take many minutes for large artists. In case it takes much longer keep the tab open and check back in some time.",
        ].join("\n\n")
      );
      if (!ok) return;
    }

    // Full re-run: wipe previous walk AFTER user confirms
    if (!isResume && (detailDoneRef.current.size > 0 || uniqueSetRef.current.size > 0)) {
      uniqueSetRef.current.clear();
      detailMapRef.current.clear();
      countDoneRef.current.clear();
      detailDoneRef.current.clear();
      ensDoneRef.current.clear();
      setVersion((v) => v + 1);
    }

    runningRef.current = true;
    abortRef.current = false;
    setPhase("running");
    setErrors([]);

    try {
      for (let i = 0; i < collections.length; i++) {
        if (abortRef.current) {
          setPhase("paused");
          setCurrentName(null);
          setStatusLine(
            `Paused · ${uniqueSetRef.current.size.toLocaleString("en-US")} unique · ${detailMapRef.current.size.toLocaleString("en-US")} rows · ${detailDoneRef.current.size}/${collections.length} collections`
          );
          return;
        }

        const col = collections[i]!;
        const slug = col.openseaSlug;
        if (!slug || detailDoneRef.current.has(slug)) continue;

        setCurrentName(col.name ?? slug);
        setStatusLine(
          `${i + 1}/${collections.length}: ${col.name ?? slug} · ${uniqueSetRef.current.size.toLocaleString("en-US")} unique · ${detailMapRef.current.size.toLocaleString("en-US")} rows`
        );

        const data = await fetchHolders(slug, (loaded) => {
          setStatusLine(
            `${i + 1}/${collections.length}: ${col.name ?? slug} · walking ${loaded.toLocaleString("en-US")} · ${uniqueSetRef.current.size.toLocaleString("en-US")} unique`
          );
        });
        if (data) {
          mergeDetail(slug, col.chainKey, data.holders ?? []);
          if (data.complete) {
            countDoneRef.current.add(slug);
            detailDoneRef.current.add(slug);
            setCollections((prev) =>
              prev.map((item) =>
                item.openseaSlug === slug
                  ? { ...item, uniqueOwners: data.uniqueOwners }
                  : item
              )
            );
          } else if (!abortRef.current) {
            setErrors((e) => [
              ...e.slice(-7),
              `${slug}: incomplete holder walk — counts may be low`,
            ]);
          }
        }

        if (i < collections.length - 1 && !abortRef.current) {
          await sleep(900);
        }
        if ((i + 1) % 3 === 0) await resolveEnsBatch();
      }

      if (abortRef.current) return;

      setPhase("done");
      setCurrentName(null);
      setStatusLine(
        `Ready · ${uniqueSetRef.current.size.toLocaleString("en-US")} unique collectors · full list available.`
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
    phase,
    resolveEnsBatch,
    totalOwnersSum,
  ]);

  function pause() {
    abortRef.current = true;
    setStatusLine("Pausing after the current request…");
  }

  const busy = phase === "running";
  const jobPct =
    total === 0 ? 100 : Math.round((jobProgress / Math.max(1, total)) * 100);
  const activePct =
    phase === "running" || phase === "paused" || phase === "done" ? jobPct : 0;

  const artistEvmUrl = evmNowAddressUrl(artist, 1);

  return (
    <div className="progressive">
      {/* Capture target: artist identity + stats */}
      <div ref={shareCardRef} className="share-card">
        {sharing && <div className="share-card__brand">collfo</div>}

        <p className="page-eyebrow share-card__eyebrow">
          {wallets.length > 1 ? `Artist · ${wallets.length} wallets` : "Artist"}
        </p>

        <h1 className="page-title share-card__title">
          {wallets.length > 1 ? (
            <>
              <span className="ens-name">
                {customLabel || formatMultiWalletTitle(wallets)}
                <button
                  data-share-ignore="true"
                  className="edit-name-btn"
                  title="Edit name for share card"
                  onClick={async () => {
                    const label = await promptAction(
                      "Edit artist name for the share card:",
                      customLabel ?? formatMultiWalletTitle(wallets)
                    );
                    if (label !== null) setCustomLabel(label.trim() || null);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
              </span>
            </>
          ) : customLabel || artistEns || openseaUsername ? (
            <>
              <span className="ens-name">
                {customLabel || artistEns || openseaUsername}
                <button
                  data-share-ignore="true"
                  className="edit-name-btn"
                  title="Edit name for share card"
                  onClick={async () => {
                    const label = await promptAction(
                      "Edit artist name for the share card:",
                      customLabel ?? artistEns ?? openseaUsername ?? ""
                    );
                    if (label !== null) setCustomLabel(label.trim() || null);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
              </span>
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
              <button
                data-share-ignore="true"
                className="edit-name-btn"
                title="Edit name for share card"
                onClick={async () => {
                  const label = await promptAction("Edit artist name for the share card:", customLabel || "");
                  if (label !== null) setCustomLabel(label.trim() || null);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
            </span>
          )}
        </h1>

        {wallets.length > 1 && (
          <ul className="wallet-list share-card__wallets">
            {wallets.map((w) => {
              const url = evmNowAddressUrl(w.address, 1);
              const nameLabel = w.ens || (w.input && !w.input.toLowerCase().startsWith("0x") ? w.input : null);
              return (
                <li key={w.address} className="wallet-list__item mono">
                  {nameLabel && (
                    <>
                      <span className="ens-name">{nameLabel}</span>
                      <span className="muted"> · </span>
                    </>
                  )}
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
            <span className="stat-cell__label">Collectors</span>
            <span className="stat-cell__value">
              {totalOwnersSum > 0 ? totalOwnersSum.toLocaleString("en-US") : "—"}
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">Unique collectors</span>
            <span className="stat-cell__value">
              {uniqueCount > 0
                ? uniqueCount.toLocaleString("en-US")
                : phase === "running"
                  ? "…"
                  : "—"}
            </span>
          </div>
        </div>

        {sharing && <p className="share-card__footer">{MARKETING_URL.replace(/^https?:\/\//, "")}</p>}
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

      {(busy || phase === "paused" || phase === "done") && (
        <div className="load-bar-wrap">
          <div className="load-bar" style={{ width: `${activePct}%` }} />
        </div>
      )}

      {/* Job actions */}
      <div className="load-actions load-actions--center" style={{ marginBottom: 16, gap: 10 }}>
        {phase === "running" ? (
          <button type="button" className="search-button" onClick={pause}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="search-button"
            disabled={busy}
            onClick={() => void runCollectors()}
          >
            {phase === "paused"
              ? "Resume"
              : jobProgress > 0 && jobProgress < total
                ? "Continue"
                : collectors.length > 0 || uniqueCount > 0
                  ? "Reload collectors"
                  : "Load collectors"}
          </button>
        )}

        <button
          type="button"
          className="search-button"
          onClick={scrollToCollections}
        >
          Browse collections
        </button>

        {collectors.length > 0 ? (
          <button
            type="button"
            className="search-button"
            onClick={scrollToCollectors}
          >
            Browse collectors
          </button>
        ) : null}
      </div>

      {phase !== "done" && collectors.length === 0 && (
        <div className="filter-meta job-note">
          <p style={{ margin: "0 0 8px 0" }}>
            To improve performance, only collection details and the total collector count are loaded initially. Click <strong>Load Collectors</strong> to fetch the unique collector count and the complete collector list.
          </p>
          <p style={{ margin: 0 }}>
            <em>Note: This may take some time, especially for artists with larger collectors base. In case it takes longer than expected keep this tab open check back in some time.</em>
          </p>
        </div>
      )}

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
        <CollectionsTable
          collections={collections}
          canAdd={phase !== "running"}
          addingMissed={addingMissed}
          onAddMissed={onAddMissedCollections}
          onRemoveAdded={
            phase !== "running" ? onRemoveAddedCollection : undefined
          }
        />
      </section>

      <section
        ref={collectorsSectionRef}
        id="collectors"
        className="collectors-section"
      >
        <h2 className="section-title">Collectors</h2>
        {collectors.length === 0 ? (
          <div className="empty-state">
            {phase === "running" || phase === "paused"
              ? "Collector rows appear as each collection finishes…"
              : (
                <>
                  Use <strong>Get collectors</strong> for the unique count and
                  full list.
                </>
              )}
          </div>
        ) : (
          <>
            <p className="filter-meta">
              {collectors.length.toLocaleString("en-US")} wallets · 100 per page
              {phase === "running" ? " · still growing" : ""}
            </p>
            <CollectorsTable
              collectors={collectors}
              pageSize={100}
              filenameBase={artistLabel}
            />
          </>
        )}
      </section>

      {dialog && (
        <div className="custom-dialog-overlay">
          <div className="custom-dialog">
            <h3 className="custom-dialog__title">{dialog.title}</h3>
            {dialog.message && (
              <p className="custom-dialog__message" style={{ whiteSpace: "pre-wrap" }}>
                {dialog.message}
              </p>
            )}
            {dialog.type === "prompt" && (
              <input
                type="text"
                className="search-input"
                style={{ width: "100%", boxSizing: "border-box", marginBottom: 16 }}
                defaultValue={dialog.defaultValue}
                id="dialog-prompt-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.currentTarget as HTMLInputElement).value;
                    dialog.resolve(val);
                    setDialog(null);
                  } else if (e.key === "Escape") {
                    dialog.resolve(null);
                    setDialog(null);
                  }
                }}
              />
            )}
            <div className="custom-dialog__actions">
              <button
                className="search-button"
                onClick={() => {
                  dialog.resolve(dialog.type === "confirm" ? false : null);
                  setDialog(null);
                }}
              >
                {dialog.cancelText || "Cancel"}
              </button>
              <button
                className="search-button"
                onClick={() => {
                  if (dialog.type === "confirm") {
                    dialog.resolve(true);
                  } else {
                    const val = (document.getElementById("dialog-prompt-input") as HTMLInputElement).value;
                    dialog.resolve(val);
                  }
                  setDialog(null);
                }}
              >
                {dialog.okText || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
