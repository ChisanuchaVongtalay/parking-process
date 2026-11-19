# MFU Smart Parking — RTSP Snapshot Worker

## Goal
Replace failed n8n snapshot flow with an independent **Node.js/TypeScript + FFmpeg** worker **inside the existing Admin/Calibration repository** (not a new project/repo). Capture RTSP frames for the existing Background Subtraction / Pixel Difference runtime.

## Before coding
Inspect existing camera schema, DB access (Drizzle/SQLite), calibration/background workflow, snapshot paths, runtime processor inputs, package scripts, and deployment config. **Reuse existing code; do not duplicate Camera Management or rewrite occupancy detection.** Deployment/storage location is not yet confirmed: do not assume the web app, worker, and runtime share a filesystem.

## Flow
`CCTV RTSP -> Snapshot Worker -> Storage -> existing Processor -> Observations/API/Dashboard`

- **Latest snapshot:** refreshed on each successful capture.
- **Base background:** calibration-approved reference, changed ONLY via existing admin/calibration flow; never overwritten by the worker.

## Requirements
1. Dedicated process (`npm run worker:snapshot`), not a Next.js route, request handler, or server startup loop. Schedule enabled cameras at configurable intervals (default **60s**). Prevent per-camera overlap and use bounded concurrency, so offline cameras do not block others.
2. Use FFmpeg to extract **one JPEG frame** per RTSP capture. Support authentication, TCP default, configurable timeout, clean subprocess termination, retries on subsequent cycles, and graceful shutdown.
3. Read camera IDs/status from the existing DB; securely resolve RTSP URLs/secrets server-side. Never log credentials, expose RTSP URLs publicly, or commit `.env` files. Validate camera IDs/paths.
4. Preserve the previous valid image on capture/upload failure. Record capture success timestamp, failure state, and freshness; prevent stale snapshots being reported as live occupancy.
5. Add a minimal **storage abstraction** with `saveLatest`, `readLatest`, and `readBackground` (adapt to existing interfaces). Implement **Local Storage** first if compatible with current setup; keep the interface ready for **private S3-compatible storage (Cloudflare R2/MinIO)** or **Supabase Storage** if app/worker/runtime run on different hosts. Do **not** add a provider or migrate storage without checking existing config. Google Drive is **not** the default for frequent snapshots.
6. Local: use configurable persistent path / shared Docker volume; write temp JPEG then atomic rename to `snapshots/{cameraId}/latest.jpg`. Remote object storage: use unique/versioned keys plus a latest-pointer/DB metadata to avoid cache-stale overwrites, and apply retention cleanup. Store image bytes in storage, only paths/keys/status/timestamps in DB.
7. Integrate minimally with existing calibration and processor. Backgrounds and snapshots must remain separate. Avoid unnecessary DB migrations, queues, new services, or unrelated refactoring.
8. Verify access restrictions for university CCTV footage before any off-campus/cloud upload. Keep buckets private; serve admin images via authenticated backend or time-limited signed URLs.

## Deliverables
- Worker source files under existing repo conventions (e.g., `workers/snapshot/`).
- Run script, sanitized `.env.example`, short setup/troubleshooting README.
- Tests/mocks: capture success, camera offline, image preserved on failure, no overlapping capture, background unchanged, multiple cameras, runtime compatibility.
- Report changed files, env vars, commands, test results, remaining deployment/storage decisions.

## Implementation order
1. Inspect repo and identify integration points.
2. Implement FFmpeg capture + scheduler + local storage adapter.
3. Connect existing camera config and runtime image loading.
4. Add status/freshness handling and tests; run typecheck/lint/tests.
5. Summarize results and unresolved infrastructure questions.

**Implement working code now; do not stop at an architectural proposal.** If storage topology is unknown, use configurable local storage as a development default, preserve the adapter boundary, and explicitly flag that production may require shared persistent storage/object storage.
