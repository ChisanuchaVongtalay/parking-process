# MFU Smart Parking Processor (Node.js + CapRover)

Ultra-fast parking slot occupancy processor designed to be called from n8n.
- No Google Drive dependency.
- Snapshot comes from RTSP (ffmpeg) or any JPEG/PNG upload.
- Background & slot maps stored locally in `/data` (mounted persistent volume).
- Express API with `X-API-Key` auth, health check, in-memory caching.
- Uses `sharp` for fast image decode/resize and raw pixel access.

## Endpoints
- `GET /health` → `{ ok: true }`
- `POST /process?cam_id={id}` (multipart form)
  - field `snapshot`: image binary (jpeg/png)
  - headers: `X-API-Key: <YOUR_KEY>`
  - returns `{ cam_id, occupied, free, slots: {slotId:0/1}, width, height, took_ms }`

## Slot Map Format (`/data/slots/<cam_id>.json`)
```json
[
  {"id":"A1","points":[[x,y],[x,y],...]},  // polygon coordinates in image pixel space
  {"id":"A2","points":[[...]]}
]
```

## Quick Start (local)
```bash
npm i
export API_KEY=changeme
node src/server.js
# or with PM2
npm i -g pm2
API_KEY=changeme pm2 start src/server.js -i max --name parking
```

## Docker (CapRover)
- Build from `Dockerfile`
- Set persistent volume: `/data:/data`
- Set env var: `API_KEY`
- Expose port 8000
- Add health check path: `/health`

## n8n Flow
Import `n8n/parking_flow.json` into n8n. It demonstrates:
- Read camera list (Static list → replace with your sheet/DB)
- For each camera (Split In Batches with concurrency), run `ffmpeg` to fetch snapshot
- POST to this API with `snapshot` as binary
- Write results to Google Sheet (or just log via Function node)

## Notes
- Snapshot is auto-resized to match background size.
- Backgrounds and binary masks for slot polygons are cached in memory for speed.
- Thresholds can be tuned via env vars: `THRESH_DIFF`, `THRESH_PIXELS`.
