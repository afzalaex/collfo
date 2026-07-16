"use client";

import { useEffect, useMemo, useState } from "react";
import type { CollectorSummary } from "@/lib/types";
import { shortenAddress } from "@/lib/address";

type SortKey = "collectionCount" | "tokenCount" | "address" | "ens";
type SortDir = "asc" | "desc";

type Props = {
  collectors: CollectorSummary[];
  pageSize?: number;
};

export function CollectorsTable({ collectors, pageSize = 100 }: Props) {
  const [query, setQuery] = useState("");
  const [minCollections, setMinCollections] = useState(1);
  const [hasEnsOnly, setHasEnsOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("collectionCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let rows = collectors.filter((c) => {
      if (c.collectionCount < minCollections) return false;
      if (hasEnsOnly && !c.ens) return false;
      if (!q) return true;
      return (
        c.address.toLowerCase().includes(q) ||
        (c.ens?.toLowerCase().includes(q) ?? false) ||
        c.chains.some((ch) => ch.toLowerCase().includes(q))
      );
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "collectionCount":
          cmp = a.collectionCount - b.collectionCount;
          break;
        case "tokenCount":
          cmp = a.tokenCount - b.tokenCount;
          break;
        case "address":
          cmp = a.address.localeCompare(b.address);
          break;
        case "ens":
          cmp = (a.ens ?? "").localeCompare(b.ens ?? "");
          if (!a.ens && b.ens) cmp = 1;
          if (a.ens && !b.ens) cmp = -1;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [collectors, query, minCollections, hasEnsOnly, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [query, minCollections, hasEnsOnly, sortKey, sortDir, collectors.length]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "address" || key === "ens" ? "asc" : "desc");
    }
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, filtered.length);

  return (
    <div className="collectors-panel">
      <div className="filters-bar">
        <label className="filter-field">
          <span className="filter-label">Filter</span>
          <input
            className="search-input filter-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ENS, 0x…, chain"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="filter-field">
          <span className="filter-label">Min collections</span>
          <select
            className="filter-select"
            value={minCollections}
            onChange={(e) => setMinCollections(Number(e.target.value))}
          >
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field filter-field--check">
          <span className="filter-label">ENS only</span>
          <input
            type="checkbox"
            checked={hasEnsOnly}
            onChange={(e) => setHasEnsOnly(e.target.checked)}
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
            <option value="collectionCount:desc">Collections ↓</option>
            <option value="collectionCount:asc">Collections ↑</option>
            <option value="tokenCount:desc">Tokens ↓</option>
            <option value="tokenCount:asc">Tokens ↑</option>
            <option value="ens:asc">ENS A–Z</option>
            <option value="ens:desc">ENS Z–A</option>
            <option value="address:asc">Address A–Z</option>
            <option value="address:desc">Address Z–A</option>
          </select>
        </label>

      </div>

      <div className="pager-bar">
        <p className="filter-meta" style={{ margin: 0 }}>
          {filtered.length === 0
            ? "No collectors"
            : `Showing ${from}–${to} of ${filtered.length.toLocaleString()} collectors`}
          {collectors.length !== filtered.length
            ? ` (filtered from ${collectors.length.toLocaleString()})`
            : ""}
        </p>
        <div className="pager-controls">
          <button
            type="button"
            className="pager-btn"
            disabled={safePage <= 1}
            onClick={() => setPage(1)}
          >
            « First
          </button>
          <button
            type="button"
            className="pager-btn"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹ Prev
          </button>
          <span className="pager-page">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="pager-btn"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next ›
          </button>
          <button
            type="button"
            className="pager-btn"
            disabled={safePage >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            Last »
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">No collectors match these filters.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>
                <button type="button" className="th-btn" onClick={() => toggleSort("ens")}>
                  ENS{sortMark("ens")}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="th-btn"
                  onClick={() => toggleSort("address")}
                >
                  Wallet{sortMark("address")}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="th-btn"
                  onClick={() => toggleSort("collectionCount")}
                >
                  Collections{sortMark("collectionCount")}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="th-btn"
                  onClick={() => toggleSort("tokenCount")}
                >
                  Tokens{sortMark("tokenCount")}
                </button>
              </th>
              <th>Chains</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c, i) => {
              const rank = (safePage - 1) * pageSize + i + 1;
              return (
                <tr key={c.address}>
                  <td>{rank}</td>
                  <td>
                    {c.ens ? (
                      <a
                        href={`https://app.ens.domains/${c.ens}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ens-name"
                      >
                        {c.ens}
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="mono" title={c.address}>
                    <a
                      href={`https://opensea.io/${c.address}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortenAddress(c.address, 4)}
                    </a>
                  </td>
                  <td>{c.collectionCount}</td>
                  <td>{c.tokenCount}</td>
                  <td>{c.chains.join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {filtered.length > pageSize && (
        <div className="pager-bar" style={{ marginTop: 16 }}>
          <div className="pager-controls" style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className="pager-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Prev
            </button>
            <span className="pager-page">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="pager-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
