// script.js (main_admin)
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
window.liffId = '2007421084-2OgzWbpV';

document.addEventListener('DOMContentLoaded', () => {
  const adminManager = new AdminManager();
  adminManager.init();
});

// ═══════════════════════════════════════════════════════════════════════════
//  โหลดไลบรารีสแกน QR ตอนที่ต้องใช้จริงเท่านั้น (14 ก.ย. 2569)
//
//  🔴 ต้นเหตุที่หน้าแอดมินเปิดค้างนาน
//     ของเดิมโหลด html5-qrcode ไว้ใน <head> แบบ defer
//     แต่ DOMContentLoaded "รอสคริปต์ defer ทุกตัวให้โหลดและรันเสร็จก่อน"
//     ไลบรารีนี้หนัก 375 KB และเขียน URL เป็น unpkg.com/html5-qrcode
//     ซึ่งไม่ระบุเวอร์ชัน unpkg จึงต้อง redirect ไปหาเวอร์ชันล่าสุดก่อนอีกรอบ
//     โค้ดทั้งหมดเริ่มทำงานตอน DOMContentLoaded จึงถูกกักรอไฟล์นี้
//     ทั้งที่ใช้เฉพาะตอนกดปุ่มสแกน
//
//  วิธีแก้: เอาออกจาก <head> แล้วโหลดตอนต้องใช้
//    - ระบุเวอร์ชันชัดเจน ไม่ต้องเสียรอบ redirect หาเวอร์ชัน
//    - อุ่นไว้เบื้องหลังหลังหน้าโผล่แล้ว (ดู applyAdmin) พอกดสแกนจึงพร้อมทันที
//    - จำ Promise ไว้ เรียกซ้ำกี่ครั้งก็โหลดไฟล์เดียว
// ═══════════════════════════════════════════════════════════════════════════
const QR_LIB_URL = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
let qrLibPromise = null;

function ensureQrLibrary() {
  if (typeof Html5Qrcode !== 'undefined') return Promise.resolve(true);
  if (qrLibPromise) return qrLibPromise;

  qrLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = QR_LIB_URL;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => {
      qrLibPromise = null;          // ให้ลองใหม่ได้ถ้าเน็ตสะดุดชั่วคราว
      reject(new Error('โหลดไลบรารีสแกน QR ไม่สำเร็จ'));
    };
    document.head.appendChild(s);
  });
  return qrLibPromise;
}

// แปลงอักขระพิเศษก่อนเอาไปต่อเข้า HTML
// ชื่อลูกค้าเป็นข้อความที่ลูกค้าพิมพ์เองตอนสมัคร ถ้าพิมพ์เป็นแท็ก HTML มาแล้วเราต่อตรง ๆ
// มันจะไปทำงานในหน้าจอของแอดมิน ซึ่งเป็นหน้าที่มีสิทธิ์บันทึกบริการ
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

//------------------------------ QRScanner ------------------------------
class QRScanner {
  constructor() {
    this.isScanning = false;
    this.pointPerBaht = 0.1;
    this.adminUserId = '';
    this.adminName = '-';
    this.token = '';
    this.foundUser = null;
    this.serviceList = [];
    this.currentCameraIndex = 0;
    this.html5QrCode = null;
    this.cameraList = [];
    this.scanToken = '';        // QR ที่สแกนมาล่าสุด (ว่าง = ค้นด้วยเบอร์)
    this.requestId = '';        // รหัสคำขอ กันบันทึกซ้ำ
    this.forceDuplicate = false;
    this.draft = null;          // ค่าที่กรอกไว้ เก็บตอนกดกลับไปแก้จากหน้ายืนยัน

    document.getElementById('manualPhone')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.manualSearch();
    });
    document.querySelector('#scannerSearchBtn')?.addEventListener('click', () => this.manualSearch());
    document.querySelector('#scannerSwitchBtn')?.addEventListener('click', () => this.toggleCamera());
    document.querySelector('#scannerCloseBtn')?.addEventListener('click', () => this.closePopup());
  }

  togglePopup(show = true) {
    const section = document.getElementById('scanSection');
    if (!section) return;
    section.classList.toggle('hidden', !show);
    if (show) {
      setTimeout(() => section.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  async openScanPopup() {
    this.togglePopup(true);

    // 🔴 เรื่องความเร็ว (แก้ 14 ก.ย. 2569)
    //    ของเดิมเช็ค `if (!this.adminUserId) await this.init()` ก่อน
    //    แล้วค่อยไปอ่าน window.adminInfo ซึ่งสลับลำดับกัน
    //    ผลคือกดปุ่มสแกนทีไร ต้องรอ this.init() ยิงถาม check_admin
    //    ไป Apps Script อีกหนึ่งรอบเต็ม ๆ ก่อนกล้องจะเริ่มทำงาน
    //    ทั้งที่ AdminManager เพิ่งถามไปแล้วและใส่ผลไว้ใน window.adminInfo ให้แล้ว
    //    -> อ่านของที่มีอยู่ก่อน ถ้าครบก็เปิดกล้องได้เลย ไม่ต้องรอเน็ต
    const { userId, name, token } = window.adminInfo || {};
    if (userId) {
      this.adminUserId = userId;
      this.adminName = name || '-';
      this.token = token;
    } else if (!this.adminUserId) {
      // เข้าหน้านี้ตรง ๆ โดยไม่ผ่าน AdminManager (ไม่ควรเกิด แต่กันไว้)
      await this.init();
    }

    this.startCamera();
    this.loadServices();
  }

  async closePopup() {
    this.togglePopup(false);
    if (this.html5QrCode && this.html5QrCode._isScanning) {
      try {
        await this.html5QrCode.stop();
      } catch (err) {
        console.warn("⚠️ กล้องหยุดไม่ได้ (อาจไม่ได้เปิด):", err.message);
      }
    }
  }



  async init() {
    await liff.init({ liffId: window.liffId });
    if (!liff.isLoggedIn()) return liff.login();

    const profile = await liff.getProfile();
    this.adminUserId = profile.userId;
    this.token = await liff.getIDToken();

    const res = await fetch(`${GAS_ENDPOINT}?action=check_admin&userId=${this.adminUserId}`);
    const result = await res.json();
    this.adminName = result.name || '-';

    this.logAction('เข้าสู่ระบบ Scan', 'มีการเข้าใช้งานหน้า scan');
    this.loadServices();
  }

  logAction(title, detail) {
    fetch(GAS_ENDPOINT + '?action=log_admin', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'log_admin',
        name: this.adminName,
        userId: this.adminUserId,
        actionTitle: title,
        detail,
        device: navigator.userAgent,
        token: this.token,
      })
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  แยกการบันทึกเป็น 2 ขั้น (รื้อใหม่ 14 ก.ย. 2569)
  //
  //  🔴 ต้นเหตุของบั๊ก: SweetAlert2 เปิดป๊อปอัปได้ทีละอันเท่านั้น
  //     ของเดิมทำทุกอย่าง (ถามยืนยัน -> ยิง POST -> ถามเรื่องรายการซ้ำ)
  //     อยู่ใน preConfirm ของป๊อปอัป "บันทึกบริการ"
  //     พอเรียก Swal.fire ถามยืนยัน มันปิดป๊อปอัปเดิมทิ้งทันที
  //     ทำให้เกิดปัญหาพร้อมกัน 3 อย่าง
  //       1. กด "กลับไปแก้" แล้วฟอร์มหายหมด ต้องสแกนใหม่  <- ที่แจ้งมา
  //       2. กล่องถาม "บันทึกซ้ำไหม" ใช้ไม่ได้ เพราะ element ในฟอร์มหายไปแล้ว
  //       3. Swal.showValidationMessage เขียนลงป๊อปอัปที่ไม่มีอยู่แล้ว = เงียบหาย
  //
  //  วิธีแก้: ให้ preConfirm ทำแค่ "ตรวจและเก็บค่า" อย่างเดียว
  //  ส่วนการถามยืนยันและยิง POST ย้ายไปทำใน .then หลังป๊อปอัปปิดแล้ว
  //  ตอนนั้นไม่มีป๊อปอัปเปิดค้างอยู่ จึงเปิดกล่องถามซ้อนได้อย่างปลอดภัย
  // ═══════════════════════════════════════════════════════════════════════

  // ขั้นที่ 1 — ตรวจและเก็บค่าจากฟอร์ม (ทำงานใน preConfirm)
  // คืน false = ฟอร์มยังไม่ครบ ป๊อปอัปจะเปิดค้างไว้ให้แก้ต่อ
  collectForm() {
    const name = document.getElementById('serviceName').value.trim();
    const note = document.getElementById('noteInput').value.trim();
    const vehicleSelect = document.getElementById('vehicleSelect');
    const selectedIndex = vehicleSelect ? Number(vehicleSelect.value) : 0;
    const selectedVehicle = this.foundUser.vehicles?.[selectedIndex] || {};
    const availablePoint = parseInt(selectedVehicle.point || 0);

    const priceInputEl = document.getElementById('priceInput');
    const priceValue = parseFloat(priceInputEl.value || '0');

    // แยกข้อความให้ตรงกับว่าขาดอะไร ของเดิมรวมเป็นประโยคเดียวจึงไม่รู้ว่าขาดช่องไหน
    // ตรงนี้ป๊อปอัปยังเปิดอยู่ showValidationMessage จึงใช้ได้จริง
    if (!name) {
      Swal.showValidationMessage('ยังไม่ได้เลือกบริการ');
      return false;
    }
    if (priceValue <= 0) {
      Swal.showValidationMessage(this.isRedeeming
        ? 'กรุณากรอกจำนวนแต้มที่จะใช้'
        : 'กรุณากรอกราคาให้ถูกต้อง');
      return false;
    }

    let price = priceValue;
    let point = Math.floor(priceValue * this.pointPerBaht);
    let label = `ราคา: ${price} บาท · ลูกค้าได้แต้ม: +${point}`;

    if (this.isRedeeming) {
      if (price > availablePoint) {
        Swal.showValidationMessage(`แต้มลูกค้าไม่พอ (มี ${availablePoint} จะใช้ ${priceValue})`);
        return false;
      }
      price = -price;
      point = -priceValue;
      // ⚠️ ในโหมดแลกแต้ม ตัวเลขที่กรอกคือ "จำนวนแต้ม" ไม่ใช่บาท
      //    ของเดิมเขียนว่า "ราคา: 40" ซึ่งอ่านแล้วเข้าใจว่าเก็บเงิน 40 บาท
      //    ทั้งที่ลูกค้าไม่ได้จ่ายเงินเลย จึงเขียนให้ชัดว่าใช้แต้มกี่แต้มและจ่ายเงินเท่าไหร่
      label = `ใช้แต้ม: ${Math.abs(point)} แต้ม · ลูกค้าจ่ายเงิน: 0 บาท`;
    }

  
    // เพิ่มทะเบียนเข้าไปด้วย ช่วยให้แอดมินยันกับรถที่จอดอยู่หน้าร้านได้ก่อนกดยืนยัน
    const plateLine = String(selectedVehicle.Plate || '').trim();

    const confirmHtml = `
      <p>ลูกค้า: ${esc(this.foundUser.Name)}</p>
      <p>รถ: ${esc(selectedVehicle.Brand)} ${esc(selectedVehicle.Model)} (${esc(selectedVehicle.Year)})${
        plateLine ? ' · ' + esc(plateLine) : ''}</p>
      <p>บริการ: ${esc(name)}</p>
      <p>${esc(label)}</p>
      <p>หมายเหตุ: ${esc(note || '-')}</p>
    `;

    // เก็บค่าที่กรอกไว้ ถ้าแอดมินกดกลับไปแก้ จะได้เติมกลับให้ครบ
    this.draft = {
      vehicleIndex: selectedIndex,
      serviceName: name,
      price: priceInputEl.value,
      note: note,
      isRedeeming: this.isRedeeming
    };

    // ส่งข้อมูลที่ตรวจแล้วออกไปให้ .then เอาไปทำต่อ
    return {
      name, note, price, point, label, confirmHtml,
      vehicle: selectedVehicle
    };
  }

  // ขั้นที่ 2 — ถามยืนยันแล้วบันทึก (ทำงานหลังป๊อปอัปฟอร์มปิดแล้ว)
  // ตรงนี้ไม่มีป๊อปอัปเปิดค้าง จึงเปิดกล่องถามต่าง ๆ ได้อย่างปลอดภัย
  // skipConfirm = true ใช้ตอนยิงซ้ำหลังแอดมินยืนยันไปแล้ว (รายการซ้ำ / เน็ตหลุด)
  // จะได้ไม่ต้องกดยืนยันหน้าเดิมซ้ำอีกรอบให้เสียเวลาหน้าร้าน
  async confirmAndSave(data, skipConfirm) {
    if (!skipConfirm) {
      const confirm = await Swal.fire({
        title: 'ตรวจข้อมูลก่อนบันทึก',
        html: data.confirmHtml,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '✅ ยืนยัน บันทึกเลย',
        cancelButtonText: 'กลับไปแก้'
      });

      // กลับไปแก้ -> เปิดฟอร์มเดิมขึ้นมาใหม่พร้อมค่าที่กรอกไว้ ไม่ใช่รีเซ็ตกลับหน้าสแกน
      if (!confirm.isConfirmed) return this.reopenForm();
    }

    Swal.fire({ title: '⏳ กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const payload = {
      action: 'record_service',
      userId: this.foundUser.UserID,
      nameLine: this.foundUser.nameLine || '',
      statusMessage: this.foundUser.statusMessage || '',
      pictureUrl: this.foundUser.pictureUrl || '',
      brand: data.vehicle.Brand || '',
      model: data.vehicle.Model || '',
      year: data.vehicle.Year || '',
      category: data.vehicle.Category || '',
      serviceName: data.name,
      price: data.price,
      point: data.point,
      note: data.note,
      timestamp: this.getThaiDateTime(),
      admin: this.adminName,

      // ── ด่านตรวจใน security.gs ใช้ทั้ง 4 ช่องนี้ ──
      adminUserId: this.adminUserId,   // ใครเป็นคนกดบันทึก
      idToken: this.token,             // LINE ID token ยืนยันว่าเป็นคนนั้นจริง
      scanToken: this.scanToken || '', // QR ที่สแกนมา (ว่างได้ถ้าค้นด้วยเบอร์)
      requestId: this.requestId,       // กันกดซ้ำ/เน็ตสะดุดแล้วยิงซ้ำ
      force: !!this.forceDuplicate     // แอดมินยืนยันแล้วว่าตั้งใจบันทึกซ้ำ
    };

    let result;
    try {
      const res = await fetch(GAS_ENDPOINT + '?action=record_service', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      result = await res.json();
    } catch (err) {
      Swal.close();
      // เน็ตหลุดตอนนี้ = ไม่รู้ว่าเซิร์ฟเวอร์บันทึกไปแล้วหรือยัง
      // แต่ requestId เดิมทำให้กดซ้ำได้อย่างปลอดภัย ไม่เกิดรายการซ้ำ
      const retry = await Swal.fire({
        icon: 'error',
        title: '❌ ส่งข้อมูลไม่สำเร็จ',
        text: 'เช็คสัญญาณเน็ตแล้วลองบันทึกอีกครั้งได้เลย ระบบกันบันทึกซ้ำให้แล้ว',
        showCancelButton: true,
        confirmButtonText: 'ลองอีกครั้ง',
        cancelButtonText: 'กลับไปแก้'
      });
      return retry.isConfirmed ? this.confirmAndSave(data, true) : this.reopenForm();
    }
    Swal.close();

    if (result.success) {
      this.draft = null;   // บันทึกสำเร็จแล้ว ไม่ต้องเก็บร่างไว้
      this.logAction('บันทึกบริการ', `✅ ${data.name} (${data.price} บาท)`);
      return Swal.fire('✅ บันทึกสำเร็จ',
        `บริการ: ${esc(data.name)}<br>แต้ม: ${esc(result.point ?? data.point)}`, 'success')
        .then(() => liff.closeWindow());
    }

    // ── รายการนี้เพิ่งถูกบันทึกไปเมื่อกี้ ให้แอดมินยืนยันก่อนว่าตั้งใจซ้ำจริง ──
    if (result.code === 'DUPLICATE') {
      const again = await Swal.fire({
        icon: 'warning',
        title: '⚠️ รายการนี้เพิ่งบันทึกไปแล้ว',
        text: result.message || '',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน บันทึกซ้ำ',
        cancelButtonText: 'ไม่บันทึก'
      });
      if (!again.isConfirmed) return this.reopenForm();

      // ยิงใหม่พร้อมธงยืนยัน และเปลี่ยนรหัสคำขอ ไม่งั้นจะไปชนตัวกันซ้ำของตัวเอง
      this.forceDuplicate = true;
      this.requestId = 'r' + Date.now() + Math.random().toString(36).slice(2, 8);
      return this.confirmAndSave(data, true);   // ยืนยันไปแล้ว ไม่ต้องถามซ้ำ
    }

    // ── เซสชัน LINE หมดอายุ (เกิดได้ถ้าเปิดหน้าค้างไว้ทั้งวัน) ──────────────
    if (result.code === 'IDTOKEN_INVALID') {
      const relog = await Swal.fire({
        icon: 'warning',
        title: '🔐 เซสชันหมดอายุ',
        text: 'ต้องเข้าสู่ระบบ LINE ใหม่อีกครั้ง แล้วค่อยบันทึกรายการนี้ซ้ำ (ข้อมูลลูกค้ายังอยู่ครบ)',
        showCancelButton: true,
        confirmButtonText: 'เข้าสู่ระบบใหม่',
        cancelButtonText: 'ไว้ก่อน'
      });
      if (relog.isConfirmed) {
        try { liff.login(); } catch (e) { location.reload(); }
        return;
      }
      return this.reopenForm();
    }

    this.logAction('บันทึกบริการ', `❌ ล้มเหลว: ${data.name}, เหตุ: ${result.message}`);
    await Swal.fire('❌ บันทึกไม่สำเร็จ', result.message || '', 'error');
    return this.reopenForm();
  }

  // เปิดฟอร์มบันทึกบริการขึ้นมาใหม่ พร้อมค่าที่กรอกค้างไว้ (this.draft)
  // หน่วงนิดหนึ่งให้ SweetAlert ปิดตัวเก่าเสร็จก่อน ไม่งั้นตัวใหม่จะถูกกลืน
  reopenForm() {
    setTimeout(() => this.showCustomerPopup(), 150);
  }



  // เปิดกล้อง "หลัง" เป็นค่าเริ่มต้น
  // ของเดิมใช้ cameras[0].id ซึ่งคือกล้องตัวแรกที่เครื่องคืนมา มือถือส่วนใหญ่คืนกล้องหน้าก่อน
  // พนักงานจึงต้องกดสลับกล้องทุกครั้ง วันละหลายสิบครั้ง
  //
  // ไล่ 3 ชั้น ถ้าชั้นแรกไม่ได้ค่อยตกไปชั้นถัดไป ชั้นสุดท้ายคือพฤติกรรมเดิม จึงไม่มีทางแย่ลงกว่าเดิม
  async startCamera() {
    const cfg = { fps: 10, qrbox: 250 };
    const onOk = text => this.onScanSuccess(text);

    try {
      // ไลบรารีไม่ได้ถูกโหลดมาตั้งแต่เปิดหน้าแล้ว (ดู ensureQrLibrary ด้านบนไฟล์)
      // ปกติจะอุ่นไว้เสร็จตั้งแต่หน้าโผล่ บรรทัดนี้จึงผ่านทันที
      // กรณีที่ยังโหลดไม่เสร็จ ค่อยรอตรงนี้ พร้อมบอกให้รู้ว่ากำลังเตรียมกล้อง
      if (typeof Html5Qrcode === 'undefined') {
        const box = document.getElementById('reader');
        if (box) box.innerHTML = '<div class="cam-wait">กำลังเตรียมกล้อง…</div>';
        await ensureQrLibrary();
        if (box) box.innerHTML = '';
      }

      if (!this.html5QrCode) this.html5QrCode = new Html5Qrcode('reader');
      if (this.html5QrCode._isScanning) await this.html5QrCode.stop();

      // เคยลองวิธี facingMode:{exact:"environment"} แล้วพบว่าถ้ามันล้มเหลว
      // html5-qrcode จะค้างอยู่ในสถานะครึ่ง ๆ กลาง ๆ ต้องกดสลับกล้องก่อนภาพถึงจะขึ้น
      // จึงเลิกใช้ เหลือวิธีเดียวคือเลือกจากรายการกล้องเหมือนเดิม แค่เลือกให้ถูกตัว
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) throw new Error('ไม่พบกล้อง');
      this.cameraList = cameras;

      // หากล้องหลังจากชื่อ — เป็นวิธีเดียวกับที่โฟลเดอร์ scan/ (โค้ดเก่า) ใช้อยู่
      const back = cameras.find(c => /back|rear|environment|หลัง/i.test(c.label || ''));

      // ไม่เจอจริง ๆ ค่อยใช้ตัวแรกเหมือนโค้ดเดิม จึงไม่มีทางแย่ลงกว่าเดิม
      const camId = back ? back.id : cameras[0].id;
      this.currentCameraIndex = Math.max(0, cameras.findIndex(c => c.id === camId));

      await this.html5QrCode.start(camId, cfg, onOk);

    } catch (err) {
      Swal.fire('❌ เปิดกล้องไม่สำเร็จ', err.message || '', 'error');
    }
  }

  toggleCamera() {
    if (!this.cameraList.length || !this.html5QrCode) return;
    this.html5QrCode.stop().then(() => {
      this.currentCameraIndex = (this.currentCameraIndex + 1) % this.cameraList.length;
      this.html5QrCode.start(
        this.cameraList[this.currentCameraIndex].id,
        { fps: 10, qrbox: 250 },
        text => this.onScanSuccess(text)
      );
    });
  }

  getThaiDateTime(d = new Date()) {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }

  // ── กลับไปสถานะพร้อมสแกนคนถัดไป ─────────────────────────────────────────
  // 🔴 บั๊กที่แก้ 13 ก.ย. 2569:
  //    ถ้าแอดมินปิดหน้าบันทึกบริการโดยไม่บันทึก (กดยกเลิก / กดนอกกรอบ / Esc)
  //    ของเดิมไม่มีอะไรทำงานต่อเลย — กล้องถูกสั่งหยุดไปแล้วตอนสแกนติด
  //    หน้าสแกนก็ถูกซ่อน และ this.foundUser กับเบอร์ที่ค้นหาค้างอยู่
  //    ผลคือเปิดกล้องอีกไม่ได้ และถ้ากดค้นหาซ้ำจะเจอข้อมูลคนเก่า
  async resetToScan() {
    this.foundUser = null;
    this.isRedeeming = false;
    this.currentPoint = 0;
    this.plateFormOpen = false;
    this.isScanning = false;
    this.scanToken = '';
    this.forceDuplicate = false;
    this.draft = null;          // เริ่มลูกค้าคนใหม่ ไม่เอาร่างของคนเก่าติดมา

    const phoneEl = document.getElementById('manualPhone');
    if (phoneEl) phoneEl.value = '';      // ล้างเบอร์เก่า ไม่ให้ค้างข้ามคน

    this.togglePopup(true);               // โชว์หน้าสแกนกลับมา
    await this.startCamera();             // เปิดกล้องใหม่ พร้อมสแกนคนถัดไป
  }

  async manualSearch() {
    const phone = document.getElementById('manualPhone').value;
    if (!phone) return;
    Swal.fire({ title: '🔍 กำลังค้นหา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let result;
    try {
      // ห่อ try/catch เพิ่ม — ของเดิมถ้าเน็ตหลุดระหว่างค้นหา
      // หน้าจอจะค้างที่ "กำลังค้นหา..." ตลอดไป ปิดไม่ได้ ต้องปิดแอปทิ้ง
      const res = await fetch(`${GAS_ENDPOINT}?action=search_phone&phone=${encodeURIComponent(phone)}`);
      result = await res.json();
    } catch (err) {
      Swal.close();
      return Swal.fire('❌ ค้นหาไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วลองใหม่อีกครั้ง', 'error');
    }
    Swal.close();

    if (!result || !result.success) return Swal.fire('ไม่พบข้อมูลลูกค้า', '', 'error');
    this.foundUser = result.data;
    this.scanToken = '';        // ค้นด้วยเบอร์ ไม่มี QR เกี่ยวข้อง
    this.closePopup();
    setTimeout(() => this.showCustomerPopup(), 300);
  }

 async onScanSuccess(token) {
    if (this.isScanning) return;
    this.isScanning = true;
  
    try {
      if (this.html5QrCode && this.html5QrCode._isScanning) {
        await this.html5QrCode.stop();
      }
    } catch (err) {
      console.warn("⚠️ ไม่สามารถหยุดกล้อง:", err.message);
    }
  
    Swal.fire({ title: '🔍 กำลังค้นหา QR...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let result;
    try {
      // ห่อ try/catch เพิ่ม — เน็ตหลุดตอนนี้แล้วหน้าจะค้างที่ "กำลังค้นหา QR..."
      const res = await fetch(`${GAS_ENDPOINT}?action=verify_token&token=${encodeURIComponent(token)}`);
      result = await res.json();
    } catch (err) {
      Swal.close();
      await Swal.fire('❌ อ่าน QR ไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วสแกนใหม่อีกครั้ง', 'error');
      this.isScanning = false;
      this.startCamera();
      return;
    }
    Swal.close();

    if (!result || !result.success) {
      Swal.fire('QR ไม่ถูกต้อง', '', 'error');
      this.isScanning = false;
      this.startCamera(); // รีสตาร์ทกล้องใหม่
      return;
    }
  
    this.foundUser = result.data;
    // เก็บ token ที่สแกนมา ส่งไปกับตอนบันทึกด้วย
    // เซิร์ฟเวอร์จะปิด token ทิ้งหลังบันทึกสำเร็จ สแกน QR อันเดิมซ้ำจึงบันทึกไม่ได้อีก
    this.scanToken = token;
    this.togglePopup(false); // ซ่อนหน้า scan
    setTimeout(() => this.showCustomerPopup(), 300);
  }


  loadServices() {
    // ฟังก์ชันนี้ถูกเรียก 2 ที่ (init กับ openScanPopup) ของเดิมจึงสร้าง
    // <datalist id="serviceOptions"> ซ้อนกัน 2 อัน id ชนกัน
    // ตอนนี้เลิกใช้ datalist แล้ว เก็บแต่รายการไว้ใน this.serviceList
    // แล้ววาดเป็นปุ่มให้แตะเลือกใน showCustomerPopup()
    //
    // 14 ก.ย. 2569 — จำรายการบริการไว้ในเครื่อง
    // รายการบริการแทบไม่เปลี่ยน แต่ของเดิมไปถามใหม่ทุกครั้งที่เปิดหน้า
    // แอดมินจึงเจอ "กำลังโหลดรายการบริการ…" ทุกครั้งที่สแกนลูกค้าคนแรกของวัน
    // ตอนนี้ขึ้นปุ่มจากของที่จำไว้ทันที แล้วค่อยไปถามของใหม่เบื้องหลัง
    // ถ้าได้ของใหม่ที่ไม่เหมือนเดิม ค่อยวาดปุ่มใหม่ให้
    if (!this.serviceList || !this.serviceList.length) {
      const cached = this.readServiceCache();
      if (cached) this.serviceList = cached;
    }

    if (this._loadingServices) return;
    this._loadingServices = true;
    fetch(`${GAS_ENDPOINT}?action=service_list`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        if (!list.length) return;              // ถามไม่ได้ผล -> ใช้ของเดิมต่อไป
        const changed = JSON.stringify(list) !== JSON.stringify(this.serviceList);
        this.serviceList = list;
        this.writeServiceCache(list);
        // วาดใหม่เฉพาะตอนรายการเปลี่ยนจริง และหน้าเลือกบริการเปิดค้างอยู่
        // (ถ้าวาดทุกครั้ง ปุ่มที่แอดมินเพิ่งแตะเลือกไว้จะกะพริบโดยไม่จำเป็น)
        if (changed && document.getElementById('svcChips')) this.renderServiceChips();
      })
      .catch(err => console.warn('โหลดรายการบริการไม่สำเร็จ:', err))
      .finally(() => { this._loadingServices = false; });
  }

  // ── จำรายการบริการไว้ 24 ชม. ─────────────────────────────────────────────
  // เก็บแยกจากของแอดมิน (bcAdmin_*) เพราะไม่ใช่ข้อมูลส่วนตัวและไม่ผูกกับคน
  readServiceCache() {
    try {
      const raw = localStorage.getItem('bcServices');
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !Array.isArray(c.list) || !c.list.length) return null;
      if (Date.now() - (c.at || 0) > 24 * 60 * 60 * 1000) return null;
      return c.list;
    } catch (e) { return null; }
  }

  writeServiceCache(list) {
    try {
      localStorage.setItem('bcServices', JSON.stringify({ list, at: Date.now() }));
    } catch (e) { /* เครื่องปิด localStorage ก็ไม่เป็นไร แค่ช้าเหมือนเดิม */ }
  }

  // วาดปุ่มบริการให้แตะเลือก
  //
  // กรองจาก this.svcFilter (คำที่แอดมินพิมพ์) ไม่ใช่จากค่าในช่อง
  // เพราะถ้ากรองจากค่าในช่อง พอแตะเลือกไปแล้วรายการจะเหลือปุ่มเดียว
  // แล้วเปลี่ยนใจเลือกบริการอื่นไม่ได้ ต้องลบข้อความในช่องเองก่อน
  // (แอดมินแจ้งมา 13 ก.ย. 2569) จึงแยกคำค้นออกจากค่าที่เลือกไว้
  //
  // ตัวที่เลือกอยู่จะติดสี · แตะซ้ำที่ตัวเดิมเพื่อยกเลิกได้
  renderServiceChips() {
    const box = document.getElementById('svcChips');
    if (!box) return;

    if (!this.serviceList || !this.serviceList.length) {
      box.innerHTML = '<span class="svc-empty">กำลังโหลดรายการบริการ… พิมพ์ชื่อบริการเองได้เลย</span>';
      return;
    }

    const nameEl = document.getElementById('serviceName');
    const chosen = nameEl ? nameEl.value.trim() : '';
    const q = String(this.svcFilter || '').trim().toLowerCase();
    const list = this.serviceList.filter(s =>
      !q || String(s.name || '').toLowerCase().includes(q)
    );

    if (!list.length) {
      box.innerHTML = '<span class="svc-empty">ไม่พบบริการนี้ในรายการ — พิมพ์เองได้เลย</span>';
      return;
    }

    // ไม่โชว์ราคาบนปุ่มแล้ว (13 ก.ย. 2569 ตามที่แจ้ง)
    // เพราะมีช่องพิมพ์ราคาอยู่แล้ว และราคาจริงตั้งตามงานหน้าร้านเป็นครั้ง ๆ ไป
    // ราคาในชีตอาจไม่ตรงกับที่คิดจริง ถ้าโชว์ไว้จะทำให้เข้าใจผิดว่าเป็นราคาที่ต้องเก็บ
    const chips = list.map(s => {
      const on = String(s.name || '') === chosen ? ' is-on' : '';
      return `<button type="button" class="svc-chip${on}" data-name="${esc(s.name)}">`
        + esc(s.name)
        + `</button>`;
    }).join('');

    const hint = chosen
      ? '<div class="svc-note">แตะปุ่มอื่นเพื่อเปลี่ยนบริการ · แตะปุ่มเดิมซ้ำเพื่อยกเลิก</div>'
      : '';
    box.innerHTML = chips + hint;
  }

  // ── การ์ดเลือกรถ ────────────────────────────────────────────────────────
  // ของเดิมเป็น <select> บรรทัดเดียว อ่านไม่ครบและกดยากบนมือถือ
  // การ์ดโชว์ รุ่น / ยี่ห้อ · ปี · ทะเบียน / แต้ม ครบในที่เดียว
  renderVehiclePicks() {
    const box = document.getElementById('vpickList');
    const sel = document.getElementById('vehicleSelect');
    if (!box || !sel) return;

    const idx = Number(sel.value) || 0;
    box.innerHTML = (this.foundUser.vehicles || []).map((v, i) => {
      const plate = String(v.Plate || '').trim();
      const moto = String(v.Category || '') === 'Motorcycle';
      const sub = [esc(v.Brand || '-'), esc(v.Year || '-'),
                   plate ? esc(plate) : '<i class="vp-nop">ยังไม่มีทะเบียน</i>'].join(' · ');
      return `<button type="button" class="vpick" data-idx="${i}" aria-pressed="${i === idx}">
        <span class="tick">✓</span>
        <span class="vp-l">
          <span class="vp-m">${esc(v.Model || '-')}${moto ? ' <span class="vp-moto">🛵</span>' : ''}</span>
          <span class="vp-s">${sub}</span>
        </span>
        <span class="vp-p"><span class="vp-n">${parseInt(v.point || 0) || 0}</span><span class="vp-u">แต้ม</span></span>
      </button>`;
    }).join('');
  }

  // ── ช่องเติมทะเบียนของรถคันที่เลือกอยู่ ──────────────────────────────────
  // โผล่เฉพาะรถที่ยังไม่มีทะเบียน · กรอกแล้วบันทึกได้จากในหน้านี้เลย
  // ไม่เปิดป๊อปอัปซ้อน เพราะ SweetAlert เปิดได้ทีละอัน จะทำให้ฟอร์มที่กรอกไว้หาย
  renderPlateBox() {
    const box = document.getElementById('plateBox');
    const sel = document.getElementById('vehicleSelect');
    if (!box || !sel) return;

    const i = Number(sel.value) || 0;
    const v = (this.foundUser.vehicles || [])[i] || {};
    const plate = String(v.Plate || '').trim();

    // ⚠️ ต้องเช็ค plateFormOpen "ก่อน" เช็คว่ามีทะเบียนแล้วหรือยัง
    //    ของเดิมเช็คว่ามีทะเบียนก่อนแล้ว return ทันที ปุ่ม "แก้ทะเบียน" จึงกดแล้วไม่มีอะไรเกิดขึ้น
    //    (แอดมินแจ้งมา 13 ก.ย. 2569 — "เมนูแก้ไขทะเบียนกดไม่ได้")
    if (this.plateFormOpen) {
      // แยกทะเบียนเดิมกลับเป็น หมวด + เลขท้าย เพื่อเติมลงช่องให้แก้ต่อได้เลย
      const m = plate.match(/^(.*?)\s*(\d{1,4})$/);
      const curHead = m ? m[1].trim() : plate;
      const curTail = m ? m[2] : '';
      const provOpts = (typeof plateProvinceOptions === 'function')
        ? plateProvinceOptions(v.Province || '') : '<option value="">—</option>';

      box.innerHTML = `<div class="plate-form">
        <div class="plate-form-hd">${plate ? 'แก้ทะเบียนรถ' : 'เพิ่มทะเบียนรถ'}
          <span>— ${plate ? 'ของเดิม ' + esc(plate) : 'ถามลูกค้าแล้วกรอกได้เลย'}</span></div>
        <div class="pl-grid">
          <div>
            <input type="text" id="apHead" class="pl-in" placeholder="1กร" autocomplete="off"
                   maxlength="7" value="${esc(curHead)}">
            <div class="pl-eg">หมวด เช่น <b>1กร</b> (ภาษาไทยเท่านั้น)</div>
          </div>
          <div>
            <input type="text" id="apTail" class="pl-in" placeholder="1723" inputmode="numeric"
                   autocomplete="off" maxlength="4" value="${esc(curTail)}">
            <div class="pl-eg">เลขท้าย เช่น <b>1723</b></div>
          </div>
        </div>
        <select id="apProv" class="pl-in pl-prov">${provOpts}</select>
        <div class="pl-preview" id="apPreview" hidden></div>
        <div class="pl-warn" id="apWarn" hidden></div>
        <div class="plate-acts">
          <button type="button" class="plate-save" id="apSave">💾 บันทึกทะเบียน</button>
          <button type="button" class="plate-skip" id="apSkip">${plate ? 'ยกเลิก' : 'ข้ามไปก่อน'}</button>
        </div>
      </div>`;
      return;
    }

    if (plate) {
      box.innerHTML = `<div class="plate-have">
        ${typeof plateHtml === 'function' ? plateHtml(plate, v.Province, false) : esc(plate)}
        <button type="button" class="plate-edit" id="plateEditBtn">แก้ทะเบียน</button>
      </div>`;
      return;
    }

    box.innerHTML = `<button type="button" class="plate-add" id="plateAddBtn">
      ➕ รถคันนี้ยังไม่มีทะเบียน — เพิ่มเลย
    </button>`;
  }

  // ส่งทะเบียนไปเก็บที่ชีต (action=set_plate ใน plate.gs)
  async savePlate(btn) {
    const sel = document.getElementById('vehicleSelect');
    const i = Number(sel.value) || 0;
    const v = (this.foundUser.vehicles || [])[i];
    if (!v) return;

    const head = document.getElementById('apHead');
    const tail = document.getElementById('apTail');
    const prov = document.getElementById('apProv');
    const warn = document.getElementById('apWarn');

    const check = (typeof plateValidate === 'function')
      ? plateValidate(head.value, tail.value, { required: true }) : { ok: true, warn: '' };
    const plate = (typeof platePretty === 'function')
      ? platePretty(head.value, tail.value) : (head.value + ' ' + tail.value).trim();

    if (!check.ok || !plate) {
      warn.textContent = '⚠️ ' + (check.warn || 'กรุณากรอกทะเบียนให้ครบ');
      warn.hidden = false;
      return;
    }

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = '⏳ กำลังบันทึก...';

    try {
      const res = await fetch(`${GAS_ENDPOINT}?action=set_plate`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'set_plate',
          userId: this.foundUser.UserID,          // เจ้าของรถ
          brand: v.Brand, model: v.Model, year: v.Year,
          plate, province: prov ? prov.value : '',
          admin: this.adminName,
          // ── ข้อมูลยืนยันตัวตนคนที่กดแก้ (ด่านตรวจใน security.gs ใช้) ──
          adminUserId: this.adminUserId,
          idToken: this.token
        })
      });
      const out = await res.json();

      // เซสชัน LINE หมดอายุ — ชวนเข้าสู่ระบบใหม่ ไม่ใช่แค่ขึ้นข้อความให้งง
      if (out.code === 'IDTOKEN_INVALID') {
        const relog = await Swal.fire({
          icon: 'warning',
          title: '🔐 เซสชันหมดอายุ',
          text: 'ต้องเข้าสู่ระบบ LINE ใหม่ก่อนบันทึกทะเบียน',
          showCancelButton: true,
          confirmButtonText: 'เข้าสู่ระบบใหม่',
          cancelButtonText: 'ไว้ก่อน'
        });
        if (relog.isConfirmed) { try { liff.login(); } catch (e) { location.reload(); } }
        btn.disabled = false;
        btn.textContent = label;
        return;
      }

      if (out.status !== 'success') throw new Error(out.message || 'บันทึกไม่สำเร็จ');

      // อัปเดตในหน่วยความจำด้วย เพื่อให้การ์ดกับบรรทัดสรุปเปลี่ยนทันที
      v.Plate = out.plate || plate;
      v.Province = out.province || (prov ? prov.value : '');
      this.plateFormOpen = false;
      this.renderVehiclePicks();
      this.renderPlateBox();
    } catch (err) {
      warn.textContent = '⚠️ ' + err.message;
      warn.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  showCustomerPopup() {
    this.isRedeeming = false;
    this.currentPoint = 0;
    this.plateFormOpen = false;

    // สร้างรหัสคำขอใหม่ทุกครั้งที่เปิดหน้าบันทึก
    // เซิร์ฟเวอร์จำรหัสนี้ไว้ 6 ชั่วโมง ยิงมาด้วยรหัสเดิม = คำขอเดิม ไม่ใช่รายการใหม่
    // ทำให้กดบันทึกซ้ำหรือเน็ตสะดุดแล้วยิงซ้ำ ไม่เกิดรายการซ้ำและแต้มไม่เด้งสองรอบ
    this.requestId = 'r' + Date.now() + Math.random().toString(36).slice(2, 8);
    this.forceDuplicate = false;
  
    const vehicleOptions = this.foundUser.vehicles.map((v, i) =>
      `<option value="${i}">${esc(v.Brand)} ${esc(v.Model)} (${esc(v.Year)}) - ${esc(v.point)} แต้ม</option>`
    ).join('');

    Swal.fire({
      // ชื่อหน้าเดิมคือ "ข้อมูลลูกค้า" แต่หน้านี้ทำทั้งเลือกรถ เลือกบริการ และบันทึก
      // จึงเปลี่ยนให้ตรงกับงานที่ทำจริง
      title: 'บันทึกบริการ',
      html: `
        <div class="cust-head">
          <div class="row"><span class="lbl">ลูกค้า</span><span class="val">${esc(this.foundUser.Name)}</span></div>
          <div class="row"><span class="lbl">เบอร์</span><span class="val">${esc(this.foundUser.Phone)}</span></div>
        </div>

        <div class="fld">
          <label class="fld-lbl">เลือกรถที่มาวันนี้${this.foundUser.vehicles.length > 1
            ? ` <span class="fld-sub">— มี ${this.foundUser.vehicles.length} คันในระบบ</span>` : ''}</label>
          <div class="vpick-list" id="vpickList"></div>
          <!-- ⚠️ select ตัวนี้ถูกซ่อนไว้ ห้ามลบ
               collectForm() กับ updateCurrentPoint() อ่านค่าจาก #vehicleSelect
               การ์ดด้านบนเป็นแค่หน้าตา กดแล้วมาเขียนค่าลง select ตัวนี้ -->
          <select id="vehicleSelect" hidden>${vehicleOptions}</select>
          <div class="plate-box" id="plateBox"></div>
        </div>

        <div class="fld">
          <label class="fld-lbl" for="serviceName">บริการ</label>
          <input type="text" id="serviceName" class="swal2-input"
                 placeholder="แตะเลือกด้านล่าง หรือพิมพ์ชื่อบริการ" autocomplete="off">
          <div class="svc-chips" id="svcChips"></div>
        </div>

        <div class="fld">
          <label class="fld-lbl">วิธีชำระ</label>
          <div class="pay-seg" role="group" aria-label="เลือกวิธีชำระ">
            <button type="button" id="modeCash" class="pay-opt is-on">💰 จ่ายเงิน</button>
            <button type="button" id="modePts"  class="pay-opt">🎁 แลกแต้ม</button>
          </div>
        </div>

        <input type="number" id="priceInput" placeholder="ราคา (บาท)" class="swal2-input">
        <p id="pointInfo">แต้มที่จะได้: <span id="pointPreview">0</span></p>
        <input type="text" id="noteInput" placeholder="หมายเหตุ (ไม่บังคับ)" class="swal2-input">
      `,
      confirmButtonText: '✅ บันทึก',
      // ปุ่มยกเลิกที่เห็นได้ชัด — ของเดิมต้องกดนอกกรอบหรือ Esc เท่านั้น
      // ซึ่งพนักงานหน้าร้านไม่รู้ และกดนอกกรอบโดยบังเอิญก็หลุดออกมาแบบงง ๆ
      showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      didOpen: () => {
        const priceInput = document.getElementById('priceInput');
        const pointPreview = document.getElementById('pointPreview');
        const pointInfo = document.getElementById('pointInfo');
        const modeCash = document.getElementById('modeCash');
        const modePts = document.getElementById('modePts');
        const vehicleSelect = document.getElementById('vehicleSelect');
  
        const updatePointDisplay = () => {
          const p = parseFloat(priceInput.value) || 0;
          if (this.isRedeeming) {
            const remain = this.currentPoint - p;
            if (remain < 0) {
              // ⚠️ ข้อความนี้แอดมินเป็นคนอ่าน ไม่ใช่ลูกค้า
              //    ของเดิมเขียนว่า "แต้มของคุณไม่พอใช้บริการนี้ค่ะ" ซึ่งเขียนถึงลูกค้า
              //    ทั้งที่ลูกค้าไม่เห็นหน้านี้เลย จึงเปลี่ยนให้พูดกับแอดมินตรง ๆ
              pointInfo.textContent = `❌ แต้มลูกค้าไม่พอ (มี ${this.currentPoint} จะใช้ ${p})`;
              pointInfo.style.color = 'red';
              Swal.getConfirmButton().disabled = true;
            } else {
              pointInfo.textContent = `แต้มคงเหลือ: ${this.currentPoint} - ${p} → ${remain} แต้ม`;
              pointInfo.style.color = 'black';
              Swal.getConfirmButton().disabled = false;
            }
          } else {
            pointPreview.textContent = Math.floor(p * this.pointPerBaht);
            pointInfo.innerHTML = `แต้มที่จะได้: <span id="pointPreview">${Math.floor(p * this.pointPerBaht)}</span>`;
            Swal.getConfirmButton().disabled = false;
          }
        };
  
        // เปลี่ยนคันรถ → อัปเดตแต้ม
        const updateCurrentPoint = () => {
          const selectedIndex = Number(vehicleSelect.value) || 0;
          this.currentPoint = parseInt(this.foundUser.vehicles[selectedIndex].point || '0');
          updatePointDisplay();
        };
  
        vehicleSelect.addEventListener('change', updateCurrentPoint);
        priceInput.addEventListener('input', updatePointDisplay);

        // ── การ์ดเลือกรถ + ช่องเติมทะเบียน ─────────────────────────────
        const vpickList = document.getElementById('vpickList');
        const plateBox = document.getElementById('plateBox');
        this.renderVehiclePicks();
        this.renderPlateBox();

        vpickList.addEventListener('click', (ev) => {
          const card = ev.target.closest('.vpick');
          if (!card) return;
          vehicleSelect.value = card.dataset.idx;
          this.plateFormOpen = false;      // เปลี่ยนคันแล้วปิดฟอร์มทะเบียนที่ค้างไว้
          this.renderVehiclePicks();
          this.renderPlateBox();
          updateCurrentPoint();            // อัปเดตแต้มของคันที่เลือกใหม่
        });

        // ปุ่มในกล่องทะเบียนถูกวาดใหม่เรื่อย ๆ จึงฟังที่กล่องแม่ตัวเดียว
        plateBox.addEventListener('click', (ev) => {
          const t = ev.target.closest('button');
          if (!t) return;

          if (t.id === 'plateAddBtn' || t.id === 'plateEditBtn') {
            this.plateFormOpen = true;
            this.renderPlateBox();
            const h = document.getElementById('apHead');
            if (h) h.focus();
          } else if (t.id === 'apSkip') {
            this.plateFormOpen = false;
            this.renderPlateBox();
          } else if (t.id === 'apSave') {
            this.savePlate(t);
          }
        });

        // ตัวอย่างป้ายที่อัปเดตตามที่พิมพ์ (ฟังที่กล่องแม่เหมือนกัน)
        const paintPlatePreview = () => {
          const head = document.getElementById('apHead');
          const tail = document.getElementById('apTail');
          const prov = document.getElementById('apProv');
          const prev = document.getElementById('apPreview');
          if (!head || !prev || typeof platePretty !== 'function') return;
          const plate = platePretty(head.value, tail.value);
          if (plate) {
            prev.innerHTML = plateHtml(plate, prov ? prov.value : '', true);
            prev.hidden = false;
          } else {
            prev.innerHTML = '';
            prev.hidden = true;
          }
        };
        plateBox.addEventListener('input', (ev) => {
          if (ev.target.id === 'apTail') {
            const c = ev.target.value.replace(/\D/g, '').slice(0, 4);
            if (ev.target.value !== c) ev.target.value = c;
          }
          // หมวดรับแต่เลขกับพยัญชนะไทย กันพิมพ์อังกฤษตั้งแต่แรก
          if (ev.target.id === 'apHead' && typeof plateCleanHead === 'function') {
            const c = plateCleanHead(ev.target.value);
            if (ev.target.value !== c) {
              const pos = ev.target.selectionStart || 0;
              const cut = pos - plateCleanHead(ev.target.value.slice(0, pos)).length;
              ev.target.value = c;
              try { ev.target.setSelectionRange(pos - cut, pos - cut); } catch (e) {}
            }
          }
          paintPlatePreview();
        });
        plateBox.addEventListener('change', (ev) => {
          if (ev.target.id === 'apProv') paintPlatePreview();
        });
  
        // แถบเลือกวิธีชำระ — เห็นทั้ง 2 ทางเลือกพร้อมกัน และรู้ว่าตอนนี้อยู่โหมดไหน
        // ของเดิมเป็นปุ่มเดียวที่กดสลับไปมา ซึ่งชวนสับสนว่ากดแล้วบันทึกเลยหรือเปล่า
        const setMode = (redeem) => {
          this.isRedeeming = redeem;
          modeCash.classList.toggle('is-on', !redeem);
          modePts.classList.toggle('is-on', redeem);
          priceInput.placeholder = redeem ? 'จำนวนแต้มที่ใช้' : 'ราคา (บาท)';
          updatePointDisplay();
        };
        modeCash.addEventListener('click', () => setMode(false));
        modePts.addEventListener('click', () => setMode(true));

        // ── รายการบริการให้แตะเลือก ─────────────────────────────────────
        const serviceInput = document.getElementById('serviceName');
        const svcChips = document.getElementById('svcChips');

        this.svcFilter = '';
        this.renderServiceChips();

        // พิมพ์ = กรองรายการ (ค่าที่เลือกไว้คือค่าในช่องเสมอ)
        serviceInput.addEventListener('input', () => {
          this.svcFilter = serviceInput.value;
          this.renderServiceChips();
        });

        // ใช้ตัวฟังตัวเดียวที่กล่องแม่ เพราะปุ่มถูกวาดใหม่ทุกครั้ง
        svcChips.addEventListener('click', (ev) => {
          const chip = ev.target.closest('.svc-chip');
          if (!chip) return;

          const name = chip.dataset.name || '';
          const isSame = serviceInput.value.trim() === name;

          // เลิกเติมราคาให้อัตโนมัติ (13 ก.ย. 2569)
          // เมื่อไม่โชว์ราคาบนปุ่มแล้ว การแอบเติมเลขลงช่องราคาจะยิ่งชวนสับสน
          // เพราะแอดมินจะไม่รู้ว่าเลขนั้นมาจากไหน · ปุ่มมีหน้าที่เลือกชื่อบริการอย่างเดียว
          // ราคาพิมพ์เองทุกครั้ง ชัดเจนและไม่มีทางบันทึกราคาผิดจากราคาเก่าในชีต
          serviceInput.value = isSame ? '' : name;   // แตะซ้ำที่ตัวเดิม = ยกเลิก

          // ล้างคำค้นเสมอ เพื่อให้รายการเต็มยังอยู่ เปลี่ยนใจได้ทันที
          this.svcFilter = '';
          this.renderServiceChips();
          updatePointDisplay();
        });

        // ── เติมค่าที่กรอกไว้กลับ ถ้ากดกลับไปแก้มาจากหน้ายืนยัน ──────────
        // ต้องทำหลังผูกตัวฟังทั้งหมดแล้ว เพื่อให้ setMode/updateCurrentPoint
        // คำนวณจากค่าที่เติมกลับเข้าไปได้ถูกต้อง
        const d = this.draft;
        if (d) {
          this.draft = null;                       // ใช้ครั้งเดียวแล้วทิ้ง
          vehicleSelect.value = String(d.vehicleIndex || 0);
          serviceInput.value = d.serviceName || '';
          priceInput.value = d.price || '';
          const noteEl = document.getElementById('noteInput');
          if (noteEl) noteEl.value = d.note || '';
          this.renderVehiclePicks();
          this.renderPlateBox();
          this.renderServiceChips();
          setMode(!!d.isRedeeming);                // คืนโหมดจ่ายเงิน/แลกแต้ม
        } else {
          setMode(false);       // เปิดใหม่ปกติ เริ่มที่จ่ายเงินเสมอ
        }
        updateCurrentPoint();   // โหลดครั้งแรก
      },
      // ตรวจและเก็บค่าเท่านั้น ห้ามเปิดป๊อปอัปอื่นในนี้เด็ดขาด (ดูคำอธิบายที่ collectForm)
      preConfirm: () => this.collectForm()
    }).then(result => {
      if (result.isConfirmed && result.value) {
        // ฟอร์มผ่านแล้วและป๊อปอัปปิดไปแล้ว -> ค่อยถามยืนยันและบันทึก
        this.confirmAndSave(result.value);
        return;
      }
      // ปิดหน้านี้โดยไม่ได้บันทึก -> กลับไปพร้อมสแกนคนถัดไป
      if (result.isDismissed) this.resetToScan();
    });
  }
}

//----------------------------------------------------------------- main admin --------------------------------------------------
class AdminManager {
  constructor() {
    this.userId = "N/A";
    this.name = "-";
    this.statusMessage = "";
    this.pictureUrl = "";
    this.token = "N/A";
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ทำให้เข้าหน้าแอดมินไวขึ้น (14 ก.ย. 2569)
  //
  //  ของเดิมกว่าหน้าจะโผล่ ต้องรอ Apps Script ถึง 3 ครั้ง
  //    1. update_line_profile  } ยิงขนานกัน แต่ await ทั้งคู่
  //    2. check_admin          }   จึงช้าเท่าตัวที่ช้ากว่า
  //    3. log_admin            await ต่อท้ายอีก ก่อนจะ display:block
  //  Apps Script ตอบช้าครั้งละ 1-5 วินาที รวมแล้วลูกค้ายืนรอจนไม่รอ
  //
  //  แก้ 3 อย่าง
  //    ก. update_line_profile  ไม่ await แล้ว — หน้าจอไม่ได้ใช้ผลลัพธ์เลย
  //    ข. log_admin            ไม่ await แล้ว — เป็นแค่ log ไม่ใช่ของที่ต้องรอ
  //    ค. check_admin          จำผลไว้ใน localStorage ของเครื่องนั้น
  //       เปิดครั้งถัดไปแสดงหน้าทันทีจากของที่จำไว้ (ไม่รอเน็ตเลย)
  //       แล้วค่อยตรวจซ้ำเบื้องหลัง ถ้าสิทธิ์เปลี่ยนค่อยปิดหน้าต่าง
  //
  //  ⚠️ การแสดงหน้าจากของที่จำไว้ ไม่ได้ลดความปลอดภัยลงเลย
  //     เพราะการ "เห็นหน้าจอ" ไม่ใช่ด่านกันอะไรอยู่แล้ว
  //     ทุกคำสั่งที่เขียนข้อมูลถูกตรวจสิทธิ์ที่เซิร์ฟเวอร์ทุกครั้ง (security.gs)
  //     คนที่ไม่ใช่แอดมินเห็นหน้าจอก็ทำอะไรไม่ได้ และจะโดนปิดหน้าต่างใน 2-3 วินาที
  // ═══════════════════════════════════════════════════════════════════════

  adminCacheKey() { return 'bcAdmin_' + this.userId; }

  readAdminCache() {
    try {
      const raw = localStorage.getItem(this.adminCacheKey());
      if (!raw) return null;
      const c = JSON.parse(raw);
      // เก็บไว้ 12 ชั่วโมง พอสำหรับ 1 กะการทำงาน
      if (!c || !c.at || Date.now() - c.at > 12 * 60 * 60 * 1000) return null;
      return c;
    } catch (e) { return null; }
  }

  writeAdminCache(result) {
    try {
      localStorage.setItem(this.adminCacheKey(), JSON.stringify({
        isAdmin: true, name: result.name, role: result.role, level: result.level, at: Date.now()
      }));
    } catch (e) { /* โหมดส่วนตัวเขียนไม่ได้ ไม่เป็นไร แค่ช้าเหมือนเดิม */ }
  }

  clearAdminCache() {
    try { localStorage.removeItem(this.adminCacheKey()); } catch (e) {}
  }

  async init() {
    try {
      Swal.fire({
        title: 'กำลังโหลด...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
      });

      await liff.init({ liffId: window.liffId });
      if (!liff.isLoggedIn()) return liff.login();

      const profile = await liff.getProfile();
      this.userId = profile.userId;
      this.name = profile.displayName;
      this.statusMessage = profile.statusMessage || "";
      this.pictureUrl = profile.pictureUrl || "";

      if (liff.getIDToken && typeof liff.getIDToken === 'function') {
        this.token = await liff.getIDToken();
      }

      // ── อัปเดตโปรไฟล์ LINE เบื้องหลัง ไม่ต้องรอ ──────────────────────
      // หน้าจอไม่ได้ใช้ผลลัพธ์ของมันเลย เอาออกจากทางวิ่งหลักได้ทันที
      this.updateLineProfile(profile);

      // ── เคยเข้ามาแล้ว -> แสดงหน้าทันที ไม่รอเน็ต ────────────────────
      const cached = this.readAdminCache();
      if (cached) {
        Swal.close();
        this.applyAdmin(cached);
        this.checkAdmin(true);        // ตรวจซ้ำเบื้องหลัง เผื่อสิทธิ์เปลี่ยน
      } else {
        await this.checkAdmin(false); // ครั้งแรกของเครื่องนี้ ต้องรอรอบเดียว
      }

    } catch (err) {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'โหลดข้อมูลผู้ดูแลไม่สำเร็จ',
        confirmButtonText: 'ปิดหน้าต่าง'
      }).then(() => liff.closeWindow());
      console.error(err);
    }
  }

  async updateLineProfile(profile) {
    try {
      const payload = {
        action: 'update_line_profile',
        userId: profile.userId,
        nameLine: profile.displayName,
        statusMessage: profile.statusMessage || "",
        pictureUrl: profile.pictureUrl || ""
      };

      const res = await fetch(GAS_ENDPOINT + '?action=update_line_profile', {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log("✅ LINE Profile อัปเดตอัตโนมัติ:", data);
    } catch (err) {
      console.warn("⚠️ อัปเดตโปรไฟล์ LINE ล้มเหลว:", err);
    }
  }

  // ถามเซิร์ฟเวอร์ว่าเป็นแอดมินไหม
  // background = true คือเรียกซ้ำเบื้องหลังหลังแสดงหน้าจากของที่จำไว้แล้ว
  async checkAdmin(background) {
    let result;
    try {
      const res = await fetch(`${GAS_ENDPOINT}?action=check_admin&userId=${this.userId}&name=${encodeURIComponent(this.name)}&statusMessage=${encodeURIComponent(this.statusMessage)}&pictureUrl=${encodeURIComponent(this.pictureUrl)}`);
      result = await res.json();
    } catch (err) {
      // ตรวจเบื้องหลังแล้วเน็ตสะดุด -> เงียบไว้ หน้าที่แสดงอยู่ยังใช้ได้
      // ถ้าสิทธิ์ถูกถอนจริง เซิร์ฟเวอร์จะบล็อกตอนกดบันทึกอยู่ดี
      if (background) { console.warn('ตรวจสิทธิ์เบื้องหลังไม่สำเร็จ (ข้ามไป):', err); return; }
      throw err;
    }

    if (!background) Swal.close();

    if (result.blacklisted || !result.isAdmin) {
      // สิทธิ์ถูกถอนไปแล้ว -> ล้างของที่จำไว้ ไม่งั้นเปิดครั้งหน้าจะยังเห็นหน้าอยู่
      this.clearAdminCache();
      return Swal.fire({
        icon: 'error',
        title: result.blacklisted ? '🚫 ถูกจำกัดสิทธิ์' : '❌ ไม่ใช่ผู้ดูแลระบบ',
        text: result.blacklisted
          ? 'คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้'
          : 'ระบบจำกัดเฉพาะผู้ที่ได้รับอนุญาต',
        confirmButtonText: 'ปิดหน้าต่าง'
      }).then(() => liff.closeWindow());
    }

    this.writeAdminCache(result);

    // log การเข้าใช้งาน — ไม่ await เพราะเป็นแค่บันทึก ไม่ใช่ของที่หน้าจอต้องรอ
    // ของเดิม await ตรงนี้ = รอ Apps Script อีกหนึ่งรอบเต็ม ๆ ก่อนหน้าจะโผล่
    this.logAction(result.name, 'เข้าสู่ระบบ', 'มีการเข้าใช้งานหน้า admin');

    // แสดงหน้าจากผลจริง (ถ้าแสดงจากของที่จำไว้ไปแล้ว จะอัปเดตให้ตรงของจริง)
    this.applyAdmin(result);
  }

  // วาดหน้าจอตามสิทธิ์ — เรียกซ้ำได้ ไม่ผูกตัวฟังซ้ำ
  applyAdmin(result) {
    document.body.style.display = 'block';
    document.getElementById('adminName').textContent = result.name || 'ไม่ทราบชื่อ';
    document.getElementById('adminLevel').textContent = result.level || '1';
    document.getElementById('adminRole').textContent = result.role || '-';

    // ── เมนูตามระดับสิทธิ์ (แก้ 18 ก.ย. 2569) ─────────────────────────────
    //
    //   ระดับ 2 (พนักงานหน้าร้าน) : 🔍 สแกน QR + 🔐 ตรวจความปลอดภัย เท่านั้น
    //   ระดับ 3 ขึ้นไป            : เห็นเมนูอื่นทั้งหมด
    //
    //   ⚠️ นี่เป็นแค่การ "ซ่อนปุ่ม" ไม่ใช่ด่านกัน
    //      คนที่รู้ URL ยังพิมพ์เข้ามาเองได้ ด่านจริงต้องอยู่ที่เซิร์ฟเวอร์
    //      หน้าสรุปยอดตรวจ STATS_MIN_LEVEL ใน stats.gs อยู่แล้ว
    //      ถ้าเพิ่มเมนูใหม่ที่มีข้อมูลสำคัญ ต้องไปใส่ด่านฝั่งเซิร์ฟเวอร์ด้วยเสมอ
    //      (ส่วนหน้าข้อมูลร้านไม่ต้อง เพราะเป็นหน้าที่ลูกค้าทุกคนเห็นได้อยู่แล้ว
    //       ซ่อนไว้เพื่อให้จอพนักงานสะอาด ไม่ใช่เพื่อความปลอดภัย)
    const level = parseInt(result.level || '1');
    if (level >= 2) document.getElementById('scanBtn')?.classList.remove("hidden");
    if (level >= 3) {
      document.querySelector('[data-menu="stats"]')?.classList.remove("hidden");
      document.querySelector('[data-menu="shopinfo"]')?.classList.remove("hidden");
      document.querySelector('[data-menu="feedback"]')?.classList.remove("hidden");
    }
    if (level >= 5) document.querySelector('[data-menu="settings"]')?.classList.remove("hidden");

    // ใส่ชื่อจาก Admin_List (result.name) ไม่ใช่ชื่อ LINE
    // เพราะชื่อนี้คือชื่อที่จะถูกบันทึกลงคอลัมน์ "แอดมิน" ใน Service_History
    // ของเดิมใส่ชื่อ LINE ทำให้ข้อมูลไม่ตรงกับที่ showSecurityStatus แสดง
    // และถ้าแอดมินเปลี่ยนชื่อ LINE ประวัติก็จะเรียกคนละชื่อกัน
    window.adminInfo = {
      userId: this.userId,
      name: result.name || this.name,
      token: this.token
    };

    // ปุ่มตรวจความปลอดภัย — ใช้ onclick ไม่ใช่ addEventListener
    // เพราะฟังก์ชันนี้ถูกเรียก 2 รอบได้ (จากของที่จำไว้ แล้วจากผลจริง)
    // ถ้าใช้ addEventListener ตัวฟังจะซ้อนกันแล้วยิงตรวจ 2 ครั้งต่อการกดหนึ่งที
    const secBtn = document.getElementById('secTestBtn');
    if (secBtn) {
      secBtn.classList.remove('hidden');
      secBtn.onclick = () => this.runSecuritySelfTest(secBtn);
    }

    // ทำครั้งเดียวพอ ถึงจะวาดหน้าซ้ำก็ไม่ยิงซ้ำ
    if (!this._afterReady) {
      this._afterReady = true;
      this.verifySessionQuietly();                 // ตรวจเซสชันเบื้องหลัง
      // อุ่นรายการบริการไว้ล่วงหน้า พอกดสแกนแล้วปุ่มบริการจะขึ้นทันที
      if (window.scanner?.loadServices) window.scanner.loadServices();
      // อุ่นไลบรารีสแกน QR ไว้เบื้องหลังด้วย (375 KB)
      // ทำหลังหน้าโผล่แล้ว จึงไม่หน่วงการเปิดหน้าเลย แต่พอกดสแกนก็พร้อมใช้ทันที
      ensureQrLibrary().catch(() => { /* กดสแกนแล้วค่อยลองใหม่ได้ */ });
    }
  }

  async logAction(name, action, detail) {
    try {
      const res = await fetch(GAS_ENDPOINT + '?action=log_admin', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'log_admin',
          name,
          userId: this.userId,
          actionTitle: action,
          detail,
          device: navigator.userAgent,
          token: this.token
        })
      });

      const result = await res.json();
      console.log("📘 บันทึก Admin Log:", result);
    } catch (err) {
      console.warn("❌ บันทึก Log ไม่สำเร็จ:", err);
    }
  }

  // ── ตรวจเซสชันเงียบ ๆ ตอนเปิดหน้า ────────────────────────────────────────
  //
  // ทำไมไม่ทำเป็นหน้าบังคับให้กดปุ่มก่อนเข้า:
  //   ตอนนี้เปิดโหมดบังคับ ID token ไปแล้ว ทุกครั้งที่บันทึกงานระบบตรวจอยู่แล้ว
  //   การบังคับกดก่อนเข้าจึงไม่ได้เพิ่มความปลอดภัยเลย แต่ทำให้เข้าหน้าช้าลง
  //   และยิงไปถาม LINE เพิ่มทุกครั้งที่เปิดหน้า
  //
  // สิ่งที่มีประโยชน์จริงคือ "รู้ก่อนที่ลูกค้าจะมายืนรอ"
  //   จึงตรวจเบื้องหลังแบบไม่ await -> หน้าเปิดเร็วเท่าเดิมเป๊ะ ไม่รอผลอะไรเลย
  //   ผ่านแล้วจดไว้ใน localStorage ของเครื่องนั้น วันนั้นจะไม่ยิงซ้ำอีก
  //   (ตอบคำถาม "ตรวจแล้วไม่ขึ้นอีก" — ใช่ และไม่กินเน็ตซ้ำด้วย)
  async verifySessionQuietly() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const key = 'bcSecOk_' + this.userId + '_' + today;

      // เคยผ่านแล้ววันนี้ -> ไม่ต้องยิงอะไรเลย
      try { if (localStorage.getItem(key)) return; } catch (e) { /* โหมดส่วนตัวอ่านไม่ได้ ไม่เป็นไร */ }

      const res = await fetch(`${GAS_ENDPOINT}?action=security_selftest`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'security_selftest',
          adminUserId: this.userId,
          idToken: this.token
        })
      });
      const r = await res.json();

      if (r.ok) {
        try { localStorage.setItem(key, '1'); } catch (e) {}
        return;
      }

      // ไม่ผ่าน — เตือนตอนนี้ ดีกว่าไปเจอตอนลูกค้ายืนรออยู่หน้าร้าน
      const failed = (r.checks || []).filter(c => !c.pass);
      const relog = await Swal.fire({
        icon: 'warning',
        title: '🔐 เซสชันยังไม่พร้อม',
        html: `<div style="text-align:left;font-size:13.5px">
                 ${failed.map(c => `<div style="margin:5px 0">❌ <b>${esc(c.name)}</b><br>
                   <span style="font-size:12px;color:#5A7986">${esc(c.detail || '')}</span></div>`).join('')}
               </div>
               <p style="font-size:12.5px;margin-top:10px;color:#5A7986">
                 บันทึกงานตอนนี้อาจไม่ผ่าน แนะนำให้เข้าสู่ระบบใหม่ก่อนเริ่มงาน</p>`,
        showCancelButton: true,
        confirmButtonText: 'เข้าสู่ระบบใหม่',
        cancelButtonText: 'ใช้งานต่อ'
      });
      if (relog.isConfirmed) { try { liff.login(); } catch (e) { location.reload(); } }

    } catch (err) {
      // ตรวจไม่ได้ก็ไม่เป็นไร ไม่ควรรบกวนการทำงาน
      console.warn('ตรวจเซสชันเบื้องหลังไม่สำเร็จ (ข้ามไป):', err);
    }
  }

  // ── ตรวจว่าเครื่องนี้ยืนยันตัวตนกับ LINE ได้ครบทุกข้อไหม ──────────────────
  // ตรวจอย่างเดียว ไม่แก้ข้อมูลใด ๆ
  //
  // ทำไมต้องมีปุ่มนี้: การเปิดโหมดบังคับ ID token ใน security.gs ต้องรู้ก่อนว่า
  // liff.getIDToken() ของเครื่องจริงคืน token ที่ LINE ยอมรับหรือเปล่า
  // (ขึ้นกับว่า LIFF เปิดสิทธิ์ openid ไว้ไหม) ซึ่งทดสอบจากเครื่องนักพัฒนาไม่ได้
  // แตะปุ่มนี้หนึ่งครั้งต่อเครื่อง = ได้คำตอบ และผลถูกบันทึกลง Security_Log ให้ด้วย
  async runSecuritySelfTest(btn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ กำลังตรวจ...';

    try {
      // ดึง token สดอีกครั้ง เผื่อของเดิมค้างมาตั้งแต่เปิดหน้า
      if (liff.getIDToken && typeof liff.getIDToken === 'function') {
        try { this.token = await liff.getIDToken(); } catch (e) { /* ใช้ตัวเดิม */ }
      }

      const res = await fetch(`${GAS_ENDPOINT}?action=security_selftest`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'security_selftest',
          adminUserId: this.userId,
          idToken: this.token
        })
      });
      const r = await res.json();

      const rows = (r.checks || []).map(c =>
        `<div style="display:flex;gap:8px;align-items:flex-start;text-align:left;margin:6px 0">
           <span style="flex:0 0 auto">${c.pass ? '✅' : '❌'}</span>
           <span style="flex:1">
             <b>${esc(c.name)}</b><br>
             <span style="font-size:12px;color:#5A7986">${esc(c.detail || '')}</span>
           </span>
         </div>`).join('');

      await Swal.fire({
        icon: r.ok ? 'success' : 'warning',
        title: r.ok ? '✅ ผ่านครบทุกข้อ' : '⚠️ ยังไม่ผ่านครบ',
        html: rows + `<p style="font-size:12.5px;margin-top:12px;color:#5A7986">${esc(r.message || '')}</p>` +
              (r.ok ? `<p style="font-size:12px;color:#12A594">เครื่องนี้ยืนยันตัวตนกับ LINE ได้ปกติ<br>
                       บันทึกผลไว้ในชีต Security_Log แล้ว</p>` : ''),
        confirmButtonText: 'ปิด'
      });

      // ผ่านแล้วจดไว้ วันนี้จะไม่ตรวจเบื้องหลังซ้ำอีก
      if (r.ok) {
        try {
          localStorage.setItem('bcSecOk_' + this.userId + '_' + new Date().toISOString().slice(0, 10), '1');
        } catch (e) {}
      }
    } catch (err) {
      Swal.fire('❌ ตรวจไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  logout() {
    liff.logout();
    liff.closeWindow();
  }
}

const scannerInstance = new QRScanner();
window.scanner = scannerInstance;

// ปุ่มออกจากระบบใน index.html เรียก onclick="logout()" ซึ่งต้องเป็นฟังก์ชัน global
// แต่ของเดิมประกาศ logout() ไว้เป็นเมธอดของคลาส AdminManager เท่านั้น
// กดแล้วจึงได้ Uncaught ReferenceError: logout is not defined แบบเงียบ ๆ
window.logout = function () {
  try {
    if (typeof liff !== 'undefined' && liff.logout) liff.logout();
  } catch (err) {
    console.warn('liff.logout ผิดพลาด:', err);
  }
  try {
    if (typeof liff !== 'undefined' && liff.closeWindow) liff.closeWindow();
  } catch (err) {
    console.warn('liff.closeWindow ผิดพลาด:', err);
  }
};

document.getElementById('scanBtn')?.addEventListener('click', async () => {
  if (window.scanner?.openScanPopup) {
    await window.scanner.openScanPopup();
  } else {
    Swal.fire("❌ ไม่สามารถเปิดกล้อง", "ระบบยังไม่พร้อมใช้งาน", "error");
  }
});
