import { requireParkingAdminPage } from "@/lib/auth/session";
import { BarChart3, Clock, Gauge, Layers } from "lucide-react";
import { EmptyState, Notice, PageHeading, Panel, Stats } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";

export default async function Analytics() {
  await requireParkingAdminPage();
  return <>
    <PageHeading title="Admin Analytics" description="วิเคราะห์การใช้พื้นที่จอด ช่วงเวลาหนาแน่น และคุณภาพข้อมูลย้อนหลัง"
      actions={<Button variant="outline" disabled>Export CSV</Button>} />
    <Notice title="Insufficient data">รอชุดข้อมูลย้อนหลังที่ตรวจสอบความครอบคลุมและจัดการช่องจอดซ้ำแล้ว</Notice>
    <Stats items={[
      { label: "Average occupancy", value: "—", icon: <BarChart3 /> },
      { label: "Peak hour", value: "—", icon: <Clock />, tone: "warn" },
      { label: "Data coverage", value: "—", icon: <Gauge />, tone: "good" },
      { label: "Missing periods", value: "—", icon: <Layers />, tone: "neutral" },
    ]} />
    <div className="admin-grid wide">
      <Panel title="Occupancy trend" detail="Asia/Bangkok"><div className="admin-chart-empty"><EmptyState title="Insufficient data">กราฟจะแสดงเมื่อมีผลประมวลผลย้อนหลังที่ใช้สรุปได้</EmptyState></div></Panel>
      <Panel title="Peak hours"><EmptyState title="ยังจัดอันดับไม่ได้">ต้องมีข้อมูลเพียงพอในแต่ละช่วงเวลา</EmptyState></Panel>
      <Panel title="Zone comparison"><EmptyState title="ยังเปรียบเทียบไม่ได้">รอการสรุปข้อมูลย้อนหลังรายโซน</EmptyState></Panel>
      <Panel title="Data quality & methodology"><dl className="admin-fields"><div><dt>Timezone</dt><dd>Asia/Bangkok</dd></div><div><dt>Occupancy</dt><dd>ช่องที่มีรถ / ช่องที่รู้สถานะ</dd></div><div><dt>Missing data</dt><dd>แสดงช่วงที่ข้อมูลขาดในกราฟ</dd></div></dl></Panel>
    </div>
  </>;
}
