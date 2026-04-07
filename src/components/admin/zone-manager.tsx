"use client";

import { useEffect, useState } from "react";

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

export function ZoneManager() {
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/zones", { cache: "no-store" });
    const json = await res.json();
    setZones(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createZone() {
    const res = await fetch("/api/admin/zones", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        description: form.description || null,
      }),
    });

    if (!res.ok) {
      alert("Cannot create zone");
      return;
    }

    setForm({ code: "", name: "", description: "" });
    await load();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <Button onClick={createZone} className="w-full">
            Create Zone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zones</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-600">Loading...</p> : null}
          <div className="space-y-2">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
              >
                <p className="font-semibold text-tertiary">
                  {zone.code} · {zone.name}
                </p>
                <p className="text-slate-600">{zone.description || "-"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
