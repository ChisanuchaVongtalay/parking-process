import { requireParkingAdminPage } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Camera, Clock, ParkingSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeading, Panel, Stats, Status } from "@/components/admin/admin-ui";
import { db } from "@/db";
import { adminTime, readCameraHealth } from "@/lib/admin-overview";
import { listCameraSlots } from "@/services/camera-slots";

export const dynamic = "force-dynamic";

export default async function CameraDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireParkingAdminPage("/admin/cameras");
  const { id } = await params;
  const camera = await db.query.cameras.findFirst({ where: (cameras, { eq }) => eq(cameras.id, id) });
  if (!camera) notFound();
  const zone = await db.query.zones.findFirst({ where: (zones, { eq }) => eq(zones.id, camera.zoneId) });
  const health = readCameraHealth().find((row) => row.id === id);
  const slots = await listCameraSlots(id);
  const status = health?.status ?? "Unknown";
  const snapshot = camera.latestSnapshotPath?.split("/").map(encodeURIComponent).join("/");

  return <>
    <PageHeading title={`Camera Detail · ${camera.code}`} description={camera.name} parent={{ href: "/admin/cameras", label: "Cameras" }}
      actions={<>
        <Button asChild variant="outline"><Link href={`/admin/cameras/${id}/edit`}>แก้ไขข้อมูลกล้อง</Link></Button>
        <Button asChild><Link href={`/admin/cameras/${id}/calibration`}>Edit Calibration</Link></Button>
      </>} />
    <Stats items={[
      { label: "Capture status", value: status, icon: <Activity />, tone: status === "Fresh" ? "good" : status === "Error" ? "bad" : "neutral" },
      { label: "Last capture", value: adminTime(health?.captureAt), icon: <Camera /> },
      { label: "Last processed", value: adminTime(health?.processedAt), icon: <Clock />, tone: "warn" },
      { label: "Enabled slots", value: slots.filter((slot) => slot.enabled).length, icon: <ParkingSquare /> },
    ]} />
    <div className="admin-grid wide">
      <Panel title="Latest Snapshot Preview">
        {snapshot ? <img src={`/api/files/${snapshot}`} className="w-full rounded-lg bg-slate-100 object-contain" alt={`ภาพล่าสุดจากกล้อง ${camera.code}`} />
          : <EmptyState title="ยังไม่มีภาพจากกล้อง">ตรวจการตั้งค่า RTSP และการทำงานของ Snapshot Worker</EmptyState>}
      </Panel>
      <Panel title="Camera configuration">
        <dl className="admin-fields">
          <div><dt>Camera code</dt><dd>{camera.code}</dd></div>
          <div><dt>Zone</dt><dd><Link className="admin-link" href={`/admin/zones/${camera.zoneId}`}>{zone?.code ?? "—"}</Link></dd></div>
          <div><dt>RTSP input</dt><dd>{camera.streamUrl ? "Configured · ••••••••" : "Not configured"}</dd></div>
          <div><dt>Mode</dt><dd><Status tone={camera.isActive ? "good" : "neutral"}>{camera.isActive ? "Active" : "Disabled"}</Status></dd></div>
        </dl>
      </Panel>
    </div>
    <div className="admin-grid">
      <Panel title="Pipeline health"><dl className="admin-fields"><div><dt>RTSP capture</dt><dd>{status}</dd></div><div><dt>Background reference</dt><dd>{camera.backgroundImagePath ? "Configured" : "Not configured"}</dd></div></dl></Panel>
      <Panel title="Capture & processing incidents"><EmptyState title={health?.captureError ? "Capture error" : "ไม่มีข้อผิดพลาดจากการดึงภาพล่าสุด"}>
        {health?.captureError ? "ตรวจการเชื่อมต่อและการตั้งค่ากล้องในระบบ" : "ดูผลประมวลผลในหน้า Monitoring"}
      </EmptyState></Panel>
    </div>
  </>;
}
