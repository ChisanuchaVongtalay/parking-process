"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  streamUrl: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

export function CameraManager() {
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("");
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
    const query = zoneId ? `?zoneId=${zoneId}` : "";
    const res = await fetch(`/api/admin/cameras${query}`, { cache: "no-store" });
    const json = await res.json();
    setCameras(json.data ?? []);
  }

  useEffect(() => {
    loadZones();
    loadCameras();
  }, []);

  useEffect(() => {
    loadCameras(selectedZone || undefined);
  }, [selectedZone]);

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
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add Camera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Camera List</CardTitle>
          <div className="pt-2">
            <select
              className="h-10 w-80 rounded-md border border-slate-300 bg-white px-3 text-sm"
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cameras.map((camera) => (
              <div key={camera.id} className="rounded-md border border-slate-200 bg-white p-4 text-sm">
                <p className="font-semibold text-tertiary">
                  {camera.code} · {camera.name}
                </p>
                <p className="text-slate-600">Zone: {zoneMap.get(camera.zoneId) || camera.zoneId}</p>
                <p className="text-slate-600">{camera.streamUrl || "No stream URL"}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {camera.isPrimary ? "Primary" : "Secondary"} · {camera.isActive ? "Active" : "Inactive"}
                  </p>
                  <Button asChild size="sm" variant="tertiary">
                    <Link href={`/admin/cameras/${camera.id}/calibration`}>Open Calibration</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
