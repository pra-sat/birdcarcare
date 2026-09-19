// ✅ script.js
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';

const memberInfoEl = document.getElementById('memberInfo');
const historySection = document.getElementById('historySection');
const toggleBtn = document.getElementById('toggleHistory');

//const serviceDate = feedbackBtn.getAttribute('data-raw');  // ← ปรับเป็นแบบนี้:
//const serviceDate = toBangkokISOString(new Date(feedbackBtn.getAttribute('data-raw')));

// ⭐ Global variable to store current userId for later use (e.g., submitting feedback)
let currentUserId = null;
let memberData = null; // เพิ่มไว้ด้านบนสุด

// async function showPopupLoading() {
//   return await Swal.fire({
//     title: '⏳ กำลังโหลดข้อมูลสมาชิก...',
//     allowOutsideClick: false,
//     allowEscapeKey: false,
//     showConfirmButton: false,
//     didOpen: () => Swal.showLoading()
//   });
// }

function showLoadingOverlay() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoadingOverlay() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}

// ═══════════════════════════════════════════════════════════════════════════
//  ตัวช่วยของการ์ดรถ (เพิ่ม 13 ก.ย. 2569)
//  ทุกฟังก์ชันในบล็อกนี้อ่านข้อมูลที่ handleMemberGet ส่งมาอยู่แล้วทั้งหมด
//  ไม่มีการเรียก API ใหม่ และไม่ต้องแก้ Apps Script
// ═══════════════════════════════════════════════════════════════════════════

// กันข้อมูลในชีตที่เผลอมีเครื่องหมาย < > & ทำให้หน้าเว็บเพี้ยนหรือถูกฝังสคริปต์
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// แปลงวันที่รูปแบบ d/M/yyyy ที่ Apps Script ส่งมา เป็น Date
// คืน null ถ้าอ่านไม่ออก ปลายทางต้องเช็ค null ทุกที่
function parseThaiDate(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

// เหลืออีกกี่วันจะถึงวันหมดอายุ (ติดลบ = เลยมาแล้ว) · null ถ้าไม่มีวันที่
function daysLeft(dateStr) {
  const exp = parseThaiDate(dateStr);
  if (!exp) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

// ประวัติของรถคันนี้
// ⚠️ Service_History เก็บแค่ ยี่ห้อ + รุ่น (ไม่มีปี ไม่มี VehicleID)
//    จึงเทียบได้แค่ 2 ช่องนี้ เหมือนที่ feedback.gs ใช้อยู่
//    ถ้าลูกค้ามีรถ ยี่ห้อ+รุ่น ซ้ำกัน 2 คัน จะแยกไม่ออก → ผู้เรียกต้องไม่แสดงตัวเลข
function historyOf(vehicle, history) {
  if (!Array.isArray(history)) return [];
  const b = String(vehicle.brand || '').trim().toLowerCase();
  const m = String(vehicle.model || '').trim().toLowerCase();
  return history.filter(r =>
    String(r.brand || '').trim().toLowerCase() === b &&
    String(r.model || '').trim().toLowerCase() === m
  );
}

// สร้างการ์ดรถ 1 คัน — รถกับแต้มอยู่กรอบเดียวกัน เพื่อให้แยกคันได้ง่ายเวลามีหลายคัน
// countable = false เมื่อมีรถ ยี่ห้อ+รุ่น ซ้ำกัน จะซ่อนจำนวนครั้งไว้ ดีกว่าโชว์เลขผิด
function vehicleCardHtml(vehicle, history, countable) {
  const left = daysLeft(vehicle.expirationDate);
  const point = parseInt(vehicle.point || 0) || 0;
  const expired = parseInt(vehicle.expiredPoints || 0) || 0;

  let pill = '';
  let expClass = '';
  if (left === null)      pill = '';
  else if (left < 0)      { pill = '<span class="pill grey">แต้มหมดอายุแล้ว</span>'; expClass = ' is-late'; }
  else if (left === 0)    { pill = '<span class="pill warn">วันนี้วันสุดท้าย</span>'; expClass = ' is-soon'; }
  else if (left <= 30)    { pill = `<span class="pill warn">เหลือ ${left} วัน</span>`; expClass = ' is-soon'; }
  else                    pill = '<span class="pill">ใช้ได้</span>';

  // วันใช้บริการล่าสุด + จำนวนครั้ง
  //
  // ตั้งแต่ 14 ก.ย. 2569 Apps Script ส่ง lastService กับ visits มาให้เลย
  // (lastService มาจากคอลัมน์ N ของ Customer_Master · visits นับมาจากฝั่งเซิร์ฟเวอร์)
  // หน้านี้จึงไม่ต้องรอประวัติทั้งก้อนมาก่อนอีกแล้ว
  //
  // ถ้ายังไม่ได้ deploy Apps Script ตัวใหม่ จะไม่มี 2 ฟิลด์นี้ และ history จะยังส่งมา
  // จึงคำนวณแบบเดิมเป็นทางถอย เพื่อไม่ให้การ์ดว่างในช่วงที่ยังไม่ได้ deploy
  let lastDate = String(vehicle.lastService || '').trim();
  let visits = Number.isFinite(vehicle.visits) ? vehicle.visits : null;

  if (!lastDate || visits === null) {
    // ⚠️ ต้องหาค่ามากสุดเอง ห้ามใช้แถวแรกหรือแถวท้าย เพราะโค้ดส่วนแสดงประวัติ
    //    เรียก history.sort() ซึ่งสลับลำดับ array ก้อนเดียวกันนี้ทิ้ง
    const rows = historyOf(vehicle, history);
    if (visits === null) visits = rows.length;
    if (!lastDate) {
      let lastTime = -Infinity;
      rows.forEach(r => {
        const d = parseThaiDate(r.date);
        if (d && d.getTime() > lastTime) {
          lastTime = d.getTime();
          lastDate = String(r.date || '').split(',')[0].trim();
        }
      });
    }
  }

  const bits = [];
  if (countable && visits) bits.push(`ใช้บริการมาแล้ว <b>${visits} ครั้ง</b>`);
  if (expired > 0) bits.push(`หมดอายุไปแล้ว <b>${expired} แต้ม</b>`);

  // ป้ายทะเบียน — เลขบรรทัดบน จังหวัดบรรทัดล่าง เหมือนป้ายจริง
  // ว่างได้ (Apps Script รุ่นก่อน 13 ก.ย. 2569 ยังไม่ส่งฟิลด์นี้มา) จะไม่ขึ้นกรอบเปล่า
  // ใช้ plateHtml() จาก ../plate_data.js เพื่อให้หน้าสมาชิกกับหน้าแอดมินวาดป้ายเหมือนกัน
  // ถ้าไฟล์นั้นโหลดไม่ขึ้น ค่อยวาดเองแบบเดียวกันเป็นทางถอย
  const plate = String(vehicle.plate || '').trim();
  const plateBadge = !plate ? ''
    : (typeof plateHtml === 'function'
        ? plateHtml(plate, vehicle.province, false)
        : `<span class="plate"><span class="num">${esc(plate)}</span><span class="prov">${esc(vehicle.province || '—')}</span></span>`);

  return `
    <div class="vunit">
      <div class="uhead">
        <div class="uname">
          <div class="ubrand">${esc(vehicle.brand || '-')}</div>
          <div class="umodel">${esc(vehicle.model || '-')}</div>
          <div class="uyear">${vehicle.year ? 'ปี ' + esc(vehicle.year) : ''}</div>
        </div>
        ${plateBadge}
      </div>
      <div class="upts">
        <div class="updrow">
          <div class="pts"><b>${point}</b><span>แต้ม</span></div>
          ${pill}
        </div>
      </div>
      <div class="udet">
        <div class="row"><span class="lbl">แต้มใช้ได้ถึง</span><span class="val small${expClass}">${esc(vehicle.expirationDate || '-')}</span></div>
        ${lastDate ? `<div class="row"><span class="lbl">ใช้บริการล่าสุด</span><span class="val small">${esc(lastDate)}</span></div>` : ''}
        ${bits.length ? `<div class="subline">${bits.join(' · ')}</div>` : ''}
      </div>
    </div>
  `;
}

// แก้ไขฟังก์ชัน toBangkokISOString ให้ชัดเจน
function toBangkokISOString(date) {
  const bangkokOffset = 7 * 60; // GMT+07:00 ในหน่วยนาที
  const bangkokTime = new Date(date.getTime() + (bangkokOffset * 60 * 1000));
  return bangkokTime.toISOString();
}

// แก้ไขฟังก์ชัน formatDateToYMDHM
function formatDateToYMDHM(rawDate) {
  const d = parseCustomDate(rawDate); // ใช้ parseCustomDate เพื่อแปลงวันที่
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function toFullThaiDateTimeString(dateObj) {
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  const hour = dateObj.getHours().toString().padStart(2, '0');
  const minute = dateObj.getMinutes().toString().padStart(2, '0');
  const second = dateObj.getSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year}, ${hour}:${minute}:${second}`;
}


// ⏳ ฟังก์ชันสร้าง token ไม่ซ้ำ
function generateToken(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ✅ เพิ่มใน script.js — หลัง currentUserId ถูกกำหนดแล้ว qr code
window.qrToken = null;
let qrInterval = null;

// ═══════════════════════════════════════════════════════════════════════════
//  เตรียม QR ไว้ล่วงหน้า (14 ก.ย. 2569)
//
//  ลูกค้าไม่ได้กดแสดง QR ตอนเปิดหน้า แต่ไปกดตอนยืนจะจ่ายเงินที่หน้าร้าน
//  ซึ่งเป็นจังหวะที่รอไม่ได้ที่สุด แล้วของเดิมต้องรอ Apps Script อีกรอบเต็ม ๆ
//  ตรงนั้น (ยังไม่นับเน็ตช้า) ลูกค้ากับพนักงานเลยยืนรอกันหน้าเคาน์เตอร์
//
//  ตอนนี้ขอ token ไว้เงียบ ๆ ตั้งแต่ตอนเปิดหน้า พอกดปุ่มก็ขึ้น QR ทันที
//  ไม่ต้องยิงเน็ตอะไรเลย
//
//  ⏰ เรื่องอายุ token — จุดที่พลาดง่ายที่สุดของวิธีนี้
//     ฝั่งเซิร์ฟเวอร์ (verify_token.gs) ให้ token อายุ 10 นาที นับจากตอน "สร้าง"
//     ไม่ใช่ตอนที่ลูกค้ากดดู ถ้าเตรียมไว้แล้วลูกค้าเปิดทิ้งไว้ 9 นาทีค่อยกด
//     QR จะขึ้นสวย ๆ แต่พนักงานสแกนแล้วขึ้น "QR ไม่ถูกต้อง" ซึ่งแย่กว่าเดิมอีก
//
//     จึงใช้ของที่เตรียมไว้เฉพาะตอนที่อายุยังไม่เกิน QR_PREWARM_MAX_AGE
//     ตั้งไว้ที่ 270 วิ = 600 (อายุจริง) - 300 (เวลานับถอยหลังที่โชว์) - 30 (เผื่อ)
//     แปลว่า QR ที่ขึ้นจอจะหมดเวลาก่อนของจริงหมดอายุเสมอ ไม่มีทางสแกนแล้วพัง
//     ถ้าเกินกว่านั้น ก็ไปขอใหม่แบบเดิม (ช้าเท่าเดิม แต่ไม่พลาด)
//
//     และทุกครั้งที่ลูกค้าสลับกลับมาที่หน้านี้ (เช่น ล็อกจอเดินไปเคาน์เตอร์
//     แล้วปลดล็อก) จะเตรียมของใหม่ให้เบื้องหลังทันที กว่าจะกดก็ได้ของสดแล้ว
// ═══════════════════════════════════════════════════════════════════════════
const QR_SERVER_LIFE_SEC = 600;   // อายุจริงฝั่งเซิร์ฟเวอร์ (verify_token.gs)
const QR_SHOW_SEC        = 300;   // เวลานับถอยหลังที่โชว์ให้ลูกค้าเห็น
const QR_SAFETY_SEC      = 30;    // เผื่อเวลาเดินทาง/นาฬิกาคลาดกัน
const QR_PREWARM_MAX_AGE = QR_SERVER_LIFE_SEC - QR_SHOW_SEC - QR_SAFETY_SEC;  // 270
const QR_REWARM_AGE      = 180;   // กลับมาที่หน้านี้แล้วของเก่าเกินเท่านี้ ให้ขอใหม่

let warmToken = null;      // { token, at }
let warmPending = null;    // กันขอซ้อนกัน

// ขอ token เตรียมไว้ — ยิงแล้วไม่รอ ไม่รบกวนหน้าจอ ถ้าพลาดก็เงียบ ๆ
function prewarmQRToken() {
  if (!currentUserId) return null;
  if (warmPending) return warmPending;

  const token = generateToken();
  warmPending = createTokenOnServer(token)
    .then(() => {
      // ของเก่าที่ยังไม่ได้ใช้ ลบทิ้งด้วย ไม่งั้นค้างในชีตเปล่า ๆ
      const old = warmToken;
      warmToken = { token, at: Date.now() };
      if (old && old.token !== token) deleteTokenOnServer(old.token);
      return warmToken;
    })
    .catch(err => {
      console.warn('⚠️ เตรียม QR ล่วงหน้าไม่สำเร็จ (ไม่เป็นไร เดี๋ยวขอตอนกด):', err);
      return null;
    })
    .finally(() => { warmPending = null; });

  return warmPending;
}

function warmTokenAgeSec() {
  return warmToken ? (Date.now() - warmToken.at) / 1000 : Infinity;
}

function createTokenOnServer(token) {
  // createdAt: ฝั่ง Apps Script ไม่ได้ใช้ค่านี้เลย (token.gs ใช้ new Date() ของตัวเอง
  // เป็นเวลาสร้าง QR เสมอ ซึ่งถูกแล้ว) ส่งเวลาปัจจุบันไปเฉย ๆ เพื่อไม่ให้รูปแบบ
  // ข้อมูลที่ส่งเปลี่ยน · ของเดิมดึงวันที่จากประวัติ ทำให้หน้านี้ต้องรอโหลดประวัติก่อน
  return fetch(GAS_ENDPOINT + '?action=create_token', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: "create_token",
      token,
      userId: currentUserId,
      createdAt: new Date().toISOString()
    })
  }).then(res => {
    if (!res.ok) throw new Error("create_token failed");
    return res.json();
  }).then(result => {
    if (result.status !== 'success') throw new Error(result.message || "QR สร้างไม่สำเร็จ");
    return result;
  });
}

function deleteTokenOnServer(token) {
  if (!token) return;
  fetch(GAS_ENDPOINT + '?action=delete_token', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: "delete_token", token })
  }).catch(() => { /* ลบไม่สำเร็จก็ปล่อย เดี๋ยวหมดอายุเองอยู่แล้ว */ });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ขอทะเบียนรถจากลูกค้า ก่อนแสดง QR (20 ก.ย. 2569)
//
//  ทำไมต้องมาถามตรงนี้
//    ทะเบียนเป็นข้อมูลที่รอบ C ต้องใช้เป็นกุญแจแทน ยี่ห้อ+รุ่น+ปี
//    แต่ของจริงแอดมินแทบไม่ได้กรอกให้ เพราะตอนเก็บเงินรีบและลูกค้ารออยู่
//    ทะเบียนจึงไม่ถูกเก็บสักที
//
//    จังหวะ "กดแสดง QR" คือจังหวะเดียวที่ลูกค้าว่าง ถือมือถืออยู่ และ
//    ยืนอยู่ข้างรถตัวเองพอดี = ถามตอนนี้ได้คำตอบที่ถูกต้องที่สุด
//
//  🔴 กติกา
//     ก. **ห้ามบล็อก** ถ้าลูกค้าไม่สะดวกต้องกดข้ามแล้วได้ QR ทันที
//        ลูกค้ายืนรอจ่ายเงินอยู่ ห้ามให้ฟอร์มขวางการจ่ายเงินเด็ดขาด
//     ข. ต้องบอกเหตุผลและบอกว่าเอาไปใช้ทำอะไร ไม่ใช่ขอเฉย ๆ
//     ค. กดข้ามแล้วไม่ถามซ้ำในรอบนี้ (จำไว้ใน sessionStorage)
//        แต่ครั้งหน้าที่เปิดหน้าใหม่ถามได้อีก ไม่งั้นจะไม่ได้กรอกสักที
//     ง. ถ้าไม่มี token เลย = บันทึกไม่ได้อยู่ดี -> ไม่ต้องถามให้เสียเวลา
//     จ. อะไรพังก็ห้ามลาก QR พังไปด้วย ครอบ try/catch ทั้งก้อน
// ═══════════════════════════════════════════════════════════════════════════
const memberTokens = { id: '', access: '' };
const PLATE_SKIP_KEY = 'bcPlateAskSkip';

function plateAskSkipped() {
  try { return sessionStorage.getItem(PLATE_SKIP_KEY) === '1'; } catch (e) { return false; }
}
function markPlateAskSkipped() {
  try { sessionStorage.setItem(PLATE_SKIP_KEY, '1'); } catch (e) {}
}

async function savePlateForMe(vehicle, plate, province) {
  const res = await fetch(GAS_ENDPOINT + '?action=set_own_plate', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'set_own_plate',
      idToken: memberTokens.id,
      accessToken: memberTokens.access,
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      year: vehicle.year || '',
      plate: plate,
      province: province
    })
  });
  return res.json();
}

async function askPlateIfMissing() {
  try {
    if (!memberData || !Array.isArray(memberData.vehicles)) return;
    if (!memberTokens.id && !memberTokens.access) return;   // (ง)
    if (plateAskSkipped()) return;

    const v = memberData.vehicles.find(x => !String(x.plate || '').trim());
    if (!v) return;                                          // มีครบแล้ว ไม่ต้องถาม

    const carName = [v.brand, v.model, v.year ? 'ปี ' + v.year : '']
      .filter(Boolean).map(esc).join(' ');

    const provOpts = (typeof plateProvinceOptions === 'function')
      ? plateProvinceOptions(v.province || '') : '<option value="">—</option>';

    const html = `
      <div class="mp-why">
        <p class="mp-car">🚘 ${carName}</p>
        <p><b>ขอเลขทะเบียนรถคันนี้หน่อยนะคะ</b> กรอกครั้งเดียว ครั้งต่อไปกดแล้วขึ้น QR ทันที</p>
        <ul class="mp-list">
          <li>ใช้ยืนยันว่าแต้มเข้ารถคันไหน — บ้านที่มีรถรุ่นเดียวกันหลายคันจะได้ไม่สลับกัน</li>
          <li>เวลาสแกน พนักงานจะเห็นทะเบียนขึ้นให้ตรวจ ลดการบันทึกผิดคัน</li>
          <li>เก็บไว้ในระบบของร้านเท่านั้น <b>ไม่เปิดเผยให้บุคคลอื่น</b> และไม่ใช้ติดต่อเรื่องอื่น</li>
        </ul>
      </div>
      <div class="pl-grid">
        <input id="mpHead" class="pl-in" type="text" inputmode="text"
               placeholder="หมวด เช่น 1กร" autocomplete="off" maxlength="6">
        <input id="mpTail" class="pl-in" type="text" inputmode="numeric"
               placeholder="เลข เช่น 1723" autocomplete="off" maxlength="4">
      </div>
      <select id="mpProv" class="pl-in pl-prov">${provOpts}</select>
      <div class="pl-preview" id="mpPreview">
        <p class="pl-eg">พิมพ์แล้วจะขึ้นตัวอย่างป้ายให้ดูตรงนี้</p>
      </div>
    `;

    const result = await Swal.fire({
      title: '🚗 ขอเลขทะเบียนก่อนนะคะ',
      html: html,
      width: 400,
      showCancelButton: true,
      confirmButtonText: '💾 บันทึกแล้วแสดง QR',
      cancelButtonText: 'ยังไม่สะดวกตอนนี้',
      focusConfirm: false,
      allowOutsideClick: () => !Swal.isLoading(),
      didOpen: () => {
        // ตัวอย่างป้ายอัปเดตตามที่พิมพ์ ให้เห็นว่าจะออกมาหน้าตาแบบไหน
        const head = document.getElementById('mpHead');
        const tail = document.getElementById('mpTail');
        const prov = document.getElementById('mpProv');
        const box = document.getElementById('mpPreview');
        const draw = () => {
          const h = (typeof plateCleanHead === 'function')
            ? plateCleanHead(head.value) : head.value;
          const t = String(tail.value || '').replace(/[^0-9]/g, '');
          tail.value = t;
          const txt = (typeof platePretty === 'function') ? platePretty(h, t) : (h + ' ' + t);
          box.innerHTML = (h || t) && typeof plateHtml === 'function'
            ? plateHtml(txt, prov.value, true)
            : '<p class="pl-eg">พิมพ์แล้วจะขึ้นตัวอย่างป้ายให้ดูตรงนี้</p>';
        };
        head.oninput = draw; tail.oninput = draw; prov.onchange = draw;
        setTimeout(() => head.focus(), 60);
      },
      // ⚠️ ที่นี่ทำได้แค่ "ตรวจ + ยิงบันทึก" ห้ามเปิดป๊อปอัปตัวใหม่เด็ดขาด
      //    SweetAlert เปิดได้ทีละอัน เปิดตัวใหม่ = ตัวนี้ถูกปิดทิ้งทันที
      preConfirm: async () => {
        const h = document.getElementById('mpHead').value;
        const t = document.getElementById('mpTail').value;
        const prov = document.getElementById('mpProv').value;

        if (typeof plateValidate === 'function') {
          const chk = plateValidate(h, t, { required: true });
          if (!chk.ok) { Swal.showValidationMessage(chk.warn); return false; }
        }

        const pretty = (typeof platePretty === 'function')
          ? platePretty(plateCleanHead(h), t) : (h + ' ' + t);

        try {
          const out = await savePlateForMe(v, pretty, prov);
          if (out && (out.status === 'success' || out.status === 'exists')) return out;
          Swal.showValidationMessage((out && out.message) || 'บันทึกไม่สำเร็จ');
          return false;
        } catch (err) {
          Swal.showValidationMessage('เชื่อมต่อไม่ได้ ลองอีกครั้ง หรือกด "ยังไม่สะดวกตอนนี้"');
          return false;
        }
      }
    });

    if (result.isConfirmed && result.value) {
      // อัปเดตในมือทันที ไม่ต้องรอโหลดหน้าใหม่
      v.plate = result.value.plate || '';
      v.province = result.value.province || '';
      try { writeMemberCache(currentUserId, memberData); } catch (e) {}
      try { renderMember(memberData); } catch (e) {}
    } else {
      markPlateAskSkipped();                                 // (ค)
    }

  } catch (err) {
    // (จ) ตรงนี้พังห้ามลาก QR พังไปด้วย
    console.warn('ถามทะเบียนไม่สำเร็จ (ข้ามไป):', err);
  }
}


async function showQRSection() {

  if (!document.getElementById('qrSection').classList.contains('hidden')) {
    return; // ถ้าแสดงอยู่แล้ว ไม่ต้องสร้างใหม่
  }

  // ยังไม่มีทะเบียน -> ขอก่อน (ข้ามได้ ไม่บล็อกการแสดง QR)
  // ⚠️ ต้องอยู่ก่อนการเช็คอายุ QR ที่เตรียมไว้ เพราะลูกค้าใช้เวลากรอกสักพัก
  //    ถ้าเช็คอายุไปก่อนแล้วค่อยถาม ของที่เตรียมไว้อาจหมดอายุระหว่างกรอก
  await askPlateIfMissing();

  // ── มีของเตรียมไว้และยังสดอยู่ -> ขึ้นเลย ไม่แตะเน็ต ────────────────────
  if (warmToken && warmTokenAgeSec() <= QR_PREWARM_MAX_AGE) {
    const token = warmToken.token;
    warmToken = null;                    // ใช้แล้วใช้ซ้ำไม่ได้
    window.qrToken = token;
    document.getElementById('qrSection').classList.remove('hidden');
    generateQRCode(token, memberData);
    startQRCountdown();
    return;
  }

  // ── ไม่มีของ หรือของเก่าเกินไป -> ขอใหม่ (ทางเดิม) ─────────────────────
  const btn = document.getElementById("qrBtn");
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = "⏳ กำลังสร้าง QR...";

  try {
    // ถ้ากำลังเตรียมอยู่พอดี รอตัวนั้นเลย จะได้ไม่ยิงซ้อนกัน 2 รอบ
    const pending = warmPending ? await warmPending : null;

    let token;
    if (pending && (Date.now() - pending.at) / 1000 <= QR_PREWARM_MAX_AGE) {
      token = pending.token;
      warmToken = null;
    } else {
      token = generateToken();
      await createTokenOnServer(token);
    }

    window.qrToken = token;
    document.getElementById('qrSection').classList.remove('hidden');
    generateQRCode(token, memberData);
    startQRCountdown();
  } catch (err) {
    console.error("❌ QR Creation Error:", err);  // 🔍 แสดง error จริงใน console
    Swal.fire("❌ ไม่สามารถสร้าง QR ได้", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

    
// ═══════════════════════════════════════════════════════════════════════════
//  QR ลายเซ็นของร้าน (13 ก.ย. 2569)
//
//  เปลี่ยน 3 อย่างจากของเดิม
//    1. โมดูลเป็นสีน้ำเงินเข้มของร้าน (#0A4F7A) ไม่ใช่ดำ
//    2. ยกระดับการกู้คืนข้อผิดพลาดเป็น H (กู้ได้ถึง 30%) จากค่าปริยาย L (7%)
//    3. วางตรา "BC" ตรงกลาง
//
//  🔬 ทดสอบแล้วก่อนใช้ (13 ก.ย. 2569)
//     สร้าง QR จาก token 20 ตัวแบบเดียวกับระบบ 40 ครั้งต่อกรณี
//     แล้วถอดรหัสด้วยตัวถอด jsQR จริง ผลที่ได้:
//       ระดับ H  อ่านออก 100% เมื่อตรากลางกว้างไม่เกิน 34% ของความกว้าง QR
//       ระดับ Q  พังที่ 34%
//       ระดับ M  พังที่ 26%
//     ของเราใช้ระดับ H + ตรากว้าง 22%  ->  เหลือระยะเผื่อ 12 จุด
//
//  ⚠️ ห้ามขยายตราให้ใหญ่กว่า LOGO_FRAC นี้ และห้ามลดระดับจาก 'H'
//     ถ้าจะแก้ ต้องรันทดสอบถอดรหัสใหม่ก่อนเสมอ ไม่งั้นเสี่ยงสแกนไม่ติดหน้าร้าน
// ═══════════════════════════════════════════════════════════════════════════
const QR_DARK = '#0A4F7A';   // --bc-deep
const QR_SIZE = 220;
const QR_PAD  = 8;           // ขอบเงียบ (quiet zone)
const LOGO_FRAC = 0.22;      // ความกว้างตรา เทียบความกว้าง QR (เพดานที่ทดสอบไว้ 0.34)

function drawShopMark(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;                    // QRious ตั้ง width = size
    // คิดสัดส่วนจาก "ความกว้างตัวโค้ด" ไม่ใช่ความกว้างผ้าใบ
    // เพราะที่ทดสอบไว้วัดเทียบตัวโค้ด (ไม่รวมขอบเงียบ)
    const qrW = Math.max(1, W - QR_PAD * 2);
    const side = Math.round(qrW * LOGO_FRAC);
    const x = Math.round((W - side) / 2);
    const y = Math.round((W - side) / 2);
    const r = Math.round(side * 0.26);

    // กรอบขาวรองพื้น เว้นขอบขาวรอบตราให้กล้องแยกออกจากโมดูลได้ชัด
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + side, y, x + side, y + side, r);
    ctx.arcTo(x + side, y + side, x, y + side, r);
    ctx.arcTo(x, y + side, x, y, r);
    ctx.arcTo(x, y, x + side, y, r);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = Math.max(1, side * 0.055);
    ctx.strokeStyle = QR_DARK;
    ctx.stroke();

    // ตัวอักษร BC — ใช้ฟอนต์ระบบ ไม่พึ่ง Mitr ที่อาจโหลดไม่ทันตอนวาด
    ctx.fillStyle = QR_DARK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(side * 0.42) + 'px system-ui, -apple-system, Arial, sans-serif';
    ctx.fillText('BC', x + side / 2, y + side / 2 + side * 0.02);
    ctx.restore();
  } catch (e) {
    // วาดตราไม่ได้ก็ไม่เป็นไร QR ที่อ่านได้ยังอยู่ครบ
    console.warn('drawShopMark:', e);
  }
}

function generateQRCode(text, userInfo) {
  const canvas = document.getElementById("qrCanvas");
  const qr = new QRious({
    element: canvas,
    value: text,
    size: QR_SIZE,
    level: 'H',              // ⚠️ ห้ามลดระดับ — ตรากลางต้องพึ่งการกู้คืนข้อผิดพลาด
    foreground: QR_DARK,
    background: '#FFFFFF',
    padding: QR_PAD          // ขอบเงียบ ต้องมี ไม่งั้นกล้องจับขอบโค้ดไม่เจอ
  });
  drawShopMark(canvas);

  // ชื่อเป็นบรรทัดเด่น คำอธิบายเป็นบรรทัดเล็กใต้ลงไป (อ่านง่ายกว่าต่อกันบรรทัดเดียว)
  document.getElementById('qrUserInfo').innerHTML =
    `<span class="qr-name">${esc(userInfo.name)}</span>` +
    `<span class="qr-hint">แจ้งรุ่นรถกับพนักงานได้เลยค่ะ</span>`;
  // ใช้ onclick ไม่ใช่ addEventListener เพราะฟังก์ชันนี้ถูกเรียกทุกครั้งที่เปิด QR
  // ถ้าใช้ addEventListener ตัวฟังจะซ้อนกันเรื่อย ๆ แล้วยิง delete_token หลายรอบ
  document.getElementById('closeQRBtn').onclick = closeQRSection;
}

    function closeQRSection() {
      document.getElementById('qrSection').classList.add('hidden');
      document.getElementById('qrUserInfo').innerText = '';
      clearInterval(qrInterval);
      deleteQRToken();
      // เตรียมของใหม่ไว้เลย เผื่อกดปิดพลาดแล้วกดเปิดใหม่ จะได้ไม่ต้องรออีก
      prewarmQRToken();
    }


    // แสดงเป็น นาที:วินาที อ่านง่ายกว่าเลขวินาทีดิบ (ของเดิมขึ้น 287 แล้วนับลง)
    function fmtCountdown(sec) {
      const s = Math.max(0, sec);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function startQRCountdown() {
      let count = 300;
      document.getElementById("qrCountdown").textContent = fmtCountdown(count);
      qrInterval = setInterval(() => {
        count--;
        document.getElementById("qrCountdown").textContent = fmtCountdown(count);
        if (count <= 0) {
          clearInterval(qrInterval);
          deleteQRToken();
          closeQRSection();
        }
      }, 1000);
    }
    
    
    function deleteQRToken() {
      if (!window.qrToken) return;
      // ไม่ต้อง await — หน้าจอไม่ได้ใช้ผลลัพธ์ ของเดิมรอไว้เฉย ๆ
      deleteTokenOnServer(window.qrToken);
      window.qrToken = null;
    }

    function parseCustomDate(str) {
      const [dmy, hms] = str.split(',');
      const [day, month, year] = dmy.trim().split('/').map(Number);
      const [hour, minute, second] = hms.trim().split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute, second);
    }

document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoadingOverlay();
    console.log("Start login line...");
    await liff.init({ liffId: '2007421084-WXmXrzZY' });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    const profile = await liff.getProfile();

    // เก็บ token ไว้ใช้ตอนลูกค้ากรอกทะเบียนรถเอง (ดู askPlateIfMissing)
    // ⚠️ getIDToken() ใช้ได้ต่อเมื่อ LIFF ตัวนี้เปิดสิทธิ์ openid ไว้
    //    ถ้าไม่ได้เปิดจะคืน null เงียบ ๆ จึงเก็บ access token ไว้เป็นทางสำรอง
    //    (มีติดมากับ LIFF ทุกตัวอยู่แล้ว) เซิร์ฟเวอร์รับได้ทั้งสองแบบ
    try {
      memberTokens.id = (liff.getIDToken && liff.getIDToken()) || '';
    } catch (e) { memberTokens.id = ''; }
    try {
      memberTokens.access = (liff.getAccessToken && liff.getAccessToken()) || '';
    } catch (e) { memberTokens.access = ''; }

    // ยิงแล้วไม่รอผล (14 ก.ย. 2569)
    // ของเดิมใช้ await ทำให้ต้องรอ Apps Script ครบ 1 รอบก่อน แล้วค่อยไปขอแต้ม
    // = รอเรียงกัน 2 รอบกว่าลูกค้าจะเห็นแต้ม ทั้งที่งานนี้ลูกค้าไม่ได้อะไรเลย
    // เป็นแค่การจดชื่อ/รูปโปรไฟล์ LINE ล่าสุดไว้ในชีต
    //
    // ยิงพร้อมกับ action=member ได้ ไม่ชนกัน เพราะเขียนคนละคอลัมน์
    // (อันนี้เขียน C/D/E = ชื่อไลน์ สเตตัส รูป · หน้านี้แสดงชื่อจริงจากคอลัมน์ F)
    silentlyUpdateLineProfile(profile);

    function silentlyUpdateLineProfile(profile) {
          const payload = {
            action: 'update_line_profile',
            userId: profile.userId,
            nameLine: profile.displayName,
            statusMessage: profile.statusMessage || "",
            pictureUrl: profile.pictureUrl || ""
          };

          fetch(GAS_ENDPOINT + '?action=update_line_profile', {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
          })
            .then(res => res.json())
            .then(data => console.log("✅ LINE Profile อัปเดตอัตโนมัติ:", data))
            .catch(err => console.warn("⚠️ อัปเดตโปรไฟล์ LINE ล้มเหลว:", err));
        }

    const userId = profile.userId;
    console.log("✅ userId:", userId);
    currentUserId = userId;

    // ── เคยเปิดหน้านี้แล้ว -> ขึ้นแต้มให้เห็นทันที ไม่ต้องรอเน็ต ──────────
    // แล้วค่อยไปถามของจริงเบื้องหลัง ได้มาเมื่อไหร่ก็อัปเดตทับให้
    // (ดูเหตุผลและข้อควรระวังที่ readMemberCache)
    const cached = readMemberCache(userId);
    if (cached) {
      renderMember(cached, true);
      hideLoadingOverlay();
    }

    // เตรียม QR ไว้ล่วงหน้าตั้งแต่ตอนนี้ — ยิงพร้อมกับ action=member ไปเลย
    // ไม่ต้องรอข้อมูลสมาชิกก่อน เพราะใช้แค่ userId
    prewarmQRToken();

    let res;
    try {
      res = await fetch(`${GAS_ENDPOINT}?action=member&userId=${userId}`);
      console.log("✅ response status:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      // มีของเก่าค้างจออยู่แล้ว -> ปล่อยให้ดูต่อไป ดีกว่าไล่ลูกค้าออกจากหน้า
      // แต่ต้องบอกให้รู้ว่านี่ไม่ใช่ของสด เผื่อเพิ่งใช้บริการมาแล้วแต้มยังไม่ขึ้น
      if (cached) {
        console.warn('⚠️ ขอข้อมูลล่าสุดไม่สำเร็จ ใช้ของที่เก็บไว้:', err);
        markStale('เชื่อมต่อไม่ได้ · กำลังแสดงข้อมูลที่บันทึกไว้');
        return;
      }
      hideLoadingOverlay();
      Swal.fire({
        icon: 'error',
        title: '❗️ ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้',
        text: 'กรุณาลองใหม่อีกครั้งหรือติดต่อ Admin',
        confirmButtonText: 'Close'
      }).then(() => {
        liff.closeWindow();
      });
      return;
    }

    const data = await res.json();

    if (!data || !data.name) {
      // ของเก่าบอกว่าเคยเป็นสมาชิก แต่ตอนนี้หาไม่เจอ -> ของเก่าใช้ไม่ได้แล้ว ลบทิ้ง
      clearMemberCache(userId);
      hideLoadingOverlay();
      Swal.fire({
        icon: 'error',
        title: '❌ ไม่พบข้อมูลสมาชิก',
        text: 'กรุณาคลิกที่เมนู สมัครสมาชิก',
        confirmButtonText: 'Close'
      }).then(() => {
        liff.closeWindow();
      });
      return;
    }

    renderMember(data, false);
    writeMemberCache(userId, data);
    hideLoadingOverlay();

  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
    hideLoadingOverlay();
  }
});


// ═══════════════════════════════════════════════════════════════════════════
//  วาดหน้าสมาชิก
// ═══════════════════════════════════════════════════════════════════════════
function renderMember(data, isStale) {
  memberData = data;

  // ── ข้อมูลส่วนตัว + การ์ดรถแต่ละคัน ────────────────────────────────
  // เขียนทีเดียวจบ (ของเดิมใช้ innerHTML += ซึ่งทำให้เบราว์เซอร์
  // พาร์สและวาดใหม่ 2 รอบโดยไม่จำเป็น)
  const profileHtml = `
    <div class="card bc-prof">
      <div class="row"><span class="lbl">ชื่อ</span><span class="val">${esc(data.name || "-")}</span></div>
      <div class="row"><span class="lbl">เบอร์โทร</span><span class="val">${esc(formatPhone(String(data.vehicles[0]?.phone || "-")))}</span></div>
    </div>
  `;

  // เช็คว่ามีรถ ยี่ห้อ+รุ่น ซ้ำกันไหม ถ้าซ้ำจะนับจำนวนครั้งแยกคันไม่ได้
  const keyOf = v => `${String(v.brand || '').trim().toLowerCase()}|${String(v.model || '').trim().toLowerCase()}`;
  const keys = data.vehicles.map(keyOf);
  const noDupModel = keys.length === new Set(keys).size;

  // หมายเหตุอายุแต้ม — ตามที่แจ้งลูกค้าไว้ตอนสมัครสมาชิก
  const expNoteHtml = `
    <p class="bc-expnote">❕ แต้มมีอายุ 3 เดือนนับจากวันใช้บริการครั้งล่าสุด
    หากเลยกำหนดจะถูกหักเดือนละ 10 แต้ม · มาใช้บริการเมื่อไหร่ วันหมดอายุจะถูกนับใหม่ทันที</p>
  `;

  // แถบบอกว่ากำลังอัปเดต — ขึ้นเฉพาะตอนแสดงของเก่า
  // ต้องมีเสมอ ไม่งั้นลูกค้าที่เพิ่งใช้บริการจะเห็นแต้มเก่าแล้วนึกว่าร้านไม่ได้ให้แต้ม
  const staleHtml = isStale
    ? '<p class="bc-stale" id="staleNote">⏳ กำลังอัปเดตข้อมูลล่าสุด...</p>'
    : '';

  memberInfoEl.innerHTML = staleHtml
    + profileHtml
    + data.vehicles.map(v => vehicleCardHtml(v, data.serviceHistory, noDupModel)).join('')
    + expNoteHtml;

  // ── ประวัติการใช้บริการ ────────────────────────────────────────────
  // โหลดตอนกดปุ่มเท่านั้น ไม่โหลดตั้งแต่เปิดหน้า
  // ลูกค้าส่วนใหญ่เปิดมาดูแค่แต้ม การรอประวัติทั้งก้อน (ชีต 1,100+ แถว)
  // ทำให้กว่าจะเห็นแต้มช้าโดยไม่จำเป็น
  if (historySection.classList.contains('hidden') || !historyCache) {
    historySection.innerHTML = '';
    historySection.classList.add('hidden');
    toggleBtn.textContent = '▼ ดูประวัติการใช้บริการ';
  }
  toggleBtn.disabled = false;
  toggleBtn.classList.remove('disabled');
  bindHistoryToggle();

  // ถ้ายังไม่ได้ deploy Apps Script ตัวใหม่ ประวัติจะติดมากับ action=member เหมือนเดิม
  // ใช้ของที่ได้มาแล้วเลย จะได้ไม่ต้องยิงซ้ำ
  if (Array.isArray(data.serviceHistory)) {
    historyCache = data.serviceHistory;
  }
}

function markStale(text) {
  const el = document.getElementById('staleNote');
  if (el) el.textContent = '⚠️ ' + text;
}


// ═══════════════════════════════════════════════════════════════════════════
//  จำข้อมูลสมาชิกไว้ในเครื่อง (14 ก.ย. 2569)
//
//  ลูกค้าเปิดหน้านี้ซ้ำ ๆ ทุกครั้งที่มาใช้บริการ ของที่เห็นก็ชุดเดิมเกือบทั้งหมด
//  (ชื่อ เบอร์ รถ ทะเบียน) เปลี่ยนจริงแค่ตัวเลขแต้ม และเปลี่ยนตอนที่แอดมิน
//  บันทึกบริการให้เท่านั้น จึงขึ้นของเก่าให้เห็นก่อนได้เลย แล้วค่อยอัปเดตทับ
//
//  ⚠️ ข้อควรระวัง ตัวเลขแต้มที่เห็นตอนแรกอาจยังไม่ใช่ล่าสุด
//     จึงต้องขึ้นแถบ "กำลังอัปเดตข้อมูลล่าสุด..." คู่กันเสมอ
//     และต้องอัปเดตทับทันทีที่ของจริงมาถึง ห้ามปล่อยให้ค้าง
//
//  เก็บ 7 วัน — เกินกว่านั้นถือว่านานพอที่จะไม่ควรเดาแล้ว รอของจริงดีกว่า
//  แยกคีย์ตาม userId เผื่อเครื่องเดียวมีหลายคนใช้
// ═══════════════════════════════════════════════════════════════════════════
const MEMBER_CACHE_DAYS = 7;
const memberCacheKey = userId => 'bcMember_' + userId;

function readMemberCache(userId) {
  try {
    const raw = localStorage.getItem(memberCacheKey(userId));
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.at || !c.data || !c.data.name) return null;
    if (!Array.isArray(c.data.vehicles) || !c.data.vehicles.length) return null;
    if (Date.now() - c.at > MEMBER_CACHE_DAYS * 24 * 60 * 60 * 1000) return null;
    return c.data;
  } catch (e) { return null; }
}

function writeMemberCache(userId, data) {
  try {
    // ไม่เก็บประวัติลงไปด้วย — ก้อนใหญ่และมีข้อความที่ลูกค้าเขียนเอง
    // เก็บแค่ที่ใช้วาดหน้าแรก
    const slim = { userId: data.userId, name: data.name, vehicles: data.vehicles };
    localStorage.setItem(memberCacheKey(userId), JSON.stringify({ at: Date.now(), data: slim }));
  } catch (e) { /* เครื่องปิด localStorage ก็ไม่เป็นไร แค่ช้าเหมือนเดิม */ }
}

function clearMemberCache(userId) {
  try { localStorage.removeItem(memberCacheKey(userId)); } catch (e) {}
}


// ═══════════════════════════════════════════════════════════════════════════
//  กลับมาที่หน้านี้อีกครั้ง -> เตรียม QR ใหม่ + เช็คแต้มล่าสุด
//
//  ท่าที่ลูกค้าทำจริง: เปิดหน้านี้ดูแต้ม -> ล็อกจอ -> เดินไปเคาน์เตอร์ ->
//  ปลดล็อก -> กดแสดง QR  ตรงจังหวะปลดล็อกนี่แหละที่เตรียมของใหม่ได้ทัน
//  กว่านิ้วจะแตะปุ่มก็ได้ของสดแล้ว
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !currentUserId) return;

  // QR ที่เตรียมไว้เก่าเกินไปแล้ว -> ขอใหม่เงียบ ๆ
  if (warmTokenAgeSec() > QR_REWARM_AGE) prewarmQRToken();

  // เช็คแต้มล่าสุดด้วย เผื่อแอดมินเพิ่งบันทึกบริการให้ระหว่างที่พับหน้าจอไว้
  // ไม่ขึ้นหน้าจอโหลดคั่น ถ้าได้ของใหม่ค่อยอัปเดตทับเงียบ ๆ
  if (document.getElementById('qrSection') &&
      !document.getElementById('qrSection').classList.contains('hidden')) {
    return;  // กำลังโชว์ QR อยู่ อย่าไปวาดทับ
  }
  fetch(`${GAS_ENDPOINT}?action=member&userId=${currentUserId}`)
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (!data || !data.name) return;
      renderMember(data, false);
      writeMemberCache(currentUserId, data);
    })
    .catch(() => { /* เน็ตสะดุดก็ปล่อย ของที่เห็นอยู่ยังใช้ได้ */ });
});


// ═══════════════════════════════════════════════════════════════════════════
//  ประวัติการใช้บริการ — โหลดตอนกดดู (14 ก.ย. 2569)
// ═══════════════════════════════════════════════════════════════════════════

let historyCache = null;      // เก็บไว้หลังโหลดครั้งแรก กดปิด/เปิดซ้ำจะไม่ยิงใหม่
let historyLoading = false;   // กันกดรัว ๆ แล้วยิงซ้อนกัน

function bindHistoryToggle() {
  if (toggleBtn.classList.contains('bound')) return;
  toggleBtn.classList.add('bound');

  toggleBtn.addEventListener('click', async () => {
    // กำลังเปิดอยู่ -> ปิด
    if (!historySection.classList.contains('hidden')) {
      historySection.classList.add('hidden');
      toggleBtn.textContent = '▼ ดูประวัติการใช้บริการ';
      return;
    }

    if (historyLoading) return;

    // โหลดแล้ว -> เปิดให้ดูเลย
    if (historyCache) {
      historySection.classList.remove('hidden');
      toggleBtn.textContent = '▲ ซ่อนประวัติการใช้บริการ';
      renderHistory(historyCache);
      return;
    }

    // ครั้งแรก -> ไปเอาประวัติมาก่อน
    historyLoading = true;
    toggleBtn.disabled = true;
    const originalText = toggleBtn.textContent;
    toggleBtn.textContent = '⏳ กำลังโหลดประวัติ...';
    historySection.innerHTML = '<p>⏳ กำลังโหลดประวัติ...</p>';
    historySection.classList.remove('hidden');

    try {
      const res = await fetch(`${GAS_ENDPOINT}?action=member_history&userId=${encodeURIComponent(currentUserId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.status === 'error') throw new Error(data.message || 'โหลดประวัติไม่สำเร็จ');

      historyCache = Array.isArray(data.serviceHistory) ? data.serviceHistory : [];
      toggleBtn.textContent = '▲ ซ่อนประวัติการใช้บริการ';
      renderHistory(historyCache);

    } catch (err) {
      console.error('❌ โหลดประวัติไม่สำเร็จ:', err);
      // ไม่เก็บ cache ไว้ จะได้กดลองใหม่ได้
      historySection.classList.add('hidden');
      historySection.innerHTML = '';
      toggleBtn.textContent = originalText;
      Swal.fire({
        icon: 'error',
        title: '❌ โหลดประวัติไม่สำเร็จ',
        text: 'กรุณาลองกดใหม่อีกครั้ง',
        confirmButtonText: 'ปิด'
      });
    } finally {
      historyLoading = false;
      toggleBtn.disabled = false;
    }
  });
}

function renderHistory(historyRows) {
  // ⚠️ คัดลอกออกมาก่อน sort — ของเดิม sort ทับ array ก้อนเดิม
  //    ซึ่งเป็นก้อนเดียวกับที่การ์ดรถใช้หาวันใช้บริการล่าสุด
  const history = historyRows.slice();

  history.sort((a, b) => parseCustomDate(b.date) - parseCustomDate(a.date));

    if (history.length === 0) {
      historySection.innerHTML = '<p>-</p>';
    } else {
      if (window.innerWidth <= 480) {
        let historyCardsHtml = '';
        history.forEach((row, index) => {
          const dateStr = row.date;
          const parsedDate = parseCustomDate(dateStr);
          historyCardsHtml += `<div class="history-card${row.rating && row.feedback ? ' rated' : ''}">`;
          if (row.rating) {
            historyCardsHtml += '<div class="rating-display">';
            for (let s = 1; s <= 5; s++) {
              historyCardsHtml += `<span class="star static${s <= row.rating ? ' filled' : ''}">${s <= row.rating ? '★' : '☆'}</span>`;
            }
            historyCardsHtml += '</div>';
          } else {
            historyCardsHtml += `
              <button class="btn feedback-btn"
                data-date="${dateStr}"
                data-raw="${toBangkokISOString(parsedDate)}"
                data-service="${row.service || ''}"
                data-brand="${row.brand || ''}"
                data-model="${row.model || ''}">
                ให้คะแนน / ข้อเสนอแนะ
              </button>
            `;
          }
          historyCardsHtml += `
            <p><b> วันที่:</b> ${dateStr}</p>
            <p><b> ยี่ห้อ/รุ่น:</b> ${row.brand || '-'} ${row.model || '-'}</p>
            <p><b> บริการ:</b> ${row.service}</p>
            <p><b> ราคา:</b> ${row.price} ฿</p>
            <p><b> แต้ม:</b> ${row.point}</p>
            <p><b> หมายเหตุ:</b> ${row.note}</p>
          `;
          if (!row.rating || !row.feedback) {
            historyCardsHtml += `
              <div class="feedback-panel">
                <div class="star-selector">
                  <span class="star">☆</span><span class="star">☆</span><span class="star">☆</span><span class="star">☆</span><span class="star">☆</span>
                </div>
                <textarea class="feedback-text" placeholder="ข้อเสนอแนะ..."></textarea>
                <button class="btn submit-feedback-btn">ส่งความคิดเห็น</button>
              </div>
            `;
          }
          historyCardsHtml += `</div>`;
        });
        historySection.innerHTML = historyCardsHtml;
      } else {
        const rowsHtml = history.map((row, index) => {
          const dateStr = formatDateToYMDHM(row.date); // ใช้ฟังก์ชันนี้แทน
          if (row.rating) {
            let starsTd = '';
            for (let s = 1; s <= 5; s++) {
              starsTd += `<span class="star static${s <= row.rating ? ' filled' : ''}">${s <= row.rating ? '★' : '☆'}</span>`;
            }
            return `
              <tr class="history-entry">
                <td>${dateStr}</td>
                <td>${row.brand || '-'} ${row.model || '-'}</td>
                <td>${row.service}</td>
                <td>${row.price} ฿</td>
                <td>${row.point}</td>
                <td>${row.note}</td>
                <td>${starsTd}</td>
              </tr>
            `;
          } else {
            const parsedDate = parseCustomDate(row.date);
            return `
              <tr class="history-entry">
                <td>${dateStr}</td>
                <td>${row.brand || '-'} ${row.model || '-'}</td>
                <td>${row.service}</td>
                <td>${row.price} ฿</td>
                <td>${row.point}</td>
                <td>${row.note}</td>
                <td>
                  <button class="btn feedback-btn"
                    data-date="${dateStr}"
                    data-raw="${toBangkokISOString(parsedDate)}"
                    data-service="${row.service || ''}"
                    data-brand="${row.brand || ''}"
                    data-model="${row.model || ''}">
                    ให้คะแนน / ข้อเสนอแนะ
                  </button>
                </td>
              </tr>
              <tr class="feedback-row hidden">
                <td colspan="7">
                  <div class="feedback-panel">
                    <div class="star-selector">
                      <span class="star">☆</span><span class="star">☆</span><span class="star">☆</span><span class="star">☆</span><span class="star">☆</span>
                    </div>
                    <textarea class="feedback-text" placeholder="ข้อเสนอแนะ..."></textarea>
                    <button class="btn submit-feedback-btn">ส่งความคิดเห็น</button>
                  </div>
                </td>
              </tr>
            `;
          }
        }).join('');
        historySection.innerHTML = `
          <div class="history-section-wrapper">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ยี่ห้อ/รุ่น</th>
                  <th>บริการ</th>
                  <th>ราคา</th>
                  <th>แต้ม</th>
                  <th>หมายเหตุ</th>
                  <th>คะแนน</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    // ⭐ Event listeners for Rating/Feedback interactions
    // ผูกทุกครั้งที่วาดประวัติใหม่ — ปุ่มเหล่านี้ถูกสร้างใหม่พร้อม innerHTML ด้านบน
    // จึงไม่มีตัวเก่าค้างให้ผูกซ้ำ
    const feedbackButtons = document.querySelectorAll('.feedback-btn');
    feedbackButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.innerWidth <= 480) {
          // Mobile: Toggle slide-down panel in card
          const card = btn.closest('.history-card');
          const panel = card.querySelector('.feedback-panel');
          if (panel) {
            panel.classList.toggle('open');
          }
        } else {
          // Desktop: Toggle slide-down panel row in table
          const mainRow = btn.closest('tr');
          const panelRow = mainRow.nextElementSibling;
          if (panelRow && panelRow.classList.contains('feedback-row')) {
            const panelDiv = panelRow.querySelector('.feedback-panel');
            if (panelRow.classList.contains('hidden')) {
              panelRow.classList.remove('hidden');
              // force reflow before expanding (for smooth transition)
              panelDiv.offsetHeight;
              panelDiv.classList.add('open');
            } else {
              panelDiv.classList.remove('open');
              setTimeout(() => {
                panelRow.classList.add('hidden');
              }, 300);  // hide row after transition
            }
          }
        }
      });
    });
    // Star rating selection events
    const starContainers = document.querySelectorAll('.star-selector');
    starContainers.forEach(container => {
      const stars = container.querySelectorAll('.star');
      container.dataset.rating = '0';  // initialize selected rating as 0
      stars.forEach((starEl, idx) => {
        // Highlight stars on hover (desktop only, no effect on mobile)
        starEl.addEventListener('mouseenter', () => {
          stars.forEach((s, i) => {
            if (i <= idx) {
              s.textContent = '★';
              s.classList.add('filled');
            } else {
              s.textContent = '☆';
              s.classList.remove('filled');
            }
          });
        });
        starEl.addEventListener('mouseleave', () => {
          const currentRating = parseInt(container.dataset.rating) || 0;
          stars.forEach((s, i) => {
            if (i < currentRating) {
              s.textContent = '★';
              s.classList.add('filled');
            } else {
              s.textContent = '☆';
              s.classList.remove('filled');
            }
          });
        });
        // Set rating on click
        starEl.addEventListener('click', () => {
          const selectedRating = idx + 1;
          container.dataset.rating = String(selectedRating);
          stars.forEach((s, i) => {
            if (i < selectedRating) {
              s.textContent = '★';
              s.classList.add('filled');
            } else {
              s.textContent = '☆';
              s.classList.remove('filled');
            }
          });
        });
      });
    });
    
// Submit feedback event
const submitButtons = document.querySelectorAll('.submit-feedback-btn');
submitButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const panelDiv = btn.closest('.feedback-panel');
    const ratingVal = parseInt(panelDiv.querySelector('.star-selector').dataset.rating) || 0;
    const feedbackText = panelDiv.querySelector('.feedback-text').value.trim();
    if (!ratingVal) {
      await Swal.fire({
        icon: 'warning',
        title: 'กรุณาให้คะแนน (เลือกจำนวนดาว)',
        confirmButtonText: 'ตกลง'
      });
      return;
    }
    try {
      btn.disabled = true;
      Swal.fire({
        title: 'กำลังส่งความคิดเห็น...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      let serviceDate = '', serviceName = '';
      let feedbackBtn;
      if (window.innerWidth <= 480) {
        const card = btn.closest('.history-card');
        feedbackBtn = card.querySelector('.feedback-btn');
      } else {
        const panelRow = btn.closest('.feedback-row');
        const mainRow = panelRow.previousElementSibling;
        feedbackBtn = mainRow.querySelector('.feedback-btn');
      }
      if (feedbackBtn) {
        serviceDate = feedbackBtn.getAttribute('data-date'); // ใช้ data-date แทน data-raw
        serviceName = feedbackBtn.getAttribute('data-service');
      }
      if (!feedbackBtn) {
        Swal.fire({ icon: 'error', title: '❌ ไม่พบข้อมูลบริการ', confirmButtonText: 'ปิด' });
        btn.disabled = false;
        return;
      }

      const parsedDate = new Date(feedbackBtn.getAttribute('data-raw'));
      const formattedDate = toFullThaiDateTimeString(parsedDate);


      // ระหว่างส่ง feedback
      const brand = feedbackBtn.getAttribute('data-brand') || '';
      const model = feedbackBtn.getAttribute('data-model') || '';
      
      const res = await fetch(GAS_ENDPOINT + '?action=feedback', {
        redirect: "follow",
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'feedback',
          userId: currentUserId,
          date: formattedDate,
          service: serviceName,
          rating: ratingVal,
          feedback: feedbackText,
          brand,
          model
        })
      });


      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // On success, update the UI:
      if (window.innerWidth <= 480) {
        const card = btn.closest('.history-card');
        panelDiv.classList.remove('open');
        const fbButton = card.querySelector('.feedback-btn');
        if (fbButton) fbButton.remove();
        let staticStarsHtml = '<div class="rating-display">';
        for (let s = 1; s <= 5; s++) {
          staticStarsHtml += `<span class="star static${s <= ratingVal ? ' filled' : ''}">${s <= ratingVal ? '★' : '☆'}</span>`;
        }
        staticStarsHtml += '</div>';
        card.insertAdjacentHTML('beforeend', staticStarsHtml);
        card.classList.add('rated');
      } else {
        const panelRow = btn.closest('.feedback-row');
        const mainRow = panelRow.previousElementSibling;
        panelRow.remove();
        const fbButton = mainRow.querySelector('.feedback-btn');
        if (fbButton) {
          const cell = fbButton.parentElement;
          fbButton.remove();
          let starsDisplay = '';
          for (let s = 1; s <= 5; s++) {
            starsDisplay += `<span class="star static${s <= ratingVal ? ' filled' : ''}">${s <= ratingVal ? '★' : '☆'}</span>`;
          }
          cell.innerHTML = starsDisplay;
        }
      }
      console.log("[📤 ส่ง Feedback]", {
        userId: currentUserId,
        date: serviceDate,
        service: serviceName,
        rating: ratingVal,
        feedback: feedbackText,
        brand,
        model
      });
      Swal.fire({
        icon: 'success',
        title: 'ส่งความคิดเห็นสำเร็จ!',
        text: 'ขอบคุณสำหรับความคิดเห็นของคุณ',
        confirmButtonText: 'ตกลง'
      });
    } catch (error) {
      console.error('Error sending feedback:', error);
      Swal.fire({
        icon: 'error',
        title: '❌ ไม่สามารถส่งความคิดเห็นได้',
        text: 'กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ปิด'
      });
      btn.disabled = false;
    }
  });
});

} // จบ renderHistory
