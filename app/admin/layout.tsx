import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SessionTimeout } from "@/components/admin/session-timeout";
import { requireAdminPage } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/roles";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();
  return (
    <div className="admin-shell">
      <a href="#admin-content" className="admin-skip">ข้ามไปยังเนื้อหา</a>
      <SessionTimeout expiresAt={session.expiresAt} />
      <AdminNavigation role={session.role} />
      <div className="admin-main">
        <header className="admin-topbar flex-wrap gap-2">
          <div><strong>MFU Smart Parking</strong><small>Admin Console · Parking Processor</small></div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <AdminNotifications />
            <div className="min-w-0 text-right">
              <strong className="block text-sm">{roleLabel[session.role]}</strong>
              <Link href="/change-password" className="text-xs underline">เปลี่ยนรหัสผ่าน</Link>
            </div>
            <form method="post" action="/api/auth/logout">
              <Button size="sm" variant="outline" type="submit">ออกจากระบบ</Button>
            </form>
          </div>
        </header>
        <main className="admin-content" id="admin-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
