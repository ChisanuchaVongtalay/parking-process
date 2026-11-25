import { redirect } from "next/navigation";
import { AdminCredentialsForm } from "@/components/admin/admin-credentials-form";
import { getAdminSession } from "@/lib/auth/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string; changed?: string }> }) {
  const session = await getAdminSession();
  if (session) redirect(session.mustChangePassword ? "/change-password" : "/admin");
  const { expired, changed } = await searchParams;

  return <main className="grid min-h-screen place-items-center bg-[#faf9f6] px-4 py-10">
    <section className="w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="bg-primary p-7 text-white">
        <p className="text-sm text-[#f3d18c]">Mae Fah Luang University</p>
        <h1 className="mt-1 text-2xl font-bold">MFU Smart Parking</h1>
        <p className="mt-2 text-sm">เข้าสู่ระบบ Admin Console</p>
      </header>
      <div className="space-y-4 p-7">
        {expired === "1" && <p role="status" className="rounded-lg bg-[#fff3d8] p-3 text-sm">เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่</p>}
        {changed === "1" && <p role="status" className="rounded-lg bg-[#e7f6ed] p-3 text-sm">บันทึกรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่</p>}
        <AdminCredentialsForm mode="login" />
      </div>
    </section>
  </main>;
}
