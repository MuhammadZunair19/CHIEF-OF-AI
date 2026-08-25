import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Morrow — Stay ahead of your day", template: "%s · Morrow" },
  description:
    "Your inbox, calendar, and priorities—organized with deliberate human approval.",
  openGraph: {
    title: "Morrow — Stay ahead of your day",
    description:
      "Your inbox, calendar, and priorities—organized with deliberate human approval.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Morrow — Stay ahead of your day",
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
