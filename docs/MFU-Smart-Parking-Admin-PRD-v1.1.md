# Product Requirements Document (PRD)
# MFU Smart Parking — Admin Console & Parking Processor

| รายการ | รายละเอียด |
| --- | --- |
| Document version | 1.1 (ฉบับขยายขอบเขต Admin) |
| Updated | 24 พฤศจิกายน 2026 |
| Status | Draft — ใช้กำหนดแผนพัฒนาและทบทวนร่วมกับผู้เกี่ยวข้อง ยังไม่ใช่การรับรอง Production |
| Product | MFU Smart Parking — ระบบหลังบ้านสำหรับจัดการพื้นที่จอด กล้อง การประมวลผล และการบริหาร |
| Related product | MFU Smart Parking User Web (PRD แยกต่างหาก) |
| Product owner / Approver | รอกำหนด |
| Primary technology (ตาม PRD เดิม) | Next.js App Router, React, TypeScript, Tailwind, SQLite, Drizzle, FFmpeg / RTSP |

> **วิธีอ่านสถานะ:** **มีแล้ว (ตาม PRD เดิม)** = ข้อความระบุว่ามีอยู่ในโค้ด ณ 19 พ.ย. 2026 แต่ไม่ได้ตรวจ repository ล่าสุดซ้ำในการแก้เอกสารนี้; **ต้องพัฒนา** = ความต้องการใหม่หรือส่วนที่ยังไม่ครบ; **รอยืนยัน** = ต้องตัดสินใจเรื่องนโยบาย/ข้อมูล/สิทธิ์ก่อนพัฒนา; **Future** = ความสามารถระยะถัดไป ไม่ถือว่ามีระบบจริงแล้ว
>
> **ขอบเขต:** เอกสารนี้เป็น PRD **ฝั่ง Admin และ Processor** ไม่ใช่ PRD ฝั่งนักศึกษา/ผู้ใช้ทั่วไป การจองจากเว็บผู้ใช้ การเก็บรถ และการเข้าสู่ระบบผู้ใช้เป็นระบบอีกฝั่งหนึ่ง ซึ่ง Admin จะรับข้อมูลผ่านบริการหรือสัญญา API ที่ตกลงร่วมกันเท่านั้น

---

## 1. ภาพรวมผลิตภัณฑ์และปัญหา

MFU Smart Parking Admin Console เป็นระบบให้ผู้ดูแลมหาวิทยาลัยบริหารโซนจอดรถ กล้อง CCTV ช่องจอด การตรวจจับจากภาพและคุณภาพข้อมูล เพื่อส่งสถานะที่เชื่อถือได้ให้ MFU Smart Parking User Web นอกจากนี้ระบบหลังบ้านควรช่วยผู้ดูแลเห็นภาพรวมการใช้งาน วิเคราะห์ความหนาแน่น ตรวจหลักฐานรถ กำหนดนโยบายที่เกี่ยวข้อง และเตรียมความสามารถ Smart Campus ในอนาคต

ระบบ Processor ปัจจุบันใช้ **Background Subtraction / Pixel Difference ในขอบเขตช่องจอดที่กำหนดไว้** เทียบ snapshot ล่าสุดกับ background reference ไม่ใช่การยืนยันรถด้วย object-detection model, OCR หรือข้อมูลไม้กั้น การแปลผลอาจผิดพลาดจากแสง ฝน เงา มุมกล้อง และการบังภาพ

ความแตกต่างที่สำคัญของสองผลิตภัณฑ์:

| รายการ | Admin Console & Processor (เอกสารนี้) | User Web (อีก PRD) |
| --- | --- | --- |
| ผู้ใช้งาน | ผู้ดูแลลานจอด ผู้ดูแลระบบ ผู้ตรวจหลักฐาน ผู้บริหารที่ได้รับสิทธิ์ | นักศึกษา บุคลากร อาจารย์ |
| หน้าที่หลัก | สร้างโซน/กล้อง, calibration, ตรวจคุณภาพข้อมูล, dashboard, analytics, approvals, ตั้งค่านโยบาย, Smart Campus | ค้นหาที่จอด ดูผัง จอง ดูรถของฉัน ประวัติและการแจ้งเตือน |
| แหล่งข้อมูล | กล้อง, observations, ฐานข้อมูล Admin, บริการส่วนกลางตามที่เชื่อมจริง | Parking API, Booking Service, User Profile และบริการที่เกี่ยวข้อง |
| ข้อจำกัดวันนี้ | มีแกนกล้อง/ภาพ/ช่องจอด/monitor; ส่วนบริหารเชิงธุรกิจยังไม่ครบ | การจองและข้อมูลจอดส่วนใหญ่ยังเป็น Mock; หลักฐานรถยังอยู่ใน IndexedDB ของผู้ใช้ |

## 2. เป้าหมายและตัวชี้วัด

### 2.1 เป้าหมาย

1. ให้ผู้ดูแลตั้งค่ากล้อง RTSP, background, calibration และ logical parking slots ได้โดยไม่แก้โค้ด
2. เก็บสถานะภาพล่าสุด ผลรายกล้อง/ช่อง และแยก `fresh`, `stale`, `unknown`, `partial`, `error` อย่างโปร่งใส
3. มี **Admin Dashboard** ที่ตอบได้ทันทีว่าแต่ละโซนใช้งานเป็นอย่างไร กล้องใดขัดข้อง และมีงานค้างอะไร
4. มี **Admin Analytics** เพื่อวิเคราะห์ช่วงเวลาหนาแน่น รูปแบบการใช้งาน ความครอบคลุมและความน่าเชื่อถือของข้อมูล
5. มี **Vehicle Approvals** ตรวจหลักฐานรถจากระบบส่วนกลางและแจ้งผลกลับเจ้าของรายการได้โดยปลอดภัย
6. รองรับ **Policy Management** เพื่อจัดการกฎการจอง/โควตาเมื่อบริการส่วนกลางพร้อม พร้อมบันทึกประวัติการเปลี่ยนแปลง
7. เตรียม **Smart Campus** เพื่อแนะนำจุดจอดและพยากรณ์ความต้องการเมื่อมีข้อมูลและสิทธิ์ใช้งานครบ

### 2.2 ตัวชี้วัด (ยังไม่กำหนดเป้าตัวเลข)

| ตัวชี้วัด | นิยาม/ข้อพึงระวัง |
| --- | --- |
| Camera availability | สัดส่วนกล้องที่เชื่อมต่อและมี capture ที่สดต่อจำนวนกล้องที่เปิดใช้งาน |
| Observation freshness | เวลาปัจจุบันเทียบกับเวลาประมวลผล/เวลา capture ล่าสุด แยกสองเวลา |
| Slot coverage | จำนวน logical slots ที่มีข้อมูลสดและไม่ซ้ำ / จำนวน logical slots ที่เปิดใช้งานและกำหนดไว้ |
| Detection accuracy | ผลประเมินเทียบการตรวจนับภาคสนาม/ภาพติดป้ายกำกับ ต้องระบุชุดทดสอบ |
| Review turnaround time | เวลาตั้งแต่คำขอตรวจรถเข้าสู่คิวส่วนกลางจนตัดสินใจ |
| Dashboard/analytics usage | การเข้าใช้ ฟิลเตอร์ และการส่งออกข้อมูลโดยผู้มีสิทธิ์ |
| Prediction quality | ความคลาดเคลื่อนของค่าคาดการณ์เทียบผลจริง พร้อมรายงาน coverage/ความเชื่อมั่น |

ห้ามแสดงเป้าหมายหรือผลลัพธ์ประเมินเป็นตัวเลขจริงโดยไม่มีข้อมูลตรวจวัดและแหล่งอ้างอิง

## 3. ขอบเขตและลำดับความสำคัญ

| ระบบ | ขอบเขต | สถานะ | Priority ที่เสนอ |
| --- | --- | --- | --- |
| Zones & Camera Settings | จัดการโซน, กล้อง, RTSP, camera status, import/export | มีแล้วบางส่วน; ต้องเพิ่มความปลอดภัย | P0 |
| Snapshot Worker | ดึงภาพ FFmpeg ตามรอบ, เก็บภาพล่าสุดและ error | มีแล้วตาม PRD เดิม | P0 |
| Calibration & Slot Management | background, polygon/slot, thresholds, test, save | มีแล้วตาม PRD เดิม; ต้องปรับ workflow | P0 |
| Runtime Processing & Monitoring | ผลรายกล้อง/ช่อง, snapshot state, stale/partial, error | มีแล้วบางส่วน; ต้องเพิ่ม health | P0 |
| Access Control & Audit | Admin RBAC, ป้องกันข้อมูลกล้อง/เอกสาร, ประวัติการแก้ไข | ต้องพัฒนา/ยืนยัน | P0 |
| Admin Dashboard | KPI, สถานะโซน, แผนที่, health, activity | ต้องพัฒนา | P1 |
| Admin Analytics | historical trends, peak hours, occupancy, exports | ต้องพัฒนา | P1 |
| Vehicle Approvals | review queue, หลักฐาน private, decision, notification | ต้องพัฒนา; รอ shared backend | P1 / P0 ก่อนเปิดการตรวจรถจริง |
| Policy Management | โควตา, ระยะเวลาจอง, วันเริ่มใช้, audit | ต้องพัฒนา; รอ Booking Service | P1 |
| Smart Campus | recommendation, demand forecast, credit concept | Future; รอ data governance/validation | P2 |

**ไม่ใช่ขอบเขตที่รับรองแล้ว:** ระบบชำระเงิน, ไม้กั้น/ควบคุมเข้าออก, OCR ทะเบียน, การพัฒนา AI object detection เอง, เส้นทางนำทางที่รับรองความถูกต้อง, real-time video streaming สู่ผู้ใช้ทั่วไป และการย้าย cloud storage โดยอัตโนมัติ

## 4. กลุ่มผู้ใช้และสิทธิ์ (Proposed RBAC)

ต้องกำหนดสิทธิ์ที่ Server ไม่ใช้การซ่อนเมนูเป็นตัวป้องกัน สิทธิ์ต่อไปนี้เป็น **ข้อเสนอเพื่อออกแบบ** ไม่ใช่ Role ที่ยืนยันว่าใช้อยู่แล้ว:

| ความสามารถ | Viewer / Executive | Parking Admin | Vehicle Reviewer | Super Admin |
| --- | :---: | :---: | :---: | :---: |
| ดู Dashboard/Analytics | ✓ | ✓ | ดูข้อมูลเท่าที่จำเป็น | ✓ |
| ดู Monitor และสถานะกล้อง | เฉพาะ Summary | ✓ | — | ✓ |
| แก้กล้อง/โซน/Calibration/Slots | — | ✓ | — | ✓ |
| เปิดหลักฐานรถส่วนตัว | — | — | ✓ | ตามความจำเป็นและสิทธิ์เฉพาะ |
| อนุมัติ/ปฏิเสธรถ | — | — | ✓ | ตามนโยบายที่อนุมัติ |
| เปลี่ยนนโยบายจอง | — | — | — | ✓ |
| จัดการบัญชีผู้ดูแล/สิทธิ์ | — | — | — | ✓ |
| ดูและส่งออก Audit Logs | จำกัดเฉพาะ Summary | จำกัดตามหน้าที่ | เฉพาะเคสตัวเอง | ✓ |

- หนึ่งบัญชีอาจมีหลาย permission ได้ตามนโยบาย แต่ต้องมี `least privilege` และ server-side authorization
- ผู้ใช้งานทั่วไปจาก User Web **ไม่สามารถเลือก role ของตัวเองเพื่อเพิ่มสิทธิ์**
- ต้องยืนยัน identity provider, วิธี provision Admin, การถอดสิทธิ์, การจัดการบัญชีบุคลากร และผู้อนุมัติ Super Admin ก่อนใช้จริง

## 5. Information Architecture และหน้าจอ Admin

เส้นทางด้านล่างเป็น **ข้อเสนอการจัดหน้า UI** เพื่อพัฒนา ไม่ใช่การยืนยันว่ามี route ใน repository แล้ว (route เดิมให้ตรวจจากโค้ดก่อน refactor)

| หน้าจอ | Suggested route | เนื้อหา/การกระทำ |
| --- | --- | --- |
| Admin Dashboard | `/admin` | KPI ภาพรวม, zone map, camera health, pending approvals, activity |
| Admin Analytics | `/admin/analytics` | Trends, occupancy, peak hours, comparison, export |
| Parking Zones | `/admin/zones` | รายชื่อโซน, ความจุ, ผูกกล้อง, แก้ข้อมูล |
| Zone Detail / Slots | `/admin/zones/[id]` | Logical slots, mapping กล้อง, coverage |
| Cameras | `/admin/cameras` | รายชื่อกล้อง, active, network/capture health, import/export |
| Camera Detail | `/admin/cameras/[id]` | รายละเอียด, snapshot, calibrations, errors |
| Calibration Editor | `/admin/cameras/[id]/calibration` | background, วาด slot, tune, run test, save |
| Monitoring | `/admin/monitor` | สถานะโซน/กล้อง/ช่อง, freshness, error และ refresh |
| Vehicle Approvals | `/admin/vehicle-approvals` | คิวรอตรวจ, ค้นหา/กรอง, approve/reject |
| Approval Detail | `/admin/vehicle-approvals/[id]` | ข้อมูลรถ, เอกสารสิทธิ์, ความเห็นและประวัติการตัดสินใจ |
| Policy Management | `/admin/policies` | นโยบายการจอง/สิทธิ์และวันที่มีผล |
| Smart Campus | `/admin/smart-campus` | Schedule recommendation status, forecast, insight, model health |
| Audit Logs | `/admin/audit-logs` | ประวัติการเปลี่ยนแปลงที่สำคัญและการเข้าถึงข้อมูลอ่อนไหว |
| Admin Settings | `/admin/settings` | ผู้ใช้/สิทธิ์, ระบบแจ้งเตือน, ค่าแสดงผล ตาม permission |

**UI Design:** สีหลัก `#7D000F` (แดงเลือดหมู) และสีรอง `#775A19` (น้ำตาลทอง) ใช้ร่วมกับข้อความ/icon สถานะ ห้ามใช้สีเพียงอย่างเดียวในการสื่อความหมาย; มี Responsive Navigation, ตารางที่เลื่อนในมือถือได้, loading/empty/error, keyboard focus และคีย์ข้อมูลสำคัญอ่านได้ชัดเจน

## 6. User Workflows

### 6.1 Workflow ปัจจุบัน: ตั้งค่ากล้องจนส่งผลให้เว็บหลัก

1. Parking Admin สร้าง Zone และ Camera ระบุ RTSP URL และเปิดใช้งาน
2. Snapshot Worker ดึง JPEG ล่าสุดด้วย FFmpeg และเขียน `snapshots/<cameraId>/latest.jpg`
3. Admin อัปโหลด background ซึ่งเป็นภาพอ้างอิงพื้นที่ว่าง (ไม่ใช่ snapshot ล่าสุดโดยอัตโนมัติ)
4. Admin วาด/ปรับ slot, ประเภทรถ, รหัสช่อง และตั้งค่าคำนวณ Pixel Difference
5. Admin กด Run Test ตรวจ overlay, test summary และ score รายช่อง
6. Admin กด **Save & Start Counting** เพื่อบันทึก slots/parameters และลองประมวลผล snapshot ล่าสุด
7. Runtime อ่าน configuration ที่บันทึกไว้แล้วเก็บ camera observations และ slot observations
8. Monitor และ Public API ส่งต่อข้อมูลสรุปพร้อมเวลาล่าสุด; ถ้าขาดข้อมูลต้องสื่อว่า unknown/stale/partial ไม่ใช่ 0 ช่อง

### 6.2 Workflow ใหม่: Admin Dashboard → แก้ปัญหาหน้างาน

1. Admin เปิด Dashboard และเลือกช่วงเวลา/โซน
2. เห็นจำนวนช่องที่มีข้อมูลจริง, occupied/free, coverage และข้อมูลอัปเดตล่าสุด
3. เห็น camera ที่ offline/stale/error หรือโซนที่ข้อมูลไม่ครบ
4. คลิกรายการผิดปกติเพื่อไป Camera Detail, Monitor หรือ Calibration
5. ผู้มีสิทธิ์แก้การตั้งค่า/ทดสอบและดูว่าการประมวลผลกลับมาสดใหม่หรือไม่
6. ระบบเก็บเหตุการณ์ที่เกี่ยวข้องและ Audit Log ในการเปลี่ยน configuration

### 6.3 Workflow ใหม่: Vehicle Approvals

1. User Web ส่งคำขอรถและหลักฐานขึ้น backend ส่วนกลาง **หลังจากมี integration ที่ปลอดภัย**
2. Vehicle Reviewer เห็นคำขอ `pending` พร้อมข้อมูลพื้นฐานโดยไม่เปิดเอกสารทั้งหมดล่วงหน้า
3. เปิดรายการและเอกสารผ่าน signed/authorized access ที่จำกัดสิทธิ์ พร้อมบันทึกการเข้าถึงตามนโยบาย
4. ตรวจข้อมูลรถ/หลักฐาน จากนั้น `approve` หรือ `reject` (กรณีปฏิเสธต้องระบุเหตุผล)
5. Backend บันทึกผลแบบ atomic รวมผู้ตรวจ เวลา เหตุผล version และ audit
6. ระบบแจ้งผู้ใช้และปรับสถานะรถใน User Web จาก server source of truth
7. กรณีหลักฐานขาด ให้ใช้ `request_changes` เฉพาะเมื่ออนุมัติ state และ UX เพิ่มเติมแล้ว ไม่แอบแทนที่ `rejected`

### 6.4 Workflow ใหม่: Analytics / Smart Campus

1. เลือกช่วงเวลาและโซนที่ต้องการวิเคราะห์
2. Analytics โหลด historical logical-slot observations ที่ผ่านการคัดกรองคุณภาพ พร้อม coverage
3. ผู้ใช้ดู peak hour, occupancy trend, พื้นที่มีปัญหา และ export summary ตามสิทธิ์
4. หากข้อมูลและนโยบายพร้อม Smart Campus จึงเปิด forecast/recommendation พร้อมเหตุผล แหล่งข้อมูล และระดับความมั่นใจ
5. เมื่อข้อมูลไม่พอ ต้องแสดง unavailable/insufficient data และใช้การค้นหาหรือสรุปแบบปกติแทน

## 7. Functional Requirements — Core Processor (ระบบเดิม)

### FR-01 Zone & Camera Management (P0)

- **มีแล้วตาม PRD เดิม:** สร้างโซน/กล้อง ตั้งรหัส ชื่อ โซน RTSP URL, `active` และกล้องหลัก; camera list มีตัวกรองโซนและ import/export CSV
- **มีแล้วตาม PRD เดิม:** SQLite/Drizzle เก็บ zones, cameras, calibrations, slots และ observations
- **ต้องทำ:** ตรวจ/จำกัดสิทธิ์การสร้าง แก้ ลบ ย้ายโซน/กล้อง; แสดงผลกระทบเมื่อปิดกล้อง/แก้ logical slot; Audit Log และป้องกันการเผย RTSP credentials ใน response/CSV
- **รอยืนยัน:** หลักเกณฑ์การลบข้อมูล, วิธีเก็บ/หมุน credentials, mapping กล้องต่อ physical slot และผู้มีสิทธิ์แก้ไข

### FR-02 RTSP Snapshot Worker (P0)

- **มีแล้วตาม PRD เดิม:** แยก process `npm run worker:snapshot`, อ่านกล้อง active จาก DB ทุก cycle, ดึง JPEG หนึ่งเฟรมผ่าน FFmpeg โดย TCP เป็นค่าเริ่มต้น
- **มีแล้วตาม PRD เดิม:** ตั้ง interval 60 วินาที, timeout 20 วินาที, concurrency 4 กล้องเป็นค่าเริ่มต้น; สามารถเลือก UDP ได้
- **มีแล้วตาม PRD เดิม:** กันงานกล้องเดียวกันซ้อนภายใน worker instance เดียว, คุม concurrency, ยกเลิก FFmpeg เมื่อ timeout/ปิดโปรแกรม และ retry รอบถัดไป
- **มีแล้วตาม PRD เดิม:** ตรวจไฟล์ JPEG, เขียน temp แล้ว rename เป็น `snapshots/<cameraId>/latest.jpg`; การ capture ล้มเหลวไม่ลบภาพล่าสุด/ภาพ background; บันทึกเวลาและ error ใน `snapshot_capture_status`
- **ข้อจำกัด:** รอบ 60 วินาทีเป็น target ไม่ใช่ guarantee; ห้ามรันหลาย instance ที่แย่งกล้องชุดเดียวกันโดยไม่มีกลไก coordination
- **ต้องทำ:** health/alerting, แยก capture error กับ processing error, auto restart, retention/disk monitoring, load/capacity test และควบคุมสิทธิ์ไฟล์

### FR-03 Calibration & Parking Slot Management (P0)

- **มีแล้วตาม PRD เดิม:** อัปโหลด background/snapshot, วาด/ย้าย/resize slot, ตั้งรหัส ประเภทรถ และ enabled/disabled
- **มีแล้วตาม PRD เดิม:** pixel threshold, occupancy threshold, grayscale, blur radius, normalize, downscale, lighting compensation, edge weight; ทดสอบค่าที่ยังไม่ Save ได้
- **มีแล้วตาม PRD เดิม:** Test Summary, Slot Score Log, overlay ผลว่าง/มีรถ; สามารถ Save slots/parameters และ Save & Start Counting ได้ รวมทั้ง export JSON เป็นทางเลือก
- **ข้อจำกัด:** Save slots กับ parameters เป็นคนละ request ไม่ atomic; ผล Run Test และ Runtime ต้องตรวจด้วย input เดียวกัน; background อาจมีรถหรือแสงต่างกัน
- **ต้องทำ:** version ของ CalibrationProfile, change history/rollback, ตรวจ slots ซ้อน/นอกภาพ/รหัสซ้ำ, explicit background approval, logical-slot mapping หลายกล้อง, safety confirmation เมื่อแก้ slot ที่มีผลต่อ API
- **Future/รอยืนยัน:** เลือก snapshot ล่าสุดเป็น background, presets, heatmap, auto-tune, ชุดทดสอบกลางวัน/กลางคืน/ฝน และเกณฑ์ยอมรับความแม่นยำ

### FR-04 Image Processing & Observations (P0)

- **มีแล้วตาม PRD เดิม:** Runtime โหลด background, calibration และ enabled slots จาก DB เมื่อประมวลผล camera ID; preprocess และ lighting compensation; เทียบ Pixel Difference ราย slot ก่อนบันทึก `camera_observations`, `slot_observations`
- **มีแล้วตาม PRD เดิม:** ค่า `score`, `occupied`, free/occupied counts รายกล้อง/ช่อง
- **ต้องทำ:** แยกสถานะ `fresh`, `stale`, `unknown`, `partial`, `error`; บันทึก processing failure; กำหนด strategy สำหรับกล้องมองช่องเดียวกัน, deduplicate logical slot และจัดการการเปลี่ยนตำแหน่งกล้อง
- **ข้อจำกัด:** `occupied=false` คือแบบจำลองประเมินว่าว่าง ไม่ใช่หลักฐานจากการตรวจรถจริง; การจองในระบบอื่นไม่เปลี่ยนจำนวนรถจริง

### FR-05 Monitoring & System Health (P0)

- **มีแล้วตาม PRD เดิม:** Admin Monitor แสดง zone/camera/slot summary, manual test และ Refresh
- **ต้องทำ:** สถานะ worker, RTSP capture, last success, last processed, latency/freshness, processing errors, disk usage, camera coverage, unresolved incidents และ drill-down
- **ต้องทำ:** แยกข้อความเหตุการณ์ระบบ (`camera_offline`, `snapshot_timeout`, `processing_error`, `stale_data`) กับธุรกิจ (`vehicle_approved`, `policy_changed`) และไม่แสดง event ที่เกิดซ้ำจากการ refresh
- **รอยืนยัน:** ความถี่ alert/escalation, ช่องทางแจ้งทีมงาน และ SLA ระยะเวลาแก้ไข

### FR-06 Public Data API & User Web Integration (P0)

**Endpoint ที่ PRD เดิมระบุว่ามีอยู่:** response สำเร็จ `{ "data": ... }`, error `{ "error": ... }`

| Endpoint | ความหมาย |
| --- | --- |
| `GET /api/public/zones/status` | สรุป `zone`, `total_slots`, `free_slots`, `occupied_slots`, `last_updated` |
| `GET /api/public/zones` | โซนพร้อม summary และเวลาล่าสุด |
| `GET /api/public/zones/{zoneId}/summary` | สรุปโซน |
| `GET /api/public/cameras?zoneId={zoneId}` | รายกล้อง โดยกรองโซนได้ |
| `GET /api/public/cameras/{cameraId}` | observation ล่าสุดของกล้อง |
| `GET /api/public/cameras/{cameraId}/slots` | `slotCode`, `score`, `occupied`, `updatedAt` |
| `POST /api/runtime/cameras/{cameraId}/process` | สั่งประมวลผล snapshot จาก path หรือภาพล่าสุด; ต้องจำกัดสิทธิ์ |

- `occupied: true/false` เป็นผลประเมินจากภาพ; timestamps ใช้ ISO 8601; ID จริงขึ้นอยู่กับ DB
- **Freshness เดิม:** `SNAPSHOT_MAX_AGE_SECONDS` มี default 900 วินาทีสำหรับกรอง observation เก่า; camera detail อาจตอบ 404 และ slots อาจว่างเมื่อไม่มีผลใหม่; บาง summary อาจตอบ 0 หรือข้อมูลไม่ครบ **ห้ามตีความ 0 ว่าไม่มีรถ/ไม่มีช่องโดยอัตโนมัติ**
- **ต้องทำก่อน Production:** API contract/version, status `unknown/stale/partial`, coverage และ per-slot freshness, CORS/proxy/network/auth, validation, fail-closed behavior และไม่ fallback เป็น Mock โดยไม่แจ้ง
- **Contract boundary:** `free` จากภาพ = ช่องที่ไม่มีรถตามข้อมูลกายภาพ; `bookable` ต้องคำนวณร่วมกับ **Booking Service** และข้อจำกัดการจองที่ Server ไม่สามารถให้ Processor อ้างเองจากยอดกล้อง

## 8. Functional Requirements — Admin Management (ใหม่)

### FR-07 Admin Dashboard (P1)

**Purpose:** จุดเริ่มต้นของผู้ดูแลเพื่อเห็นสถานะการจอด + health ของการเก็บข้อมูล + งานค้างภายในหน้าจอเดียว โดยไม่ใช่เพียงการนำ Monitor เดิมมาแสดงซ้ำ

**องค์ประกอบหน้าจอที่ต้องมี**

| Component | ข้อมูล/พฤติกรรมที่ต้องมี | แหล่งข้อมูล/เงื่อนไข |
| --- | --- | --- |
| Summary KPI Cards | Total known capacity, occupied, physically free, unknown slots, occupancy rate | logical slots + latest valid observations; แสดง coverage |
| Zone Overview | Card/table ของแต่ละโซน พร้อมสถานะ available/near-full/full/no-data และ last updated | aggregated logical slots; เกณฑ์สีต้องเป็น config ที่ยืนยัน |
| Campus Map | คลิกโซนเพื่อเข้า Zone Detail; สัญลักษณ์สถานะบนแผนที่ | พิกัด/แผนที่ที่ตรวจจริง ไม่ย้ายอาคารตามภาพ mock |
| Camera Health | Active, healthy, offline, stale, error, last capture & process time | snapshot capture + process health |
| Pending Vehicle Approvals | จำนวนรายการ pending และลิงก์เข้าคิว | ต้องมี approvals backend ก่อน; มิฉะนั้นแสดง Not connected |
| Recent Activity / System Events | เหตุการณ์ระบบล่าสุดและรายการเปลี่ยนการตั้งค่าสำคัญ | Event source/Audit ตามสิทธิ์ |
| Time / Zone / Vehicle Filters | เลือกช่วงเวลา โซน รถยนต์/มอเตอร์ไซค์ | ตาม data granularity จริง |

**Business rules**

- ค่า Physical occupancy ของช่องที่รู้สถานะ = `occupied_known / known_slots`; ต้องแสดง `known_slots / total_enabled_logical_slots` (coverage) ควบคู่เสมอ
- ไม่เอาโซนที่ไม่มีข้อมูลมาบวกเป็นช่องว่าง; ไม่มีข้อมูลต้องมีข้อความ `No data/Unknown` แม้ API เดิมให้ 0
- ห้ามนับช่องเดียวซ้ำเพราะหลายกล้อง; หากยัง deduplicate ไม่ได้ ห้ามอ้างว่ายอดรวมแม่นยำทั่วมหาวิทยาลัย
- Dashboard แบบข้อมูลล่าสุด **ไม่ใช่ real-time guarantee**; ระบุ `Last updated`, refresh control และ stale indicator
- แยก `Occupied` จาก `Reserved/Bookable` อย่างชัดเจน; จะแสดง reservation KPI ได้ต่อเมื่อเชื่อม Booking Service จริง
- ข้อมูลอนุมัติรถและจองที่ยังไม่เชื่อมต้องเป็น `Not connected/Coming soon` ไม่สร้างตัวเลขปลอม
- คลิก error zone/camera จะไปหน้าแก้ไขที่มี permission ไม่ใช่เปิด RTSP URL ให้ผู้ใช้เห็น

### FR-08 Admin Analytics (P1)

**Purpose:** วิเคราะห์การใช้ที่จอดย้อนหลังเพื่อช่วยวางแผน capacity และดูจุดวิกฤต โดยต้องแสดงคุณภาพข้อมูลทุกกราฟ

**ความต้องการ**

1. เลือกวัน/ช่วงวัน, hour granularity, โซน, ประเภทรถ และช่วงเวลาเปรียบเทียบ
2. แสดง Occupancy Trend, Peak Hours, Average Occupancy, Zone Comparison, Camera Coverage / Missing Data Trend
3. สามารถ drill down เป็นโซน/วัน/ช่วงเวลา และตรวจว่าเหตุใดกราฟมีจุดขาดหาย
4. แสดงจำนวน sample, coverage, time zone (`Asia/Bangkok`) และนิยาม Metric อย่างชัดเจน
5. Export CSV ของข้อมูล summary ที่ผู้ใช้นั้นมีสิทธิ์ โดยไม่ส่งข้อมูล raw RTSP/ภาพ/ทะเบียน
6. หากเก็บข้อมูลย้อนหลังไม่ครบหรือไม่มี sample ให้แสดง `Insufficient data` ไม่เติม 0 หรือแสดงกราฟต่อเนื่องโดยไม่มีหลักฐาน
7. Historical trend ต้องดึงจาก observations ที่เก็บเป็นประวัติจริง ไม่สามารถสร้างข้อมูลอดีตจาก `latest.jpg` ซึ่งถูกเขียนทับได้
8. ความสามารถเรื่อง overflow, reservation behavior, no-show และบุคคลที่จอดซ้ำ ต้องเลื่อนจนได้ข้อมูลจริงและนิยามที่อนุมัติ

**นิยามเมตริกเบื้องต้น (เสนอให้ยืนยันก่อนนำไปใช้)**

| Metric | นิยามที่เสนอ | ข้อจำกัด |
| --- | --- | --- |
| Snapshot occupancy rate | `known_occupied / known_slots` ณ timestamp นั้น | รายงาน coverage คู่กัน |
| Average occupancy | ค่าเฉลี่ยตามช่วงเวลาที่ใช้จริง (time-weighted เมื่อ sampling ไม่สม่ำเสมอ) | ห้ามนับ null เป็น 0; กำหนด minimum coverage |
| Peak hour | ชั่วโมงที่มี average/maximum occupancy สูงสุดตามนิยามที่ตกลง | ระบุ metric ที่ใช้จัดอันดับและ timezone |
| Utilization by zone | Occupied/capacity ที่ผ่าน quality rule | เปรียบเทียบเฉพาะโซนที่ coverage เพียงพอ |
| Camera data availability | ช่วงเวลาที่มีกล้อง/ผลคำนวณสดเทียบเวลาที่คาดว่าต้องมี | ต้องกำหนด sampling window และ SLA |
| Reservation analytics | จำนวนจองสำเร็จ/ยกเลิก/หมดเวลา/ไม่มา | **ไม่ได้อยู่ใน Processor ปัจจุบัน**; รอ Booking Service |

**Data prerequisites:** retention ของ observations, sampling policy, deduplicated logical slots, export job limits, สร้าง rollup รายชั่วโมง/วันเมื่อข้อมูลมาก และกำหนดวิธีคำนวณเมื่อกล้องหายบางส่วน

### FR-09 Vehicle Approvals (P1; Integration P0 ก่อนใช้จริง)

**Purpose:** ให้ผู้ตรวจที่ได้รับสิทธิ์พิจารณาข้อมูลรถ/หลักฐานจากเว็บผู้ใช้ ก่อนส่งผลอนุมัติกลับไปยังระบบผู้ใช้

**ข้อเท็จจริงวันนี้:** User Web ต้นแบบมีการเพิ่มรถและแนบหลักฐาน แต่เก็บไฟล์ใน IndexedDB ของเบราว์เซอร์ จึง **ไม่มีคิวเอกสารที่ Admin อ่านได้จริง** ณ ตอนนี้ การสร้างหน้า Admin อย่างเดียวไม่ใช่การเชื่อมตรวจรถสำเร็จ

**ข้อกำหนด**

| Feature | พฤติกรรม |
| --- | --- |
| Review Queue | รายการ `pending`, ค้นหาทะเบียน/จังหวัด/ผู้ยื่นตามสิทธิ์, วันที่, ประเภทรถ, pagination |
| Review Detail | ข้อมูลรถ ทะเบียน จังหวัด ยี่ห้อ ประเภทรถ ผู้ยื่น วันที่ส่ง เวอร์ชันหลักฐาน |
| Evidence Viewer | ดู JPEG/PNG/PDF ที่ Backend ตรวจชนิด/ขนาดแล้วผ่าน private authorized access; ห้ามเผยลิงก์ถาวรสาธารณะ |
| Decision | Approve หรือ Reject; ถ้า Reject ต้องมีเหตุผลที่ใช้แจ้งผู้ยื่นได้ |
| Concurrency | ป้องกันผู้ตรวจสองคนสรุปรายการเดียวกันพร้อมกันด้วย version/transaction |
| Notification | ส่งสถานะ/เหตุผลกลับ User Web หรือ backend notification ที่เชื่อมจริง |
| Audit | บันทึก reviewer ID, action, previous/new status, timestamp, reason และ document version |
| Privacy | แสดงเท่าที่จำเป็น, จำกัด download, retention/deletion และระงับสิทธิ์ทันทีเมื่อถูกถอด role |

**Proposed states:** `pending → approved` หรือ `pending → rejected`; `request_changes` / `resubmitted` เป็น optional ที่ต้องตัดสินใจก่อน implement. ห้ามปล่อย state ที่ frontend/backend ไม่รู้จัก

**User Web contract ที่ต้องรักษา:** ข้อมูลรถมี license plate + province, brand, type (Sedan, Hatchback, SUV, Pickup, Van, Motorcycle, Other) และหลักฐานสิทธิ์ใช้รถ; User Web ต้นแบบรับ JPEG/PNG/PDF ไม่เกิน 5 MiB ซึ่งเป็น **ข้อกำหนดต้นแบบ** ที่ต้องยืนยันร่วมกับ backend ตรวจไฟล์ฝั่ง server ซ้ำ; ป้องกันทะเบียน+จังหวัดซ้ำตาม policy

**ข้อห้าม:** อย่าตั้ง `approved` โดยอัตโนมัติเพราะผู้ใช้ upload สำเร็จ; การอนุมัติรถไม่ใช่หลักฐานว่ามีการจอดจริง และยังไม่เป็นเงื่อนไขจองจนกว่านโยบายส่วนกลางจะกำหนด

### FR-10 Policy Management (P1)

- จัดการนโยบายจำนวนการจองค้างสูงสุด ระยะเวลาจองสูงสุด ระยะจองล่วงหน้า และข้อจำกัดราย role/zone/vehicle type ตามสิทธิ์
- ต้องกำหนด effective date, policy version, ผู้แก้/ผู้อนุมัติ, before/after และ change reason
- แสดง Preview ผลกระทบและ Validation ก่อน Save; ถ้ามีรายการจองเดิมต้องกำหนดว่าการเปลี่ยน policy กระทบย้อนหลังหรือไม่
- Source of truth ของนโยบายจองต้องอยู่ใน Booking Backend/บริการกลางที่บังคับ rule แบบ transaction ไม่ใช่เฉพาะ Admin UI หรือ Client
- **ข้อเท็จจริง:** ตัวเลข quota ของ User Web ปัจจุบันเป็น Demo ไม่ใช่นโยบายที่มหาวิทยาลัยอนุมัติ; Admin ต้องไม่ประกาศใช้โดยอัตโนมัติ
- เมื่อติดต่อ Booking Service ไม่ได้ต้องไม่แสดง Save สำเร็จ และต้องมี audit/error state

### FR-11 Smart Campus (Future / P2)

**Purpose:** ใช้ข้อมูลพื้นที่จอดร่วมกับตารางการเรียน/งานและข้อมูลย้อนหลังเพื่อเสนอทางเลือกที่จอดที่เหมาะสมและช่วยผู้ดูแลวางแผนความต้องการ โดยไม่ให้คำแนะนำสื่อว่าได้รับประกันช่องจอด

#### FR-11.1 Schedule-Aware Parking Recommendation

- เชื่อมตารางผู้ใช้/อาคาร/ช่วงเวลาได้ก็ต่อเมื่อได้รับอนุญาตและกำหนด data owner, consent/legal basis, scope และ retention
- คำนวณ candidate zone จากช่วงเวลามาถึง, ประเภทรถ, สิทธิ์, physical availability / bookability ที่เชื่อมจริง และระยะทางเดินที่มีข้อมูลแผนที่ตรวจสอบแล้ว
- แสดงผล `Recommended zone`, เหตุผล (`ใกล้อาคาร`, `ยังมีช่องที่ยืนยันว่าใช้ได้`, `ความหนาแน่นต่ำกว่า`) พร้อมเวลาที่ข้อมูลอัปเดต
- หากไม่รู้ตำแหน่ง E2/C5 หรือโซนอื่น ให้ระบุ `location unverified` และไม่คำนวณระยะที่อ้างว่าแม่นยำ
- ไม่มีตารางเรียนหรือไม่มีสิทธิ์เข้าถึง ต้องใช้การค้นหา/แนะนำทั่วไปได้ ไม่ block ผู้ใช้
- คำแนะนำเป็นผลประเมิน ณ เวลาใดเวลาหนึ่ง ไม่ถือเป็นสิทธิ์จองหรือรับประกันการมีช่องว่าง

#### FR-11.2 Demand Forecast & Campus Insights

- แสดง Forecast รายโซน/ช่วงเวลาในรูปกราฟ/Prediction Banner ที่มีป้าย `Forecast` แยกจาก `Observed`
- ข้อมูลที่เสนอให้ใช้: historical occupancy ที่ผ่าน quality gate, วันในสัปดาห์, ภาคเรียน/วันหยุดตามแหล่งข้อมูลที่อนุญาต, ตารางแบบ aggregation ที่ไม่เปิดเผยตัวบุคคล
- โมเดลต้องมี train/validation plan, baseline, version, รอบประเมิน, metrics ความผิดพลาดและ drift; ห้าม claim prediction accuracy จนวัดจริง
- แสดง uncertainty/ช่วงคาดการณ์หรือคำเตือนข้อมูลไม่พอ และปิดการแสดงค่าคาดการณ์เมื่อเกินเกณฑ์ความคลาดเคลื่อน/coverage ต่ำ
- Admin วิเคราะห์ช่วงเวลาที่คาดว่าจะหนาแน่นได้ แต่ต้องไม่เปิดเผยตารางรายบุคคลโดยไม่จำเป็น

#### FR-11.3 Credit / Incentive (Optional, หลังนโยบายอนุมัติ)

- แนวคิดคะแนนสำหรับการเลือกโซนที่หนาแน่นน้อยหรือพฤติกรรมที่ตรวจสอบได้
- **ห้ามให้คะแนนจากการกดจองหรือคำแนะนำเพียงอย่างเดียว** ต้องมี evidence ของพฤติกรรมจริง/กฎ anti-duplicate และการตรวจสอบข้อพิพาท
- ต้องมีนโยบายผู้มีสิทธิ์รับคะแนน การหัก/ย้อนรายการ การเก็บประวัติ และเกณฑ์พิจารณา fairness ก่อนทำ UI เชิงใช้งานจริง

**Smart Campus prerequisites:** มีข้อมูลอดีตคุณภาพเพียงพอ, confirmed zone mapping, Booking Service ที่ใช้งานได้, policy/consent, privacy review, source of schedule และแนวทางวัดผล; หากยังไม่พร้อมให้หน้า Admin แสดง Data Readiness ไม่ใช่ตัวเลขพยากรณ์ปลอม

### FR-12 Audit, Notifications & Data Governance (P0/P1)

- Audit การแก้ zone/camera/slot/calibration/policy, vehicle decisions, admin permissions และการเข้าถึงเอกสารสำคัญตามความจำเป็น
- Log ควรมี actor, action, target, timestamp, correlation/request ID, before/after ที่ไม่ใส่ secret และ outcome; บังคับอ่านตามสิทธิ์
- Notification สำหรับ admin: offline/stale camera, processing failures, pending vehicle review (ถ้าเชื่อมแล้ว), policy update และปัญหา integration
- คำสั่งแก้ข้อมูล/อนุมัติจริงต้องตรวจ role, object ownership/scope, CSRF/session และ validation ที่ Server
- กำหนด retention, purge, backup และขั้นตอนตอบสนองการรั่วไหลตามนโยบายองค์กรและกฎหมายที่เกี่ยวข้อง

## 9. Data Model & Ownership

### 9.1 Existing entities (ตาม PRD Processor เดิม)

`Zone`, `Camera`, `CalibrationProfile`, `LogicalSlot`, `CameraSlot`, `CalibrationRun`, `ConfigExport`, `CameraObservation`, `SlotObservation`, `SnapshotCaptureStatus`

- `LogicalSlot` = ช่องจอดจริงหนึ่งช่อง; `CameraSlot` = พื้นที่ช่องนั้นที่มองผ่านกล้องแต่ละตัว ต้อง map เพื่อไม่ให้นับซ้ำ
- `latest.jpg` คือภาพล่าสุดที่ถูกเขียนทับ ไม่ใช่ภาพหลักฐานย้อนหลัง
- Zone summary เดิมรวม observations รายกล้อง จึงยังไม่ยืนยันการ deduplicate ระหว่างกล้อง
- ไฟล์ใน `data/backgrounds`, `data/snapshots`, `data/exports` และ SQLite (default `data/sqlite/parking.db`); `DATA_DIR` เป็น root ร่วมตาม config

### 9.2 Proposed entities / service boundaries (ยังไม่มีการยืนยัน implementation)

| Entity / Contract | Key fields (แนวคิด) | Owner / Source of Truth |
| --- | --- | --- |
| `AdminAccount`, `AdminPermission` | identity, role/permission, scope, active | Auth/Authorization Service ของ Admin |
| `SystemEvent`, `AuditEvent` | action, actor, target, result, timestamp | Admin backend / immutable audit store |
| `ObservationRollup` | zoneId, time bucket, occupied, known, total, coverage | Analytics pipeline จาก observations |
| `VehicleReview` | vehicleId, ownerId, status, reviewer, reason, version, timestamps | Vehicle Service กลาง (ไม่ใช่ IndexedDB) |
| `VehicleEvidence` | private file reference, metadata, integrity, retention | Private file storage/Vehicle Service |
| `BookingPolicyVersion` | rule set, effectiveAt, editor, approver | Booking Service กลาง |
| `ScheduleAccess`, `ScheduleEntry` | owner, building, start/end, source, consent | Authorized schedule provider/User service |
| `ForecastRun`, `ForecastResult` | modelVersion, target zone/time, prediction, quality | Smart Campus analytics service |
| `CreditLedger` | transaction, rationale, verified event, reversal | Future credit service; **ยังไม่อยู่ใน scope P0/P1** |

### 9.3 Definition & Integration Rules

- **Physical free:** ช่องที่ระบบภาพประเมินว่าไม่มีรถ (เฉพาะข้อมูลสดและทราบสถานะ)
- **Occupied:** ช่องที่ระบบภาพประเมินว่ามีรถจริง ไม่เพิ่มขึ้นเพราะมีการจอง
- **Bookable:** จำนวนที่ยังจองได้ในเวลาที่เลือก ต้องได้จาก Booking Service หลังตรวจ reserved windows และนโยบาย
- **Unknown/No-data:** ไม่ทราบสถานะ ห้ามนับเป็น free
- **Partial:** บางกล้อง/ช่องขาดข้อมูล สรุปต้องประกาศ coverage
- **Stale:** มีผลเก่าแต่เกิน max age ที่ตกลง ไม่ใช้แทนปัจจุบันเงียบ ๆ
- **Source timestamps:** เก็บ `capturedAt`, `processedAt`, `observedAt`, `lastUpdated` ให้ชัด; ทุก timestamp ผ่านระบบที่มี timezone/UTC และแสดงตาม Asia/Bangkok
- ต้องมี API contract mapping IDs ระหว่าง Admin Processor, Booking Service และ User Web; ไม่จับคู่ด้วยชื่อโซน/เลขทะเบียนแบบข้อความโดยลำพัง

## 10. API Requirements

### 10.1 Existing API

รายละเอียด endpoint ปัจจุบันอยู่ใน FR-06; ต้องตรวจ current code และระบุ API owner, auth และ response ก่อนใช้งานจริง

### 10.2 Proposed API / Contracts — ยังไม่ใช่ Endpoint ที่มีอยู่

| Function | ตัวอย่าง contract (ไม่ใช่การรับรอง route) | Notes |
| --- | --- | --- |
| Dashboard summary | `GET /api/admin/dashboard/summary` | aggregate known/unknown และ health; RBAC |
| Analytics time series | `GET /api/admin/analytics/occupancy` | filter zone/from/to/granularity, coverage |
| System events | `GET /api/admin/events` | redaction/filter ตาม scope |
| Review queue | `GET /api/admin/vehicle-reviews` | อ่านจาก shared Vehicle Service |
| Review detail | `GET /api/admin/vehicle-reviews/{id}` | authorization ต่อรายการ |
| Review decision | `POST /api/admin/vehicle-reviews/{id}/decision` | atomic, version check, audit |
| Policy read/update | `/api/admin/booking-policies` | ตัวกลางไป Booking Service, effective date |
| Forecast | `GET /api/admin/smart-campus/forecast` | data readiness/validation ก่อนเปิด |
| Audit logs | `GET /api/admin/audit-logs` | export จำกัดสิทธิ์ |

**สัญญาข้อมูลตอบกลับ:** ต้องมี success/error type ชัดเจน, `source`, `lastUpdated`, `coverage` เมื่อเกี่ยวกับ occupancy, pagination สำหรับ lists, audit/correlation id, authorization, schema version และ error states; endpoint ใช้ `GET`/`POST`/`PATCH` ตาม semantics จริงหลังตกลง API design

**Critical boundary:** Admin ไม่อ่าน IndexedDB จากเครื่องผู้ใช้, ไม่ส่ง RTSP URL/credentials ไป client, ไม่เปิดภาพ CCTV สาธารณะ และไม่ใช้ public endpoint เพื่อเปลี่ยนสถานะอนุมัติ/นโยบาย

## 11. Non-Functional Requirements

| ด้าน | ข้อกำหนด |
| --- | --- |
| Security | Server-side authentication/authorization ทุก mutation และ privileged read; no privilege escalation; HTTPS/TLS ตาม deployment; sensitive route protection |
| CCTV/RTSP secrets | เก็บและ mask credentials, ไม่ใส่ใน logs/CSV/public response, define rotation และ secret management |
| Privacy / PDPA | จำกัดการเข้าถึงภาพและหลักฐานรถ, minimization, retention, access logging, deletion/subject requests, data sharing agreements เมื่อเชื่อมข้อมูลมหาวิทยาลัย |
| Accuracy | Test set ภาคสนามครอบคลุมกลางวัน/กลางคืน/ฝน/เงา/บังภาพ; แสดง uncertainty; ไม่มีตัวเลข accuracy baseline ที่ยืนยันแล้ว |
| Freshness | Target capture interval 60 s; max observation age ค่าเดิม 900 s เป็นค่า configuration ไม่ใช่ SLA ที่อนุมัติ; UI ต้องสื่อ capture vs processing freshness |
| Consistency | Deduplicate logical slots, transactional decisions, no conflicting vehicle review/booking policy change |
| Reliability | worker restart, one-worker-per-camera ownership, persistent storage, disk monitoring, backup/restore, incidents และ retry policy |
| Performance | benchmark load ตามจำนวนกล้อง/slot/ประวัติจริง, server pagination, analytics aggregation, ห้ามกำหนด SLA โดยไม่มีผลทดสอบ |
| Accessibility | keyboard support, readable chart alternative, labels/icon คู่สี, focus visible, responsive desktop/tablet/mobile |
| Internationalization | ไทย/อังกฤษสำหรับหน้าหลัก/สถานะ/ข้อผิดพลาด; identifiers/plate numbers ไม่แปล |
| Auditability | trace admin changes/decisions, protected logs, trace request-id, export ตามสิทธิ์ |
| Honest states | loading, empty, unknown, stale, partial, error, not connected และ insufficient data ต้องแยกกัน |

## 12. Acceptance Criteria / Test Scenarios

เกณฑ์ด้านล่างเป็นสิ่งที่ **ต้องผ่านเมื่อพัฒนาฟีเจอร์นั้น** ไม่ใช่รายงานว่าผ่านแล้ว:

| ID | Feature | Scenario | Expected result |
| --- | --- | --- | --- |
| AC-A01 | Camera/Calibration | สร้างกล้อง + background + slots + Save & Start Counting | Worker/Runtime ใช้ค่าที่ Save แล้วกับภาพถัดไปโดยไม่ต้อง export JSON |
| AC-A02 | Snapshot | กล้อง Timeout ระหว่าง cycle | เก็บ latest/background เดิม, บันทึก error, กล้องอื่นไม่ถูกหยุด |
| AC-A03 | Monitoring | กล้องมี observation เกิน max age | ไม่แสดงเป็น free/0; ระบุ stale และ timestamp |
| AC-A04 | Aggregation | สองกล้องมอง logical slot เดียวกัน | นับหนึ่งช่อง หรือแสดงไม่พร้อมรวมจน dedup rule รองรับ |
| AC-A05 | RBAC | ผู้ไม่มีสิทธิ์เรียก Admin API โดยตรง | Server ปฏิเสธและไม่เผย credentials/หลักฐาน |
| AC-A06 | Dashboard | บางโซนข้อมูลหาย | KPI/zone card แสดง coverage/unknown/partial และลิงก์แก้ปัญหา |
| AC-A07 | Dashboard | ไม่ได้เชื่อม Booking/Vehicle Service | ไม่สร้าง reserved/pending ตัวเลขจำลอง; แสดง not connected |
| AC-A08 | Analytics | ช่วงเวลามี observation ไม่ครบ | กราฟมี gap/coverage ไม่แทนที่ missing ด้วย zero |
| AC-A09 | Analytics | เลือก filter/ช่วงเวลาและ export | Filter สอดคล้องกับกราฟ; CSV แสดงนิยาม/ช่วงเวลาและไม่หลุดข้อมูลส่วนตัว |
| AC-A10 | Analytics | ข้อมูลประวัติไม่พอ | แสดง insufficient data พร้อมอธิบายเงื่อนไข |
| AC-A11 | Vehicle Approvals | ผู้ใช้ส่งรถจาก backend ส่วนกลาง | คิว pending แสดงรายการจริง ไม่อ่าน IndexedDB โดยตรง |
| AC-A12 | Vehicle Approvals | Approve/Reject | บันทึก reviewer/time/decision และผลแสดงใน User Web หลัง sync |
| AC-A13 | Vehicle Approvals | ผู้ตรวจสองคนตัดสินใจพร้อมกัน | อนุญาตหนึ่ง decision สำหรับ version เดียวและบันทึก conflict ชัดเจน |
| AC-A14 | Vehicle Privacy | ผู้ไม่มี permission เปิด evidence | ปฏิเสธ, ไม่ออก public URL, จำกัดการเข้าถึงไฟล์ |
| AC-A15 | Policy | บันทึก policy ที่เปลี่ยน quota | Validate, version/effective date/audit; Booking Backend enforce ตาม policy |
| AC-A16 | Smart Campus | ไม่มี schedule/ระยะทาง/ข้อมูลพยากรณ์ที่อนุมัติ | ไม่ปล่อย recommendation/forecast อ้างว่าแม่นยำ; มี fallback |
| AC-A17 | Smart Campus | มี forecast จริง | แสดง prediction แยก observed, target time, version, quality และ limitation |
| AC-A18 | Audit | Admin แก้ slot/approve รถ/change policy | เก็บ actor/action/target/time/result โดยไม่บันทึก secrets |
| AC-A19 | Recovery | restart worker/web พร้อม persistent storage | ไม่มีข้อมูลหายโดยไม่คาดหมายและสถานะ health กลับมาได้ตามแผนทดสอบ |

วิธีตรวจรับ: unit/integration tests ตาม service, API authorization tests, manual user journeys, screenshot/responsive review, staging test พร้อมข้อมูลกล้องจริงและ regression test ก่อน deploy

## 13. Roadmap & Dependencies

| Phase | Priority | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| 0 — Stabilize processor | P0 | Validate calibration-runtime, logical slot mapping, camera health, error/freshness contract | ผลภาพ/ช่องทดสอบสอดคล้องและข้อมูล stale/partial ไม่ถูกแสดงผิด |
| 1 — Secure admin foundation | P0 | Auth/RBAC, secret masking, audit, worker deployment, backup, API contract | ผู้ไม่มีสิทธิ์เข้าถึงภาพ/credentials/privileged APIs ไม่ได้ |
| 2 — Admin Dashboard | P1 | KPIs, zone overview/map, camera health, events, drill-down | ตอบสถานะหลักพร้อม coverage และเวลาได้ถูกต้อง |
| 3 — Analytics | P1 | Historical data retention/rollup, charts, filters, export | กราฟ/ค่าเฉลี่ยผ่าน test รวมข้อมูลหายและ slot ซ้ำ |
| 4 — Vehicle Approvals & Policies | P1 (shared backend เป็น P0 dependency) | Shared vehicle storage/queue/decisions, booking policy integration, audit | ตรวจรถจากข้ามเครื่องได้จริง; Backend enforce ผล/นโยบาย |
| 5 — Smart Campus | P2 | Data readiness, schedule integration, recommendations, forecast; credits optional | มีข้อมูล/สิทธิ์/การวัดคุณภาพเพียงพอและผ่าน review |

**Parallel work ที่ทำได้:** ออกแบบ UI ของ Dashboard/Analytics/Approvals ได้ด้วย sample data ที่ติดป้าย Demo ระหว่างทำ P0 แต่ห้ามเปิดตัวว่า production-ready หรือเปิดการอนุมัติจริงก่อน shared backend/auth พร้อม

## 14. Risks, Assumptions & Open Decisions

| หัวข้อ | ประเด็นที่ต้องตัดสินใจ |
| --- | --- |
| Admin auth | ใช้ Identity Provider ใด, ใคร provision/revoke roles, รองรับบุคลากรโดเมนใด |
| Camera credentials | จะเข้ารหัส/เก็บ RTSP URL ที่มี password อย่างไร และใครมีสิทธิ์เห็น |
| Slot truth | หนึ่งช่องจริงมี mapping จากกี่กล้อง; conflict resolution เมื่อค่าต่างกัน |
| Physical capacity | ความจุจริง/ตำแหน่งจริงของ D1, E1, E2, C2, C3, C5, M-STORE ผ่านการสำรวจหรือไม่ |
| Health threshold | Fresh/stale/offline/SLA/alert policy และเจ้าของงานรับผิดชอบ |
| Data retention | เก็บภาพ snapshot/history/observations/หลักฐานรถ/analytics นานเท่าไร ใครลบ |
| Booking | Admin ดูข้อมูลการจองจากระบบใดและจัดการ policy ผ่าน owner service ใด |
| Approvals | ใครตรวจ, ต้องอนุมัติรถก่อนจองหรือไม่, การอุทธรณ์/ส่งใหม่/เอกสารถูกปฏิเสธทำอย่างไร |
| Smart Campus | เชื่อม REG/ตารางผ่านวิธีใด มี consent/legal basis อะไร และใครควบคุมการเข้าถึง |
| Forecast | นิยาม ground truth, baseline, accuracy threshold, re-training และวิธีระบุข้อมูลไม่พอ |
| Credits | กฎคะแนน/หลักฐานตรวจสอบ/การย้อนรายการและป้องกันการโกงได้รับอนุมัติหรือยัง |
| Deployment | Worker, Next.js, SQLite และ persistent volume จะอยู่ที่ใด; จำนวนกล้องที่รองรับจริง |

## 15. System Architecture & Operations (Current vs Target)

### 15.1 ระบบประมวลผลปัจจุบัน

```text
RTSP CCTV
  │
  ▼
FFmpeg Snapshot Worker (default cycle 60s)
  │
  ▼
Local snapshots/latest.jpg
  │              ┌─────────────────────────────┐
  └─────────────►│ background + calibration   │
                 │ + camera slots จาก SQLite  │
                 └─────────────┬───────────────┘
                               ▼
                     Pixel Difference Processor
                               ▼
                 Camera/Slot Observations (SQLite)
                               ▼
                  Monitor / Public Parking API
                               ▼
                       MFU User Web (เมื่อเชื่อมจริง)
```

### 15.2 Target Admin services (ข้อเสนอ ไม่ใช่ implementation ปัจจุบัน)

```text
                      ┌──────────────────────────────────┐
                      │ Admin Console + Auth + RBAC      │
                      └────────────────┬─────────────────┘
                                       │
              ┌────────────────────────┼─────────────────────────┐
              ▼                        ▼                         ▼
    Parking & Camera Ops         Admin Analytics           Vehicle Approvals
    Calibration/Monitoring       Historical Rollups        Private Evidence
              │                        │                         │
              ▼                        ▼                         ▼
    Snapshot/Observations       Insights / Forecast       Shared Vehicle Service
              │                        │                         │
              └────────────────────────┼─────────────────────────┘
                                       ▼
                         Audits / Events / Notification
                                       │
                                       ▼
                            User Web / Booking Service
```

Current run requirements จาก PRD เดิม: Node/dependencies, FFmpeg, เข้าถึงกล้อง RTSP, shared storage ระหว่าง Web และ Worker

```bash
npm ci
npm run db:migrate
npm run dev
# เปิดอีก terminal
npm run worker:snapshot
```

ค่าที่ใช้ใน PRD เดิม: `DATA_DIR`, `SNAPSHOT_INTERVAL_SECONDS`, `SNAPSHOT_TIMEOUT_SECONDS`, `SNAPSHOT_CONCURRENCY`, `SNAPSHOT_RTSP_TRANSPORT`, `SNAPSHOT_MAX_AGE_SECONDS`; `.env.example` ไม่ถูกโหลดอัตโนมัติโดย worker ตามสภาพเดิม

**ข้อจำกัด Deploy เดิม:** Dockerfile รองรับ Next.js Web แต่ไม่รวม FFmpeg และ Worker โดยอัตโนมัติ จึงต้องวางแผนการรัน worker, persistent volume, startup/restart และ backup ก่อน production

## 16. เอกสารและแหล่งอ้างอิงภายในโครงการ

- `README.md` — วิธีรันระบบและ worker; อาจมี legacy details
- `PROJECT_STATUS.md` — สถานะเดิม ณ เมษายน 2026 ต้องเทียบกับโค้ดล่าสุด
- `mfu-rtsp-snapshot-worker-task.md` — ข้อกำหนด worker ในอดีต; ค่า default interval เดิมปรับเป็น 60 วินาทีแล้ว
- `workers/snapshot/`, `src/lib/runtime/`, `src/services/`, `app/api/` — ตำแหน่งโค้ดสำคัญที่ PRD เดิมอ้างอิง
- PRD ฝั่ง User Web (เอกสารแยก) — ใช้ยืนยัน vehicle schema, booking contract, schedule integration และ UI semantics เท่านั้น ไม่ถือว่าฝั่ง Admin implementation มีแล้ว
- Design references ของ Admin Dashboard, Admin Analytics, Vehicle Approvals, Policy Management และ Smart Campus — **เป็น UI Concepts** ไม่ใช่หลักฐานว่าระบบทำงานแล้ว

## 17. Change Log

| Version | Date | Summary |
| --- | --- | --- |
| Draft เดิม | 19 พ.ย. 2026 | ระบบ Processor/Camera, snapshot, calibration, slots, monitoring และ public API |
| 1.1 | 24 พ.ย. 2026 | ปรับขอบเขตให้เป็น Admin Console & Processor; เพิ่ม Dashboard, Analytics, Vehicle Approvals, Policy Management, Smart Campus, RBAC, audit, contracts, roadmap และ acceptance criteria โดยรักษาข้อจำกัดของระบบเดิม |

---

**หมายเหตุส่งต่อให้ Developer/AI Agent:** ให้อ่าน repo จริงและบันทึกความต่างก่อนเริ่มพัฒนา; ห้ามตีความส่วน `ต้องพัฒนา`, `Future` หรือ Proposed APIs ว่า implement แล้ว และอย่าย้ายข้อมูลผู้ใช้/การจองจาก Mock มาเป็น Server truth โดยไม่ออกแบบ authentication, database transaction และ API integration ให้ครบก่อน
