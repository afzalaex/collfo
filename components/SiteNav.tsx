import Link from "next/link";

export function SiteNav() {
  return (
    <nav aria-label="Main" className="site-navbar">
      <div className="site-navbar__content" style={{ justifyContent: "center" }}>
        <Link href="/" className="site-navbar__logo-group group">
          <div className="logo-monogram">
            <img src="/assets/monogram-left.svg" alt="Collfo left" className="logo-part-left" />
            <img src="/assets/monogram-right.svg" alt="Collfo right" className="logo-part-right" />
          </div>
          <div className="logo-full-wrapper">
            <img src="/assets/full-logo.svg" alt="Collfo" className="logo-full-img" />
          </div>
        </Link>
      </div>
    </nav>
  );
}
