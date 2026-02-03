/**
 * Root layout component providing global configuration and styling.
 * Sets up fonts, metadata, and analytics for the entire application.
 */

import { Analytics } from "@vercel/analytics/next";
import { type Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const googleSansText = localFont({
  src: [
    {
      path: "../public/Google_Sans_Text/GoogleSansText-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Text/GoogleSansText-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/Google_Sans_Text/GoogleSansText-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Text/GoogleSansText-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/Google_Sans_Text/GoogleSansText-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Text/GoogleSansText-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-google-sans-text",
  display: "swap",
});

const googleSansCode = localFont({
  src: [
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-LightItalic.ttf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-SemiBoldItalic.ttf",
      weight: "600",
      style: "italic",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../public/Google_Sans_Code/GoogleSansCode-ExtraBoldItalic.ttf",
      weight: "800",
      style: "italic",
    },
  ],
  variable: "--font-google-sans-code",
  display: "swap",
});

/**
 * Generate metadata dynamically for the application.
 * Configures SEO, Open Graph, and Twitter card settings.
 */
export function generateMetadata(): Metadata {
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

/**
 * Root layout wrapping all pages with fonts, theme, and analytics.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${googleSansText.variable} ${googleSansCode.variable} font-sans antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
