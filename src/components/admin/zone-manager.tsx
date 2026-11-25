"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, Status } from "./admin-ui";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ZoneItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export function ZoneManager({ inventory }: { inventory: Record<string, { slots: number; known: number }> }) {
  const router = useRouter();
  const editor = useRef<HTMLDetailsElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });

  const filtered = zones.filter((zone) => [zone.name, zone.code].some((value) => value.toLowerCase().includes(search.trim().toLowerCase())));

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/zones", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setZones(json.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetEditor() {
    setEditingId(null);
    setForm({ code: "", name: "", description: "" });
    setSaveError("");
  }

  function editZone(zone: ZoneItem) {
    setEditingId(zone.id);
    setForm({ code: zone.code, name: zone.name, description: zone.description || "" });
    setSaveError("");
    if (editor.current) {
      editor.current.open = true;
      editor.current.scrollIntoView({ block: "nearest" });
      editor.current.querySelector("input")?.focus();
    }
  }

  async function saveZone() {
    if (saving) return;
    if (!form.code.trim() || !form.name.trim()) {
      setSaveError("กรุณาระบุรหัสและชื่อโซน");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(editingId ? `/api/admin/zones/${encodeURIComponent(editingId)}` : "/api/admin/zones", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, description: form.description.trim() || null }),
      });
      const result = await response.json();
      if (!response.ok) {
        setSaveError(result.error ?? "บันทึกโซนไม่สำเร็จ");
        return;
      }
      resetEditor();
      if (editor.current) editor.current.open = false;
      await load();
      router.refresh();
    } catch {
      setSaveError("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <details ref={editor} className="admin-panel mb-4">
        <summary className="cursor-pointer font-semibold text-primary">{editingId ? "แก้ไขโซน" : "+ เพิ่มโซน"}</summary>
        <Card className="mt-3 border-0 shadow-none">
        <CardHeader>
          <CardTitle>{editingId ? "Edit Zone" : "Create Zone"}</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset disabled={saving} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zone-code">Zone Code</Label>
              <Input
                id="zone-code"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="E1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-name">Name</Label>
              <Input
                id="zone-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Dorm E1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-desc">Description</Label>
              <Textarea
                id="zone-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional note"
              />
            </div>
            <div className="admin-actions">
              <Button onClick={() => void saveZone()}>{saving ? "กำลังบันทึก…" : editingId ? "บันทึกโซน" : "เพิ่มโซน"}</Button>
              {editingId && <Button variant="outline" onClick={resetEditor}>ยกเลิก</Button>}
            </div>
            {saveError && <p role="alert" className="text-sm text-primary">{saveError}</p>}
          </fieldset>
        </CardContent>
      </Card>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Zones</CardTitle>
        </CardHeader>
        <CardContent>
          <Input className="mb-3 max-w-sm" aria-label="ค้นหาโซน" placeholder="ค้นหาชื่อหรือรหัสโซน…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {error && <p role="alert" className="mb-3 text-primary">โหลดรายการโซนไม่สำเร็จ <button className="underline" onClick={load}>ลองอีกครั้ง</button></p>}
          <DataTable headings={["Zone", "Description", "Logical slots", "Coverage", "Status", "Action"]}>
            {filtered.map((zone) => {
              const { known, slots } = inventory[zone.id] ?? { known: 0, slots: 0 };
              return <tr key={zone.id}>
                <td><span className="admin-code">{zone.code}</span><small>{zone.name}</small></td>
                <td>{zone.description || "—"}</td><td>{slots}</td><td>{slots ? `${known} / ${slots}` : "—"}</td>
                <td><Status tone={!known ? "neutral" : known < slots ? "warn" : "good"}>{!known ? "Unknown" : known < slots ? "Partial" : "Fresh"}</Status></td>
                <td><div className="admin-actions">
                  <Link className="admin-link" href={`/admin/zones/${zone.id}`}>ดูรายละเอียด</Link>
                  <button type="button" className="admin-link" disabled={saving} onClick={() => editZone(zone)}>แก้ไข</button>
                </div></td>
              </tr>;
            })}
            {!filtered.length && <tr><td colSpan={6}>{loading ? "กำลังโหลด…" : error ? "ข้อมูลไม่พร้อมใช้งาน" : "ไม่พบโซน"}</td></tr>}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
