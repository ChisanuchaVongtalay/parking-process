"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type MonitorZoneSummary = {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  lastUpdated: string | null;
  summary: {
    total: number;
    occupied: number;
    free: number;
  };
};

export function ZoneSummaryPanel(props: {
  zones: MonitorZoneSummary[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string | null) => void;
}) {
  const { zones, selectedZoneId, onSelectZone } = props;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Zone Summary</h3>
        <button
          className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
          onClick={() => onSelectZone(null)}
        >
          Show All
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {zones.map((zone) => {
          const selected = selectedZoneId === zone.zoneId;
          return (
            <button key={zone.zoneId} className="text-left" onClick={() => onSelectZone(zone.zoneId)}>
              <Card className={selected ? "border-tertiary ring-1 ring-tertiary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-tertiary">
                    {zone.zoneCode} · {zone.zoneName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>Total: {zone.summary.total}</p>
                  <p className="text-primary">Occupied: {zone.summary.occupied}</p>
                  <p className="text-success">Free: {zone.summary.free}</p>
                  <p className="text-xs text-slate-500">
                    Last updated: {zone.lastUpdated ? new Date(zone.lastUpdated).toLocaleString() : "-"}
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
