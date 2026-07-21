export default function Loading() {
  return (
    <div className="page-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "10vh" }}>
      <div className="share-card-wrapper" style={{ width: "100%", maxWidth: 600 }}>
        <div className="share-card" style={{ minHeight: 250, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <h1 className="page-title share-card__title" style={{ opacity: 0.6, fontSize: "clamp(1.4rem, 4vw, 2rem)" }}>
            Loading artist data...
          </h1>
          
          <div className="empty-state" style={{ marginTop: 24, border: "none", opacity: 0.8, padding: 0 }}>
            <p style={{ margin: "0 0 8px 0" }}>
              Locating collections across Ethereum and L2s.
            </p>
            <p className="filter-meta" style={{ margin: 0 }}>
              This can take a few seconds if the artist has significant on-chain history.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
