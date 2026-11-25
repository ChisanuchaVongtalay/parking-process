import { requireParkingAdminPage } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { PageHeading, Panel } from "@/components/admin/admin-ui";
import { CameraEditForm } from "@/components/admin/camera-edit-form";
import { db } from "@/db";
import { cameras, zones } from "@/db/schema";

export default async function CameraEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireParkingAdminPage();
  const { id } = await params;
  const camera = db.query.cameras.findFirst({ where: eq(cameras.id, id) }).sync();
  if (!camera) notFound();

  const zoneOptions = db.select({ id: zones.id, code: zones.code, name: zones.name }).from(zones).orderBy(asc(zones.code)).all();

  return (
    <>
      <PageHeading title={`Edit Camera · ${camera.code}`} description="แก้ไขข้อมูล การเชื่อมต่อ และสถานะของกล้อง"
        parent={{ href: `/admin/cameras/${id}`, label: "Camera Detail" }} />
      <Panel title="Camera settings">
        <CameraEditForm camera={{
          id: camera.id,
          zoneId: camera.zoneId,
          code: camera.code,
          name: camera.name,
          isPrimary: camera.isPrimary,
          isActive: camera.isActive,
          hasStream: Boolean(camera.streamUrl),
        }} zones={zoneOptions} />
      </Panel>
    </>
  );
}
