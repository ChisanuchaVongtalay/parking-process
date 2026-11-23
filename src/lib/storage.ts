import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const backgroundsDir = path.join(STORAGE_ROOT, "backgrounds");
const snapshotsDir = path.join(STORAGE_ROOT, "snapshots");
const exportsDir = path.join(STORAGE_ROOT, "exports");

const allowedMime = new Set(["image/jpeg", "image/png", "application/json"]);

async function ensureDirs() {
  await Promise.all([
    fs.mkdir(backgroundsDir, { recursive: true }),
    fs.mkdir(snapshotsDir, { recursive: true }),
    fs.mkdir(exportsDir, { recursive: true }),
  ]);
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "application/json") return ".json";
  return "";
}

function sanitizeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function stableName(prefix: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const random = crypto.randomBytes(4).toString("hex");
  return `${prefix}-${ts}-${random}${ext}`;
}

export async function saveUploadedFile(options: {
  file: File;
  kind: "background" | "snapshot";
  cameraId: string;
  maxBytes?: number;
}) {
  const { file, kind, cameraId, maxBytes = 10 * 1024 * 1024 } = options;

  if (!allowedMime.has(file.type) || file.type === "application/json") {
    throw new Error("Unsupported upload type");
  }
  if (file.size > maxBytes) {
    throw new Error("File too large");
  }

  await ensureDirs();

  const ext = extensionFromMime(file.type);
  const base = sanitizeSegment(cameraId);
  const filename = stableName(base, ext);
  const relativePath = path.posix.join(kind === "background" ? "backgrounds" : "snapshots", filename);
  const outputPath = path.join(STORAGE_ROOT, relativePath);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));

  return {
    relativePath,
    absolutePath: outputPath,
  };
}

export async function saveExportJson(options: {
  cameraId: string;
  version: number;
  payload: unknown;
}) {
  const { cameraId, version, payload } = options;
  await ensureDirs();

  const filename = stableName(`${sanitizeSegment(cameraId)}-v${version}`, ".json");
  const relativePath = path.posix.join("exports", filename);
  const outputPath = path.join(STORAGE_ROOT, relativePath);
  const json = JSON.stringify(payload, null, 2);

  await fs.writeFile(outputPath, json, "utf8");

  const checksum = crypto.createHash("sha256").update(json).digest("hex");
  return {
    relativePath,
    absolutePath: outputPath,
    checksum,
  };
}

export function resolveDataPath(relativePath: string): string {
  return path.join(STORAGE_ROOT, relativePath.replace(/^\/+/, ""));
}
