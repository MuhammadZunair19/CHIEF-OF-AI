import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Chief — AI Chief of Staff", template: "%s · Chief" },
  description:
    "Your inbox, calendar, and priorities—organized with deliberate human approval.",
  openGraph: {
    title: "Chief — AI Chief of Staff",
    description:
      "Your inbox, calendar, and priorities—organized with deliberate human approval.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Chief — AI Chief of Staff",
    description: "A private-by-design executive assistant.",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
