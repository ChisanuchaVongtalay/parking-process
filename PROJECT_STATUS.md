# MFU Smart Parking - สรุปสถานะโปรเจกต์

อัปเดตล่าสุด: 2026-04-06

## 1) ขอบเขตงานที่ทำเสร็จแล้ว (Current Scope)

โปรเจกต์ถูกขยายจากตัวประมวลผล Node.js เดิม มาเป็นโมดูล Admin Calibration Dashboard ที่ใช้งานได้จริง โดยมีองค์ประกอบหลักดังนี้:

- Next.js 15 (App Router)
- TypeScript (strict)
- Tailwind CSS
- SQLite พร้อม Drizzle schema และสคริปต์ migration
- File storage สำหรับ background, snapshot และไฟล์ JSON ที่ export
- Flow ทดสอบ calibration ที่เชื่อมกับ backend analysis service
- หน้า UI สำหรับปรับ calibration ระดับกล้อง และวาด/แก้ไข slot

## 2) สิ่งที่ระบบมีแล้วในปัจจุบัน

### A. Data Model และ Database Layer

ตารางที่สร้างแล้วใน SQLite schema:

- Zone
- Camera
- CalibrationProfile
- LogicalSlot
- CameraSlot
- CalibrationRun
- ConfigExport

ส่วน DB/files/services ที่ทำแล้ว:

- นิยาม Drizzle schema ครบ
- SQL migration เริ่มต้น
- ตัว bootstrap DB และ migration runner
- seed script สำหรับข้อมูลตัวอย่าง zone/camera/calibration

### B. Admin API (Route Handlers)

Endpoint ที่ทำแล้ว:

- GET/POST zones
- GET/POST cameras
- GET/PATCH camera by id
- POST อัปโหลด background ของกล้อง
- POST อัปโหลด snapshot ทดสอบ
- GET/PUT camera slots
- POST import slots
- GET export slots
- GET/PUT calibration profile
- POST calibration test
- POST export camera config
- GET file proxy endpoint สำหรับเสิร์ฟไฟล์ที่เก็บในระบบ

มี validation และ error handling ผ่าน shared schema utilities

### C. Calibration Workspace UI

ฟีเจอร์ที่ทำแล้ว:

- พื้นที่ภาพหลักพร้อม overlay slot
- Draw mode: ลากเมาส์เพื่อสร้าง slot แบบสี่เหลี่ยม
- Edit mode: ย้าย/ปรับขนาด slot เดิม
- รายการ slot พร้อมการแก้ไขข้อมูล
- เปลี่ยนประเภทยานพาหนะ (car/motorcycle)
- เปิด/ปิด slot และลบ slot
- แผงควบคุม calibration parameters
- ปุ่ม Run Test พร้อมสรุปผล
- ตาราง Slot Score Log (score/status/enabled ราย slot)
- การแสดง preview ของ background และ snapshot
- ใช้ snapshot เป็นภาพหลักเมื่อมีไฟล์ (fallback เป็น background)

### D. Processing/Calibration Engine Integration

service หลักฝั่ง backend ที่เชื่อมแล้ว:

- analyzeCameraSnapshot(...)
- buildCameraMasksIfNeeded(...)
- exportCameraConfig(...)

การแก้ไขสำคัญที่ทำแล้ว:

- หน้า frontend ส่ง slot และ calibration ปัจจุบัน (ที่ยังไม่ save) เข้า test ได้
- Run test ซ้ำได้ต่อเนื่อง
- ช่อง upload แสดงชื่อไฟล์ล่าสุดที่เก็บจริง ลดความสับสน UX
- แก้ coordinate mapping ให้ถูกต้อง (stage -> image-native)
- ลด false positive ใน processing ด้วย:
  - preprocess background/snapshot ให้เหมือนกัน
  - รองรับ lighting compensation

## 3) พฤติกรรมระบบที่ใช้งานได้ตอนนี้

- ผู้ดูแลสร้าง zone และ camera ได้จากหน้า admin
- อัปโหลด background และ snapshot ได้
- วาด slot บนภาพกล้องได้โดยตรง
- ปรับพารามิเตอร์ด้วย slider + กรอกตัวเลขได้
- Run test ได้ทันทีและดูผลราย slot ได้
- Export camera config เป็น JSON สำหรับ runtime ได้

## 4) โครงสร้างการเก็บไฟล์ (File Storage)

ใช้โครงสร้าง local ดังนี้:

- data/backgrounds
- data/snapshots
- data/exports
- data/sqlite/parking.db

## 5) Scripts ที่มีในโปรเจกต์

สคริปต์หลักที่พร้อมใช้งาน:

- npm run dev
- npm run build
- npm run start
- npm run db:migrate
- npm run db:seed
- npm run processor:start

## 6) หมายเหตุการใช้งานที่ควรรู้

- บน Windows อาจเจอ Next.js ขึ้น EPERM ที่ .next/trace เป็นครั้งคราวจากไฟล์ lock
- วิธีแก้เร็ว:
  - ลบโฟลเดอร์ .next
  - รัน dev/build ใหม่

## 7) งานที่แนะนำให้ทำต่อ (Next Steps)

Backlog ที่ควรทำต่อ:

1. เพิ่ม UI สำหรับ mapping logical slot (camera slot -> logical slot)
2. เพิ่มปุ่ม clear-all slots พร้อม confirmation
3. เพิ่ม debug visualization overlay (difference heatmap)
4. เพิ่มพรีเซ็ตพารามิเตอร์ (Conservative/Balanced/Aggressive)
5. เพิ่ม tests ให้ API หลักและ processing service
6. เพิ่ม baseline auto-tune จากภาพว่าง (empty snapshots)

## 8) สรุปภาพรวม

Calibration Admin Module ตอนนี้สามารถใช้งานแบบ end-to-end ได้แล้ว ตั้งแต่การตั้งค่า zone/camera, การวาดและปรับ slot, การ run test, ไปจนถึง export config JSON สำหรับ runtime โดยมีโครงสร้างสถาปัตยกรรมและ API ที่พร้อมต่อยอดในเฟสถัดไป