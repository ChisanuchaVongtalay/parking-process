"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SlotResultTable, type MonitorSlotRow } from "./slot-table";

type CameraOption = {
  cameraId: string;
  cameraCode: string;
  cameraName: string;
};

type RuntimeResult = {
  result: {
    cameraId: string;
    summary: { total: number; occupied: number; free: number };
    slots: Array<{ cameraSlotId: string; score: number; occupied: boolean }>;
  };
};

type CalibrationResult = {
  cameraId: string;
  occupied: number;
  free: number;
  slots: Array<{ slotId: string; slotCode: string; score: number; occupied: boolean }>;
};

export function ManualTestPanel(props: {
  cameras: CameraOption[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
}) {
  const { cameras, selectedCameraId, onSelectCamera } = props;

  const [file, setFile] = useState<File | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [runtimeResult, setRuntimeResult] = useState<RuntimeResult["result"] | null>(null);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);

  const runtimeRows: MonitorSlotRow[] = useMemo(() => {
    if (!runtimeResult) return [];
    return runtimeResult.slots.map((slot) => ({
      cameraSlotId: slot.cameraSlotId,
      slotCode: slot.cameraSlotId,
      score: slot.score,
      occupied: slot.occupied,
      updatedAt: new Date().toISOString(),
    }));
  }, [runtimeResult]);

  const calibrationRows: MonitorSlotRow[] = useMemo(() => {
    if (!calibrationResult) return [];
    return calibrationResult.slots.map((slot) => ({
      cameraSlotId: slot.slotId,
      slotCode: slot.slotCode,
      score: slot.score,
      occupied: slot.occupied,
      updatedAt: new Date().toISOString(),
    }));
  }, [calibrationResult]);

  const comparisonRows = useMemo(() => {
    if (!compareMode || !runtimeRows.length || !calibrationRows.length) return [];

    const calByCode = new Map(calibrationRows.map((row) => [row.slotCode, row]));
    return runtimeRows.map((runtime) => {
      const cal = calByCode.get(runtime.slotCode);
      const mismatch = cal ? cal.occupied !== runtime.occupied : false;
      return {
        slotCode: runtime.slotCode,
        runtime: runtime.occupied,
        calibration: cal?.occupied ?? null,
        mismatch,
      };
    });
  }, [compareMode, runtimeRows, calibrationRows]);

  async function run() {
    if (!selectedCameraId || !file) return;

    setIsRunning(true);
    try {
      const runtimeForm = new FormData();
      runtimeForm.set("file", file);

      const runtimeRes = await fetch(`/api/runtime/cameras/${selectedCameraId}/process`, {
        method: "POST",
        body: runtimeForm,
      });
      const runtimeJson = (await runtimeRes.json()) as {
        error?: string;
        details?: unknown;
        data?: RuntimeResult;
      };
      if (!runtimeRes.ok) {
        const detailText = runtimeJson.details ? `\nDetails: ${JSON.stringify(runtimeJson.details)}` : "";
        throw new Error(`${runtimeJson.error || "Runtime process failed"}${detailText}`);
      }
      setRuntimeResult(runtimeJson.data?.result ?? null);

      if (compareMode) {
        const calibrationForm = new FormData();
        calibrationForm.set("file", file);

        const calibrationRes = await fetch(`/api/admin/cameras/${selectedCameraId}/calibration/test`, {
          method: "POST",
          body: calibrationForm,
        });
        const calibrationJson = (await calibrationRes.json()) as {
          error?: string;
          details?: unknown;
          data?: CalibrationResult;
        };
        if (!calibrationRes.ok) {
          const detailText = calibrationJson.details
            ? `\nDetails: ${JSON.stringify(calibrationJson.details)}`
            : "";
          throw new Error(`${calibrationJson.error || "Calibration test failed"}${detailText}`);
        }
        setCalibrationResult(calibrationJson.data ?? null);
      }
    } catch (error) {
      alert(String(error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Test Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Camera</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
              value={selectedCameraId ?? ""}
              onChange={(e) => onSelectCamera(e.target.value)}
            >
              <option value="">Select camera</option>
              {cameras.map((camera) => (
                <option key={camera.cameraId} value={camera.cameraId}>
                  {camera.cameraCode} · {camera.cameraName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-600">Upload Snapshot</span>
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs text-slate-600">Action</span>
            <Button className="w-full" onClick={run} disabled={!selectedCameraId || !file || isRunning}>
              {isRunning ? "Running..." : "Run Test"}
            </Button>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          Compare Mode
        </label>

        {runtimeResult ? (
          <div className="rounded border border-slate-200 p-2 text-xs">
            Runtime summary: total {runtimeResult.summary.total}, occupied {runtimeResult.summary.occupied}, free {runtimeResult.summary.free}
          </div>
        ) : null}

        {compareMode && calibrationResult ? (
          <div className="rounded border border-slate-200 p-2 text-xs">
            Calibration summary: total {calibrationResult.slots.length}, occupied {calibrationResult.occupied}, free {calibrationResult.free}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          <SlotResultTable title="Runtime Result" rows={runtimeRows} />
          {compareMode ? <SlotResultTable title="Calibration Result" rows={calibrationRows} /> : null}
        </div>

        {compareMode ? (
          <div className="rounded border border-slate-200 p-2">
            <h5 className="mb-2 text-sm font-semibold">Comparison (slot-by-slot)</h5>
            <div className="max-h-48 overflow-auto rounded border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Slot</th>
                    <th className="px-2 py-1 text-left">Calibration</th>
                    <th className="px-2 py-1 text-left">Runtime</th>
                    <th className="px-2 py-1 text-left">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.slotCode} className={`border-t ${row.mismatch ? "bg-red-50" : ""}`}>
                      <td className="px-2 py-1">{row.slotCode}</td>
                      <td className="px-2 py-1">{row.calibration === null ? "-" : String(row.calibration)}</td>
                      <td className="px-2 py-1">{String(row.runtime)}</td>
                      <td className="px-2 py-1">
                        {row.mismatch ? (
                          <span className="font-semibold text-primary">mismatch</span>
                        ) : (
                          <span className="font-semibold text-success">match</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
