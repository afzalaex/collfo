import type { Metadata } from "next";
import { discoverArtist } from "@/lib/collectors";
import { shortenAddress } from "@/lib/address";
import { parseWalletsFromPath } from "@/lib/wallets";
import { ArtistSearch } from "@/components/ArtistSearch";
import { ProgressiveCollectors } from "@/components/ProgressiveCollectors";

type PageProps = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  const wallets = parseWalletsFromPath(address);
  const label =
    wallets.length > 1
      ? `${wallets.length} wallets`
      : wallets[0]?.endsWith(".eth")
        ? wallets[0]
        : shortenAddress(wallets[0] ?? address, 6);
  return {
    title: `Collectors · ${label}`,
    description: `Collectors across created collections for ${wallets.join(", ")}`,
  };
}

export default async function ArtistPage({ params }: PageProps) {
  const { address } = await params;
  const wallets = parseWalletsFromPath(address);
  const data = await discoverArtist(wallets.length ? wallets : [address]);

  return (
    <div className="page-shell">
      {data.collections.length === 0 ? (
        <>
          <p className="page-eyebrow">
            {data.wallets.length > 1
              ? `Artist · ${data.wallets.length} wallets`
              : "Artist"}
          </p>
          <h1 className="page-title" style={{ fontSize: "clamp(1.4rem, 4vw, 2rem)" }}>
            {data.wallets.length > 1 ? (
              <>
                <span className="ens-name">{data.wallets.length} wallets</span>
                <span className="wallet-sub mono">
                  {data.wallets
                    .map((w) => w.ens ?? shortenAddress(w.address, 4))
                    .join(" · ")}
                </span>
              </>
            ) : data.artistEns || data.openseaUsername ? (
              <>
                <span className="ens-name">{data.artistEns || data.openseaUsername}</span>
                <span className="wallet-sub mono">{data.artist}</span>
              </>
            ) : (
              <span className="mono">{data.artist}</span>
            )}
          </h1>
          <div className="empty-state">
            No created collections found for this artist on OpenSea.
          </div>
        </>
      ) : (
        <ProgressiveCollectors
          artist={data.artist}
          artistEns={data.artistEns}
          openseaUsername={data.openseaUsername}
          wallets={data.wallets}
          collections={data.collections}
          totalOwnersSum={data.totalOwnersSum}
        />
      )}

      <div style={{ marginTop: 48 }}>
        <ArtistSearch
          initial={data.wallets.map((w) => w.ens ?? w.address)}
        />
      </div>
    </div>
  );
}
