import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MFU Smart Parking Admin",
  description: "Admin console for parking zones, CCTV calibration, and processor monitoring",
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
