# PRD: MFU Smart Parking Processor

สถานะ: ฉบับร่างอ้างอิงโค้ดและบทสนทนาล่าสุด
ปรับปรุง: 19 พฤศจิกายน 2026
เจ้าของผลิตภัณฑ์ / ผู้อนุมัติ: รอกำหนด

เอกสารนี้อธิบายระบบประมวลผลที่จอดรถใน repository นี้และความต้องการสำหรับเชื่อมเว็บหลัก คำว่า **มีแล้ว** หมายถึงพบการทำงานในโค้ด ไม่ได้หมายถึงผ่านการรับรองสำหรับ production ส่วน **ต้องทำ/ยืนยัน** เป็นข้อเสนอหรือช่องว่างที่ยังไม่ควรถือว่าทำเสร็จ

## 1. ภาพรวมและปัญหา

ผู้ใช้เว็บหลักต้องการทราบจำนวนและสถานะช่องจอดรถที่เป็นปัจจุบัน โดยไม่ต้องเปิดดูกล้องเอง ผู้ดูแลต้องสามารถกำหนดพื้นที่จอดจากภาพ CCTV และปรับการตรวจจับได้ ระบบนี้ทำหน้าที่จัดการกล้องและ calibration ดึงภาพนิ่งเป็นรอบ ประเมินสถานะช่องจอด และให้ API สำหรับเว็บหลัก

วิธีหลักปัจจุบันคือเปรียบเทียบภาพล่าสุดกับภาพ background อ้างอิงภายในพื้นที่ slot ที่ผู้ดูแลวาด ผลเป็นการประเมินจากภาพ ไม่ใช่การยืนยันว่ามีรถด้วยโมเดลตรวจจับวัตถุ

## 2. เป้าหมายและขอบเขต

1. ผู้ดูแลตั้งค่าโซน กล้อง ภาพอ้างอิง พื้นที่ slot และค่าการประมวลผลได้ด้วยตนเอง
2. ดึง snapshot จากกล้อง RTSP ที่เปิดใช้งานเป็นรอบ ค่าเริ่มต้น 60 วินาที และรักษาภาพล่าสุดที่ดึงสำเร็จ
3. ประมวลผลภาพโดยใช้ค่าที่บันทึกในฐานข้อมูล แล้วเก็บผลรายกล้องและรายช่อง
4. ให้เว็บหลักเรียกข้อมูลสรุปและสถานะรายช่องผ่าน API โดยไม่ต้องอ่านภาพ CCTV
5. แยกข้อมูลที่ไม่มีหรือเก่าออกจากสถานะที่เชื่อถือได้ และรักษาความปลอดภัยข้อมูลกล้อง

ไม่อยู่ในขอบเขตที่ยืนยันแล้ว: ระบบจอง/ชำระค่าจอด, นำทางรถ, อ่านป้ายทะเบียน, แอปผู้ใช้ปลายทาง, การตรวจจับด้วย AI และการย้ายไป cloud storage

## 3. ผู้ใช้และผู้เกี่ยวข้อง

| กลุ่ม | ความต้องการ |
| --- | --- |
| ผู้ขับขี่ / ผู้ใช้เว็บหลัก | เห็นจำนวนช่องว่างและเวลาที่อัปเดต รวมถึงรู้เมื่อข้อมูลไม่พร้อม |
| ผู้ดูแลที่จอดรถ | จัดการกล้องและโซน ตั้งภาพอ้างอิง วาดช่อง ทดสอบและติดตามผล |
| ผู้ดูแลระบบ | รัน worker, ดูสถานะกล้อง, แก้ปัญหาการเชื่อมต่อและดูแล storage |
| ผู้พัฒนาเว็บหลัก | ใช้ API ที่มีรูปแบบและความหมายของข้อมูลชัดเจน |
| ผู้ดูแล CCTV / มหาวิทยาลัย | กำหนดสิทธิ์และขอบเขตการเข้าถึงภาพและเครือข่าย |

## 4. ขั้นตอนใช้งานหลัก

1. ผู้ดูแลสร้างโซนและกล้อง ตั้ง RTSP URL และเปิดใช้งานกล้อง
2. Worker ดึง snapshot ล่าสุดเก็บใน local storage เมื่อเชื่อมต่อกล้องได้
3. ผู้ดูแลเลือกภาพ background ที่แสดงพื้นที่จอดว่างตามช่องที่จะตรวจ แล้วอัปโหลดใน Calibration
4. ผู้ดูแลวาด slot ปรับค่าการตรวจจับ และกด Run Test ตรวจยอดรวม ตารางคะแนน และสีสถานะบนภาพ
5. กด **Save & Start Counting** เพื่อบันทึก slots และ calibration และลองประมวลผล snapshot ล่าสุด ค่าที่บันทึกไว้จะถูกใช้กับภาพรอบต่อไป ไม่ต้อง export JSON เพื่อใช้งาน runtime
6. Worker ต้องรันต่อเนื่องเพื่อดึงภาพและบันทึก observations เว็บหลักเรียก public API เพื่อแสดงข้อมูล

ข้อควรทราบ: background และ snapshot เป็นคนละภาพ Worker อัปเดต snapshot ไม่ได้เปลี่ยน background อัตโนมัติ ภาพ background ที่มีรถหรือมีสภาพแสงต่างมากอาจทำให้ผลคลาดเคลื่อน

## 5. ความต้องการเชิงฟังก์ชัน

### 5.1 จัดการโซนและกล้อง

- **มีแล้ว:** สร้างโซนและกล้อง ระบุโซน รหัส ชื่อ RTSP URL สถานะ active และกล้องหลัก; หน้า camera list มีตัวกรองโซนและ import/export CSV
- **มีแล้ว:** มี SQLite และ Drizzle สำหรับโซน กล้อง calibration slots และผลประมวลผล
- **ต้องทำ/ยืนยัน:** นโยบายแก้ไข/ลบกล้อง ประวัติการเปลี่ยนค่า การจัดการสิทธิ์ และการนำเข้า credentials อย่างปลอดภัย

### 5.2 Snapshot worker

- **มีแล้ว:** process แยก `npm run worker:snapshot` อ่านกล้อง active จาก DB ทุก cycle; ใช้ FFmpeg ดึง JPEG หนึ่งเฟรมผ่าน RTSP โดย TCP เป็นค่าเริ่มต้น
- **มีแล้ว:** ตั้ง interval, timeout และ concurrency ได้; ค่าเริ่มต้น 60 วินาที, 20 วินาที และ 4 กล้องตามลำดับ; ใช้ UDP ได้เมื่อกำหนดค่า
- **มีแล้ว:** ป้องกันการทำงานซ้อนของกล้องเดียวกันภายใน worker instance เดียว จำกัดงานพร้อมกัน ยกเลิก FFmpeg เมื่อ timeout/ปิดโปรแกรม และลองใหม่ในรอบถัดไป
- **มีแล้ว:** ตรวจภาพ JPEG, เขียนไฟล์ชั่วคราวแล้ว rename เป็น `snapshots/<cameraId>/latest.jpg`; ความล้มเหลวในการดึงภาพไม่ลบภาพเก่า บันทึกเวลาและ error ของการ capture ใน `snapshot_capture_status`
- **ข้อจำกัด:** ความถี่ 60 วินาทีเป็นรอบเป้าหมาย ไม่รับประกันว่าทุกกล้องจะได้ภาพตรงเวลาหากงานทั้งรอบใช้เวลานาน ระบบป้องกันการซ้อนกันไม่ได้ครอบคลุมหลาย worker instance; ให้รัน instance เดียวต่อชุดกล้อง
- **ต้องทำ/ยืนยัน:** แยกและแสดงสถานะ processing failure จาก capture failure, monitoring/alerting, ขีดจำกัดปริมาณกล้องและการรันอัตโนมัติหลังเครื่อง restart

### 5.3 Calibration และช่องจอด

- **มีแล้ว:** อัปโหลด background และ snapshot; วาด/ย้าย/ปรับขนาด slot บนภาพ จัดการรหัส ประเภทรถ และเปิด/ปิดช่อง
- **มีแล้ว:** ปรับค่าที่เกี่ยวข้องกับ pixel/occupancy threshold, grayscale, blur, normalize, downscale, lighting compensation และ edge weight; ทดสอบค่าที่ยังไม่บันทึกได้
- **มีแล้ว:** Test Summary, Slot Score Log และ overlay แสดงผลรายช่องจากการทดสอบ; สีเขียวหมายถึงว่าง สีแดงหมายถึงมีรถตามผลทดสอบ
- **มีแล้ว:** บันทึก slots และ parameters; ปุ่ม Save & Start Counting บันทึกสองส่วนและลองประมวลผลภาพล่าสุด การ export slots/config JSON ยังใช้ได้เป็นทางเลือก
- **ข้อจำกัด:** การบันทึก slots และ parameters เป็นคนละ request จึงไม่ใช่ transaction เดียว; การทดสอบและ runtime ต้องตรวจความสอดคล้องกับภาพจริงและสภาพแสง ทั้งคู่ใช้แนวทาง pixel difference
- **ต้องทำ/ยืนยัน:** การเลือก snapshot ล่าสุดเป็น background โดยตรงใน UI, workflow ตรวจรับภาพว่าง, preset, heatmap, auto-tune และทดสอบความแม่นยำภาคสนาม

### 5.4 ประมวลผลและบันทึกผล

- **มีแล้ว:** runtime โหลด background, calibration และ enabled slots ล่าสุดจาก DB เมื่อเรียกด้วย camera ID; ประมวลผลภาพแยกราย slot และบันทึก camera observations กับ slot observations
- **มีแล้ว:** preprocessing และ lighting compensation ก่อนเปรียบเทียบค่าความต่างพิกเซลกับ threshold; ผลแสดงจำนวน occupied/free และ score รายช่อง
- **ข้อจำกัด:** อาจคลาดเคลื่อนจากแสง เงา ฝน มุมกล้องเปลี่ยน การบังภาพ หรือรถใน background; ต้องกำหนดวิธีประเมิน accuracy กับภาพจริงก่อนใช้งานเพื่อการตัดสินใจ
- **ต้องทำ/ยืนยัน:** นโยบาย recalibration, การจัดการกล้องมองช่องเดียวกัน และการนับ logical slot โดยไม่ซ้ำ

### 5.5 API และเว็บหลัก

รูปแบบ response ปกติของ Next.js API คือ `{ "data": ... }` และข้อผิดพลาดคือ `{ "error": ... }`:

| Endpoint | การใช้งานปัจจุบัน |
| --- | --- |
| `GET /api/public/zones/status` | สรุป `zone`, `total_slots`, `free_slots`, `occupied_slots`, `last_updated` |
| `GET /api/public/zones` | รายชื่อโซนพร้อม summary และเวลาล่าสุด |
| `GET /api/public/zones/{zoneId}/summary` | สรุปจำนวนของโซน |
| `GET /api/public/cameras?zoneId={zoneId}` | สรุปรายกล้อง กรองโซนได้ |
| `GET /api/public/cameras/{cameraId}` | สรุป observation ล่าสุดของกล้อง |
| `GET /api/public/cameras/{cameraId}/slots` | รายช่องพร้อม `slotCode`, `score`, `occupied`, `updatedAt` |
| `POST /api/runtime/cameras/{cameraId}/process` | สั่งประมวลผล snapshot โดยระบุ path หรือใช้ภาพล่าสุด |

`occupied: true` หมายถึงระบบประเมินว่ามีรถ; `false` หมายถึงประเมินว่าว่าง เวลาจาก API เป็น ISO 8601 ตัวอย่าง C3: `/api/public/cameras/cam_c3_01/slots` ทั้งนี้ ID ขึ้นกับฐานข้อมูลที่ใช้งาน

**Freshness ปัจจุบัน:** `SNAPSHOT_MAX_AGE_SECONDS` ค่าเริ่มต้น 900 วินาที กรอง observations ที่เก่าออกจากสรุป; camera detail อาจตอบ 404 และรายการ slots อาจว่างเมื่อไม่มีผลใหม่ camera list แทนค่าที่ไม่มีด้วย 0 และเวลาว่าง ขณะที่ยอดรวมโซนอาจเป็น 0 หรือไม่ครบเมื่อบางกล้องไม่มีข้อมูล จึงห้ามตีความเลข 0 หรือรายการว่างว่าเป็นจำนวนช่องจริงโดยอัตโนมัติ

**ต้องทำก่อนเชื่อม production:** ออกแบบสถานะ `unknown/stale/partial` และ coverage ให้ชัดเจนทั้งรายกล้องและรายโซน; ระบุวิธีเชื่อมเว็บหลัก รวม base URL, network, CORS หรือ server-side proxy, authentication และ contract/versioning; กำหนดความถี่ดึงข้อมูลฝั่งเว็บและแสดงเวลาล่าสุด ตัวอย่างการดึงทุก 60 วินาทีเป็นข้อเสนอ ไม่ใช่พฤติกรรมที่มีในเว็บหลักแล้ว

### 5.6 Monitoring

- **มีแล้ว:** หน้า Admin Monitor ดูสรุปโซน กล้อง และผลรายช่อง พร้อม manual test และปุ่ม refresh
- **ต้องทำ:** แสดงสถานะ worker, เวลาถ่ายล่าสุด, capture/processing error, freshness และการครอบคลุมข้อมูลอย่างชัดเจน รวมถึงแจ้งเตือนเมื่อกล้องขัดข้อง

## 6. ความต้องการที่ไม่ใช่ฟังก์ชัน

| ด้าน | ข้อกำหนด / สถานะ |
| --- | --- |
| ความปลอดภัย | ต้องจำกัด Admin, runtime และการเข้าถึงภาพ CCTV; ตรวจสิทธิ์ใช้งานภาพและข้อกำหนดมหาวิทยาลัยก่อนส่งออกนอกเครือข่าย โค้ด Next.js ปัจจุบันยังไม่เห็นชั้น auth ใน routes ที่ตรวจสอบ และ API admin/CSV อาจเปิดเผย RTSP URL ได้ จึงต้องจัดการก่อนเปิดใช้งานภายนอก |
| Credentials | ห้ามเผยแพร่หรือ commit secrets; ปัจจุบัน `streamUrl` อยู่ใน DB และอาจมี credentials ต้องกำหนดวิธีเก็บ ปิดบัง และหมุน credentials |
| ความเป็นส่วนตัว | ภาพกล้องเป็นข้อมูลที่ต้องจำกัดสิทธิ์ กำหนดการเก็บรักษาและผู้เข้าถึง; ไม่ให้เว็บสาธารณะต้องเข้าถึงภาพโดยตรง |
| ความสดใหม่ | ค่าเริ่มต้น capture 60 วินาที, max age ผล 900 วินาที; ต้องตกลง SLA และวิธีแสดง unknown/partial |
| ความทนทาน | เก็บภาพที่สำเร็จก่อนหน้าเมื่อดึงไม่สำเร็จ; ต้องมี backup, ตรวจพื้นที่ดิสก์ และวิธีกู้คืน DB/ไฟล์ |
| ความแม่นยำ | ต้องกำหนดเกณฑ์และชุดข้อมูลตรวจรับตามสภาพจริง ทั้งกลางวัน กลางคืน แสงเปลี่ยน และภาพมีกีดขวาง; ยังไม่มีเป้าตัวเลขที่ตกลงแล้ว |
| Capacity | ต้อง benchmark จำนวนกล้อง ขนาดภาพ เวลา capture/ประมวลผล และโหลดจริงก่อนกำหนด SLA |

## 7. ข้อมูลและโครงสร้างระบบ

```text
RTSP CCTV → FFmpeg Snapshot Worker → local snapshots
                                      ↓
                       background + calibration + slots จาก DB
                                      ↓
                             pixel-difference processor
                                      ↓
                       observations ใน SQLite → Public API → เว็บหลัก
```

- Web/API: Next.js App Router, React, TypeScript, Tailwind
- Persistence: SQLite + Drizzle; default `data/sqlite/parking.db`
- ไฟล์: `data/backgrounds`, `data/snapshots`, `data/exports`; `DATA_DIR` กำหนด root ร่วมได้
- ผลสำคัญ: zones, cameras, calibration profiles, logical slots, camera slots, calibration runs, config exports, camera observations, slot observations และ snapshot capture status
- `latest.jpg` เป็นภาพล่าสุด ไม่ใช่ archive; observations เก่าอาจอ้าง path เดิมที่ถูกเขียนทับ จึงไม่ใช่หลักฐานภาพย้อนหลัง
- Zone summary ปัจจุบันรวม observation ของกล้อง ไม่ได้ยืนยันการตัดช่องซ้ำข้ามกล้อง
- มี Express processor/n8n เดิมใน repository แต่ flow เป้าหมายปัจจุบันคือ worker + Next.js runtime; เอกสาร README ส่วนเก่าอาจไม่ตรงทั้งหมด

## 8. การติดตั้งและปฏิบัติการปัจจุบัน

ข้อกำหนด: Node.js/dependencies, FFmpeg, เครือข่ายที่เข้าถึง RTSP และ storage ที่ web app/worker ใช้ร่วมกัน

```sh
npm ci
npm run db:migrate
npm run dev
# เปิดอีก terminal
npm run worker:snapshot
```

ตั้ง environment ผ่าน process environment; `.env.example` ไม่ถูกโหลดอัตโนมัติโดย worker ปัจจุบัน มี `DATA_DIR`, `SNAPSHOT_INTERVAL_SECONDS`, `SNAPSHOT_TIMEOUT_SECONDS`, `SNAPSHOT_CONCURRENCY`, `SNAPSHOT_RTSP_TRANSPORT`, `SNAPSHOT_MAX_AGE_SECONDS` รายละเอียดใน README

Dockerfile ปัจจุบันสร้าง image สำหรับ Next.js web app ไม่ได้ติดตั้ง FFmpeg หรือจัดเตรียม worker runtime โดยตรง การ deploy worker, shared persistent storage, startup/restart และ topology ของ production ยังต้องออกแบบและทดสอบ ไม่ถือว่ารันครบด้วย Dockerfile ปัจจุบัน

## 9. เกณฑ์ตรวจรับผลิตภัณฑ์

เกณฑ์ต่อไปนี้เป็น **เป้าหมายตรวจรับ** ไม่ใช่การรับรองว่าผ่านแล้ว:

1. ผู้ดูแลตั้งกล้อง background และอย่างน้อยหนึ่ง enabled slot; บันทึกค่าครั้งเดียวแล้ว worker ประมวลผล snapshot ใหม่ได้โดยไม่ต้อง export JSON
2. ภาพจากกล้องที่เชื่อมต่อได้ถูกอัปเดตตามรอบที่ตั้งไว้ภายใต้โหลดที่ตกลง และการ capture ล้มเหลวไม่ทำลายภาพล่าสุดหรือ background
3. ผลรายช่องใน Test Summary, score log และ overlay สอดคล้องกับผลทดสอบชุดเดียวกัน; ผล runtime ผ่านการเปรียบเทียบกับภาพตัวอย่างจริง
4. API ให้ผลรายช่องและสรุปที่ตรงกับ observation ล่าสุดที่ยังสด พร้อมเวลา; เมื่อข้อมูลเก่าหรือขาด เว็บหลักต้องแสดง unknown/partial ตาม contract ที่ตกลง ไม่แสดงเป็นข้อมูลครบโดยเข้าใจผิด
5. กล้องออฟไลน์ไม่หยุดกล้องอื่น มีสถานะและแนวทางตรวจสอบที่ผู้ดูแลใช้งานได้
6. ตรวจสิทธิ์ Admin, runtime, ภาพ และข้อมูล RTSP รวมถึงการ deploy worker/backup ผ่านการทดสอบในสภาพแวดล้อมจริง

## 10. ลำดับงานถัดไปที่เสนอ

1. ตรวจ end-to-end กับ C2/C3: ภาพว่างและภาพมีรถ, การบันทึก config, worker, observation และ API พร้อมบันทึกผลความแม่นยำ
2. ปิดช่องโหว่การเข้าถึง Admin, ภาพ และ RTSP URL; กำหนดสิทธิ์และเครือข่ายสำหรับเว็บหลัก
3. ออกแบบ API freshness/unknown/partial และไม่ให้นับช่องซ้ำจากหลายกล้อง; กำหนด contract กับทีมเว็บหลัก
4. จัดทำ deployment worker, persistent storage, การเฝ้าระวังและ backup แล้วทดสอบ restart/recovery
5. เพิ่ม integration tests และทดสอบ capacity รวมถึงทดสอบเปรียบเทียบ calibration กับ runtime
6. พิจารณา UI เลือก snapshot เป็น background, presets, heatmap และ auto-tune หลังยืนยันความจำเป็น

## 11. คำถามที่รอการตัดสินใจ

- เว็บหลักอยู่ที่ใด ใครเป็นเจ้าของ และจะเชื่อม API ผ่าน network/auth แบบใด?
- จะรัน web, worker และ SQLite บนเครื่องเดียวกันหรือใช้ shared persistent volume ที่ใด? ใครดูแลและสำรองข้อมูล?
- จำนวนกล้อง ช่อง และความถี่ที่ต้องรองรับจริงคือเท่าใด? ค่า max age และ SLA เท่าใดจึงเหมาะสม?
- หากกล้องหลายตัวมองช่องเดียวกัน จะเลือกหรือรวมผลอย่างไร?
- เกณฑ์ความแม่นยำ ขั้นตอนตรวจรับ และผู้รับผิดชอบ calibration เป็นใคร?
- นโยบายสิทธิ์ เก็บรักษา และส่งภาพ CCTV ออกนอกเครือข่ายมหาวิทยาลัยเป็นอย่างไร?

## 12. เอกสารอ้างอิงใน repository

- `README.md` — วิธีรันและรายละเอียด worker (มีส่วน legacy)
- `PROJECT_STATUS.md` — สถานะเดิม ณ เมษายน 2026 อาจไม่ตรงโค้ดล่าสุด
- `mfu-rtsp-snapshot-worker-task.md` — ข้อกำหนดเริ่มต้นของ worker; interval ถูกปรับภายหลังเป็น 60 วินาที
- `workers/snapshot/`, `src/lib/runtime/`, `src/services/`, `app/api/` — แหล่งอ้างอิงพฤติกรรมปัจจุบัน
