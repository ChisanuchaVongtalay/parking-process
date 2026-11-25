import { DataTable, PageHeading, Panel } from "@/components/admin/admin-ui";
import { requireAdminPage } from "@/lib/auth/session";

export default async function RolesPage() {
  await requireAdminPage("super_admin");

  return <>
    <PageHeading title="Roles & Permissions" description="สิทธิ์การใช้งานของแต่ละ role ใน Admin Console" />
    <Panel title="สิทธิ์ตาม role">
      <DataTable headings={["ความสามารถ", "Admin", "Super Admin"]}>
        <tr><td>Dashboard, Analytics และ Monitoring</td><td>อนุญาต</td><td>อนุญาต</td></tr>
        <tr><td>จัดการโซน กล้อง และ Calibration</td><td>อนุญาต</td><td>อนุญาต</td></tr>
        <tr><td>เพิ่มและจัดการบัญชี Admin / Super Admin</td><td>จำกัดสิทธิ์</td><td>อนุญาต</td></tr>
        <tr><td>Roles & Permissions, System Settings และ Audit Logs</td><td>จำกัดสิทธิ์</td><td>อนุญาต</td></tr>
      </DataTable>
    </Panel>
  </>;
}
