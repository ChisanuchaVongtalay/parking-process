"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type CameraSettings = {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  isPrimary: boolean;
  isActive: boolean;
  hasStream: boolean;
};

export function CameraEditForm({ camera, zones }: {
  camera: CameraSettings;
  zones: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [isPrimary, setIsPrimary] = useState(camera.isPrimary);
  const [isActive, setIsActive] = useState(camera.isActive);
  const [removeStream, setRemoveStream] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const detailUrl = `/admin/cameras/${encodeURIComponent(camera.id)}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    const stream = String(fields.get("stream") ?? "").trim();

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/cameras/${encodeURIComponent(camera.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: fields.get("zone"),
          code: String(fields.get("code")).trim(),
          name: String(fields.get("name")).trim(),
          streamUrl: removeStream ? null : stream || undefined,
          isPrimary,
          isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "บันทึกข้อมูลกล้องไม่สำเร็จ");
        return;
      }
      router.push(detailUrl);
      router.refresh();
    } catch {
      setError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={saving} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-camera-code">Camera Code</Label>
            <Input id="edit-camera-code" name="code" defaultValue={camera.code} required maxLength={64} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-camera-name">Camera Name</Label>
            <Input id="edit-camera-name" name="name" defaultValue={camera.name} required maxLength={150} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-camera-zone">Zone</Label>
            <select id="edit-camera-zone" name="zone" defaultValue={camera.zoneId} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.code === zone.name ? zone.name : `${zone.code} · ${zone.name}`}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-camera-stream">Stream URL</Label>
            <Input id="edit-camera-stream" name="stream" type="password" placeholder="rtsp://…" autoComplete="new-password" disabled={removeStream} aria-describedby="edit-camera-stream-note" />
            <p id="edit-camera-stream-note" className="text-sm text-slate-600">
              {camera.hasStream ? "มี URL ตั้งค่าไว้แล้ว เว้นว่างเพื่อใช้ค่าเดิม" : "ยังไม่มี Stream URL"}
            </p>
            {camera.hasStream && <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={removeStream} onChange={(event) => setRemoveStream(event.target.checked)} /> ล้าง Stream URL เดิม
            </label>}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch id="edit-camera-primary" checked={isPrimary} onCheckedChange={setIsPrimary} />
            <Label htmlFor="edit-camera-primary">Primary camera</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="edit-camera-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="edit-camera-active">Active</Label>
          </div>
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-primary">{error}</p>}
      <div className="admin-actions">
        <Button type="submit" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกข้อมูลกล้อง"}</Button>
        <Button asChild variant="outline"><Link href={detailUrl}>ยกเลิก</Link></Button>
      </div>
    </form>
  );
}
