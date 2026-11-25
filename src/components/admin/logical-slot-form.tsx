"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LogicalSlotForm({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/zones/${encodeURIComponent(zoneId)}/slots`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "เพิ่มช่องจอดไม่สำเร็จ");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={save} className="mb-3">
    <div className="admin-actions items-center">
      <Input name="code" aria-label="รหัสช่องจอด" placeholder="รหัสช่องจอด" maxLength={64} required className="w-40" />
      <select name="vehicleType" aria-label="ประเภทช่องจอด" className="h-10 rounded-md border bg-white px-2">
        <option value="car">รถยนต์</option><option value="motorcycle">มอเตอร์ไซค์</option>
      </select>
      <Button type="submit" disabled={busy}>เพิ่มช่องจอด</Button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-primary">{error}</p>}
  </form>;
}
