import { isAuthOnlyDeployment } from "@/lib/auth/database";
import { requireAdminPage } from "@/lib/auth/session";
import { MapPin, ParkingSquare } from "lucide-react";
import { ZoneManager } from "@/components/admin/zone-manager";
import { PageHeading, ParkingStorageNotice, Stats } from "@/components/admin/admin-ui";
import { readParkingOverview } from "@/lib/admin-overview";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  await requireAdminPage();
  const available = !isAuthOnlyDeployment();
  const overview = available ? readParkingOverview() : null;
  const zones = overview?.zones ?? [];
  const inventory = Object.fromEntries(zones.map((zone) => [zone.id, {
    slots: zone.slots.length, known: zone.free + zone.occupied,
  }]));
  return <>
    <PageHeading title="Parking Zones" description="จัดการโซนจอดรถและตรวจความครอบคลุมของข้อมูลช่องจอด" />
    {!available && <ParkingStorageNotice />}
    <Stats items={[
      { label: "Parking zones", value: overview?.zones.length ?? "—", icon: <MapPin /> },
      { label: "Logical slots", value: overview?.totals.slots ?? "—", icon: <ParkingSquare /> },
      { label: "Zones with observations", value: available ? zones.filter((zone) => zone.free + zone.occupied > 0).length : "—", icon: <MapPin />, tone: "good" },
    ]} />
    <ZoneManager available={available} inventory={inventory} />
  </>;
}
