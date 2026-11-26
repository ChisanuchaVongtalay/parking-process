"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Review } from "@/services/vehicle-reviews";

const vehicleTypes = ["Sedan", "Hatchback", "SUV", "Pickup", "Van", "Motorcycle", "Other"];

export function VehicleAdminActions({ vehicle }: { vehicle: Pick<Review, "id" | "version" | "plate" | "province" | "brand" | "vehicleType"> }) {
  const router = useRouter();
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/vehicle-reviews/${encodeURIComponent(vehicle.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: mode, version: vehicle.version, changes: fields }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setMessage(result?.error || "บันทึกข้อมูลรถไม่สำเร็จ");
        return;
      }
      if (mode === "delete") router.replace("/admin/vehicle-approvals");
      else router.refresh();
      setMode(null);
    } catch {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3">
    {!mode && <div className="admin-actions">
      <Button type="button" variant="outline" onClick={() => setMode("edit")}>แก้ไขข้อมูลรถ</Button>
      <Button type="button" variant="outline" onClick={() => setMode("delete")}>ลบรถ</Button>
    </div>}
    {mode && <form onSubmit={submit} className="space-y-3">
      {mode === "edit" ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>ทะเบียน<Input name="plate" required maxLength={32} defaultValue={vehicle.plate} /></label>
        <label>จังหวัด<Input name="province" required maxLength={100} defaultValue={vehicle.province} /></label>
        <label>ยี่ห้อ<Input name="brand" required maxLength={100} defaultValue={vehicle.brand} /></label>
        <label>ประเภท<select className="block w-full rounded-md border p-2" name="vehicleType" defaultValue={vehicle.vehicleType}>
          {vehicleTypes.map((type) => <option key={type}>{type}</option>)}
        </select></label>
      </div> : <p>ยืนยันลบรถทะเบียน {vehicle.plate} ออกจากรายการของผู้ใช้หรือไม่</p>}
      <div className="admin-actions">
        <Button type="submit" disabled={busy}>{mode === "edit" ? "บันทึกข้อมูลรถ" : "ยืนยันลบรถ"}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setMode(null); setMessage(""); }}>ยกเลิก</Button>
      </div>
    </form>}
    {message && <p role="alert">{message}</p>}
  </div>;
}
