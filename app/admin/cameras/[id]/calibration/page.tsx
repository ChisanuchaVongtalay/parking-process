import { requireAdminPage } from "@/lib/auth/session";
import { PageHeading } from "@/components/admin/admin-ui";

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { CalibrationWorkspace } from "@/components/calibration/calibration-workspace";
import { db } from "@/db";
import { cameras } from "@/db/schema";
import { getOrCreateCalibration } from "@/services/calibration";
import { listCameraSlots } from "@/services/camera-slots";

export default async function CameraCalibrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });
  if (!camera) {
    notFound();
  }

  const [slots, calibration, physicalSlots] = await Promise.all([
    listCameraSlots(camera.id),
    getOrCreateCalibration(camera.id),
    db.query.logicalSlots.findMany({
      where: (slots, { and, eq }) => and(eq(slots.zoneId, camera.zoneId), eq(slots.isActive, true)),
      columns: { id: true, slotCode: true, vehicleType: true },
      orderBy: (slots, { asc }) => [asc(slots.slotCode)],
    }),
  ]);

  return (
    <div className="space-y-2">
      <PageHeading title={`Calibration Editor · ${camera.code}`}
        description="กำหนดขอบเขตช่องจอด ปรับ Pixel Difference และทดสอบก่อนเปิดนับช่อง"
        parent={{ href: `/admin/cameras/${camera.id}`, label: "Camera Detail" }} />

      <CalibrationWorkspace physicalSlots={physicalSlots}
        initialCamera={{
          id: camera.id,
          code: camera.code,
          name: camera.name,
          backgroundImagePath: camera.backgroundImagePath,
          latestSnapshotPath: camera.latestSnapshotPath,
        }}
        initialSlots={slots.map((slot) => ({
          id: slot.id,
          slotCode: slot.slotCode,
          vehicleType: slot.vehicleType,
          shapeType: slot.shapeType,
          points: slot.points,
          bbox: slot.bbox,
          enabled: slot.enabled,
          logicalSlotId: slot.logicalSlotId,
        }))}
        initialCalibration={{
          pixelThreshold: calibration.pixelThreshold,
          occupancyThreshold: calibration.occupancyThreshold,
          grayscale: calibration.grayscale,
          blurRadius: calibration.blurRadius,
          normalize: calibration.normalize,
          downscale: calibration.downscale,
          lightingCompensation: calibration.lightingCompensation,
          edgeWeight: calibration.edgeWeight,
        }}
      />
    </div>
  );
}
