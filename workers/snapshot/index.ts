import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { query, usesRemoteDatabase } from "../../src/db/client";
import { sql } from "drizzle-orm";
import { saveWorkerSnapshot } from "../../src/lib/storage";
import { cameras } from "../../src/db/schema";
import { runRuntimeProcessing } from "../../src/lib/runtime/run-pipeline";
import { captureFrame, localStorage, SnapshotWorker } from "./worker";

function positiveInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}
const interval = positiveInt("SNAPSHOT_INTERVAL_SECONDS", 60) * 1000;
const timeout = positiveInt("SNAPSHOT_TIMEOUT_SECONDS", 20) * 1000;
const concurrency = positiveInt("SNAPSHOT_CONCURRENCY", 4);
const transport = process.env.SNAPSHOT_RTSP_TRANSPORT || "tcp";
if (!["tcp", "udp"].includes(transport)) throw new Error("SNAPSHOT_RTSP_TRANSPORT must be tcp or udp");
const root = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const storage = localStorage(root);
const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());
const worker = new SnapshotWorker({
  async listCameras() { return db.select({ id: cameras.id, streamUrl: cameras.streamUrl }).from(cameras).where(eq(cameras.isActive, true)).all(); },
  capture: (url, signal) => captureFrame(url, signal, timeout, transport),
  save: usesRemoteDatabase() ? saveWorkerSnapshot : storage.saveLatest,
  async success(id, imagePath, at) {
    await db.transaction(async (tx) => {
      await tx.update(cameras).set({ latestSnapshotPath: imagePath, updatedAt: at }).where(eq(cameras.id, id)).run();
      await tx.run(sql`INSERT INTO snapshot_capture_status (camera_id, last_success_at, last_attempt_at, last_error) VALUES (${id}, ${at.getTime()}, ${at.getTime()}, NULL) ON CONFLICT(camera_id) DO UPDATE SET last_success_at=excluded.last_success_at, last_attempt_at=excluded.last_attempt_at, last_error=NULL`);
    });
  },
  async failure(id, at, error) {
    await query("INSERT INTO snapshot_capture_status (camera_id, last_attempt_at, last_error) VALUES (?, ?, ?) ON CONFLICT(camera_id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at, last_error=excluded.last_error", [id, at.getTime(), error]);
  },
  async process(id, imagePath, at) { await runRuntimeProcessing({ cameraId: id, snapshotPath: imagePath, capturedAt: at }); },
  log: (message) => console.log(new Date().toISOString(), message),
}, concurrency);

console.log(`Snapshot worker started: interval=${interval / 1000}s, concurrency=${concurrency}`);
while (!controller.signal.aborted) {
  const started = Date.now();
  try { await worker.cycle(controller.signal); } catch { console.error("Snapshot cycle failed; check database and migrations"); }
  if (controller.signal.aborted) break;
  await new Promise<void>((resolve) => {
    const done = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, Math.max(0, interval - (Date.now() - started)));
    controller.signal.addEventListener("abort", done, { once: true });
  });
}
console.log("Snapshot worker stopped");
