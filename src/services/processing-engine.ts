import sharp from "sharp";

import type {
  CalibrationTestResult,
  CameraSlot,
  Point2D,
} from "@/types/domain";

type CalibrationParams = {
  pixelThreshold: number;
  occupancyThreshold: number;
  grayscale: boolean;
  blurRadius: number;
  normalize: boolean;
  downscale: number;
  lightingCompensation: number;
  edgeWeight: number;
};

type SlotMask = {
  key: string;
  width: number;
  height: number;
  mask: Uint8Array;
};

const maskCache = new Map<string, SlotMask>();

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

function channelMean(data: Buffer | Uint8Array, channels: number): number {
  if (!data.length || channels <= 0) return 0;
  let sum = 0;
  const pixels = data.length / channels;
  for (let i = 0; i < data.length; i += channels) {
    for (let ch = 0; ch < channels; ch += 1) {
      sum += data[i + ch];
    }
  }
  return sum / (pixels * channels);
}

async function preprocessImage(
  imageBuffer: Buffer,
  width: number,
  height: number,
  calibration: CalibrationParams,
) {
  let pipeline = sharp(imageBuffer).resize(width, height);

  if (calibration.grayscale) {
    pipeline = pipeline.grayscale();
  }

  if (calibration.blurRadius > 0) {
    pipeline = pipeline.blur(calibration.blurRadius);
  }

  if (calibration.normalize) {
    pipeline = pipeline.normalize();
  }

  return pipeline.raw().toBuffer({ resolveWithObject: true });
}

function pointInPolygon(x: number, y: number, points: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function rasterizePolygon(width: number, height: number, points: Point2D[]): Uint8Array {
  const mask = new Uint8Array(width * height);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const startX = Math.max(0, Math.floor(minX));
  const endX = Math.min(width - 1, Math.ceil(maxX));
  const startY = Math.max(0, Math.floor(minY));
  const endY = Math.min(height - 1, Math.ceil(maxY));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}

export function buildCameraMasksIfNeeded(
  cameraId: string,
  width: number,
  height: number,
  slots: CameraSlot[],
): Map<string, Uint8Array> {
  const output = new Map<string, Uint8Array>();

  for (const slot of slots) {
    const signature = `${cameraId}:${slot.id}:${width}x${height}:${JSON.stringify(slot.points)}`;
    const cached = maskCache.get(signature);

    if (cached) {
      output.set(slot.id, cached.mask);
      continue;
    }

    const mask = rasterizePolygon(width, height, slot.points);
    maskCache.set(signature, {
      key: signature,
      width,
      height,
      mask,
    });
    output.set(slot.id, mask);
  }

  return output;
}

export async function analyzeCameraSnapshot(args: {
  cameraId: string;
  backgroundBuffer: Buffer;
  snapshotBuffer: Buffer;
  slots: CameraSlot[];
  calibration: CalibrationParams;
}): Promise<CalibrationTestResult> {
  const { cameraId, backgroundBuffer, snapshotBuffer, slots, calibration } = args;

  if (!slots.length) {
    return {
      cameraId,
      occupied: 0,
      free: 0,
      slots: [],
    };
  }

  const bgMeta = await sharp(backgroundBuffer).metadata();
  if (!bgMeta.width || !bgMeta.height) {
    throw new Error("Cannot decode background image");
  }

  const width = bgMeta.width;
  const height = bgMeta.height;

  const [background, snapshot] = await Promise.all([
    preprocessImage(backgroundBuffer, width, height, calibration),
    preprocessImage(snapshotBuffer, width, height, calibration),
  ]);

  const bgData = background.data;
  const snapData = snapshot.data;
  const channels = Math.min(background.info.channels, snapshot.info.channels);

  // Compensate global brightness shift (clouds/time-of-day) to reduce false occupied slots.
  if (calibration.lightingCompensation > 0 && channels > 0) {
    const bgMean = channelMean(bgData, channels);
    const snapMean = channelMean(snapData, channels);
    const shift = (bgMean - snapMean) * calibration.lightingCompensation;

    if (Math.abs(shift) >= 1) {
      for (let i = 0; i < snapData.length; i += channels) {
        for (let ch = 0; ch < channels; ch += 1) {
          snapData[i + ch] = clampByte(snapData[i + ch] + shift);
        }
      }
    }
  }

  const masks = buildCameraMasksIfNeeded(cameraId, width, height, slots);
  const slotResults: CalibrationTestResult["slots"] = [];

  for (const slot of slots) {
    const mask = masks.get(slot.id);
    if (!mask) continue;

    let activePixels = 0;
    let changedPixels = 0;

    for (let i = 0; i < mask.length; i += 1) {
      if (!mask[i]) continue;
      activePixels += 1;

      const px = i * channels;
      let diff = 0;
      for (let ch = 0; ch < channels; ch += 1) {
        diff += Math.abs(snapData[px + ch] - bgData[px + ch]);
      }

      const normalized = diff / (channels * 255);
      if (normalized >= calibration.pixelThreshold) {
        changedPixels += 1;
      }
    }

    const score = activePixels > 0 ? changedPixels / activePixels : 0;
    const occupied = score >= calibration.occupancyThreshold;

    slotResults.push({
      slotId: slot.id,
      slotCode: slot.slotCode,
      score: Number(score.toFixed(4)),
      occupied,
    });
  }

  const occupiedCount = slotResults.filter((slot) => slot.occupied).length;

  return {
    cameraId,
    occupied: occupiedCount,
    free: slotResults.length - occupiedCount,
    slots: slotResults,
  };
}
