// ของที่ใช้ร่วมกันของเมนูดูแลระบบ: 🩺 system/ · 🛟 recover/ · 👤 admins/ (23 ต.ค. 2569)
// คู่กับ sys_admin.gs (POST ?action=sys_admin) · ด่านจริงอยู่ที่เซิร์ฟเวอร์ทุกคำสั่ง
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

const $ = id => document.getElementById(id);
const SYS = { adminUserId: '', idToken: '' };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// access token = ทางสำรองเมื่อ ID token (อายุ 1 ชม.) หมด · เซิร์ฟเวอร์ใช้แทนให้เอง
function sysAccessTok() {
  try { return (typeof liff !== 'undefined' && liff.getAccessToken && liff.getAccessToken()) || ''; }
  catch (e) { return ''; }
}

// คืน data เมื่อสำเร็จ · โดนด่าน (มี code) จัดการให้เองแล้วคืน null · เน็ตพัง = โยน error ให้หน้าบอกเอง
async function sysCall(body) {
  const res = await fetch(`${GAS_ENDPOINT}?action=sys_admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ adminUserId: SYS.adminUserId, idToken: SYS.idToken, accessToken: sysAccessTok() }, body))
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'error' && data.code === 'NEED_POST') throw new Error('NEED_POST');   // เน็ตสะดุด ลองใหม่ได้
  if (data.status === 'error' && data.code) {
    const relogin = data.code === 'IDTOKEN_INVALID';
    await Swal.fire({
      icon: 'error',
      title: relogin ? 'เซสชันหมดอายุ' : 'ไม่มีสิทธิ์ใช้เมนูนี้',
      text: data.message || '',
      confirmButtonText: relogin ? 'เข้าสู่ระบบใหม่' : 'ปิด'
    });
    if (relogin) liff.login(); else liff.closeWindow();
    return null;
  }
  return data;
}

// เน็ตสะดุด (POST กลายเป็น GET / หลุดกลางทาง) -> ลองซ้ำเองสูงสุด 3 รอบ
// ใช้กับคำสั่งอ่านอย่างเดียว และคำสั่งเขียนที่เซิร์ฟเวอร์ตรวจซ้ำในล็อกแล้ว (กดซ้ำได้ผลเดิม)
async function sysCallRetry(body) {
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await sysCall(body); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
  }
  throw last;
}

async function sysBoot(onReady) {
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) return liff.login();
    const profile = await liff.getProfile();
    SYS.adminUserId = profile.userId;
    if (liff.getIDToken && typeof liff.getIDToken === 'function') SYS.idToken = await liff.getIDToken();
    await onReady();
  } catch (err) {
    console.error('เปิดหน้าไม่สำเร็จ:', err);
    Swal.fire({ icon: 'error', title: 'เปิดหน้านี้ไม่สำเร็จ', text: 'กรุณาปิดแล้วเปิดใหม่อีกครั้ง',
      confirmButtonText: 'ปิดหน้าต่าง' }).then(() => liff.closeWindow());
  }
}

// ความหมายของแต่ละระดับ — ต้องตรงกับ BC_MENU_LEVELS ใน main_admin/script.js
const LEVEL_INFO = {
  2: { name: 'พนักงานหน้าร้าน', can: 'สแกน QR · บันทึกบริการ' },
  3: { name: 'หัวหน้าหน้าร้าน', can: '+ ข้อมูลลูกค้า · คำขอแก้ไข · ข้อมูลร้าน' },
  4: { name: 'ผู้จัดการ', can: '+ สรุปยอด · เพิ่มแต้ม · สถานะระบบ' },
  5: { name: 'เจ้าของร้าน', can: '+ กู้รายการ · จัดการแอดมิน' }
};
