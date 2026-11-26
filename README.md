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

## Vercel deployment

Connect a Turso database to the target Vercel environment and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. For a stable domain, set `PARKING_ADMIN_ORIGIN` to its HTTPS origin. Leave it unset when using changing Vercel Preview URLs. Use a separate database for a test environment.

To use an explicit Turso connection in Production, set `PARKING_TURSO_DATABASE_URL` and `PARKING_TURSO_AUTH_TOKEN` as a pair. The Vercel build and the running application both use that pair when present. Keep the token server-side and confirm the selected database contains the production data before switching. Set the same pair on the Snapshot Worker if it should follow the switch.

A normal Vercel build runs migrations and preserves account credentials. For a new database without accounts, use `npm run db:setup:vercel -- --bootstrap` explicitly from an operator shell connected to that database. Supply `PARKING_SUPER_ADMIN_EMAIL` (an address at `lamduan.mfu.ac.th`) and `PARKING_SUPER_ADMIN_PASSWORD` (a unique temporary password of 16–256 characters) in the shell environment. Bootstrap only creates an account when the account table is empty. Sign in at `/login` and change the temporary password.

To recover an existing Super Admin, set the same database connection and supply the exact email, a new temporary password, and a unique `PARKING_SUPER_ADMIN_RESET_ID` in the operator shell. Run `npm run db:setup:vercel -- --recover` explicitly. Recovery invalidates that account's sessions and requires a password change at the next sign-in. A reset ID can be used only once per database. Clear temporary values after use.

## User Web and Booking Service integration

Configure the same high-entropy `PARKING_USER_API_KEY` (32+ characters) on the Admin server and in the User Web backend. Call these endpoints from the backend with `Authorization: Bearer <key>`. Keep the key and Turso credentials server-side. The caller must identify the signed-in applicant and check vehicle ownership before making a request.

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /api/integration/v1/vehicle-reviews` | `multipart/form-data` with stable submission `id`, `applicantId`, `vehicleId`, `plate`, `province`, `brand`, `vehicleType` and `evidence` file. | `201` creates a pending review. An identical retry returns `200`. Reusing the ID with different data returns `409`. |
| `GET /api/integration/v1/vehicle-reviews?applicantId={id}` | Use the signed-in applicant's ID. | `{data: {items, deleted}}` includes each listed vehicle's latest change request and request outcomes for removed vehicles. |
| `GET /api/integration/v1/vehicle-reviews/{id}?applicantId={id}` | Use the same applicant and submission IDs. | `{data: {id, vehicleId, status, version, reason, createdAt, reviewedAt}}`. An unknown or mismatched applicant returns `404`. |
| `POST /api/integration/v1/vehicle-reviews/{id}/changes` | JSON `{applicantId, mutation, requestReason}` with the signed-in applicant's ID and a required reason of up to 1,000 characters. `mutation` contains `kind` (`edit` or `delete`), the vehicle `version` and, for edits, `changes` with `plate`, `province`, `brand` and `vehicleType`. | `201` creates a pending request, `200` returns the existing identical pending request, and `409` indicates a stale vehicle version or another pending request. |
| `GET /api/integration/v1/booking-policy` | Backend key. | `{data: {version, effectiveAt, student, staff}}` or `{data: null}` if no policy is effective. Each role contains `maxActive`, `maxDurationHours` and `advanceDays`. The booking backend enforces these limits. |

Vehicle types are `Sedan`, `Hatchback`, `SUV`, `Pickup`, `Van`, `Motorcycle`, and `Other`. Evidence accepts JPEG, PNG and PDF up to 3 MiB. It is only available to signed-in Admin Console reviewers. A rejected review includes the reviewer’s reason, and a second concurrent decision cannot overwrite the first. The User Web can read the status after submission using the GET endpoint. Timestamp fields use Unix milliseconds.

Use `GET /api/public/zones/status` for the User Web. Each item has `zone`, `total_slots`, `free_slots`, `occupied_slots`, `unknown_slots`, and `last_updated`. Counts use configured active logical slots. An overlapping camera view does not add another slot, and stale, unseen, or conflicting observations count as unknown. `last_updated` is an ISO 8601 timestamp or `null` when the zone has no fresh observations. `GET /api/public/zones` and `GET /api/public/zones/{zoneId}/summary` use the same counts. A physical availability estimate does not resolve booking eligibility.

## Parking operations on Vercel

Vercel setup runs the tracked migrations on Turso, including the configured zone and camera inventory. Zones, cameras, logical slot links and observations use this database. For manual calibration, reference images, uploaded test frames, and JSON exports are stored privately using the same Turso connection. Cloud uploads are limited to 3 MiB. Local deployments use the persistent directories under `DATA_DIR` for parking media.

Run one Snapshot Worker from a Node.js host that can reach the CCTV streams. Install FFmpeg, set the same `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in that worker environment, and run `npm run worker:snapshot`. The worker saves the latest capture and observations in the shared database. Create logical slots on each zone and link the camera's calibration overlay to these slots to produce a deduplicated campus Dashboard.
