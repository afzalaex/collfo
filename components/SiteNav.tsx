import Link from "next/link";

export function SiteNav() {
  return (
    <nav aria-label="Main" className="site-navbar">
      <div className="site-navbar__content" style={{ justifyContent: "center" }}>
        <Link href="/" className="site-navbar__title group">
          <span className="logo-letter">c</span>
          <span className="nav-logo-middle">ollf</span>
          <span className="logo-letter">o</span>
        </Link>
      </div>
    </nav>
  );
}
