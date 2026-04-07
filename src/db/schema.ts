import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const nowMs = sql`(CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))`;

export const zones = sqliteTable(
  "zones",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    codeUnique: uniqueIndex("zones_code_unique").on(table.code),
  }),
);

export const cameras = sqliteTable(
  "cameras",
  {
    id: text("id").primaryKey().notNull(),
    zoneId: text("zone_id").notNull().references(() => zones.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    streamUrl: text("stream_url"),
    backgroundImagePath: text("background_image_path"),
    latestSnapshotPath: text("latest_snapshot_path"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    zoneIdx: index("cameras_zone_idx").on(table.zoneId),
    zoneCodeUnique: uniqueIndex("cameras_zone_code_unique").on(table.zoneId, table.code),
  }),
);

export const calibrationProfiles = sqliteTable(
  "calibration_profiles",
  {
    id: text("id").primaryKey().notNull(),
    cameraId: text("camera_id").notNull().references(() => cameras.id),
    pixelThreshold: integer("pixel_threshold").notNull().default(15),
    occupancyThreshold: integer("occupancy_threshold").notNull().default(8),
    grayscale: integer("grayscale", { mode: "boolean" }).notNull().default(true),
    blurRadius: integer("blur_radius").notNull().default(1),
    normalize: integer("normalize", { mode: "boolean" }).notNull().default(true),
    downscale: integer("downscale").notNull().default(1000),
    lightingCompensation: integer("lighting_compensation").notNull().default(700),
    edgeWeight: integer("edge_weight").notNull().default(1500),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    cameraUnique: uniqueIndex("calibration_profiles_camera_unique").on(table.cameraId),
  }),
);

export const logicalSlots = sqliteTable(
  "logical_slots",
  {
    id: text("id").primaryKey().notNull(),
    zoneId: text("zone_id").notNull().references(() => zones.id),
    slotCode: text("slot_code").notNull(),
    vehicleType: text("vehicle_type", { enum: ["car", "motorcycle"] }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    zoneSlotUnique: uniqueIndex("logical_slots_zone_slot_unique").on(table.zoneId, table.slotCode),
    zoneOrderIdx: index("logical_slots_zone_order_idx").on(table.zoneId, table.displayOrder),
  }),
);

export const cameraSlots = sqliteTable(
  "camera_slots",
  {
    id: text("id").primaryKey().notNull(),
    cameraId: text("camera_id").notNull().references(() => cameras.id),
    logicalSlotId: text("logical_slot_id").references(() => logicalSlots.id),
    slotCode: text("slot_code").notNull(),
    vehicleType: text("vehicle_type", { enum: ["car", "motorcycle"] }).notNull(),
    shapeType: text("shape_type", { enum: ["rect", "polygon"] }).notNull().default("rect"),
    pointsJson: text("points_json").notNull(),
    bboxJson: text("bbox_json").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    cameraSlotUnique: uniqueIndex("camera_slots_camera_slot_unique").on(table.cameraId, table.slotCode),
    cameraIdx: index("camera_slots_camera_idx").on(table.cameraId),
    logicalIdx: index("camera_slots_logical_idx").on(table.logicalSlotId),
  }),
);

export const calibrationRuns = sqliteTable(
  "calibration_runs",
  {
    id: text("id").primaryKey().notNull(),
    cameraId: text("camera_id").notNull().references(() => cameras.id),
    snapshotPath: text("snapshot_path").notNull(),
    paramsJson: text("params_json").notNull(),
    resultJson: text("result_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    cameraCreatedIdx: index("calibration_runs_camera_created_idx").on(table.cameraId, table.createdAt),
  }),
);

export const configExports = sqliteTable(
  "config_exports",
  {
    id: text("id").primaryKey().notNull(),
    cameraId: text("camera_id").references(() => cameras.id),
    zoneId: text("zone_id").references(() => zones.id),
    version: integer("version").notNull().default(1),
    exportPath: text("export_path").notNull(),
    checksum: text("checksum").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    zoneIdx: index("config_exports_zone_idx").on(table.zoneId),
    cameraIdx: index("config_exports_camera_idx").on(table.cameraId),
  }),
);

export const cameraObservations = sqliteTable(
  "camera_observations",
  {
    id: text("id").primaryKey().notNull(),
    cameraId: text("camera_id").notNull().references(() => cameras.id),
    snapshotPath: text("snapshot_path").notNull(),
    occupiedCount: integer("occupied_count").notNull(),
    freeCount: integer("free_count").notNull(),
    totalCount: integer("total_count").notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    cameraCapturedIdx: index("camera_observations_camera_captured_idx").on(
      table.cameraId,
      table.capturedAt,
    ),
  }),
);

export const slotObservations = sqliteTable(
  "slot_observations",
  {
    id: text("id").primaryKey().notNull(),
    observationId: text("observation_id")
      .notNull()
      .references(() => cameraObservations.id),
    cameraSlotId: text("camera_slot_id").notNull().references(() => cameraSlots.id),
    score: integer("score").notNull(),
    occupied: integer("occupied", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => ({
    observationIdx: index("slot_observations_observation_idx").on(table.observationId),
    slotIdx: index("slot_observations_camera_slot_idx").on(table.cameraSlotId),
  }),
);

export type ZoneRow = typeof zones.$inferSelect;
export type CameraRow = typeof cameras.$inferSelect;
export type CalibrationProfileRow = typeof calibrationProfiles.$inferSelect;
export type LogicalSlotRow = typeof logicalSlots.$inferSelect;
export type CameraSlotRow = typeof cameraSlots.$inferSelect;
export type CalibrationRunRow = typeof calibrationRuns.$inferSelect;
export type ConfigExportRow = typeof configExports.$inferSelect;
export type CameraObservationRow = typeof cameraObservations.$inferSelect;
export type SlotObservationRow = typeof slotObservations.$inferSelect;
