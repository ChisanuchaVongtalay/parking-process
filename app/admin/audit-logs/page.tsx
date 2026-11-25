import { DataTable, PageHeading, Panel, Status } from "@/components/admin/admin-ui";
import { authRows } from "@/lib/auth/database";
import { adminTime } from "@/lib/admin-time";
import { requireAdminPage } from "@/lib/auth/session";

export default async function AuditLogs() {
  await requireAdminPage("super_admin");
  const events = await authRows<{ id: number; actor: string; action: string; target: string; status: number; recordedAt: number }>(`
    SELECT id, actor, action, target, status, recorded_at AS recordedAt
    FROM admin_audit_events ORDER BY id DESC LIMIT 200
  `);

  return <>
    <PageHeading title="Audit Logs" description="ติดตามการเข้าสู่ระบบ การจัดการบัญชี และคำสั่งเปลี่ยนแปลงข้อมูล" />
    <Panel title="System & administration activity" detail="ล่าสุดไม่เกิน 200 รายการ · Asia/Bangkok">
      <DataTable headings={["Time", "Actor", "Event", "Target", "Outcome"]}>
        {events.map((event) => <tr key={event.id}>
          <td>{adminTime(event.recordedAt)}</td><td>{event.actor}</td><td>{event.action}</td>
          <td className="break-all">{event.target}</td>
          <td><Status tone={event.status < 400 ? "good" : "bad"}>{event.status < 400 ? "Success" : `Failed (${event.status})`}</Status></td>
        </tr>)}
        {!events.length && <tr><td colSpan={5}>ยังไม่มีกิจกรรม</td></tr>}
      </DataTable>
    </Panel>
  </>;
}
