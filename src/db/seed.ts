import { eq } from "drizzle-orm";

import { db } from "./index";
import { calibrationProfiles, cameras, logicalSlots, zones } from "./schema";

async function seed() {
  const existingZone = await db.query.zones.findFirst({ where: eq(zones.code, "E1") });
  if (existingZone) {
    console.log("Seed already exists.");
    return;
  }

  const now = new Date();
  const zoneId = "zone_e1_demo";
  const cameraId = "cam_e1_demo_01";

  await db.insert(zones).values({
    id: zoneId,
    code: "E1",
    name: "Dorm E1",
    description: "Sample zone",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(cameras).values({
    id: cameraId,
    zoneId,
    code: "E1-CAM-01",
    name: "E1 Front Camera",
    streamUrl: null,
    backgroundImagePath: null,
    latestSnapshotPath: null,
    isPrimary: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(calibrationProfiles).values({
    id: "cal_e1_demo_01",
    cameraId,
    pixelThreshold: 15,
    occupancyThreshold: 8,
    grayscale: true,
    blurRadius: 1,
    normalize: true,
    downscale: 1000,
    lightingCompensation: 700,
    edgeWeight: 1500,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(logicalSlots).values([
    {
      id: "ls_e1_a01",
      zoneId,
      slotCode: "A01",
      vehicleType: "car",
      displayOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ls_e1_m01",
      zoneId,
      slotCode: "M01",
      vehicleType: "motorcycle",
      displayOrder: 2,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("Seed completed.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
