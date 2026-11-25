import { requireAdminPage } from "@/lib/auth/session";
import { DataTable, EmptyState, Notice, PageHeading, Panel, Status } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";

export default async function Policies() {
  await requireAdminPage();
  return <>
    <PageHeading title="Policy Management" description="กำหนดนโยบายการจองตามกลุ่มผู้ใช้และวันที่มีผล"
      actions={<><Button variant="outline" disabled>Preview changes</Button><Button disabled>Publish policy</Button></>} />
    <Notice title="Demo only · Booking Service not connected">กฎที่แสดงเป็นตัวอย่างและยังไม่มีผลบังคับใช้</Notice>
    <div className="admin-grid wide">
      <Panel title="Role-based booking limits" detail="ตัวอย่าง Draft">
        <DataTable headings={["Role", "Active reservations", "Max duration", "Status"]}>
          <tr><td>Student</td><td>1</td><td>2 ชั่วโมง</td><td><Status tone="warn">Demo</Status></td></tr>
          <tr><td>Staff</td><td>2</td><td>4 ชั่วโมง</td><td><Status tone="warn">Demo</Status></td></tr>
        </DataTable>
      </Panel>
      <Panel title="Policy configuration"><dl className="admin-fields"><div><dt>Version</dt><dd>Demo draft</dd></div><div><dt>Effective date</dt><dd>ยังไม่กำหนด</dd></div><div><dt>Approver</dt><dd>รอยืนยัน</dd></div></dl></Panel>
      <Panel title="Change impact preview"><EmptyState title="Not connected">ต้องเชื่อม Booking Service เพื่อประเมินผลกระทบกับรายการจอง</EmptyState></Panel>
      <Panel title="Audit & revision history"><EmptyState title="ยังไม่มีประวัตินโยบาย">ประวัติจะมาจาก Booking Service</EmptyState></Panel>
    </div>
  </>;
}
