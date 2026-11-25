import { DataTable, PageHeading, Panel, Status } from "@/components/admin/admin-ui";
import { SessionSettingsForm } from "@/components/admin/session-settings-form";
import { readSessionMinutes, requireAdminPage } from "@/lib/auth/session";

export default async function Settings() {
  await requireAdminPage("super_admin");
  return <>
    <PageHeading title="System Settings" description="กำหนดเวลาเข้าสู่ระบบและดูสถานะการเชื่อมต่อบริการ" />
    <div className="admin-grid">
      <Panel title="Session timeout"><SessionSettingsForm minutes={await readSessionMinutes()} /></Panel>
      <Panel title="Service integrations">
        <DataTable headings={["Service", "Status"]}>
          {["Booking Service", "Shared Vehicle Service"].map((service) => <tr key={service}><td>{service}</td><td><Status>Not connected</Status></td></tr>)}
          <tr><td>University Schedule</td><td><Status tone="warn">Future</Status></td></tr>
        </DataTable>
      </Panel>
    </div>
  </>;
}
