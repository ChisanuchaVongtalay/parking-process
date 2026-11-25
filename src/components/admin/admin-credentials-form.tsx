"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminCredentialsForm({ mode }: { mode: "login" | "password" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isLogin = mode === "login";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    if (!isLogin && fields.get("confirmPassword") !== password) {
      setError("รหัสผ่านใหม่ทั้งสองช่องต้องตรงกัน");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isLogin ? { email: fields.get("email"), password } : { currentPassword: fields.get("currentPassword"), password }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (!isLogin && response.status === 401) {
          window.location.replace("/login?expired=1");
          return;
        }
        setError(result.error ?? "ดำเนินการไม่สำเร็จ");
        return;
      }
      window.location.replace(result.data.next);
    } catch {
      setError("ติดต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-4">
    {isLogin ? <div className="space-y-2">
      <Label htmlFor="email">อีเมลมหาวิทยาลัย</Label>
      <Input id="email" name="email" type="email" placeholder="name@landuan.mfu.ac.th" autoComplete="username" required maxLength={254} />
    </div> : <div className="space-y-2">
      <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
      <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} />
    </div>}
    <div className="space-y-2">
      <Label htmlFor="password">{isLogin ? "รหัสผ่าน" : "รหัสผ่านใหม่ (อย่างน้อย 12 ตัวอักษร)"}</Label>
      <Input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={isLogin ? undefined : 12} maxLength={256} />
    </div>
    {!isLogin && <div className="space-y-2">
      <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
      <Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} />
    </div>}
    {error && <p role="alert" className="text-sm text-primary">{error}</p>}
    <Button type="submit" className="w-full" disabled={busy}>{busy ? "กำลังดำเนินการ…" : isLogin ? "เข้าสู่ระบบ" : "บันทึกรหัสผ่านใหม่"}</Button>
  </form>;
}
