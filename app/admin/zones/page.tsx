import { ZoneManager } from "@/components/admin/zone-manager";

export default function ZonesPage() {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold">Zone Management</h2>
      <p className="text-sm text-slate-600">Create and maintain business parking zones.</p>
      <ZoneManager />
    </div>
  );
}
