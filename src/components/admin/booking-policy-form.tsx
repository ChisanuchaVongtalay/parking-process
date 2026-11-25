"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Limits = { maxActive: number; maxDurationHours: number; advanceDays: number };

const roles = ["student", "staff"] as const;
const fields = [
  { key: "maxActive", name: "จำนวนจองค้างสูงสุด", min: 0, max: 100 },
  { key: "maxDurationHours", name: "ระยะเวลาจองสูงสุด (ชั่วโมง)", min: 1, max: 168 },
  { key: "advanceDays", name: "จองล่วงหน้าสูงสุด (วัน)", min: 0, max: 365 },
] as const;

export function BookingPolicyForm({ version, policy }: { version: number; policy?: Record<(typeof roles)[number], Limits> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const limits = (role: string) => Object.fromEntries(fields.map(({ key }) => [key, Number(data.get(`${role}-${key}`))]));
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/booking-policies", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: version, effectiveDate: data.get("effectiveDate"), student: limits("student"), staff: limits("staff") }),
      });
      const json = await response.json();
      setMessage(response.ok ? "เผยแพร่เวอร์ชันใหม่แล้ว" : json.error || "เผยแพร่ไม่สำเร็จ");
      if (response.ok) router.refresh();
    } catch {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={publish} className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="policy-effective">วันที่มีผล (เวลาไทย)</Label>
      <Input type="date" id="policy-effective" name="effectiveDate" required />
    </div>
    {roles.map((role) => <fieldset key={role} className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 font-semibold">{role === "student" ? "นักศึกษา" : "บุคลากร"}</legend>
      {fields.map((field) => {
        const id = `${role}-${field.key}`;
        return <div key={id} className="space-y-1">
          <Label htmlFor={id}>{field.name}</Label>
          <Input id={id} name={id} type="number" min={field.min} max={field.max} required defaultValue={policy?.[role][field.key]} />
        </div>;
      })}
    </fieldset>)}
    <Button type="submit" disabled={busy}>{busy ? "กำลังเผยแพร่…" : "เผยแพร่นโยบาย"}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
