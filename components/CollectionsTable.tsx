"use client";

import { useMemo, useState } from "react";
import type { CollectionSummary } from "@/lib/types";
import { chainById } from "@/lib/chains";
import { shortenAddress } from "@/lib/address";
import { evmNowAddressUrl } from "@/lib/evm-now";

type SortKey = "name" | "holders";
type SortDir = "asc" | "desc";

type Props = {
  collections: CollectionSummary[];
  /** Lookup & merge OpenSea slugs/URLs the user pastes */
  onAddMissed?: (input: string) => Promise<string | null>;
  /** Remove a manually added collection (by OpenSea slug) */
  onRemoveCollection?: (slug: string) => void;
  addingMissed?: boolean;
  canAdd?: boolean;
};

export function CollectionsTable({
  collections,
  onAddMissed,
  onRemoveCollection,
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
        <label className="filter-field" style={{ flex: "1 1 auto" }}>
          <span className="filter-label">Search</span>
          <input
            className="search-input filter-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, contract, chain…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="filter-field" style={{ flex: "0 0 auto" }}>
          <span className="filter-label">Sort</span>
          <div className="sort-tabs">
            <button
              type="button"
              className={`sort-tab ${sortKey === "holders" ? "active" : ""}`}
              onClick={() => {
                if (sortKey === "holders") setSortDir(d => d === "asc" ? "desc" : "asc");
                else { setSortKey("holders"); setSortDir("desc"); }
              }}
            >
              Collectors {sortKey === "holders" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </button>
            <button
              type="button"
              className={`sort-tab ${sortKey === "name" ? "active" : ""}`}
              onClick={() => {
                if (sortKey === "name") setSortDir(d => d === "asc" ? "desc" : "asc");
                else { setSortKey("name"); setSortDir("asc"); }
              }}
            >
              Name {sortKey === "name" ? (sortDir === "asc" ? " A–Z" : " Z–A") : ""}
            </button>
          </div>
        </label>
      </div>

      {canAdd && onAddMissed ? (
        <div style={{ marginBottom: 16 }}>
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

      {showAdd && canAdd && onAddMissed ? (
        <div className="missed-inline">
          <p className="filter-meta" style={{ marginBottom: 8 }}>
            Collfo can miss collections. Paste Opensea collection slug(s) or URLs. If the collections is not OS standard paste contract address.
          </p>
          <div className="missed-inline__row">
            <input
              type="text"
              className="search-input filter-input missed-inline__input"
              value={missedInput}
              onChange={(e) => setMissedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitMissed();
                }
              }}
              placeholder="Slug, opensea.io/collection/slug, or 0x..."
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

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "35%" }}>Name</th>
              <th style={{ width: "10%" }}>Chain</th>
              <th style={{ width: "40%" }}>Contract</th>
              <th style={{ width: "15%" }}>Collectors</th>
              {onRemoveCollection ? <th className="th-actions" aria-label="Actions" /> : null}
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
              const canRemove = Boolean(onRemoveCollection);
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
                  <td>
                    {evmUrl ? (
                      <a
                        href={evmUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mono"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {contractLabel}
                      </a>
                    ) : (
                      <span className="mono" style={{ whiteSpace: "nowrap" }}>{contractLabel}</span>
                    )}
                  </td>
                  <td>
                    {c.estimatedOwners ?? c.uniqueOwners ?? (
                      <span title="Collectors will be updated after loading">—</span>
                    )}
                  </td>
                  {onRemoveCollection ? (
                    <td className="td-actions">
                      {canRemove ? (
                        <button
                          type="button"
                          className="row-remove-btn"
                          aria-label={`Remove ${c.name ?? (c.openseaSlug ?? c.contractAddress)}`}
                          title="Remove collection"
                          onClick={() => onRemoveCollection(c.openseaSlug ?? c.contractAddress)}
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
