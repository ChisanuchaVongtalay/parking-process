import { requireParkingAdminPage } from "@/lib/auth/session";
import { DataTable, EmptyState, Notice, PageHeading, Panel, Status } from "@/components/admin/admin-ui";

export default async function SmartCampus() {
  await requireParkingAdminPage();
  const prerequisites = ["Historical occupancy", "Verified campus geometry", "Authorized schedule source", "Booking Service", "Forecast validation"];
  return <>
    <PageHeading title="Smart Campus" description="ความพร้อมของข้อมูลสำหรับแนะนำโซนจอดรถและพยากรณ์ความต้องการ" />
    <Notice title="Future · P2">การแนะนำโซนและการพยากรณ์จะเปิดเมื่อแหล่งข้อมูล สิทธิ์ และเกณฑ์คุณภาพผ่านการยืนยัน</Notice>
    <div className="admin-grid">
      <Panel title="Data readiness checklist"><DataTable headings={["Source", "Status"]}>
        {prerequisites.map((item) => <tr key={item}><td>{item}</td><td><Status tone="warn">รอยืนยัน</Status></td></tr>)}
      </DataTable></Panel>
      <Panel title="Campus demand forecast"><div className="admin-chart-empty"><EmptyState title="Forecast unavailable">ต้องมีข้อมูลย้อนหลังและผลประเมินโมเดลก่อนแสดงค่าพยากรณ์</EmptyState></div></Panel>
    </div>
    <div className="admin-grid three">
      <Panel title="Schedule-aware recommendations"><p className="text-sm">รอแหล่งข้อมูลตารางและตำแหน่งอาคารที่อนุญาตให้ใช้</p></Panel>
      <Panel title="Demand insights"><p className="text-sm">รอข้อมูลย้อนหลังที่มีความครอบคลุมเพียงพอ</p></Panel>
      <Panel title="Credits & incentives"><p className="text-sm">แนวคิดสำหรับพิจารณาหลังอนุมัตินโยบาย</p></Panel>
    </div>
  </>;
}
