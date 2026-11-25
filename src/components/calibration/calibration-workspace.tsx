"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { rectToPoints } from "@/lib/geometry";

type CameraItem = {
  id: string;
  code: string;
  name: string;
  backgroundImagePath: string | null;
  latestSnapshotPath: string | null;
};

type SlotItem = {
  id: string;
  slotCode: string;
  vehicleType: "car" | "motorcycle";
  shapeType: "rect" | "polygon";
  points: { x: number; y: number }[];
  bbox: { x: number; y: number; width: number; height: number };
  enabled: boolean;
  logicalSlotId: string | null;
};

type CalibrationProfile = {
  pixelThreshold: number;
  occupancyThreshold: number;
  grayscale: boolean;
  blurRadius: number;
  normalize: boolean;
  downscale: number;
  lightingCompensation: number;
  edgeWeight: number;
};

type TestResult = {
  occupied: number;
  free: number;
  slots: Array<{ slotId: string; slotCode: string; score: number; occupied: boolean }>;
};

type ImageFrame = {
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
};

function toFileUrl(relativePath: string | null): string | null {
  if (!relativePath) return null;
  return `/api/files/${relativePath}`;
}

export function CalibrationWorkspace({
  initialCamera,
  initialSlots,
  initialCalibration,
}: {
  initialCamera: CameraItem;
  initialSlots: SlotItem[];
  initialCalibration: CalibrationProfile;
}) {
  const [camera, setCamera] = useState(initialCamera);
  const [slots, setSlots] = useState(initialSlots);
  const [calibration, setCalibration] = useState(initialCalibration);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(initialSlots[0]?.id ?? null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isDrawMode, setIsDrawMode] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [isUploadingSnapshot, setIsUploadingSnapshot] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const snapshotInputRef = useRef<HTMLInputElement | null>(null);
  const oneShotTestInputRef = useRef<HTMLInputElement | null>(null);

  const resultMap = useMemo(() => {
    return new Map((testResult?.slots ?? []).map((item) => [item.slotId, item]));
  }, [testResult]);

  useEffect(() => {
    setTestResult(null);
  }, [slots, calibration]);

  const mainImagePath = camera.latestSnapshotPath ?? camera.backgroundImagePath;
  const backgroundImageUrl = toFileUrl(camera.backgroundImagePath);
  const snapshotImageUrl = toFileUrl(camera.latestSnapshotPath);
  const mainImageUrl = toFileUrl(mainImagePath);

  const imageFrame = useMemo<ImageFrame | null>(() => {
    if (!stageRef.current || !imageNaturalSize) return null;
    const rect = stageRef.current.getBoundingClientRect();
    const stageWidth = rect.width;
    const stageHeight = rect.height;
    if (!stageWidth || !stageHeight) return null;

    const scale = Math.min(stageWidth / imageNaturalSize.width, stageHeight / imageNaturalSize.height);
    const displayWidth = imageNaturalSize.width * scale;
    const displayHeight = imageNaturalSize.height * scale;

    return {
      offsetX: (stageWidth - displayWidth) / 2,
      offsetY: (stageHeight - displayHeight) / 2,
      displayWidth,
      displayHeight,
      scale,
      naturalWidth: imageNaturalSize.width,
      naturalHeight: imageNaturalSize.height,
    };
  }, [imageNaturalSize]);

  function basename(p: string | null): string {
    if (!p) return "-";
    const chunks = p.split("/");
    return chunks[chunks.length - 1] || p;
  }

  function clampToImage(x: number, y: number, frame: ImageFrame) {
    return {
      x: Math.max(0, Math.min(frame.naturalWidth, x)),
      y: Math.max(0, Math.min(frame.naturalHeight, y)),
    };
  }

  function clientToImagePoint(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!stageRef.current || !imageFrame) return null;
    const rect = stageRef.current.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const imageX = (sx - imageFrame.offsetX) / imageFrame.scale;
    const imageY = (sy - imageFrame.offsetY) / imageFrame.scale;
    return clampToImage(imageX, imageY, imageFrame);
  }

  function imageRectToStage(bbox: SlotItem["bbox"], frame: ImageFrame) {
    return {
      x: frame.offsetX + bbox.x * frame.scale,
      y: frame.offsetY + bbox.y * frame.scale,
      width: bbox.width * frame.scale,
      height: bbox.height * frame.scale,
    };
  }

  function stageRectToImage(
    x: number,
    y: number,
    width: number,
    height: number,
    frame: ImageFrame,
  ): SlotItem["bbox"] {
    const left = (x - frame.offsetX) / frame.scale;
    const top = (y - frame.offsetY) / frame.scale;
    const right = (x + width - frame.offsetX) / frame.scale;
    const bottom = (y + height - frame.offsetY) / frame.scale;

    const p1 = clampToImage(left, top, frame);
    const p2 = clampToImage(right, bottom, frame);

    const nx = Math.min(p1.x, p2.x);
    const ny = Math.min(p1.y, p2.y);
    const nw = Math.max(Math.abs(p2.x - p1.x), 1);
    const nh = Math.max(Math.abs(p2.y - p1.y), 1);

    return { x: nx, y: ny, width: nw, height: nh };
  }

  function isInsideImageRegion(clientX: number, clientY: number): boolean {
    if (!stageRef.current || !imageFrame) return false;
    const rect = stageRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return (
      x >= imageFrame.offsetX &&
      x <= imageFrame.offsetX + imageFrame.displayWidth &&
      y >= imageFrame.offsetY &&
      y <= imageFrame.offsetY + imageFrame.displayHeight
    );
  }

  async function parseErrorMessage(res: Response): Promise<string> {
    try {
      const body = (await res.json()) as { error?: string; details?: unknown };
      if (body?.error) return body.error;
      return `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  const slotStats = useMemo(() => {
    const total = slots.length;
    const enabled = slots.filter((slot) => slot.enabled).length;
    return {
      total,
      enabled,
      occupied: testResult?.occupied ?? 0,
      free: testResult?.free ?? Math.max(enabled - (testResult?.occupied ?? 0), 0),
    };
  }, [slots, testResult]);

  const slotScoreRows = useMemo(() => {
    return slots
      .map((slot) => {
        const result = resultMap.get(slot.id);
        return {
          id: slot.id,
          slotCode: slot.slotCode,
          vehicleType: slot.vehicleType,
          enabled: slot.enabled,
          score: result?.score ?? null,
          occupied: result?.occupied ?? null,
        };
      })
      .sort((a, b) => a.slotCode.localeCompare(b.slotCode));
  }, [slots, resultMap]);

  async function refreshCamera() {
    const res = await fetch(`/api/admin/cameras/${camera.id}`, { cache: "no-store" });
    const json = await res.json();
    setCamera(json.data);
  }

  useEffect(() => {
    if (!mainImageUrl) return;

    const img = new Image();
    img.onload = () => {
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = mainImageUrl;
  }, [mainImageUrl]);

  useEffect(() => {
    if (!stageRef.current) return;

    const observer = new ResizeObserver(() => {
      setImageNaturalSize((prev) => (prev ? { ...prev } : prev));
    });

    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  async function uploadBackground(file: File) {
    setIsUploadingBackground(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/admin/cameras/${camera.id}/background`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        alert(`Background upload failed: ${await parseErrorMessage(res)}`);
        return;
      }
      setTestResult(null);
      await refreshCamera();

      // Allow selecting the same file again and avoid stale browser file label confusion.
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = "";
      }
    } finally {
      setIsUploadingBackground(false);
    }
  }

  async function uploadSnapshot(file: File) {
    setIsUploadingSnapshot(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/admin/cameras/${camera.id}/test-snapshot`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        alert(`Snapshot upload failed: ${await parseErrorMessage(res)}`);
        return;
      }
      setTestResult(null);
      await refreshCamera();

      if (snapshotInputRef.current) {
        snapshotInputRef.current.value = "";
      }
    } finally {
      setIsUploadingSnapshot(false);
    }
  }

  function beginDraw(clientX: number, clientY: number) {
    const point = clientToImagePoint(clientX, clientY);
    if (!point) return;
    setDrawingStart(point);
    setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function moveDraw(clientX: number, clientY: number) {
    if (!drawingStart) return;
    const point = clientToImagePoint(clientX, clientY);
    if (!point) return;

    const x = Math.min(drawingStart.x, point.x);
    const y = Math.min(drawingStart.y, point.y);
    const width = Math.abs(point.x - drawingStart.x);
    const height = Math.abs(point.y - drawingStart.y);

    setDraftRect({ x, y, width, height });
  }

  function finishDraw() {
    if (!draftRect) {
      setDrawingStart(null);
      return;
    }

    if (draftRect.width < 8 || draftRect.height < 8) {
      setDraftRect(null);
      setDrawingStart(null);
      return;
    }

    const slot: SlotItem = {
      id: `tmp-${crypto.randomUUID()}`,
      slotCode: `S${String(slots.length + 1).padStart(2, "0")}`,
      vehicleType: "car",
      shapeType: "rect",
      points: rectToPoints(draftRect),
      bbox: draftRect,
      enabled: true,
      logicalSlotId: null,
    };

    setSlots((prev) => [...prev, slot]);
    setSelectedSlotId(slot.id);
    setDraftRect(null);
    setDrawingStart(null);
  }

  async function saveSlots() {
    const payload = {
      slots: slots.map((slot) => ({
        id: slot.id.startsWith("tmp-") ? undefined : slot.id,
        slotCode: slot.slotCode,
        vehicleType: slot.vehicleType,
        shapeType: slot.shapeType,
        points: slot.points,
        bbox: slot.bbox,
        enabled: slot.enabled,
        logicalSlotId: slot.logicalSlotId,
      })),
    };

    const res = await fetch(`/api/admin/cameras/${camera.id}/slots`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert(`Saving slots failed: ${await parseErrorMessage(res)}`);
      return false;
    }

    const json = await res.json();
    setSlots(json.data ?? []);
    return true;
  }

  async function saveCalibration() {
    const res = await fetch(`/api/admin/cameras/${camera.id}/calibration`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(calibration),
    });

    if (!res.ok) {
      alert(`Calibration save failed: ${await parseErrorMessage(res)}`);
      return false;
    }
    return true;
  }

  async function saveAndStartCounting() {
    if (!camera.backgroundImagePath || !slots.some((slot) => slot.enabled)) {
      alert("Please set a background and enable at least one slot first.");
      return;
    }
    setIsActivating(true);
    try {
      if (!(await saveSlots()) || !(await saveCalibration())) return;
      const response = await fetch(`/api/runtime/cameras/${camera.id}/process`, {
        method: "POST", headers: { "content-type": "application/json" }, body: "{}",
      });
      if (!response.ok) {
        alert(`Settings saved. Counting will run on the next successful snapshot. Current snapshot could not be processed: ${await parseErrorMessage(response)}`);
        return;
      }
      alert("Settings saved and latest snapshot processed. New snapshots will be counted automatically while the worker is running.");
    } catch {
      alert("Could not complete the request. Check the connection and try again.");
    } finally {
      setIsActivating(false);
    }
  }

  async function runTest(file?: File) {
    setIsTesting(true);
    try {
      const fd = new FormData();
      if (file) {
        fd.set("file", file);
      }
      fd.set(
        "slots",
        JSON.stringify({
          slots: slots.map((slot) => ({
            id: slot.id,
            logicalSlotId: slot.logicalSlotId,
            slotCode: slot.slotCode,
            vehicleType: slot.vehicleType,
            shapeType: slot.shapeType,
            points: slot.points,
            bbox: slot.bbox,
            enabled: slot.enabled,
          })),
        }),
      );
      fd.set("calibration", JSON.stringify(calibration));

      const res = await fetch(`/api/admin/cameras/${camera.id}/calibration/test`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        alert(`Calibration test failed: ${await parseErrorMessage(res)}`);
        return;
      }

      const json = await res.json();
      setTestResult(json.data);
      await refreshCamera();

      if (oneShotTestInputRef.current) {
        oneShotTestInputRef.current.value = "";
      }
    } finally {
      setIsTesting(false);
    }
  }

  async function importSlots(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/admin/cameras/${camera.id}/slots/import`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      alert("Import failed");
      return;
    }
    const json = await res.json();
    setSlots(json.data ?? []);
  }

  async function exportSlots() {
    const res = await fetch(`/api/admin/cameras/${camera.id}/slots/export`, { cache: "no-store" });
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${camera.code}-slots.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportCameraConfig() {
    const res = await fetch(`/api/admin/cameras/${camera.id}/export`, { method: "POST" });
    if (!res.ok) {
      alert("Export failed");
      return;
    }
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json.data.doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${camera.code}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selected = slots.find((slot) => slot.id === selectedSlotId) ?? null;

  return (
    <div className="admin-calibration-grid">
      <Card className="admin-calibration-slots">
        <CardHeader>
          <CardTitle>Slot Management</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveSlots}>
              Save Slots
            </Button>
            <Button size="sm" variant="outline" onClick={exportSlots}>
              Export Slots
            </Button>
          </div>
          <label className="text-xs text-slate-600">
            Import Slots
            <Input
              type="file"
              accept="application/json"
              className="mt-1"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importSlots(file);
              }}
            />
          </label>
        </CardHeader>
        <CardContent className="space-y-2">
          {slots.map((slot) => {
            const status = resultMap.get(slot.id);
            return (
              <button
                key={slot.id}
                className={`w-full rounded-md border p-2 text-left text-sm ${
                  slot.id === selectedSlotId ? "border-tertiary bg-[#e8f3f8]" : "border-slate-200 bg-white"
                }`}
                onClick={() => setSelectedSlotId(slot.id)}
              >
                <p className="font-semibold">
                  {slot.slotCode} · {slot.vehicleType}
                </p>
                <p className="text-xs text-slate-600">
                  {slot.enabled ? "Enabled" : "Disabled"}
                  {status ? ` · score ${status.score} · ${status.occupied ? "occupied" : "free"}` : ""}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="admin-calibration-canvas">
        <CardHeader>
          <CardTitle>
            {camera.code} · {camera.name}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Button
              size="sm"
              variant={isDrawMode ? "default" : "outline"}
              onClick={() => setIsDrawMode(true)}
            >
              Draw Slot Mode
            </Button>
            <Button
              size="sm"
              variant={!isDrawMode ? "tertiary" : "outline"}
              onClick={() => setIsDrawMode(false)}
            >
              Edit Slot Mode
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label>
              Upload Background
              <Input
                ref={backgroundInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="mt-1"
                disabled={isUploadingBackground || isTesting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBackground(file);
                }}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Latest background: {basename(camera.backgroundImagePath)}
              </p>
            </label>
            <label>
              Upload Snapshot
              <Input
                ref={snapshotInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="mt-1"
                disabled={isUploadingSnapshot || isTesting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadSnapshot(file);
                }}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Latest snapshot: {basename(camera.latestSnapshotPath)}
              </p>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={stageRef}
            className={`relative h-[540px] overflow-hidden rounded-lg border border-slate-300 bg-slate-100 ${
              isDrawMode ? "cursor-crosshair" : "cursor-default"
            }`}
            onMouseDown={(e) => {
              if (!isDrawMode) return;
              if (!mainImagePath) return;
              if (e.button !== 0) return;
              if (!isInsideImageRegion(e.clientX, e.clientY)) return;
              beginDraw(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => {
              if (!isDrawMode) return;
              if (!drawingStart) return;
              moveDraw(e.clientX, e.clientY);
            }}
            onMouseUp={() => {
              if (!isDrawMode) return;
              finishDraw();
            }}
            onMouseLeave={() => {
              if (!isDrawMode) return;
              if (drawingStart) finishDraw();
            }}
          >
            {mainImageUrl ? (
              <img
                src={mainImageUrl}
                alt="calibration-main"
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
                Upload background and snapshot to start calibration.
              </div>
            )}

            <div className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
              {camera.latestSnapshotPath ? "Main: Snapshot" : "Main: Background"}
            </div>

            {slots.map((slot) => {
              const status = resultMap.get(slot.id);
              const strokeClass = status
                ? status.occupied
                  ? "border-red-500 bg-red-500/20"
                  : "border-green-500 bg-green-500/20"
                : slot.vehicleType === "car"
                  ? "border-tertiary bg-tertiary/20"
                  : "border-secondary bg-secondary/25";

              return (
                <Rnd
                  key={slot.id}
                  bounds="parent"
                  size={{
                    width: imageFrame ? imageRectToStage(slot.bbox, imageFrame).width : slot.bbox.width,
                    height: imageFrame ? imageRectToStage(slot.bbox, imageFrame).height : slot.bbox.height,
                  }}
                  position={{
                    x: imageFrame ? imageRectToStage(slot.bbox, imageFrame).x : slot.bbox.x,
                    y: imageFrame ? imageRectToStage(slot.bbox, imageFrame).y : slot.bbox.y,
                  }}
                  onDragStop={(_e, data) => {
                    if (!imageFrame) return;
                    setSlots((prev) =>
                      prev.map((item) => {
                        if (item.id !== slot.id) return item;
                        const displayRect = imageRectToStage(item.bbox, imageFrame);
                        const bbox = stageRectToImage(
                          data.x,
                          data.y,
                          displayRect.width,
                          displayRect.height,
                          imageFrame,
                        );
                        return { ...item, bbox, points: rectToPoints(bbox) };
                      }),
                    );
                  }}
                  onResizeStop={(_e, _direction, ref, _delta, position) => {
                    if (isDrawMode) return;
                    if (!imageFrame) return;
                    const width = Number(ref.style.width.replace("px", ""));
                    const height = Number(ref.style.height.replace("px", ""));
                    setSlots((prev) =>
                      prev.map((item) => {
                        if (item.id !== slot.id) return item;
                        const bbox = stageRectToImage(
                          position.x,
                          position.y,
                          width,
                          height,
                          imageFrame,
                        );
                        return { ...item, bbox, points: rectToPoints(bbox) };
                      }),
                    );
                  }}
                  disableDragging={isDrawMode}
                  enableResizing={!isDrawMode}
                  onClick={() => {
                    if (isDrawMode) return;
                    setSelectedSlotId(slot.id);
                  }}
                  className={`border-2 ${strokeClass} ${selectedSlotId === slot.id ? "ring-2 ring-white" : ""} ${
                    isDrawMode ? "pointer-events-none" : ""
                  }`}
                >
                  <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    {slot.slotCode}{status ? (status.occupied ? " · Occupied" : " · Free") : ""}
                  </div>
                </Rnd>
              );
            })}

            {draftRect ? (
              (() => {
                if (!imageFrame) return null;
                const drawRect = imageRectToStage(draftRect, imageFrame);
                return (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10"
                style={{
                  left: drawRect.x,
                  top: drawRect.y,
                  width: drawRect.width,
                  height: drawRect.height,
                }}
              />
                );
              })()
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Draw mode: drag on the image to create bounding box. Edit mode: move and resize existing slot.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="mb-2 text-xs font-semibold text-slate-700">Background</p>
              {backgroundImageUrl ? (
                <img
                  src={backgroundImageUrl}
                  alt="background-preview"
                  className="h-28 w-full rounded object-cover"
                />
              ) : (
                <div className="grid h-28 place-items-center rounded bg-slate-100 text-xs text-slate-500">
                  No background uploaded
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="mb-2 text-xs font-semibold text-slate-700">Snapshot</p>
              {snapshotImageUrl ? (
                <img
                  src={snapshotImageUrl}
                  alt="snapshot-preview"
                  className="h-28 w-full rounded object-cover"
                />
              ) : (
                <div className="grid h-28 place-items-center rounded bg-slate-100 text-xs text-slate-500">
                  No snapshot uploaded
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Slot Score Log (Latest Test)</p>
              <p className="text-[11px] text-slate-500">
                occupancyThreshold = {calibration.occupancyThreshold.toFixed(2)}
              </p>
            </div>

            {testResult ? (
              <div className="max-h-44 overflow-auto rounded border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-2 py-1 text-left">Slot</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-left">Enabled</th>
                      <th className="px-2 py-1 text-left">Score</th>
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotScoreRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-2 py-1 font-medium">{row.slotCode}</td>
                        <td className="px-2 py-1">{row.vehicleType}</td>
                        <td className="px-2 py-1">{row.enabled ? "yes" : "no"}</td>
                        <td className="px-2 py-1">{row.score === null ? "-" : row.score.toFixed(4)}</td>
                        <td className="px-2 py-1">
                          {row.occupied === null ? (
                            <span className="text-slate-500">not tested</span>
                          ) : row.occupied ? (
                            <span className="font-semibold text-primary">occupied</span>
                          ) : (
                            <span className="font-semibold text-success">free</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Run test once to see per-slot score log for tuning thresholds.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="admin-calibration-controls">
        <CardHeader>
          <CardTitle>Calibration Controls</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveCalibration}>
              Save Params
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              disabled={isTesting || !camera.latestSnapshotPath}
              onClick={() => runTest()}
            >
              {isTesting ? "Testing..." : "Run Test"}
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCameraConfig}>
              Export Config
            </Button>
          </div>
          <Button size="sm" disabled={isActivating} onClick={saveAndStartCounting}>
            {isActivating ? "Saving..." : "Save & Start Counting"}
          </Button>
          <label className="text-xs text-slate-600">
            Test with one-time snapshot
            <Input
              ref={oneShotTestInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="mt-1"
              disabled={isTesting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void runTest(file);
              }}
            />
          </label>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="pixelThreshold"
              value={calibration.pixelThreshold}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => setCalibration((prev) => ({ ...prev, pixelThreshold: value }))}
            />
            <Field
              label="occupancyThreshold"
              value={calibration.occupancyThreshold}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => setCalibration((prev) => ({ ...prev, occupancyThreshold: value }))}
            />
            <Field
              label="blurRadius"
              value={calibration.blurRadius}
              min={0}
              max={9}
              step={1}
              integer
              onChange={(value) => setCalibration((prev) => ({ ...prev, blurRadius: value }))}
            />
            <Field
              label="downscale"
              value={calibration.downscale}
              min={0.1}
              max={1}
              step={0.1}
              onChange={(value) => setCalibration((prev) => ({ ...prev, downscale: value }))}
            />
            <Field
              label="lightingCompensation"
              value={calibration.lightingCompensation}
              min={0}
              max={2}
              step={0.1}
              onChange={(value) =>
                setCalibration((prev) => ({ ...prev, lightingCompensation: value }))
              }
            />
            <Field
              label="edgeWeight"
              value={calibration.edgeWeight}
              min={0}
              max={5}
              step={0.1}
              onChange={(value) => setCalibration((prev) => ({ ...prev, edgeWeight: value }))}
            />
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <Toggle
              label="grayscale"
              checked={calibration.grayscale}
              onCheckedChange={(checked) => setCalibration((prev) => ({ ...prev, grayscale: checked }))}
            />
            <Toggle
              label="normalize"
              checked={calibration.normalize}
              onCheckedChange={(checked) => setCalibration((prev) => ({ ...prev, normalize: checked }))}
            />
          </div>

          {selected ? (
            <div className="space-y-3 rounded-md border border-slate-200 p-3">
              <p className="font-semibold">Selected Slot</p>
              <div className="space-y-1">
                <Label>Slot Code</Label>
                <Input
                  value={selected.slotCode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSlots((prev) =>
                      prev.map((item) => (item.id === selected.id ? { ...item, slotCode: value } : item)),
                    );
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Vehicle Type</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 px-3"
                  value={selected.vehicleType}
                  onChange={(e) => {
                    const value = e.target.value as "car" | "motorcycle";
                    setSlots((prev) =>
                      prev.map((item) => (item.id === selected.id ? { ...item, vehicleType: value } : item)),
                    );
                  }}
                >
                  <option value="car">car</option>
                  <option value="motorcycle">motorcycle</option>
                </select>
              </div>
              <Toggle
                label="enabled"
                checked={selected.enabled}
                onCheckedChange={(checked) => {
                  setSlots((prev) =>
                    prev.map((item) => (item.id === selected.id ? { ...item, enabled: checked } : item)),
                  );
                }}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSlots((prev) => prev.filter((item) => item.id !== selected.id));
                  setSelectedSlotId(null);
                }}
              >
                Delete Slot
              </Button>
            </div>
          ) : null}

          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-semibold">Test Summary</p>
            <p className="text-xs text-slate-600">Total slots: {slotStats.total}</p>
            <p className="text-xs text-slate-600">Enabled slots: {slotStats.enabled}</p>
            <p className="text-xs text-slate-600">Occupied: {slotStats.occupied}</p>
            <p className="text-xs text-slate-600">Free: {slotStats.free}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Test uses current slots and calibration from this page (including unsaved edits).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step,
  integer,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  onChange: (value: number) => void;
}) {
  const format = integer ? value.toFixed(0) : value.toFixed(step < 1 ? 2 : 0);

  const applyValue = (raw: number) => {
    if (Number.isNaN(raw)) return;
    const bounded = Math.max(min, Math.min(max, raw));
    onChange(integer ? Math.round(bounded) : bounded);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-[11px] text-slate-500">
          {min} - {max}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => applyValue(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-tertiary"
      />

      <Input
        type="number"
        value={format}
        min={min}
        max={max}
        step={step}
        onChange={(e) => applyValue(Number(e.target.value))}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
