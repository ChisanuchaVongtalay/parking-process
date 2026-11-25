"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, Panel, Status } from "./admin-ui";
import { roleLabel, type AdminRole } from "@/lib/auth/roles";

type Account = { id: string; email: string; role: AdminRole; active: number; mustChange: number };
type AccountAction = { email: string; role: string } | { action: "update"; role: string; active: boolean } | { action: "reset" };

export function AdminAccounts({ accounts, currentId }: { accounts: Account[]; currentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [issued, setIssued] = useState<{ email: string; temporaryPassword: string } | null>(null);

  async function save(payload: AccountAction, id?: string) {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch(id ? `/api/admin/accounts/${id}` : "/api/admin/accounts", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.status === 401) {
        window.location.replace("/login?expired=1");
        return false;
      }
      if (!response.ok) throw new Error(result.error || "บันทึกข้อมูลบัญชีไม่สำเร็จ");
      if (result.data.temporaryPassword) setIssued(result.data);
      setMessage("บันทึกข้อมูลบัญชีแล้ว");
      router.refresh();
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "บันทึกข้อมูลบัญชีไม่สำเร็จ");
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (await save({ email: String(fields.get("email")), role: String(fields.get("role")) })) form.reset();
  }

  return <div className="space-y-4">
    <Panel title="เพิ่มบัญชีผู้ดูแล">
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64 space-y-2">
          <Label htmlFor="account-email">อีเมล @lamduan.mfu.ac.th</Label>
          <Input id="account-email" name="email" type="email" required maxLength={254} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-role">Role</Label>
          <select id="account-role" name="role" className="block h-10 rounded-md border bg-white px-3 text-sm">
            <option value="admin">Admin</option><option value="super_admin">Super Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={busy || Boolean(issued)}>สร้างบัญชี</Button>
      </form>
      {message && <p role={error ? "alert" : "status"} className="mt-3 text-sm">{message}</p>}
      {issued && <div className="admin-notice mt-3">
        <div className="min-w-0 space-y-2">
          <strong>รหัสผ่านชั่วคราวสำหรับ {issued.email}</strong>
          <code className="block break-all select-all">{issued.temporaryPassword}</code>
          <p>คัดลอกแล้วส่งให้เจ้าของบัญชีผ่านช่องทางส่วนตัว ระบบจะให้เปลี่ยนรหัสผ่านครั้งแรกที่เข้าสู่ระบบ</p>
          <Button variant="outline" type="button" onClick={() => setIssued(null)}>ซ่อนรหัสผ่าน</Button>
        </div>
      </div>}
    </Panel>
    <Panel title="บัญชีผู้ดูแล">
      <DataTable headings={["Email", "Role & access", "Password status"]}>
        {accounts.map((account) => <tr key={`${account.id}-${account.role}-${account.active}`}>
          <td className="break-all">{account.email}{account.id === currentId && <small>บัญชีของคุณ</small>}</td>
          <td>{account.id === currentId ? roleLabel[account.role] : <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            void save({ action: "update", role: String(fields.get("role")), active: fields.has("active") }, account.id);
          }}>
            <select name="role" aria-label={`Role ${account.email}`} defaultValue={account.role} className="h-9 rounded-md border bg-white px-2">
              <option value="admin">Admin</option><option value="super_admin">Super Admin</option>
            </select>
            <label className="flex items-center gap-1"><input name="active" type="checkbox" defaultChecked={Boolean(account.active)} /> Active</label>
            <Button type="submit" size="sm" variant="outline" disabled={busy}>บันทึก</Button>
          </form>}</td>
          <td><div className="flex flex-wrap items-center gap-2">
            <Status tone={account.mustChange ? "warn" : "good"}>{account.mustChange ? "รอเปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่านแล้ว"}</Status>
            {account.id !== currentId && <Button type="button" size="sm" variant="outline" disabled={busy || Boolean(issued)}
              onClick={() => { if (window.confirm(`รีเซ็ตรหัสผ่านและออกจากระบบทุกเซสชันของ ${account.email}?`)) void save({ action: "reset" }, account.id); }}>รีเซ็ตรหัสผ่าน</Button>}
          </div></td>
        </tr>)}
      </DataTable>
    </Panel>
  </div>;
}
