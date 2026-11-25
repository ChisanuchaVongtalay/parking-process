import { AdminAccounts } from "@/components/admin/admin-accounts";
import { PageHeading } from "@/components/admin/admin-ui";
import { db } from "@/db";
import { requireAdminPage } from "@/lib/auth/session";
import type { AdminRole } from "@/lib/auth/roles";

export default async function AccountsPage() {
  const session = await requireAdminPage("super_admin");
  const accounts = db.$client.prepare(`
    SELECT id, email, role, active, must_change_password AS mustChange FROM admin_accounts ORDER BY email
  `).all() as { id: string; email: string; role: AdminRole; active: number; mustChange: number }[];

  return <>
    <PageHeading title="Admin Management" description="เพิ่มและจัดการบัญชี Admin และ Super Admin" />
    <AdminAccounts accounts={accounts} currentId={session.id} />
  </>;
}
