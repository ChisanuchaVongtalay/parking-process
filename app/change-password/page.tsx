import { redirect } from "next/navigation";
import { AdminCredentialsForm } from "@/components/admin/admin-credentials-form";
import { SessionTimeout } from "@/components/admin/session-timeout";
import { Button } from "@/components/ui/button";
import { getAdminSession } from "@/lib/auth/session";

export default async function ChangePassword() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  return <main className="grid min-h-screen place-items-center px-4 py-10">
    <SessionTimeout expiresAt={session.expiresAt} />
    <section className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-primary">{session.mustChangePassword ? "ตั้งรหัสผ่านก่อนเข้าใช้งาน" : "เปลี่ยนรหัสผ่าน"}</h1>
      <p className="break-all text-sm text-slate-600">{session.email}</p>
      <AdminCredentialsForm mode="password" />
      <form method="post" action="/api/auth/logout"><Button variant="outline" type="submit">ออกจากระบบ</Button></form>
    </section>
  </main>;
}
