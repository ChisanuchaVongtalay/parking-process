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

## RTSP snapshot worker

The worker runs separately from the web app. It captures one JPEG from each active camera with an RTSP URL every minute by default, stores it under `data/snapshots/<camera-id>/latest.jpg`, then runs the existing processor using the camera's saved slots, calibration and background from the database. Save the slots and calibration first; an unconfigured camera can still capture but processing will fail until the configuration is ready. Exporting JSON is optional. The worker never replaces the calibration background.

Install FFmpeg and Node dependencies, then run:

```sh
npm ci
npm run db:migrate
npm run worker:snapshot
```

Set the options in `.env.example` in the process environment (the worker does not automatically load `.env` files). `DATA_DIR` must point to the same persistent directory for the web app, migration, and worker. Set `SNAPSHOT_INTERVAL_SECONDS` (default 60), `SNAPSHOT_TIMEOUT_SECONDS` (20), `SNAPSHOT_CONCURRENCY` (4), and `SNAPSHOT_RTSP_TRANSPORT` (`tcp` or `udp`) as needed. `SNAPSHOT_MAX_AGE_SECONDS` defaults to 900 seconds and should be set on the web app; observations older than this are excluded from current public summaries. Zone totals may therefore be incomplete when cameras are offline. Capture timestamps and failures are stored in `snapshot_capture_status`.

Run only one worker instance against a given set of cameras and shared storage. The local adapter requires a shared persistent volume if processes run on different hosts; remote storage is not implemented. If capture fails, check FFmpeg availability, network access to the camera, the RTSP URL and camera status. Avoid sharing RTSP credentials and restrict access to the admin application and CCTV footage. For local verification run `npm run test:snapshot`.

## Admin Console sign-in

Run `npm run db:migrate` before starting the web app. For the first local account, run the following with the intended university login email and a new, private path outside the repository. The command writes the temporary password to that file and only provisions the first Super Admin.

```sh
npm run admin:bootstrap -- owner@lamduan.mfu.ac.th /private/path/mfu-admin-password.txt
```

For the first CapRover deployment, set `PARKING_SUPER_ADMIN_EMAIL`, `PARKING_SUPER_ADMIN_PASSWORD` (a unique temporary password of 16–256 characters), and `PARKING_ADMIN_ORIGIN` (the public HTTPS origin). Keep the app's existing persistent `DATA_DIR` mount. The container runs migrations and provisions the first Super Admin during startup. Remove the bootstrap password from deployment settings after setup. Each account sets its own password at first sign-in.

To hand over the console, create an account under **Admin Management** with the **Super Admin** role. Give the new owner their temporary password privately. Once the owner signs in and verifies access, they can disable the outgoing account. Role changes, password resets and disabled accounts revoke existing sessions. The default session lifetime is 30 minutes from sign-in and is configurable in **System Settings** for subsequent sign-ins. Public parking status endpoints remain available separately from the Admin Console.

## Vercel authentication test

Connect a Turso database to the target Vercel environment. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `PARKING_SUPER_ADMIN_EMAIL` (an address at `lamduan.mfu.ac.th`), and `PARKING_SUPER_ADMIN_PASSWORD` (a unique temporary password of 16–256 characters). For a stable domain, set `PARKING_ADMIN_ORIGIN` to its HTTPS origin. Leave it unset when using changing Vercel Preview URLs.

The repository's `vercel.json` build command applies the authentication migration and creates the first Super Admin on Turso. After the initial deployment, sign in at `/login`, change the temporary password, then remove `PARKING_SUPER_ADMIN_PASSWORD` from Vercel. Rebuilding leaves existing accounts and passwords intact.

The Vercel deployment supports sign-in, password change, the authentication dashboard, and Super Admin pages for accounts, roles, session settings, and audit. The parking operations and Worker require the persistent parking backend. Use a separate Turso database for a test environment.

To recover an existing Super Admin on Vercel, set `PARKING_SUPER_ADMIN_EMAIL` to the existing account at the corrected domain and set a new temporary `PARKING_SUPER_ADMIN_PASSWORD`. Set a unique `PARKING_SUPER_ADMIN_RESET_ID` in Production and redeploy. A reset ID can be used only once on a database. Recovery invalidates the account's sessions and requires a password change at next sign-in. Remove the reset ID and temporary password from Vercel after you have regained access.
