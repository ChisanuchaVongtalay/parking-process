import { requireAdminPage } from "@/lib/auth/session";
import Link from "next/link";
import { Activity, Camera, Car, CircleHelp, Gauge, MapPin, ParkingSquare } from "lucide-react";
import { adminTime, readCameraHealth, readParkingOverview } from "@/lib/admin-overview";
import { DataTable, EmptyState, Notice, PageHeading, Panel, Stats, Status } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requireAdminPage();
  const { zones, totals } = readParkingOverview();
  const cameras = readCameraHealth();
  const known = totals.free + totals.occupied;
  const coverage = totals.slots ? (known / totals.slots * 100).toFixed(1) + "%" : "—";
  const captureStates = ["Fresh", "Stale", "Error", "Unknown", "Disabled"];
  const latestCapture = cameras.reduce<number | null>((latest, camera) =>
    camera.captureAt !== null && (latest === null || camera.captureAt > latest) ? camera.captureAt : latest, null);

  return (
    <>
      <PageHeading title="Admin Dashboard" description="ภาพรวมการใช้พื้นที่จอดรถและสถานะระบบประมวลผล" />
      <Notice title={known ? "ข้อมูลจากกล้องและช่องจอดที่กำหนดไว้" : "ยังไม่มีข้อมูลสถานะช่องจอดที่ใช้สรุปได้"}>
        Coverage คำนวณจากช่องที่มีผลล่าสุดและผลจากกล้องสอดคล้องกัน อัปเดตภาพล่าสุด {adminTime(latestCapture)}
      </Notice>
      <Stats items={[
        { label: "Logical slots", value: totals.slots, icon: <ParkingSquare /> },
        { label: "Occupied", value: known ? totals.occupied : "—", icon: <Car />, tone: "bad" },
        { label: "Physically free", value: known ? totals.free : "—", icon: <ParkingSquare />, tone: "good" },
        { label: "Unknown", value: totals.unknown, icon: <CircleHelp />, tone: "neutral" },
        { label: "Coverage", value: coverage, detail: `${known} / ${totals.slots} slots`, icon: <Gauge />, tone: "warn" },
      ]} />
      <div className="admin-grid wide">
        <Panel title="Zone overview" detail="จำนวนช่องว่างและช่องที่มีรถจากผลประมวลผลล่าสุด">
          {zones.length ? <DataTable headings={["Zone", "Slots", "Occupied", "Free", "Coverage", "Status"]}>
            {zones.map((zone) => {
              const known = zone.occupied + zone.free;
              return <tr key={zone.id}>
                <td><Link className="admin-link" href={`/admin/zones/${zone.id}`}>{zone.code}</Link><small>{zone.name}</small></td>
                <td>{zone.slots.length}</td><td>{known ? zone.occupied : "—"}</td><td>{known ? zone.free : "—"}</td>
                <td>{zone.slots.length ? <><progress className="block w-20 accent-primary" aria-label={`Coverage ${zone.code}`} max={zone.slots.length} value={known} />{known}/{zone.slots.length}</> : "—"}</td>
                <td><Status tone={!known ? "neutral" : zone.unknown ? "warn" : "good"}>{!known ? "Unknown" : zone.unknown ? "Partial" : "Fresh"}</Status></td>
              </tr>;
            })}
          </DataTable> : <EmptyState title="ยังไม่มีโซน"><Link className="admin-link" href="/admin/zones">จัดการโซนจอดรถ</Link></EmptyState>}
        </Panel>
        <Panel title="Campus map" detail="ตำแหน่งโซนในมหาวิทยาลัย">
          <div className="admin-map"><MapPin size={30} aria-hidden="true" /><strong>รอข้อมูลตำแหน่งที่ยืนยันแล้ว</strong>
            <div className="admin-actions justify-center">{zones.map((zone) => <Link className="admin-code" key={zone.id} href={`/admin/zones/${zone.id}`}>{zone.code}</Link>)}</div>
          </div>
        </Panel>
      </div>
      <div className="admin-grid three">
        <Panel title="Camera Health" detail="สถานะการดึงภาพจาก Worker">
          <dl className="admin-fields">{captureStates.map((status) => <div key={status}><dt>{status}</dt><dd>{cameras.filter((camera) => camera.status === status).length}</dd></div>)}</dl>
          <Link className="admin-link mt-3 inline-flex items-center gap-2" href="/admin/monitor"><Activity size={16} /> Monitoring</Link>
        </Panel>
        <Panel title="Vehicle Approvals"><EmptyState title="Not connected">รอเชื่อม Shared Vehicle Service</EmptyState></Panel>
        <Panel title="Recent system activity" detail="เวลาที่กล้องดึงภาพสำเร็จล่าสุด">
          {cameras.some((camera) => camera.captureAt !== null) ? <ul className="space-y-3">
            {cameras.filter((camera) => camera.captureAt !== null).sort((a, b) => (b.captureAt ?? 0) - (a.captureAt ?? 0)).slice(0, 4).map((camera) =>
              <li key={camera.id} className="flex items-center gap-2 text-sm"><Camera size={16} /><Link className="admin-link" href={`/admin/cameras/${camera.id}`}>{camera.code}</Link><span>{adminTime(camera.captureAt)}</span></li>)}
          </ul> : <EmptyState title="ยังไม่มีประวัติการดึงภาพ">ข้อมูลจะแสดงเมื่อ Worker ดึงภาพสำเร็จ</EmptyState>}
        </Panel>
      </div>
    </>
  );
}
