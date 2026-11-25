import { query, queryRows, usesRemoteDatabase, writeTransaction } from "@/db/client";
import type { Transaction } from "@libsql/client";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
export const CLOUD_FILE_LIMIT = 3 * 1024 * 1024;
const CHUNK_SIZE = 512 * 1024;
const allowedMime = new Set(["image/jpeg", "image/png"]);

async function writeDataFile(relativePath: string, bytes: Buffer) {
  if (!usesRemoteDatabase()) {
    const absolute = resolveDataPath(relativePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, bytes);
    return;
  }

  await writeTransaction((transaction) => writeDatabaseFile(relativePath, bytes, transaction));
}

export async function writeDatabaseFile(relativePath: string, bytes: Buffer, transaction: Transaction) {
  if (!bytes.length || bytes.length > CLOUD_FILE_LIMIT) throw new Error("File must be between 1 byte and 3 MiB");
  await query("DELETE FROM parking_file_chunks WHERE path = ?", [relativePath], transaction);
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    await query("INSERT INTO parking_file_chunks (path, part, content) VALUES (?, ?, ?)",
      [relativePath, offset / CHUNK_SIZE, bytes.subarray(offset, offset + CHUNK_SIZE)], transaction);
  }
}

export async function readDataFile(relativePath: string): Promise<Buffer> {
  return usesRemoteDatabase() ? readDatabaseFile(relativePath) : fs.readFile(resolveDataPath(relativePath));
}

export async function readDatabaseFile(relativePath: string): Promise<Buffer> {
  const chunks = await queryRows<{ content: ArrayBuffer }>(
    "SELECT content FROM parking_file_chunks WHERE path = ? ORDER BY part", [relativePath],
  );
  if (!chunks.length) throw Object.assign(new Error("Stored file not found"), { code: "ENOENT" });
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.content)));
}

export async function saveWorkerSnapshot(id: string, image: Buffer) {
  const relativePath = `snapshots/${id}/latest.jpg`;
  await writeDataFile(relativePath, image);
  return relativePath;
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

  if (!allowedMime.has(file.type)) {
    throw new Error("Unsupported upload type");
  }
  if (file.size > (usesRemoteDatabase() ? Math.min(maxBytes, CLOUD_FILE_LIMIT) : maxBytes)) {
    throw new Error("File too large");
  }


  const ext = extensionFromMime(file.type);
  const base = sanitizeSegment(cameraId);
  const filename = stableName(base, ext);
  const relativePath = path.posix.join(kind === "background" ? "backgrounds" : "snapshots", filename);
  const outputPath = path.join(STORAGE_ROOT, relativePath);

  const arrayBuffer = await file.arrayBuffer();
  await writeDataFile(relativePath, Buffer.from(arrayBuffer));

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

  const filename = stableName(`${sanitizeSegment(cameraId)}-v${version}`, ".json");
  const relativePath = path.posix.join("exports", filename);
  const outputPath = path.join(STORAGE_ROOT, relativePath);
  const json = JSON.stringify(payload, null, 2);

  await writeDataFile(relativePath, Buffer.from(json));

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
