import Link from "next/link";

export function SiteNav() {
  return (
    <nav aria-label="Main" className="site-navbar">
      <div className="site-navbar__content" style={{ justifyContent: "center" }}>
        <Link href="/" className="site-navbar__title">
          collfo
        </Link>
      </div>
    </nav>
  );
}
