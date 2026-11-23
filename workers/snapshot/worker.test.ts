import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { localStorage, SnapshotWorker, type Dependencies } from "./worker";

test("captures multiple cameras, preserves old image on failure and never changes background", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "snapshot-test-"));
  try {
    const storage = localStorage(root);
    await fs.mkdir(path.join(root, "backgrounds"));
    await fs.writeFile(path.join(root, "backgrounds", "base.jpg"), "background");
    await storage.saveLatest("offline", Buffer.from("previous"));
    const successes: string[] = [], failures: string[] = [], processed: string[] = [];
    const deps: Dependencies = {
      async listCameras() { return [{ id: "one", streamUrl: "rtsp://one" }, { id: "offline", streamUrl: "rtsp://offline" }, { id: "two", streamUrl: "rtsp://two" }]; },
      async capture(url) { if (url.endsWith("offline")) throw new Error("offline"); return Buffer.from(url); },
      save: storage.saveLatest,
      async success(id) { successes.push(id); }, async failure(id) { failures.push(id); },
      async process(id) { processed.push(id); }, log() {},
    };
    await new SnapshotWorker(deps, 2).cycle(new AbortController().signal);
    assert.deepEqual(successes.sort(), ["one", "two"]);
    assert.deepEqual(processed.sort(), ["one", "two"]);
    assert.deepEqual(failures, ["offline"]);
    assert.equal((await storage.readLatest("offline")).toString(), "previous");
    assert.equal((await storage.readBackground("backgrounds/base.jpg")).toString(), "background");
    await assert.rejects(storage.saveLatest("../bad", Buffer.from("x")));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("overlapping cycles do not capture the same camera twice", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let captures = 0;
  const deps: Dependencies = { async listCameras() { return [{ id: "one", streamUrl: "rtsp://one" }]; },
    async capture() { captures++; await wait; return Buffer.from("frame"); }, async save() { return "snapshots/one/latest.jpg"; },
    async success() {}, async failure() {}, async process() {}, log() {} };
  const worker = new SnapshotWorker(deps, 1), signal = new AbortController().signal;
  const first = worker.cycle(signal);
  await new Promise((resolve) => setImmediate(resolve));
  await worker.cycle(signal);
  release(); await first;
  assert.equal(captures, 1);
});
