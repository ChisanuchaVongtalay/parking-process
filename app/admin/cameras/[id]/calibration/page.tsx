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
  const { id } = await params;
  const camera = await db.query.cameras.findFirst({ where: eq(cameras.id, id) });
  if (!camera) {
    notFound();
  }

  const [slots, calibration] = await Promise.all([
    listCameraSlots(camera.id),
    getOrCreateCalibration(camera.id),
  ]);

  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold">Calibration Workspace</h2>
      <p className="text-sm text-slate-600">
        Draw slots, tune parameters, run test detection, and export runtime config.
      </p>

      <CalibrationWorkspace
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
