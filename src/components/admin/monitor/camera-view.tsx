"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type MonitorCameraSummary = {
  cameraId: string;
  zoneId: string;
  cameraCode: string;
  cameraName: string;
  occupied: number;
  free: number;
  total: number;
  capturedAt: string | null;
  snapshotPath: string | null;
};

export function CameraDetailView(props: {
  summary: MonitorCameraSummary | null;
}) {
  const { summary } = props;

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Camera Detail</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">Select camera to view detail.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {summary.cameraCode} · {summary.cameraName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {summary.snapshotPath ? (
          <img
            src={`/api/files/${summary.snapshotPath}`}
            alt="latest snapshot"
            className="h-64 w-full rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <div className="grid h-64 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
            No snapshot available
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-md border border-slate-200 p-3">
          <p>Total: {summary.total}</p>
          <p className="text-primary">Occupied: {summary.occupied}</p>
          <p className="text-success">Free: {summary.free}</p>
        </div>

        <p className="text-xs text-slate-500">
          Last updated: {summary.capturedAt ? new Date(summary.capturedAt).toLocaleString() : "-"}
        </p>
      </CardContent>
    </Card>
  );
}
