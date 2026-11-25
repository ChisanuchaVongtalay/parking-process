import { requireAdminPage } from "@/lib/auth/session";
import { MapPin, ParkingSquare } from "lucide-react";
import { ZoneManager } from "@/components/admin/zone-manager";
import { PageHeading, Stats } from "@/components/admin/admin-ui";
import { readParkingOverview } from "@/lib/admin-overview";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  await requireAdminPage();
  const { zones, totals } = readParkingOverview();
  const inventory = Object.fromEntries(zones.map((zone) => [zone.id, {
    slots: zone.slots.length, known: zone.free + zone.occupied,
  }]));
  return <>
    <PageHeading title="Parking Zones" description="จัดการโซนจอดรถและตรวจความครอบคลุมของข้อมูลช่องจอด" />
    <Stats items={[
      { label: "Parking zones", value: zones.length, icon: <MapPin /> },
      { label: "Logical slots", value: totals.slots, icon: <ParkingSquare /> },
      { label: "Zones with observations", value: zones.filter((zone) => zone.free + zone.occupied > 0).length, icon: <MapPin />, tone: "good" },
    ]} />
    <ZoneManager inventory={inventory} />
  </>;
}
