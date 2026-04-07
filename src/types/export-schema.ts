import type { ShapeType, VehicleType } from "./domain";

export interface ExportedSlotConfig {
  camera_slot_id: string;
  logical_slot_id: string | null;
  slot_code: string;
  vehicle_type: VehicleType;
  shape_type: ShapeType;
  points: [number, number][];
}

export interface ExportedCameraConfig {
  id: string;
  is_primary: boolean;
  background_image: string | null;
  calibration: {
    pixel_threshold: number;
    occupancy_threshold: number;
    grayscale: boolean;
    blur_radius: number;
    normalize: boolean;
    downscale: number;
    lighting_compensation: number;
    edge_weight: number;
  };
  slots: ExportedSlotConfig[];
}

export interface ExportedLogicalSlot {
  id: string;
  slot_code: string;
  vehicle_type: VehicleType;
}

export interface CameraExportDocument {
  version: number;
  exported_at: string;
  zone: {
    id: string;
    name: string;
  };
  cameras: ExportedCameraConfig[];
  logical_slots: ExportedLogicalSlot[];
}
