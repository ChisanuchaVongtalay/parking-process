import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export type Camera = { id: string; streamUrl: string | null };
export type Dependencies = {
  listCameras: () => Promise<Camera[]>;
  capture: (url: string, signal: AbortSignal) => Promise<Buffer>;
  save: (id: string, image: Buffer) => Promise<string>;
  success: (id: string, imagePath: string, at: Date) => Promise<void>;
  failure: (id: string, at: Date, error: string) => Promise<void>;
  process: (id: string, imagePath: string, at: Date) => Promise<void>;
  log: (message: string) => void;
};

export function cameraSegment(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid camera ID");
  return id;
}

export function localStorage(root: string) {
  return {
    async saveLatest(id: string, image: Buffer): Promise<string> {
      const segment = cameraSegment(id);
      const dir = path.join(root, "snapshots", segment);
      await fs.mkdir(dir, { recursive: true });
      const temp = path.join(dir, `.${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temp, image, { flag: "wx" });
        await fs.rename(temp, path.join(dir, "latest.jpg"));
      } finally {
        await fs.unlink(temp).catch(() => {});
      }
      return `snapshots/${segment}/latest.jpg`;
    },
    readLatest(id: string) { return fs.readFile(path.join(root, "snapshots", cameraSegment(id), "latest.jpg")); },
    readBackground(relativePath: string) {
      const resolved = path.resolve(root, relativePath);
      if (!resolved.startsWith(path.resolve(root, "backgrounds") + path.sep)) throw new Error("Invalid background path");
      return fs.readFile(resolved);
    },
  };
}

export function captureFrame(url: string, signal: AbortSignal, timeoutMs: number, transport: string): Promise<Buffer> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return Promise.reject(new Error("Invalid RTSP URL")); }
  if (!["rtsp:", "rtsps:"].includes(parsed.protocol)) return Promise.reject(new Error("Invalid RTSP URL"));
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-rtsp_transport", transport, "-i", url, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"], { stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let reason = "FFmpeg failed";
    const stop = (why: string) => { reason = why; child.kill("SIGKILL"); };
    const timer = setTimeout(() => stop("Capture timed out"), timeoutMs);
    const abort = () => stop("Capture cancelled");
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 20 * 1024 * 1024) stop("Frame too large"); else chunks.push(chunk); });
    child.once("error", () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new Error("Unable to start FFmpeg")); });
    child.once("close", async (code) => {
      clearTimeout(timer); signal.removeEventListener("abort", abort);
      if (code !== 0 || !bytes) return reject(new Error(reason));
      const image = Buffer.concat(chunks);
      try { const metadata = await sharp(image).metadata(); if (metadata.format !== "jpeg" || !metadata.width || !metadata.height) throw new Error(); }
      catch { return reject(new Error("Invalid JPEG frame")); }
      resolve(image);
    });
  });
}

export class SnapshotWorker {
  private active = new Set<string>();
  constructor(private deps: Dependencies, private concurrency: number) {}
  async cycle(signal: AbortSignal) {
    const cameras = await this.deps.listCameras();
    let next = 0;
    const run = async () => {
      while (!signal.aborted) {
        const camera = cameras[next++];
        if (!camera) return;
        if (this.active.has(camera.id)) continue;
        this.active.add(camera.id);
        try {
          cameraSegment(camera.id);
          if (!camera.streamUrl) throw new Error("RTSP URL is missing");
          const image = await this.deps.capture(camera.streamUrl, signal);
          if (signal.aborted) continue;
          const imagePath = await this.deps.save(camera.id, image);
          const at = new Date();
          await this.deps.success(camera.id, imagePath, at);
          try { await this.deps.process(camera.id, imagePath, at); }
          catch { this.deps.log(`Camera ${camera.id}: processing failed; check calibration and exported config`); }
          this.deps.log(`Camera ${camera.id}: snapshot captured`);
        } catch (error) {
          if (!signal.aborted) {
            const reason = error instanceof Error ? error.message : "Capture failed";
            await this.deps.failure(camera.id, new Date(), reason).catch(() => this.deps.log(`Camera ${camera.id}: could not record failure`));
            this.deps.log(`Camera ${camera.id}: capture failed (${reason})`);
          }
        } finally { this.active.delete(camera.id); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, cameras.length) }, run));
  }
}
