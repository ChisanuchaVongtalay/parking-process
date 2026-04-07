export type VehicleType = "car" | "motorcycle";
export type ShapeType = "rect" | "polygon";

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Camera {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  streamUrl: string | null;
  backgroundImagePath: string | null;
  latestSnapshotPath: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalibrationProfile {
  id: string;
  cameraId: string;
  pixelThreshold: number;
  occupancyThreshold: number;
  grayscale: boolean;
  blurRadius: number;
  normalize: boolean;
  downscale: number;
  lightingCompensation: number;
  edgeWeight: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogicalSlot {
  id: string;
  zoneId: string;
  slotCode: string;
  vehicleType: VehicleType;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CameraSlot {
  id: string;
  cameraId: string;
  logicalSlotId: string | null;
  slotCode: string;
  vehicleType: VehicleType;
  shapeType: ShapeType;
  points: Point2D[];
  bbox: BoundingBox;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalibrationTestSlotResult {
  slotId: string;
  slotCode: string;
  score: number;
  occupied: boolean;
}

export interface CalibrationTestResult {
  cameraId: string;
  occupied: number;
  free: number;
  slots: CalibrationTestSlotResult[];
}
