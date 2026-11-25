# MFU Smart Parking — Admin UI Screens Index

> **Source:** `MFU-Smart-Parking-Admin-PRD-v1.1.md` · dated 24 November 2026\
> **Scope:** Admin Console & Parking Processor (not the separate User Web)\
> **Visual references:** desktop 1600 px width. Individual PNG screenshots include complete page content.

## Design system

- **Brand primary:** `#7D000F` (MFU maroon)
- **Brand secondary:** `#775A19` (brown gold)
- **Background:** `#FAF9F6` / white cards
- **Statuses:** green = fresh/healthy/free; amber = warning/partial/stale; red = error/occupied; gray = unknown/not connected
- **Layout:** fixed navigation rail on desktop, main header, page title with actions, alerts, KPIs, structured data cards, tables.
- **Typography:** Noto Sans Thai / sans-serif fallback; labels may be Thai with familiar English technical terms.

## Screen-to-route mapping — 14 screens

| No. | Screenshot file | Suggested route in Admin PRD | Content | Planned status |
| --- | --- | --- | --- | --- |
| 01 | `admin-dashboard.png` | `/admin` | Occupancy KPIs, zone overview, conceptual map, camera health, event feed, approvals integration placeholder | P1 |
| 02 | `admin-analytics.png` | `/admin/analytics` | Occupancy trend, peak hours, zone comparisons, quality/coverage, export | P1 |
| 03 | `parking-zones.png` | `/admin/zones` | Zone list, logical capacity, coverage, filters, actions | P0 existing/extend |
| 04 | `zone-detail.png` | `/admin/zones/[id]` | Logical slots, sample stable layout, camera-slot mapping | P0 existing/extend |
| 05 | `cameras.png` | `/admin/cameras` | Camera list, capture health, masked RTSP, import/export | P0 existing/extend |
| 06 | `camera-detail.png` | `/admin/cameras/[id]` | Camera detail, schematic snapshot, processing status, masked credentials | P0 existing/extend |
| 07 | `calibration-editor.png` | `/admin/cameras/[id]/calibration` | Slot editor, pixel difference parameters, Run Test, score log | P0 existing/extend |
| 08 | `monitoring.png` | `/admin/monitor` | Worker, camera freshness, pipeline, incidents | P0 existing/extend |
| 09 | `vehicle-approvals.png` | `/admin/vehicle-approvals` | Review queue sample; real API not yet connected | P1 (P0 shared backend dependency) |
| 10 | `vehicle-approval-detail.png` | `/admin/vehicle-approvals/[id]` | Review evidence mock, decision controls disabled, audit history | P1 (P0 shared backend dependency) |
| 11 | `policy-management.png` | `/admin/policies` | Demo booking rules, effective dates, draft and impact preview | P1 |
| 12 | `smart-campus.png` | `/admin/smart-campus` | Data readiness, schedule-aware recs, forecast unavailable, credits concept | P2 Future |
| 13 | `audit-logs.png` | `/admin/audit-logs` | Audit event listing, actor/target/outcome, filters, privacy | P0/P1 |
| 14 | `admin-settings.png` | `/admin/settings` | Admin RBAC, users, alerts, integrations | P0/P1 |

## Grounding rules for AI agents

1. Read the Admin PRD v1.1 before implementing screens. Routes are **suggestions** until compared with actual repository routing.
2. Treat screenshots as **visual/interaction design references**, not proof of implemented APIs, database tables, scheduled tasks, or completed access control.
3. The product currently includes camera/zone/calibration/slot/runtime functionality **according to the prior PRD**; inspect the current codebase and re-use actual logic.
4. The screenshot numbers (e.g., 480 total, 240 occupied, 162 free, 78 unknown, 83.8% coverage) are **consistent illustrative demo values**, not measured MFU inventory or actual CCTV outcomes.
5. The Campus Map on Dashboard is **not georeferenced**. Do not use its visual arrangement as exact MFU campus geometry. Keep/obtain the verified SVG/zone geometry.
6. Camera image in camera-detail/calibration is a **schematic illustration**, not CCTV data. Do not interpret it as a real background, test image, recognition output, or source of truth.
7. Processor uses background reference + snapshot pixel difference per slot, not YOLO-based detection or OCR.
8. Physical free slots must not be interpreted as bookable spaces; Booking Service must enforce reservations separately.
9. Preserve `fresh`, `stale`, `unknown`, `partial`, `error`, `not connected`, and `insufficient data` as distinct presentation states.
10. Never expose RTSP credentials or private vehicle evidence in public UI/API responses, browser local storage, logs, or CSV exports.
11. Approvals UI must not be considered ready until Shared Vehicle Service, private evidence storage, server authorization, concurrency control, notification, and audit are available.
12. Policies shown for role quotas are explicitly **Demo**; publishing is disabled pending shared Booking Backend and institutional approval.
13. Smart Campus is **Future / P2**. Do not show predictive values as actual until source/quality/consent/model evaluation are established.
14. Add accessible labels, keyboard navigation, responsive tables, Loading/Empty/Error states, and server-side RBAC in the production implementation.

## Suggested implementation workflow

- **Step 1:** Inventory existing Admin routes/components/services and report the gaps versus PRD and images; do not delete existing working pages.
- **Step 2:** Add reusable design tokens, sidebar/topbar, cards, badges, tables, filters, status patterns, and page layouts.
- **Step 3:** Implement P0 Camera / Calibration / Slots / Monitor pages against existing APIs while preserving business logic.
- **Step 4:** Implement P1 Dashboard and Analytics presentation using honest placeholders for yet-to-be-built data pipelines.
- **Step 5:** Implement Approvals/Policies only with explicit demo mode until required backends are implemented.
- **Step 6:** Keep Smart Campus as Data Readiness / Future UI with explicit labels.
- **Step 7:** Regression-test RTSP/security, calibration result consistency, role rules, API freshness, and responsive screenshots.

## Prototype

`mfu-admin-ui-preview.html` is a single-file static preview with switching between all 14 screens via the sidebar. All controls except navigation are illustrative, not functional backend actions.
