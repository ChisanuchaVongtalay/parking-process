import { AdminAccounts } from "@/components/admin/admin-accounts";
import { PageHeading } from "@/components/admin/admin-ui";
import { authRows } from "@/lib/auth/database";
import { requireAdminPage } from "@/lib/auth/session";
import type { AdminRole } from "@/lib/auth/roles";

export default async function AccountsPage() {
  const session = await requireAdminPage("super_admin");
  const accounts = await authRows<{ id: string; email: string; role: AdminRole; active: number; mustChange: number }>(`
    SELECT id, email, role, active, must_change_password AS mustChange FROM admin_accounts ORDER BY email
  `);

  return <>
    <PageHeading title="Admin Management" description="เพิ่มและจัดการบัญชี Admin และ Super Admin" />
    <AdminAccounts accounts={accounts} currentId={session.id} />
  </>;
}
