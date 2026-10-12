import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SecurityGuard from "./components/SecurityGuard";

// Oct 7 2026: the four fonts are now bundled in app/fonts (SIL Open Font
// License, see app/fonts/LICENSE-fonts.txt) instead of next/font/google.
// A clean Vercel build failed while downloading them from Google ("Cannot
// read properties of null"), so builds no longer depend on Google Fonts.
// Visitors' browsers also never contact Google for fonts now (privacy).
// Same CSS variable names and weights as before, so nothing else changed.
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

// Brand fonts from the approved CCC mockup (index/login/signup/admin/applicant)
const montserrat = localFont({
  src: "./fonts/Montserrat-Variable-latin.woff2",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
});

const openSans = localFont({
  src: "./fonts/OpenSans-Variable-latin.woff2",
  variable: "--font-open-sans",
  weight: "300 800",
  display: "swap",
});

// Oct 12 2026: link previews (Messenger, Facebook, etc.). The preview image
// is app/opengraph-image.png (1200x630); metadataBase makes its address
// absolute so shared links show it instead of the small favicon.
// Same wording as the landing page's hero text.
const SITE_DESCRIPTION =
  "Your all-in-one platform providing comprehensive application procedures, guidelines, and real-time notifications for aspiring City College of Calamba scholars.";

export const metadata: Metadata = {
  metadataBase: new URL("https://iskolusyon.dev"),
  title: "Iskolusyon | City College of Calamba",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: "https://iskolusyon.dev",
    siteName: "Iskolusyon",
    title: "Iskolusyon | City College of Calamba Scholarship Portal",
    description: SITE_DESCRIPTION,
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: "Iskolusyon | City College of Calamba Scholarship Portal",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Oct 7 2026: anti-CSRF header + inactivity sign-out (see the component). */}
        <SecurityGuard />
        {children}
      </body>
    </html>
  );
}
