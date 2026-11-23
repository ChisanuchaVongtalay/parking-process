import { db } from "@/db";

const maxAgeSeconds = Number(process.env.SNAPSHOT_MAX_AGE_SECONDS || 900);
const freshnessCutoff = () => Date.now() - (Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0 ? maxAgeSeconds : 900) * 1000;

export type ZoneSummary = {
  total: number;
  occupied: number;
  free: number;
};

export type PublicZoneSummaryRow = {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  lastUpdated: string | null;
  summary: ZoneSummary;
};

export type PublicCameraLatestSummary = {
  cameraId: string;
  zoneId: string;
  cameraCode: string;
  cameraName: string;
  occupied: number;
  free: number;
  total: number;
  capturedAt: string | null;
  snapshotPath: string | null;
};

export type PublicCameraSlotLatestRow = {
  cameraSlotId: string;
  slotCode: string;
  score: number;
  occupied: boolean;
  updatedAt: string;
};

export async function getCameraLatestSummary(
  cameraId: string,
): Promise<PublicCameraLatestSummary | null> {
  const row = db.$client
    .prepare(
      `
      SELECT
        c.code AS cameraCode,
        c.name AS cameraName,
        c.zone_id AS zoneId,
        co.camera_id AS cameraId,
        co.occupied_count AS occupied,
        co.free_count AS free,
        co.total_count AS total,
        co.captured_at AS capturedAt,
        co.snapshot_path AS snapshotPath
      FROM camera_observations co
      INNER JOIN cameras c ON c.id = co.camera_id
      WHERE co.camera_id = ? AND co.captured_at >= ${freshnessCutoff()}
      ORDER BY co.captured_at DESC
      LIMIT 1
    `,
    )
    .get(cameraId) as
    | {
        cameraId: string;
        zoneId: string;
        cameraCode: string;
        cameraName: string;
        occupied: number;
        free: number;
        total: number;
        capturedAt: number;
        snapshotPath: string;
      }
    | undefined;

  if (!row) return null;

  return {
    cameraId: row.cameraId,
    zoneId: row.zoneId,
    cameraCode: row.cameraCode,
    cameraName: row.cameraName,
    occupied: Number(row.occupied),
    free: Number(row.free),
    total: Number(row.total),
    capturedAt: row.capturedAt ? new Date(Number(row.capturedAt)).toISOString() : null,
    snapshotPath: row.snapshotPath ?? null,
  };
}

export async function getLatestCameraSummaries(zoneId?: string): Promise<PublicCameraLatestSummary[]> {
  const rows = db.$client
    .prepare(
      `
      WITH latest_per_camera AS (
        SELECT c.id AS camera_id, MAX(co.captured_at) AS max_captured_at
        FROM cameras c
        LEFT JOIN camera_observations co ON co.camera_id = c.id AND co.captured_at >= ${freshnessCutoff()}
        ${zoneId ? "WHERE c.zone_id = ?" : ""}
        GROUP BY c.id
      )
      SELECT
        c.id AS cameraId,
        c.zone_id AS zoneId,
        c.code AS cameraCode,
        c.name AS cameraName,
        co.occupied_count AS occupied,
        co.free_count AS free,
        co.total_count AS total,
        co.captured_at AS capturedAt,
        co.snapshot_path AS snapshotPath
      FROM latest_per_camera lpc
      INNER JOIN cameras c ON c.id = lpc.camera_id
      LEFT JOIN camera_observations co
        ON co.camera_id = lpc.camera_id
       AND co.captured_at = lpc.max_captured_at
      ORDER BY c.code ASC
    `,
    )
    .all(...(zoneId ? [zoneId] : [])) as Array<{
      cameraId: string;
      zoneId: string;
      cameraCode: string;
      cameraName: string;
      occupied: number | null;
      free: number | null;
      total: number | null;
      capturedAt: number | null;
      snapshotPath: string | null;
    }>;

  return rows.map((row) => ({
    cameraId: row.cameraId,
    zoneId: row.zoneId,
    cameraCode: row.cameraCode,
    cameraName: row.cameraName,
    occupied: Number(row.occupied ?? 0),
    free: Number(row.free ?? 0),
    total: Number(row.total ?? 0),
    capturedAt: row.capturedAt ? new Date(Number(row.capturedAt)).toISOString() : null,
    snapshotPath: row.snapshotPath,
  }));
}

export async function getZonesWithLatestSummary(): Promise<PublicZoneSummaryRow[]> {
  const rows = db.$client
    .prepare(
      `
      WITH latest_per_camera AS (
        SELECT c.id AS camera_id, MAX(co.captured_at) AS max_captured_at
        FROM cameras c
        LEFT JOIN camera_observations co ON co.camera_id = c.id AND co.captured_at >= ${freshnessCutoff()}
        GROUP BY c.id
      ),
      latest_observations AS (
        SELECT
          co.camera_id,
          co.occupied_count,
          co.free_count,
          co.total_count,
          co.captured_at
        FROM camera_observations co
        INNER JOIN latest_per_camera lpc
          ON lpc.camera_id = co.camera_id
         AND lpc.max_captured_at = co.captured_at
      )
      SELECT
        z.id AS zoneId,
        z.code AS zoneCode,
        z.name AS zoneName,
        COALESCE(SUM(lo.total_count), 0) AS total,
        COALESCE(SUM(lo.occupied_count), 0) AS occupied,
        COALESCE(SUM(lo.free_count), 0) AS free,
        MAX(lo.captured_at) AS lastCapturedAt
      FROM zones z
      LEFT JOIN cameras c ON c.zone_id = z.id
      LEFT JOIN latest_observations lo ON lo.camera_id = c.id
      GROUP BY z.id, z.code, z.name
      ORDER BY z.code ASC
    `,
    )
    .all() as Array<{
      zoneId: string;
      zoneCode: string;
      zoneName: string;
      total: number;
      occupied: number;
      free: number;
      lastCapturedAt: number | null;
    }>;

  return rows.map((casted) => {
    return {
      zoneId: casted.zoneId,
      zoneCode: casted.zoneCode,
      zoneName: casted.zoneName,
      lastUpdated: casted.lastCapturedAt
        ? new Date(Number(casted.lastCapturedAt)).toISOString()
        : null,
      summary: {
        total: Number(casted.total),
        occupied: Number(casted.occupied),
        free: Number(casted.free),
      },
    };
  });
}

export async function getCameraLatestSlotObservations(
  cameraId: string,
): Promise<PublicCameraSlotLatestRow[]> {
  const rows = db.$client
    .prepare(
      `
      WITH latest_observation AS (
        SELECT co.id AS observation_id, co.captured_at AS captured_at
        FROM camera_observations co
        WHERE co.camera_id = ? AND co.captured_at >= ${freshnessCutoff()}
        ORDER BY co.captured_at DESC
        LIMIT 1
      )
      SELECT
        so.camera_slot_id AS cameraSlotId,
        cs.slot_code AS slotCode,
        so.score AS score,
        so.occupied AS occupied,
        lo.captured_at AS updatedAt
      FROM slot_observations so
      INNER JOIN latest_observation lo ON lo.observation_id = so.observation_id
      INNER JOIN camera_slots cs ON cs.id = so.camera_slot_id
      ORDER BY cs.slot_code ASC
    `,
    )
    .all(cameraId) as Array<{
      cameraSlotId: string;
      slotCode: string;
      score: number;
      occupied: number;
      updatedAt: number;
    }>;

  return rows.map((row) => ({
    cameraSlotId: row.cameraSlotId,
    slotCode: row.slotCode,
    score: Number(row.score) / 10000,
    occupied: Boolean(row.occupied),
    updatedAt: new Date(Number(row.updatedAt)).toISOString(),
  }));
}

export async function getZoneSummary(zoneId: string): Promise<ZoneSummary | null> {
  const row = db.$client
    .prepare(
      `
      WITH latest_per_camera AS (
        SELECT c.id AS camera_id, MAX(co.captured_at) AS max_captured_at
        FROM cameras c
        LEFT JOIN camera_observations co ON co.camera_id = c.id AND co.captured_at >= ${freshnessCutoff()}
        WHERE c.zone_id = ?
        GROUP BY c.id
      ),
      latest_observations AS (
        SELECT
          co.camera_id,
          co.occupied_count,
          co.free_count,
          co.total_count
        FROM camera_observations co
        INNER JOIN latest_per_camera lpc
          ON lpc.camera_id = co.camera_id
         AND lpc.max_captured_at = co.captured_at
      )
      SELECT
        COALESCE(SUM(lo.total_count), 0) AS total,
        COALESCE(SUM(lo.occupied_count), 0) AS occupied,
        COALESCE(SUM(lo.free_count), 0) AS free
      FROM cameras c
      LEFT JOIN latest_observations lo ON lo.camera_id = c.id
      WHERE c.zone_id = ?
    `,
    )
    .get(zoneId, zoneId) as { total: number; occupied: number; free: number } | undefined;
  if (!row) return null;

  return {
    total: Number(row.total),
    occupied: Number(row.occupied),
    free: Number(row.free),
  };
}
