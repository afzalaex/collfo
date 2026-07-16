import Link from "next/link";

export function SiteNav() {
  return (
    <nav aria-label="Main" className="site-navbar">
      <div className="site-navbar__content">
        <a
          href="https://aex.design"
          className="site-navbar__logo"
          target="_blank"
          rel="noreferrer"
        >
          <img src="/assets/logo.svg" alt="Aex Designs" width={80} height={28} />
        </a>
        <Link href="/" className="site-navbar__title">
          collectorfo
        </Link>
      </div>
    </nav>
  );
}
