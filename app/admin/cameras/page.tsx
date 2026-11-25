import { isAuthOnlyDeployment } from "@/lib/auth/database";
import { requireAdminPage } from "@/lib/auth/session";
import { Activity, Camera, Clock, TriangleAlert } from "lucide-react";
import { CameraManager } from "@/components/admin/camera-manager";
import { Notice, PageHeading, ParkingStorageNotice, Stats } from "@/components/admin/admin-ui";
import { readCameraHealth } from "@/lib/admin-overview";

export const dynamic = "force-dynamic";

export default async function CamerasPage() {
  await requireAdminPage();
  const available = !isAuthOnlyDeployment();
  const cameras = available ? readCameraHealth() : [];
  return <>
    <PageHeading title="Cameras" description="ลงทะเบียนกล้อง ตรวจสถานะการดึงภาพ และเปิด Calibration Editor" />
    {available ? <Notice title="RTSP configuration">ข้อมูลการเชื่อมต่อจะแสดงเป็นสถานะและถูกเว้นไว้ใน CSV ที่ส่งออก</Notice> : <ParkingStorageNotice />}
    <Stats items={[
      { label: "Configured cameras", value: available ? cameras.length : "—", icon: <Camera /> },
      { label: "Fresh captures", value: available ? cameras.filter((camera) => camera.status === "Fresh").length : "—", icon: <Activity />, tone: "good" },
      { label: "Stale", value: available ? cameras.filter((camera) => camera.status === "Stale").length : "—", icon: <Clock />, tone: "warn" },
      { label: "Capture errors", value: available ? cameras.filter((camera) => camera.status === "Error").length : "—", icon: <TriangleAlert />, tone: "bad" },
    ]} />
    <CameraManager available={available} health={Object.fromEntries(cameras.map((camera) => [camera.id, camera.status]))} />
  </>;
}
