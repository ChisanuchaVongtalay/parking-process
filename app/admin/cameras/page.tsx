import { requireAdminPage } from "@/lib/auth/session";
import { Activity, Camera, Clock, TriangleAlert } from "lucide-react";
import { CameraManager } from "@/components/admin/camera-manager";
import { Notice, PageHeading, Stats } from "@/components/admin/admin-ui";
import { readCameraHealth } from "@/lib/admin-overview";

export const dynamic = "force-dynamic";

export default async function CamerasPage() {
  await requireAdminPage();
  const cameras = readCameraHealth();
  return <>
    <PageHeading title="Cameras" description="ลงทะเบียนกล้อง ตรวจสถานะการดึงภาพ และเปิด Calibration Editor" />
    <Notice title="RTSP configuration">ข้อมูลการเชื่อมต่อจะแสดงเป็นสถานะและถูกเว้นไว้ใน CSV ที่ส่งออก</Notice>
    <Stats items={[
      { label: "Configured cameras", value: cameras.length, icon: <Camera /> },
      { label: "Fresh captures", value: cameras.filter((camera) => camera.status === "Fresh").length, icon: <Activity />, tone: "good" },
      { label: "Stale", value: cameras.filter((camera) => camera.status === "Stale").length, icon: <Clock />, tone: "warn" },
      { label: "Capture errors", value: cameras.filter((camera) => camera.status === "Error").length, icon: <TriangleAlert />, tone: "bad" },
    ]} />
    <CameraManager health={Object.fromEntries(cameras.map((camera) => [camera.id, camera.status]))} />
  </>;
}
