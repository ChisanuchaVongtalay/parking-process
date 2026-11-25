import { requireParkingAdminPage } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, CircleHelp, ParkingSquare } from "lucide-react";
import { readCameraHealth, readParkingOverview } from "@/lib/admin-overview";
import { DataTable, EmptyState, PageHeading, Panel, Stats, Status } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";

function slotTone(status: string) {
  return status === "Free" ? "good" : status === "Occupied" ? "bad" : status === "Unknown" ? "neutral" : "warn";
}

export default async function ZoneDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireParkingAdminPage();
  const { id } = await params;
  const zone = readParkingOverview().zones.find((item) => item.id === id);
  if (!zone) notFound();
  const cameras = readCameraHealth().filter((camera) => camera.zoneId === id);
  const known = zone.occupied + zone.free;

  return <>
    <PageHeading title={`Zone Detail · ${zone.code}`} description={zone.name} parent={{ href: "/admin/zones", label: "Parking Zones" }} />
    <Stats items={[
      { label: "Logical slots", value: zone.slots.length, icon: <ParkingSquare /> },
      { label: "Occupied", value: known ? zone.occupied : "—", icon: <Car />, tone: "bad" },
      { label: "Physically free", value: known ? zone.free : "—", icon: <ParkingSquare />, tone: "good" },
      { label: "Unknown", value: zone.unknown, icon: <CircleHelp />, tone: "neutral" },
    ]} />
    <div className="admin-grid wide">
      <Panel title="ผังช่องจอด" detail="เรียงตามลำดับช่องที่ตั้งค่าไว้">
        {zone.slots.length ? <div className="admin-lot">{zone.slots.map((slot) =>
          <Status key={slot.id} tone={slotTone(slot.status)}>{slot.code}<br />{slot.status}</Status>)}</div>
          : <EmptyState title="ยังไม่ได้กำหนดช่องจอด">กำหนดช่องผ่าน Calibration Editor ของกล้องในโซนนี้</EmptyState>}
      </Panel>
      <Panel title="Zone & camera mapping">
        <dl className="admin-fields"><div><dt>Zone</dt><dd>{zone.name}</dd></div><div><dt>Coverage</dt><dd>{known} / {zone.slots.length}</dd></div></dl>
        {cameras.length ? <ul className="mt-3 space-y-2">{cameras.map((camera) =>
          <li key={camera.id}><Link className="admin-link" href={`/admin/cameras/${camera.id}`}>{camera.code} · {camera.name}</Link></li>)}</ul>
          : <p className="mt-3 text-sm">ยังไม่มีกล้องในโซนนี้</p>}
      </Panel>
    </div>
    <Panel title="Logical slots · Camera mapping">
      <DataTable headings={["Slot", "Vehicle type", "Camera mapping", "Status"]}>
        {zone.slots.map((slot) => <tr key={slot.id}><td>{slot.code}</td><td>{slot.vehicleType}</td><td>{slot.cameras ?? "Unmapped"}</td><td><Status tone={slotTone(slot.status)}>{slot.status}</Status></td></tr>)}
        {!zone.slots.length && <tr><td colSpan={4}>ยังไม่มีช่องจอด</td></tr>}
      </DataTable>
    </Panel>
  </>;
}
