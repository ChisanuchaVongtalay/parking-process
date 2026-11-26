import Link from "next/link";
import { Car, Clock, FileCheck, FileX } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { queryRows } from "@/db/client";
import { adminTime } from "@/lib/admin-time";
import { DataTable, Notice, PageHeading, Panel, Stats, Status } from "@/components/admin/admin-ui";
import { reviewColumns, type Review } from "@/services/vehicle-reviews";
import { listPendingVehicleChanges } from "@/services/vehicle-changes";

const states = { pending: "รอตรวจ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธแล้ว" };
const tones = { pending: "warn", approved: "good", rejected: "bad" } as const;
const size = 30;

export default async function VehicleApprovals({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; changePage?: string }> }) {
  await requireAdminPage();
  const { status, page, changePage } = await searchParams;
  const filter = status === "pending" || status === "approved" || status === "rejected" ? status : null;
  const pageNumber = Math.min(10_000, Math.max(1, Number.parseInt(page || "", 10) || 1));
  const changePageNumber = Math.min(10_000, Math.max(1, Number.parseInt(changePage || "", 10) || 1));
  const [all, counts, changes] = await Promise.all([
    queryRows<Review>(`SELECT ${reviewColumns} FROM vehicle_reviews WHERE deleted_at IS NULL AND (? IS NULL OR status = ?) ORDER BY created_at DESC, id LIMIT ? OFFSET ?`,
      [filter, filter, size + 1, (pageNumber - 1) * size]),
    queryRows<{ status: Review["status"]; total: number }>("SELECT status, COUNT(*) AS total FROM vehicle_reviews WHERE deleted_at IS NULL GROUP BY status"),
    listPendingVehicleChanges(size + 1, (changePageNumber - 1) * size),
  ]);
  const count = (key: Review["status"]) => counts.find((row) => row.status === key)?.total ?? 0;
  const route = (to: number) => `?page=${to}${filter ? `&status=${filter}` : ""}`;
  const changeRoute = (to: number) => `${route(pageNumber)}&changePage=${to}`;

  return <>
    <PageHeading title="Vehicle Approvals" description="คิวตรวจข้อมูลรถและหลักฐานการใช้รถ" />
    {(!process.env.PARKING_USER_API_KEY || process.env.PARKING_USER_API_KEY.length < 32) &&
      <Notice title="รอเชื่อม User API">ตั้งค่า PARKING_USER_API_KEY ในระบบทั้งสองฝั่งเพื่อเริ่มรับคำขอ</Notice>}
    <Stats items={[
      { label: "Pending reviews", value: count("pending"), icon: <Clock />, tone: "warn" },
      { label: "Approved", value: count("approved"), icon: <FileCheck />, tone: "good" },
      { label: "Rejected", value: count("rejected"), icon: <FileX />, tone: "bad" },
      { label: "Total", value: counts.reduce((sum, row) => sum + row.total, 0), icon: <Car /> },
    ]} />
    <Panel title="คำขอแก้ไขหรือลบรถ">
      <DataTable headings={["คำขอ", "ทะเบียน", "วันที่ส่ง", "Action"]}>
        {changes.slice(0, size).map((change) => <tr key={change.id}>
          <td>{change.kind === "edit" ? "แก้ไขข้อมูล" : "ลบรถ"}</td><td>{change.plate} · {change.province}</td>
          <td>{adminTime(change.createdAt)}</td>
          <td><Link className="admin-link" href={`/admin/vehicle-approvals/${encodeURIComponent(change.reviewId)}`}>ตรวจคำขอ</Link></td>
        </tr>)}
        {!changes.length && <tr><td colSpan={4}>ยังไม่มีคำขอรอตรวจ</td></tr>}
      </DataTable>
      <div className="admin-actions mt-3">
        {changePageNumber > 1 && <Link className="admin-link" href={changeRoute(changePageNumber - 1)}>ก่อนหน้า</Link>}
        {changes.length > size && <Link className="admin-link" href={changeRoute(changePageNumber + 1)}>ถัดไป</Link>}
      </div>
    </Panel>
    <Panel title="Review queue">
      <nav aria-label="กรองสถานะคำขอ" className="admin-actions mb-3">
        <Link className="admin-link" href="/admin/vehicle-approvals" aria-current={!filter ? "page" : undefined}>ทั้งหมด</Link>
        {Object.entries(states).map(([state, label]) =>
          <Link key={state} className="admin-link" href={`?status=${state}`} aria-current={filter === state ? "page" : undefined}>{label}</Link>)}
      </nav>
      <DataTable headings={["คำขอ", "ทะเบียน", "ประเภท", "วันที่ส่ง", "สถานะ", "Action"]}>
        {all.slice(0, size).map((review) => <tr key={review.id}>
          <td>{review.id}</td><td>{review.plate} · {review.province}</td><td>{review.vehicleType}</td><td>{adminTime(review.createdAt)}</td>
          <td><Status tone={tones[review.status]}>{states[review.status]}</Status></td>
          <td><Link className="admin-link" href={`/admin/vehicle-approvals/${encodeURIComponent(review.id)}`}>ดูคำขอ</Link></td>
        </tr>)}
        {!all.length && <tr><td colSpan={6}>ยังไม่มีคำขอในรายการนี้</td></tr>}
      </DataTable>
      <div className="admin-actions mt-3">
        {pageNumber > 1 && <Link className="admin-link" href={route(pageNumber - 1)}>ก่อนหน้า</Link>}
        {all.length > size && <Link className="admin-link" href={route(pageNumber + 1)}>ถัดไป</Link>}
      </div>
    </Panel>
  </>;
}
