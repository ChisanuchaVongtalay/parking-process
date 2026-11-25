import { isAuthOnlyDeployment } from "@/lib/auth/database";
import { requireAdminPage } from "@/lib/auth/session";
import Link from "next/link";
import { Activity, Camera, Clock, TriangleAlert } from "lucide-react";
import { DataTable, EmptyState, PageHeading, Panel, ParkingStorageNotice, Stats, Status } from "@/components/admin/admin-ui";
import { MonitorWorkspace } from "@/components/admin/monitor/monitor-workspace";
import { adminTime, readCameraHealth } from "@/lib/admin-overview";

export const dynamic = "force-dynamic";

export default async function Monitoring() {
  await requireAdminPage();
  const available = !isAuthOnlyDeployment();
  const cameras = available ? readCameraHealth() : [];
  const errors = cameras.filter((camera) => camera.status === "Error");

  return <>
    <PageHeading title="System Monitoring" description="ติดตามการดึงภาพ ผลประมวลผล และตรวจสอบปัญหาของกล้อง" />
    {!available && <ParkingStorageNotice />}
    <Stats items={[
      { label: "Enabled cameras", value: available ? cameras.filter((camera) => camera.active).length : "—", icon: <Camera /> },
      { label: "Fresh captures", value: available ? cameras.filter((camera) => camera.status === "Fresh").length : "—", icon: <Activity />, tone: "good" },
      { label: "Stale captures", value: available ? cameras.filter((camera) => camera.status === "Stale").length : "—", icon: <Clock />, tone: "warn" },
      { label: "Capture errors", value: available ? errors.length : "—", icon: <TriangleAlert />, tone: "bad" },
    ]} />
    <div className="admin-grid wide">
      <Panel title="Camera operations">
        <DataTable headings={["Camera", "Capture status", "Last capture", "Last processed"]}>
          {cameras.map((camera) => <tr key={camera.id}>
            <td><Link className="admin-link" href={`/admin/cameras/${camera.id}`}>{camera.code}</Link></td>
            <td><Status tone={camera.status === "Fresh" ? "good" : camera.status === "Error" ? "bad" : camera.status === "Stale" ? "warn" : "neutral"}>{camera.status}</Status></td>
            <td>{adminTime(camera.captureAt)}</td><td>{adminTime(camera.processedAt)}</td>
          </tr>)}
          {!cameras.length && <tr><td colSpan={4}>{available ? "ยังไม่มีกล้องในระบบ" : "รอข้อมูลจากระบบประมวลผล"}</td></tr>}
        </DataTable>
      </Panel>
      <Panel title="Processing pipeline">
        <ol className="space-y-3">{["RTSP Cameras", "FFmpeg Snapshot Worker", "Pixel Difference", "Camera & slot observations"].map((step) =>
          <li key={step} className="rounded-lg border border-[#ece9e5] bg-[#faf9f6] p-3 text-sm font-medium">{step}</li>)}</ol>
      </Panel>
      <Panel title="Capture incidents">
        {errors.length ? <ul className="space-y-2">{errors.map((camera) => <li key={camera.id}><Link className="admin-link" href={`/admin/cameras/${camera.id}`}>{camera.code}</Link> · Capture error</li>)}</ul>
          : <EmptyState title={available ? "ไม่มี Capture error ที่บันทึกไว้" : "รอข้อมูลจาก Worker"}>รายการจะแสดงเมื่อ Snapshot Worker รายงานข้อผิดพลาดล่าสุด</EmptyState>}
      </Panel>
      <Panel title="Operational notes"><p className="text-sm">เวลา Last capture และ Last processed บอกสถานะคนละขั้นตอน ตรวจทั้งสองค่าก่อนแปลผลช่องจอดใน Runtime</p></Panel>
    </div>
    {available && <MonitorWorkspace />}
  </>;
}
