"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  encodeWalletsForPath,
  looksLikeWalletOrEns,
  splitWalletQuery,
} from "@/lib/wallets";

type Props = {
  /** Single string or list of wallets / ENS */
  initial?: string | string[];
};

export function ArtistSearch({ initial = "" }: Props) {
  const router = useRouter();
  const initialList = Array.isArray(initial)
    ? initial
    : initial
      ? splitWalletQuery(initial)
      : [];

  const [wallets, setWallets] = useState<string[]>(initialList);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addWallet(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (!looksLikeWalletOrEns(t)) {
      setError("Use a 0x address, ENS, or OS username");
      return;
    }
    const key = t.toLowerCase();
    if (wallets.some((w) => w.toLowerCase() === key)) {
      setError("Already added");
      return;
    }
    if (wallets.length >= 10) {
      setError("Max 10 wallets");
      return;
    }
    setWallets((prev) => [...prev, t]);
    setDraft("");
    setError(null);
  }

  function removeWallet(index: number) {
    setWallets((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (draft.trim()) {
        addWallet(draft);
      } else if (wallets.length > 0) {
        // Enter with empty draft + chips → search
        submitSearch();
      }
      return;
    }
    if (e.key === "Backspace" && !draft && wallets.length > 0) {
      e.preventDefault();
      removeWallet(wallets.length - 1);
    }
    // Also allow comma as separator without waiting for Enter
    if (e.key === ",") {
      e.preventDefault();
      if (draft.trim()) addWallet(draft.replace(/,/g, ""));
    }
  }

  function submitSearch() {
    const list = [...wallets];
    if (draft.trim()) {
      if (!looksLikeWalletOrEns(draft.trim())) {
        setError("Use a 0x address, ENS, or OS username");
        return;
      }
      if (!list.some((w) => w.toLowerCase() === draft.trim().toLowerCase())) {
        list.push(draft.trim());
      }
    }
    if (!list.length) {
      setError("Add at least one wallet, ENS, or OS username");
      return;
    }
    setPending(true);
    setError(null);
    router.push(`/artist/${encodeWalletsForPath(list)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submitSearch();
  }

  return (
    <form className="search-form" onSubmit={onSubmit}>
      <label className="search-label" htmlFor="artist-address">
        Artist wallet(s), ENS, or OS username
      </label>

      <div className="wallet-chip-field">
        {wallets.map((w, i) => (
          <span key={`${w}-${i}`} className="wallet-chip">
            <span className="wallet-chip__text">{w}</span>
            <button
              type="button"
              className="wallet-chip__x"
              aria-label={`Remove ${w}`}
              onClick={() => removeWallet(i)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="artist-address"
          className="wallet-chip-input"
          name="address"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            wallets.length
              ? "Add another · Enter"
              : "0x…, ENS, or OS username · Enter to add more"
          }
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="search-row">
        <button
          className="search-button"
          type="submit"
          disabled={pending || (wallets.length === 0 && !draft.trim())}
        >
          {pending
            ? "Loading…"
            : wallets.length > 1
              ? `Search ${wallets.length} wallets`
              : "Find collectors"}
        </button>
      </div>

      {error && <p className="search-error">{error}</p>}

      <p className="search-hint">
        Multi-wallet: type a wallet, ENS, or OpenSea username, press <strong>Enter</strong> to add
        another (comma works too), then search. Collections from all wallets are
        merged. Max 10.
      </p>
    </form>
  );
}
