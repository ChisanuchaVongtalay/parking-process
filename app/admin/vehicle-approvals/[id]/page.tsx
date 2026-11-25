import { requireParkingAdminPage } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { EmptyState, Notice, PageHeading, Panel, Status } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireParkingAdminPage();
  if ((await params).id !== "demo-001") notFound();
  return <>
    <PageHeading title="Vehicle Approval Detail" description="DEMO-001 · ตัวอย่างการตรวจคำขอ" parent={{ href: "/admin/vehicle-approvals", label: "Vehicle Approvals" }} />
    <Notice title="Demo · Not connected">หน้าแสดงขั้นตอนตรวจสอบโดยใช้ข้อมูลจำลอง การตัดสินใจจะเปิดเมื่อบริการตรวจรถและสิทธิ์พร้อมใช้งาน</Notice>
    <div className="admin-grid wide">
      <div className="space-y-4">
        <Panel title="ข้อมูลคำขอ"><dl className="admin-fields">
          <div><dt>Applicant</dt><dd>ผู้ยื่นตัวอย่าง</dd></div><div><dt>Vehicle type</dt><dd>Sedan</dd></div>
          <div><dt>Request ID</dt><dd>DEMO-001</dd></div><div><dt>Status</dt><dd><Status tone="warn">Pending · Demo</Status></dd></div>
        </dl></Panel>
        <Panel title="หลักฐานสิทธิ์ใช้รถ"><EmptyState title="Private evidence">รอเชื่อมพื้นที่เก็บไฟล์และระบบตรวจสิทธิ์รายคำขอ</EmptyState></Panel>
      </div>
      <div className="space-y-4">
        <Panel title="Review decision"><EmptyState title="Decision locked">Shared Vehicle Service ยังไม่เชื่อมต่อ</EmptyState>
          <div className="admin-actions mt-3"><Button disabled>Approve</Button><Button variant="outline" disabled>Reject</Button></div>
        </Panel>
        <Panel title="Review history"><p className="text-sm">Submitted · Demo</p></Panel>
      </div>
    </div>
  </>;
}
