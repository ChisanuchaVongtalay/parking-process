import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MFU Smart Parking Admin",
  description: "Calibration dashboard for parking camera configuration",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
