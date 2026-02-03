import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/next";
import { Inter, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Generate metadata dynamically for the application.
 * This enables better SEO and can be extended to include
 * dynamic values based on environment or configuration.
 */
export async function generateMetadata(): Promise<Metadata> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://cep-hero.vercel.app";

  return {
    title: {
      default: "CEP Hero",
      template: "%s | CEP Hero",
    },
    description:
      "Chrome Enterprise Premium troubleshooting assistant. Diagnose, manage, and secure your browser fleet with AI-powered insights.",
    applicationName: "CEP Hero",
    keywords: [
      "Chrome Enterprise",
      "Chrome Enterprise Premium",
      "Browser Management",
      "Security",
      "Troubleshooting",
      "Google Workspace",
    ],
    authors: [{ name: "CEP Hero Team" }],
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: "CEP Hero",
      description:
        "Chrome Enterprise Premium troubleshooting assistant. Diagnose, manage, and secure your browser fleet.",
      type: "website",
      locale: "en_US",
      siteName: "CEP Hero",
    },
    twitter: {
      card: "summary_large_image",
      title: "CEP Hero",
      description:
        "Chrome Enterprise Premium troubleshooting assistant. Diagnose, manage, and secure your browser fleet.",
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: "/icon.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
