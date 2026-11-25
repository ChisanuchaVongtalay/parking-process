import { requireAdminPage } from "@/lib/auth/session";
import { DataTable, Notice, PageHeading, Panel, Status } from "@/components/admin/admin-ui";
import { BookingPolicyForm } from "@/components/admin/booking-policy-form";
import { adminTime } from "@/lib/admin-time";
import { getEffectivePolicy, getPolicies } from "@/services/booking-policies";

export default async function Policies() {
  const session = await requireAdminPage();
  const [policies, current] = await Promise.all([getPolicies(), getEffectivePolicy()]);
  const latest = policies[0];
  return <>
    <PageHeading title="Policy Management" description="ตั้งกฎการจองและเผยแพร่เวอร์ชันสำหรับ Booking Service" />
    <Notice title={current ? `นโยบายที่มีผล · v${current.version}` : "ยังไม่มีนโยบายที่มีผล"}>
      Booking Service สามารถอ่านนโยบายผ่าน API และเป็นผู้บังคับใช้กับการจอง
    </Notice>
    <div className="admin-grid wide">
      <div className="space-y-4">
        <Panel title="ข้อจำกัดที่มีผลปัจจุบัน">
          <DataTable headings={["กลุ่ม", "จองค้าง", "ระยะเวลาสูงสุด", "จองล่วงหน้า"]}>
            {current ? (["student", "staff"] as const).map((role) => <tr key={role}>
              <td>{role === "student" ? "นักศึกษา" : "บุคลากร"}</td><td>{current.policy[role].maxActive}</td>
              <td>{current.policy[role].maxDurationHours} ชม.</td><td>{current.policy[role].advanceDays} วัน</td>
            </tr>) : <tr><td colSpan={4}>ยังไม่มีข้อมูล</td></tr>}
          </DataTable>
        </Panel>
        <Panel title="ประวัติการเผยแพร่">
          <DataTable headings={["เวอร์ชัน", "วันที่มีผล", "ผู้เผยแพร่", "สถานะ"]}>
            {policies.map((entry) => <tr key={entry.version}><td>v{entry.version}</td><td>{adminTime(entry.effectiveAt)}</td>
              <td>{entry.updatedBy}</td><td><Status tone={current?.version === entry.version ? "good" : "neutral"}>
                {current?.version === entry.version ? "มีผล" : entry.effectiveAt > Date.now() ? "รอวันที่มีผล" : "ย้อนหลัง"}
              </Status></td></tr>)}
            {!policies.length && <tr><td colSpan={4}>ยังไม่มีเวอร์ชันเผยแพร่</td></tr>}
          </DataTable>
        </Panel>
      </div>
      {session.role === "super_admin" && <Panel title="กำหนดเวอร์ชันใหม่">
        <BookingPolicyForm version={latest?.version ?? 0} policy={latest?.policy} />
      </Panel>}
    </div>
  </>;
}
