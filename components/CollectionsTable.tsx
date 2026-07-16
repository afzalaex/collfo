"use client";

import { useMemo, useState } from "react";
import type { CollectionSummary } from "@/lib/types";
import { chainById } from "@/lib/chains";
import { shortenAddress } from "@/lib/address";
import { evmNowAddressUrl } from "@/lib/evm-now";

type SortKey = "name" | "holders" | "chain";
type SortDir = "asc" | "desc";

type Props = {
  collections: CollectionSummary[];
  /** Lookup & merge OpenSea slugs/URLs the user pastes */
  onAddMissed?: (input: string) => Promise<string | null>;
  addingMissed?: boolean;
  canAdd?: boolean;
};

export function CollectionsTable({
  collections,
  onAddMissed,
  addingMissed = false,
  canAdd = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("holders");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAdd, setShowAdd] = useState(false);
  const [missedInput, setMissedInput] = useState("");
  const [missedNote, setMissedNote] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = collections.filter((c) => {
      if (!q) return true;
      return (
        (c.name?.toLowerCase().includes(q) ?? false) ||
        (c.openseaSlug?.toLowerCase().includes(q) ?? false) ||
        c.chainKey.toLowerCase().includes(q) ||
        c.contractAddress.toLowerCase().includes(q)
      );
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = (a.name ?? "").localeCompare(b.name ?? "");
      } else if (sortKey === "holders") {
        cmp = (a.uniqueOwners ?? 0) - (b.uniqueOwners ?? 0);
      } else {
        cmp = a.chainKey.localeCompare(b.chainKey);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [collections, query, sortKey, sortDir]);

  async function submitMissed() {
    if (!onAddMissed || !missedInput.trim() || addingMissed) return;
    setMissedNote(null);
    const note = await onAddMissed(missedInput);
    if (note) setMissedNote(note);
    // Parent returns null-ish success with note that includes "Added" — clear input on success
    if (note?.startsWith("Added")) {
      setMissedInput("");
    }
  }

  return (
    <div className="collectors-panel" id="collections-table">
      <div className="filters-bar">
        <label className="filter-field">
          <span className="filter-label">Filter</span>
          <input
            className="search-input filter-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, slug, chain…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="filter-field">
          <span className="filter-label">Sort</span>
          <select
            className="filter-select"
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
              setSortKey(k);
              setSortDir(d);
            }}
          >
            <option value="holders:desc">Holders ↓</option>
            <option value="holders:asc">Holders ↑</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="chain:asc">Chain A–Z</option>
          </select>
        </label>
        {canAdd && onAddMissed ? (
          <div className="filter-field filter-field--action">
            <span className="filter-label">Options</span>
            <button
              type="button"
              className="filter-action-btn"
              disabled={addingMissed}
              onClick={() => {
                setShowAdd((v) => !v);
                setMissedNote(null);
              }}
            >
              {showAdd ? "Hide add form" : "Add missed collection(s)"}
            </button>
          </div>
        ) : null}
      </div>

      {showAdd && canAdd && onAddMissed ? (
        <div className="missed-inline">
          <p className="filter-meta" style={{ marginBottom: 8 }}>
            OpenSea can miss collections. Paste slug(s) or collection URLs.
          </p>
          <div className="missed-inline__row">
            <input
              className="search-input filter-input missed-inline__input"
              value={missedInput}
              onChange={(e) => setMissedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitMissed();
                }
              }}
              placeholder="slug or opensea.io/collection/…"
              autoComplete="off"
              spellCheck={false}
              disabled={addingMissed}
            />
            <button
              type="button"
              className="search-button"
              disabled={addingMissed || !missedInput.trim()}
              onClick={() => void submitMissed()}
            >
              {addingMissed ? "Adding…" : "Add"}
            </button>
          </div>
          {missedNote && (
            <p className="filter-meta" style={{ marginTop: 8 }}>
              {missedNote}
            </p>
          )}
        </div>
      ) : null}

      <p className="filter-meta">
        Showing {filtered.length} of {collections.length}
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Chain</th>
            <th>Contract</th>
            <th>Holders</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => {
            const chain = chainById(c.chainId) ?? null;
            const chainLabel =
              chain?.shortName ??
              (c.chainKey && c.chainKey !== "unknown" ? c.chainKey : "—");
            const contractLabel = c.contractAddress.startsWith("opensea:")
              ? c.openseaSlug ?? c.contractAddress
              : shortenAddress(c.contractAddress, 4);
            const evmUrl = evmNowAddressUrl(c.contractAddress, c.chainId);
            return (
              <tr key={`${c.openseaSlug ?? c.contractAddress}-${c.chainKey}`}>
                <td>
                  {c.openseaSlug ? (
                    <a
                      href={`https://opensea.io/collection/${c.openseaSlug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {c.name ?? c.openseaSlug}
                    </a>
                  ) : (
                    c.name ?? "—"
                  )}
                  {c.discovery === "user_added" ? (
                    <span className="muted" title="Added manually">
                      {" "}
                      · added
                    </span>
                  ) : null}
                </td>
                <td>{chainLabel}</td>
                <td className="mono" title={c.contractAddress}>
                  {evmUrl ? (
                    <a
                      href={evmUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open on evm.now (${chainLabel})`}
                    >
                      {contractLabel}
                    </a>
                  ) : (
                    contractLabel
                  )}
                </td>
                <td>{c.uniqueOwners ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
