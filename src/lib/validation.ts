import { z } from "zod";

export const vehicleTypeSchema = z.enum(["car", "motorcycle"]);
export const shapeTypeSchema = z.enum(["rect", "polygon"]);

export const zoneCreateSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
});

export const cameraCreateSchema = z.object({
  zoneId: z.string().min(1),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(150),
  streamUrl: z.string().url().nullable().optional(),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const cameraPatchSchema = cameraCreateSchema.omit({ isPrimary: true, isActive: true }).partial().extend({
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const bboxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const slotItemSchema = z.object({
  id: z.string().optional(),
  logicalSlotId: z.string().nullable().optional(),
  slotCode: z.string().min(1).max(64),
  vehicleType: vehicleTypeSchema,
  shapeType: shapeTypeSchema.default("rect"),
  points: z.array(pointSchema).min(4),
  bbox: bboxSchema,
  enabled: z.boolean().default(true),
});

export const slotBulkSchema = z.object({
  slots: z.array(slotItemSchema),
});

export const calibrationUpdateSchema = z.object({
  pixelThreshold: z.number().min(0).max(1),
  occupancyThreshold: z.number().min(0).max(1),
  grayscale: z.boolean(),
  blurRadius: z.number().int().min(0).max(9),
  normalize: z.boolean(),
  downscale: z.number().min(0.1).max(1),
  lightingCompensation: z.number().min(0).max(2),
  edgeWeight: z.number().min(0).max(5),
});
