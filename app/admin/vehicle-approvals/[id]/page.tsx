import { notFound } from "next/navigation";
import { PageHeading, Panel, Status } from "@/components/admin/admin-ui";
import { VehicleDecisionForm } from "@/components/admin/vehicle-decision-form";
import { requireAdminPage } from "@/lib/auth/session";
import { adminTime } from "@/lib/admin-time";
import { getReview } from "@/services/vehicle-reviews";
import { latestVehicleChange } from "@/services/vehicle-changes";
import { VehicleAdminActions } from "@/components/admin/vehicle-admin-actions";
import { writeTransaction } from "@/db/client";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const { review, change } = await writeTransaction(async (transaction) => {
    const review = await getReview(id, transaction);
    const change = review ? await latestVehicleChange(id, transaction) : null;
    return { review, change };
  });
  if (!review) notFound();
  const evidenceUrl = `/api/admin/vehicle-reviews/${encodeURIComponent(review.id)}/evidence`;
  const isImage = review.evidenceType.startsWith("image/");

  return <>
    <PageHeading title="Vehicle Approval Detail" description={review.id}
      parent={{ href: "/admin/vehicle-approvals", label: "Vehicle Approvals" }} />
    <div className="admin-grid wide">
      <Panel title="ข้อมูลรถปัจจุบันและหลักฐาน">
        <dl className="admin-fields mb-4">
          <div><dt>ผู้ยื่น</dt><dd>{review.applicantId}</dd></div>
          <div><dt>ทะเบียน</dt><dd>{review.plate} · {review.province}</dd></div>
          <div><dt>ยี่ห้อและประเภท</dt><dd>{review.brand} · {review.vehicleType}</dd></div>
          <div><dt>วันที่ส่ง</dt><dd>{adminTime(review.createdAt)}</dd></div>
        </dl>
        {isImage && <img className="max-h-96 w-full rounded-lg bg-slate-100 object-contain" alt="เอกสารหลักฐานการใช้รถ" src={evidenceUrl} />}
        {!isImage && <a className="admin-link" href={evidenceUrl}>ดาวน์โหลดหลักฐาน PDF</a>}
      </Panel>
      <Panel title="ผลการตรวจ">
        {review.status === "pending" ? (change?.status === "pending"
          ? <p>ตรวจคำขอแก้ไขหรือลบก่อนอนุมัติการลงทะเบียนรถ</p>
          : <VehicleDecisionForm id={review.id} version={review.version} />) : <>
          <Status tone={review.status === "approved" ? "good" : "bad"}>{review.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}</Status>
          <dl className="admin-fields mt-3">
            <div><dt>ผู้ตรวจ</dt><dd>{review.reviewedBy}</dd></div>
            <div><dt>เวลาตัดสินใจ</dt><dd>{adminTime(review.reviewedAt)}</dd></div>
            <div><dt>หมายเหตุ</dt><dd>{review.reason || "—"}</dd></div>
          </dl>
        </>}
      </Panel>
    </div>
    {change && <div id="vehicle-change-request" className="scroll-mt-24"><Panel title={change.kind === "edit" ? "คำขอแก้ไขข้อมูลรถ" : "คำขอลบรถ"}>
      {change.requestReason && <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-600">เหตุผลที่ผู้ใช้ส่งคำขอ</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{change.requestReason}</p>
      </div>}
      {change.status === "pending" ? <>
        {change.changes && <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold">ข้อมูลปัจจุบัน</p>
            <dl className="admin-fields"><div><dt>ทะเบียน · จังหวัด</dt><dd>{review.plate} · {review.province}</dd></div>
              <div><dt>ยี่ห้อ · ประเภท</dt><dd>{review.brand} · {review.vehicleType}</dd></div></dl>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-2 text-sm font-semibold text-emerald-900">ข้อมูลที่ขอแก้ไข</p>
            <dl className="admin-fields"><div><dt>ทะเบียน · จังหวัด</dt><dd>{change.changes.plate} · {change.changes.province}</dd></div>
              <div><dt>ยี่ห้อ · ประเภท</dt><dd>{change.changes.brand} · {change.changes.vehicleType}</dd></div></dl>
          </div>
        </div>}
        <VehicleDecisionForm id={change.id} changeRequest redirectOnApprove={change.kind === "delete"} />
      </> : <div className="space-y-2">
        <Status tone={change.status === "approved" ? "good" : "bad"}>
          {change.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
        </Status>
        {change.reason && <p className="whitespace-pre-wrap break-words text-sm">{change.reason}</p>}
      </div>}
    </Panel></div>}
    <Panel title="จัดการข้อมูลรถ">
      {change?.status === "pending" && <p className="mb-3">การแก้ไขหรือลบโดยตรงจะสรุปผลคำขอที่รอตรวจอยู่ตามข้อมูลที่ผู้ดูแลบันทึก</p>}
      <VehicleAdminActions key={review.version} vehicle={{ id: review.id, version: review.version, plate: review.plate,
        province: review.province, brand: review.brand, vehicleType: review.vehicleType }} />
    </Panel>
  </>;
}
