import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-primary">MFU Smart Parking</h1>
            <p className="text-sm text-slate-600">Admin Calibration Dashboard</p>
          </div>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/admin/zones" className="text-tertiary hover:underline">
              Zones
            </Link>
            <Link href="/admin/cameras" className="text-tertiary hover:underline">
              Cameras
            </Link>
            <Link href="/admin/monitor" className="text-tertiary hover:underline">
              Monitor
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
