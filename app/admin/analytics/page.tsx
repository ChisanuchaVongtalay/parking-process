import { BarChart3, Camera, Gauge } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { DataTable, EmptyState, PageHeading, Panel, Stats } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { analyticsFilters, readOccupancyAnalytics } from "@/services/parking-analytics";

export default async function Analytics({ searchParams }: { searchParams: Promise<{ days?: string; zone?: string }> }) {
  await requireAdminPage();
  const { days, zone } = await searchParams;
  const filters = analyticsFilters(days, zone);
  const [rows, zones] = await Promise.all([readOccupancyAnalytics(filters), db.query.zones.findMany()]);
  const samples = rows.reduce((sum, row) => sum + row.samples, 0);
  const average = samples ? (rows.reduce((sum, row) => sum + row.occupancy * row.samples, 0) / samples).toFixed(1) + "%" : "—";
  const csvParams = new URLSearchParams({ days: String(filters.days), zone: filters.zone ?? "" });

  return <>
    <PageHeading title="Admin Analytics" description="ผลประมวลผลย้อนหลังตามข้อมูลที่กล้องบันทึกจริง"
      actions={samples > 0 ? <Button asChild variant="outline"><a href={`/api/admin/analytics/export?${csvParams}`}>Export CSV</a></Button> : undefined} />
    <form method="get" className="admin-actions mb-4 items-center">
      <label>ช่วงเวลา <select name="days" defaultValue={filters.days} className="h-9 rounded-md border bg-white px-2"><option value="7">7 วัน</option><option value="30">30 วัน</option></select></label>
      <label>โซน <select name="zone" defaultValue={filters.zone ?? ""} className="h-9 rounded-md border bg-white px-2">
        <option value="">ทุกโซน</option>{zones.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
      </select></label>
      <Button type="submit" variant="outline">ดูข้อมูล</Button>
    </form>
    <Stats items={[
      { label: "Average camera occupancy", value: average, icon: <BarChart3 /> },
      { label: "Camera samples", value: samples, icon: <Camera /> },
      { label: "Days with data", value: rows.length, icon: <Gauge /> },
    ]} />
    <Panel title="Occupancy trend" detail="เวลาไทย · ค่าเฉลี่ยต่อผลประมวลผลของกล้องแต่ละตัว กล้องที่เห็นช่องเดียวกันอาจมีตัวอย่างซ้ำ">
      {rows.length ? <DataTable headings={["วันที่", "จำนวนตัวอย่าง", "ค่าเฉลี่ยสัดส่วนช่องมีรถ"]}>
        {rows.map((row) => <tr key={row.day}><td>{row.day}</td><td>{row.samples}</td>
          <td><progress max={100} value={row.occupancy} aria-label={`Occupancy ${row.day}`} className="mr-2 align-middle accent-primary" />{row.occupancy}%</td>
        </tr>)}
      </DataTable> : <EmptyState title="ยังไม่มีผลประมวลผลในช่วงนี้">ข้อมูลจะปรากฏเมื่อกล้องเริ่มส่งผลการประมวลผลเข้าระบบ</EmptyState>}
    </Panel>
  </>;
}
