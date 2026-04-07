"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CameraDetailView,
  type MonitorCameraSummary,
} from "@/components/admin/monitor/camera-view";
import { SlotResultTable, type MonitorSlotRow } from "@/components/admin/monitor/slot-table";
import { ManualTestPanel } from "@/components/admin/monitor/test-panel";
import {
  ZoneSummaryPanel,
  type MonitorZoneSummary,
} from "@/components/admin/monitor/zone-summary";
import { Button } from "@/components/ui/button";

export default function AdminMonitorPage() {
  const [zones, setZones] = useState<MonitorZoneSummary[]>([]);
  const [cameras, setCameras] = useState<MonitorCameraSummary[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [cameraSummary, setCameraSummary] = useState<MonitorCameraSummary | null>(null);
  const [slotRows, setSlotRows] = useState<MonitorSlotRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadZones() {
    const res = await fetch("/api/public/zones", { cache: "no-store" });
    const json = await res.json();
    setZones(json.data?.zones ?? []);
  }

  async function loadCameras(zoneId?: string | null) {
    const query = zoneId ? `?zoneId=${zoneId}` : "";
    const res = await fetch(`/api/public/cameras${query}`, { cache: "no-store" });
    const json = await res.json();
    setCameras(json.data?.cameras ?? []);
  }

  async function loadCameraDetail(cameraId: string) {
    setLoading(true);
    try {
      const [summaryRes, slotsRes] = await Promise.all([
        fetch(`/api/public/cameras/${cameraId}`, { cache: "no-store" }),
        fetch(`/api/public/cameras/${cameraId}/slots`, { cache: "no-store" }),
      ]);

      const summaryJson = await summaryRes.json();
      const slotsJson = await slotsRes.json();

      if (!summaryRes.ok) {
        setCameraSummary(null);
        setSlotRows([]);
        return;
      }

      setCameraSummary(summaryJson.data ?? null);
      setSlotRows(slotsJson.data?.slots ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadZones(), loadCameras(selectedZoneId)]);
    if (selectedCameraId) {
      await loadCameraDetail(selectedCameraId);
    }
  }

  useEffect(() => {
    void loadZones();
    void loadCameras();
  }, []);

  useEffect(() => {
    void loadCameras(selectedZoneId);
    setSelectedCameraId(null);
    setCameraSummary(null);
    setSlotRows([]);
  }, [selectedZoneId]);

  useEffect(() => {
    if (!selectedCameraId) return;
    void loadCameraDetail(selectedCameraId);
  }, [selectedCameraId]);

  const cameraOptions = useMemo(
    () =>
      cameras.map((camera) => ({
        cameraId: camera.cameraId,
        cameraCode: camera.cameraCode,
        cameraName: camera.cameraName,
      })),
    [cameras],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Admin Monitoring Dashboard</h2>
          <p className="text-sm text-slate-600">
            Monitor runtime observations, validate results, and compare calibration vs runtime.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()}>
          Refresh
        </Button>
      </div>

      <ZoneSummaryPanel
        zones={zones}
        selectedZoneId={selectedZoneId}
        onSelectZone={(zoneId) => setSelectedZoneId(zoneId)}
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <label className="text-sm">
              Camera
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={selectedCameraId ?? ""}
                onChange={(e) => setSelectedCameraId(e.target.value || null)}
              >
                <option value="">Select camera</option>
                {cameras.map((camera) => (
                  <option key={camera.cameraId} value={camera.cameraId}>
                    {camera.cameraCode} · {camera.cameraName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? <p className="text-sm text-slate-500">Loading camera data...</p> : null}
          <CameraDetailView summary={cameraSummary} />
          <SlotResultTable title="Latest Slot Result (Runtime DB)" rows={slotRows} />
        </div>

        <ManualTestPanel
          cameras={cameraOptions}
          selectedCameraId={selectedCameraId}
          onSelectCamera={(id) => setSelectedCameraId(id)}
        />
      </div>
    </div>
  );
}
