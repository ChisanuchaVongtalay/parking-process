import fs from "node:fs/promises";

import sharp from "sharp";

import type { RuntimeCameraConfig } from "./load-config";

export type RuntimeSlotResult = {
  cameraSlotId: string;
  score: number;
  occupied: boolean;
};

export type RuntimeProcessResult = {
  cameraId: string;
  slots: RuntimeSlotResult[];
  summary: {
    total: number;
    occupied: number;
    free: number;
  };
};

type Point = { x: number; y: number };

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

function pointInPolygon(x: number, y: number, points: Point[]): boolean {
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

function rasterizePolygon(width: number, height: number, points: Point[]): Uint8Array {
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

async function preprocess(
  imageBuffer: Buffer,
  width: number,
  height: number,
  calibration: RuntimeCameraConfig["camera"]["calibration"],
) {
  let pipeline = sharp(imageBuffer).resize(width, height);

  if (calibration.grayscale) {
    pipeline = pipeline.grayscale();
  }

  if (calibration.blurRadius > 0) {
    pipeline = pipeline.blur(calibration.blurRadius);
  }

  if (calibration.edgeWeight > 0) {
    pipeline = pipeline.sharpen(calibration.edgeWeight);
  }

  if (calibration.normalize) {
    pipeline = pipeline.normalize();
  }

  return pipeline.raw().toBuffer({ resolveWithObject: true });
}

export async function processCameraSnapshot(
  config: RuntimeCameraConfig,
  snapshotPath: string,
): Promise<RuntimeProcessResult> {
  const calibration = config.camera.calibration;
  const [backgroundBuffer, snapshotBuffer] = await Promise.all([
    fs.readFile(config.camera.backgroundAbsolutePath),
    fs.readFile(snapshotPath),
  ]);

  const bgMeta = await sharp(backgroundBuffer).metadata();
  if (!bgMeta.width || !bgMeta.height) {
    throw new Error("Invalid background image");
  }

  let width = bgMeta.width;
  let height = bgMeta.height;

  if (calibration.downscale < 1) {
    width = Math.max(1, Math.round(width * calibration.downscale));
    height = Math.max(1, Math.round(height * calibration.downscale));
  }

  const [background, snapshot] = await Promise.all([
    preprocess(backgroundBuffer, width, height, calibration),
    preprocess(snapshotBuffer, width, height, calibration),
  ]);

  const bgData = background.data;
  const snapData = snapshot.data;
  const channels = Math.min(background.info.channels, snapshot.info.channels);

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

  const slotResults: RuntimeSlotResult[] = [];

  for (const slot of config.camera.slots) {
    const scaledPoints = slot.points.map((point) => ({
      x: point.x * (width / (bgMeta.width ?? width)),
      y: point.y * (height / (bgMeta.height ?? height)),
    }));

    const mask = rasterizePolygon(width, height, scaledPoints);
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
      cameraSlotId: slot.cameraSlotId,
      score: Number(score.toFixed(4)),
      occupied,
    });
  }

  const occupiedCount = slotResults.filter((item) => item.occupied).length;

  return {
    cameraId: config.camera.id,
    slots: slotResults,
    summary: {
      total: slotResults.length,
      occupied: occupiedCount,
      free: slotResults.length - occupiedCount,
    },
  };
}
