"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Status } from "./admin-ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ZoneItem = {
  id: string;
  code: string;
  name: string;
};

type CameraItem = {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  hasStream: boolean;
  isPrimary: boolean;
  isActive: boolean;
};

export function CameraManager({ health, available }: { health: Record<string, string>; available: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    zoneId: "",
    code: "",
    name: "",
    streamUrl: "",
    isPrimary: false,
    isActive: true,
  });

  async function loadZones() {
    const res = await fetch("/api/admin/zones", { cache: "no-store" });
    const json = await res.json();
    const zoneItems = (json.data ?? []) as ZoneItem[];
    setZones(zoneItems);
    if (!form.zoneId && zoneItems[0]) {
      setForm((prev) => ({ ...prev, zoneId: zoneItems[0].id }));
    }
  }

  async function loadCameras(zoneId?: string) {
    setLoading(true);
    setLoadError(false);
    try {
      const query = zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : "";
      const res = await fetch(`/api/admin/cameras${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCameras(json.data ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (available) void loadZones();
  }, [available]);

  useEffect(() => {
    if (available) void loadCameras(selectedZone || undefined);
  }, [available, selectedZone]);

  const zoneMap = useMemo(() => {
    return new Map(zones.map((zone) => [zone.id, `${zone.code} · ${zone.name}`]));
  }, [zones]);

  async function createCamera() {
    const payload = {
      zoneId: form.zoneId,
      code: form.code,
      name: form.name,
      streamUrl: form.streamUrl || null,
      isPrimary: form.isPrimary,
      isActive: form.isActive,
    };

    const res = await fetch("/api/admin/cameras", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Cannot create camera");
      return;
    }

    setForm((prev) => ({
      ...prev,
      code: "",
      name: "",
      streamUrl: "",
      isPrimary: false,
      isActive: true,
    }));
    loadCameras(selectedZone || undefined);
    router.refresh();
  }

  function csvEscape(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        out.push(current.trim());
        current = "";
        continue;
      }

      current += ch;
    }

    out.push(current.trim());
    return out;
  }

  function exportCsv() {
    const rows = filtered.map((camera) => {
      const zone = zones.find((z) => z.id === camera.zoneId);
      return [
        zone?.code ?? "",
        camera.code,
        camera.name,
        "",
        camera.isPrimary ? "true" : "false",
        camera.isActive ? "true" : "false",
      ];
    });

    const header = ["zoneCode", "code", "name", "streamUrl", "isPrimary", "isActive"];
    const csv = [header, ...rows]
      .map((cols) => cols.map((col) => csvEscape(col)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedZone ? "cameras-filtered.csv" : "cameras-all.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        alert("CSV is empty");
        return;
      }

      const header = parseCsvLine(lines[0]);
      const index = new Map(header.map((name, idx) => [name, idx]));
      const required = ["zoneCode", "code", "name"];
      const missing = required.filter((name) => !index.has(name));
      if (missing.length) {
        alert(`CSV missing required columns: ${missing.join(", ")}`);
        return;
      }

      let success = 0;
      let failed = 0;
      const failures: string[] = [];

      for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
        const cols = parseCsvLine(lines[lineNo]);
        const zoneCode = cols[index.get("zoneCode") ?? -1]?.trim();
        const code = cols[index.get("code") ?? -1]?.trim();
        const name = cols[index.get("name") ?? -1]?.trim();
        const streamUrl = cols[index.get("streamUrl") ?? -1]?.trim();
        const isPrimaryRaw = cols[index.get("isPrimary") ?? -1]?.trim().toLowerCase();
        const isActiveRaw = cols[index.get("isActive") ?? -1]?.trim().toLowerCase();

        const zone = zones.find((z) => z.code.toLowerCase() === (zoneCode ?? "").toLowerCase());
        if (!zone || !code || !name) {
          failed += 1;
          failures.push(`line ${lineNo + 1}`);
          continue;
        }

        const res = await fetch("/api/admin/cameras", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            zoneId: zone.id,
            code,
            name,
            streamUrl: streamUrl || null,
            isPrimary: isPrimaryRaw === "true" || isPrimaryRaw === "1" || isPrimaryRaw === "yes",
            isActive:
              isActiveRaw === "false" || isActiveRaw === "0" || isActiveRaw === "no" ? false : true,
          }),
        });

        if (res.ok) {
          success += 1;
        } else {
          failed += 1;
          failures.push(`line ${lineNo + 1}`);
        }
      }

      await loadCameras(selectedZone || undefined);
      router.refresh();
      alert(
        `CSV import completed. success=${success}, failed=${failed}${
          failures.length ? ` (${failures.join(", ")})` : ""
        }`,
      );
    } finally {
      setIsImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  const filtered = cameras.filter((camera) => [camera.code, camera.name].some((value) =>
    value.toLowerCase().includes(search.trim().toLowerCase()),
  ));

  return (
    <div>
      <details className="admin-panel mb-4">
        <summary className="cursor-pointer font-semibold text-primary">+ เพิ่มกล้อง</summary>
        <Card className="mt-3 border-0 shadow-none">
        <CardHeader>
          <CardTitle>Add Camera</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset disabled={!available} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zone-select">Zone</Label>
              <select
                id="zone-select"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={form.zoneId}
                onChange={(e) => setForm((prev) => ({ ...prev, zoneId: e.target.value }))}
              >
                {zones.map((zone) => (
                  <option value={zone.id} key={zone.id}>
                    {zone.code} · {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="camera-code">Camera Code</Label>
              <Input
                id="camera-code"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="E1-CAM-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camera-name">Camera Name</Label>
              <Input
                id="camera-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="E1 North Wing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stream-url">Stream URL (optional)</Label>
              <Input
                id="stream-url"
                type="password"
                autoComplete="off"
                value={form.streamUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, streamUrl: e.target.value }))}
                placeholder="rtsp://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="is-primary">Primary</Label>
                <Switch
                  id="is-primary"
                  checked={form.isPrimary}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isPrimary: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is-active">Active</Label>
                <Switch
                  id="is-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>
            </div>

            <Button className="w-full" onClick={createCamera}>
              Create Camera
            </Button>
          </fieldset>
        </CardContent>
      </Card>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Camera inventory</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Input disabled={!available} className="w-full sm:w-60" aria-label="ค้นหากล้อง" placeholder="ค้นหาชื่อหรือรหัสกล้อง…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select
              aria-label="กรองตามโซน"
              disabled={!available}
              className="h-10 w-72 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              <option value="">All Zones</option>
              {zones.map((zone) => (
                <option value={zone.id} key={zone.id}>
                  {zone.code} · {zone.name}
                </option>
              ))}
            </select>

            <Button size="sm" variant="outline" disabled={!available} onClick={exportCsv}>
              Export CSV
            </Button>

            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              Import CSV
              <Input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="h-9 w-56"
                disabled={!available || isImporting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importCsv(file);
                }}
              />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {loadError && <p role="alert" className="mb-3 text-primary">โหลดข้อมูลกล้องไม่สำเร็จ <button className="underline" onClick={() => loadCameras(selectedZone)}>ลองอีกครั้ง</button></p>}
          <div className="admin-table-wrap" role="region" aria-label="Camera inventory" tabIndex={0}>
            <table className="admin-table">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Zone</th>
                  <th className="px-3 py-2 text-left">Camera Code</th>
                  <th className="px-3 py-2 text-left">Camera Name</th>
                  <th className="px-3 py-2 text-left">Stream URL</th>
                  <th className="px-3 py-2 text-left">Primary</th>
                  <th className="px-3 py-2 text-left">Capture status</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((camera) => (
                  <tr key={camera.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">{zoneMap.get(camera.zoneId) || camera.zoneId}</td>
                    <td className="px-3 py-2 font-medium text-tertiary">{camera.code}</td>
                    <td className="px-3 py-2">{camera.name}</td>
                    <td className="px-3 py-2">{camera.hasStream ? "Configured · ••••••••" : "—"}</td>
                    <td className="px-3 py-2">{camera.isPrimary ? "Yes" : "No"}</td>
                    <td className="px-3 py-2"><Status tone={health[camera.id] === "Fresh" ? "good" : health[camera.id] === "Error" ? "bad" : health[camera.id] === "Stale" ? "warn" : "neutral"}>{health[camera.id] ?? (camera.isActive ? "Unknown" : "Disabled")}</Status></td>
                    <td className="space-y-1 px-3 py-2">
                      <Button asChild size="sm" variant="tertiary">
                        <Link href={`/admin/cameras/${camera.id}`}>ดูรายละเอียด</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/cameras/${camera.id}/edit`}>แก้ไข</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={7}>
                      {!available ? "รอเชื่อมข้อมูลกล้อง" : loading ? "กำลังโหลด…" : loadError ? "ข้อมูลไม่พร้อมใช้งาน" : "ไม่พบกล้อง"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
