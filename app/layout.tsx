import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteFooter } from "@/components/SiteFooter";
import { PoweredBy } from "@/components/PoweredBy";
import { SiteNav } from "@/components/SiteNav";
import { FeedbackForm } from "@/components/FeedbackForm";
import "./globals.css";

const siteUrl = (process.env.SITE_URL?.trim() || "https://collfo.aex.design").replace(
  /\/+$/,
  ""
);

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-mono",
});

const title = "Collfo";
const description =
  "For artists minting on Ethereum and its L2s. See who holds your work across every collection you've created.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: title,
  title: {
    default: title,
    template: `%s · Collfo`,
  },
  description,
  icons: {
    icon: [{ url: "/assets/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: title,
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: title }],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/icon-512.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`theme-dark ${spaceMono.variable}`}>
      <body suppressHydrationWarning>
        <div className="site-root">
          <SiteNav />
          <main className="site-content">{children}</main>
          <div className="layout-actions">
            <a
              href="https://github.com/afzalaex/collfo"
              target="_blank"
              rel="noreferrer"
              className="layout-action-link"
            >
              Git-Repo
            </a>
            <FeedbackForm />
          </div>
          <PoweredBy />
          <SiteFooter />
        </div>
        <Analytics />
      </body>
    </html>
  );
}
