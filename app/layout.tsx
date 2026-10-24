import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biosecurity Autobalancer",
  description: "Live outbreak triage and inventory rebalancing dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
