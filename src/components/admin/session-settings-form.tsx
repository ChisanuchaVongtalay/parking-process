"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SessionSettingsForm({ minutes }: { minutes: number }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionMinutes: Number(fields.get("minutes")) }),
      });
      if (response.status === 401) {
        window.location.replace("/login?expired=1");
        return;
      }
      const result = await response.json();
      setMessage(response.ok ? "บันทึกแล้ว จะใช้กับการเข้าสู่ระบบครั้งถัดไป" : result.error ?? "บันทึกไม่สำเร็จ");
    } catch {
      setMessage("ติดต่อระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={save} className="max-w-sm space-y-3">
    <Label htmlFor="session-minutes">อายุเซสชัน (นาที)</Label>
    <Input id="session-minutes" name="minutes" type="number" min={5} max={480} step={1} required defaultValue={minutes} />
    <p className="text-sm text-slate-600">นับจากเวลาเข้าสู่ระบบ เมื่อครบกำหนดทั้งสอง role ต้องเข้าสู่ระบบใหม่</p>
    <Button type="submit" disabled={busy}>บันทึกการตั้งค่า</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
