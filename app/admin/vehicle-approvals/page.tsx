import { requireAdminPage } from "@/lib/auth/session";
import Link from "next/link";
import { Car, Clock, FileCheck, FileX } from "lucide-react";
import { DataTable, Notice, PageHeading, Panel, Stats, Status } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";

export default async function VehicleApprovals() {
  await requireAdminPage();
  return <>
    <PageHeading title="Vehicle Approvals" description="คิวตรวจข้อมูลรถและหลักฐานการใช้รถ" actions={<Button variant="outline" disabled>Export list</Button>} />
    <Notice title="Not connected · Demo">ตัวอย่างคิวสำหรับแสดงขั้นตอนตรวจเอกสาร ระบบจริงรอเชื่อม Shared Vehicle Service</Notice>
    <Stats items={[
      { label: "Pending reviews", value: "—", icon: <Clock />, tone: "warn" },
      { label: "Approved", value: "—", icon: <FileCheck />, tone: "good" },
      { label: "Rejected", value: "—", icon: <FileX />, tone: "bad" },
      { label: "Review turnaround", value: "—", icon: <Car />, tone: "neutral" },
    ]} />
    <Panel title="Review queue" detail="ข้อมูลจำลอง">
      <DataTable headings={["Request", "Applicant", "Vehicle type", "Status", "Action"]}>
        <tr><td>DEMO-001</td><td>ผู้ยื่นตัวอย่าง</td><td>Sedan</td><td><Status tone="warn">Pending · Demo</Status></td>
          <td><Link className="admin-link" href="/admin/vehicle-approvals/demo-001">ดูตัวอย่าง</Link></td></tr>
      </DataTable>
    </Panel>
  </>;
}
