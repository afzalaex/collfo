import { ArtistSearch } from "@/components/ArtistSearch";

export default function HomePage() {
  return (
    <div className="page-shell page-shell--home">
      <h1 className="page-title">
        Find the total number of collectors an artist has
      </h1>
      <p className="page-lede page-lede--home">
        For artists minting on Ethereum and its L2s. See who holds your work
        across every collection you&apos;ve created.
      </p>
      <ArtistSearch />
    </div>
  );
}
