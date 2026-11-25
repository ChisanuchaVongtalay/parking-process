import { notFound } from "next/navigation";
import { PageHeading, Panel, Status } from "@/components/admin/admin-ui";
import { VehicleDecisionForm } from "@/components/admin/vehicle-decision-form";
import { requireAdminPage } from "@/lib/auth/session";
import { adminTime } from "@/lib/admin-time";
import { getReview } from "@/services/vehicle-reviews";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const review = await getReview((await params).id);
  if (!review) notFound();
  const evidenceUrl = `/api/admin/vehicle-reviews/${encodeURIComponent(review.id)}/evidence`;
  const isImage = review.evidenceType.startsWith("image/");

  return <>
    <PageHeading title="Vehicle Approval Detail" description={review.id}
      parent={{ href: "/admin/vehicle-approvals", label: "Vehicle Approvals" }} />
    <div className="admin-grid wide">
      <Panel title="ข้อมูลคำขอและหลักฐาน">
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
        {review.status === "pending" ? <VehicleDecisionForm id={review.id} version={review.version} /> : <>
          <Status tone={review.status === "approved" ? "good" : "bad"}>{review.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}</Status>
          <dl className="admin-fields mt-3">
            <div><dt>ผู้ตรวจ</dt><dd>{review.reviewedBy}</dd></div>
            <div><dt>เวลาตัดสินใจ</dt><dd>{adminTime(review.reviewedAt)}</dd></div>
            <div><dt>หมายเหตุ</dt><dd>{review.reason || "—"}</dd></div>
          </dl>
        </>}
      </Panel>
    </div>
  </>;
}
