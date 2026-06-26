import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "justcoffee — meet a stranger for coffee",
  description:
    "Have an hour to kill? justcoffee pairs you with someone nearby who wants to talk about the same thing you do. Lower-stakes than a dating app. Just talk. Just coffee.",
};

export const viewport: Viewport = {
  themeColor: "#15625C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="paper-bg">{children}</body>
    </html>
  );
}
