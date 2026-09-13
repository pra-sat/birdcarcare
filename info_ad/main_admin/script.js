// script.js (main_admin)
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
window.liffId = '2007421084-2OgzWbpV';

document.addEventListener('DOMContentLoaded', () => {
  const adminManager = new AdminManager();
  adminManager.init();
});

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
    if (!this.adminUserId) await this.init();
    const { userId, name, token } = window.adminInfo || {};
    if (userId && name) {
      this.adminUserId = userId;
      this.adminName = name;
      this.token = token;
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

  async onServiceSave() {
    const name = document.getElementById('serviceName').value.trim();
    const note = document.getElementById('noteInput').value.trim();
    const vehicleSelect = document.getElementById('vehicleSelect');
    const selectedIndex = vehicleSelect ? Number(vehicleSelect.value) : 0;
    const selectedVehicle = this.foundUser.vehicles?.[selectedIndex] || {};
    const availablePoint = parseInt(selectedVehicle.point || 0);
  
    const priceInputEl = document.getElementById('priceInput');
    const priceValue = parseFloat(priceInputEl.value || '0');
    
    if (!name || priceValue <= 0) {
      Swal.showValidationMessage('กรุณากรอกชื่อบริการและราคาถูกต้อง');
      return;
    }
    
    let price = priceValue;
    let point = Math.floor(priceValue * this.pointPerBaht);
    let label = `ราคา: ${price} บาท | แต้มที่ได้: ${point}`;
    
    if (this.isRedeeming) {
      if (price > availablePoint) {
        Swal.showValidationMessage('แต้มของลูกค้าไม่เพียงพอ');
        return;
      }
      price = -price;
      point = -priceValue;
      label = `ราคา: ${Math.abs(price)} | แต้มที่ใช้: ${Math.abs(point)}`;
    }

  
    const confirmHtml = `
      <p>ชื่อ: ${esc(this.foundUser.Name)}</p>
      <p>รถ: ${esc(selectedVehicle.Brand)} ${esc(selectedVehicle.Model)} (${esc(selectedVehicle.Year)})</p>
      <p>บริการ: ${esc(name)}</p>
      <p>${esc(label)}</p>
      <p>หมายเหตุ: ${esc(note || '-')}</p>
    `;
  
    const confirm = await Swal.fire({
      title: 'ยืนยันข้อมูลก่อนส่ง?',
      html: confirmHtml,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ ยืนยัน',
      cancelButtonText: '❌ ยกเลิก'
    });
  
    if (!confirm.isConfirmed) return;
  
    Swal.fire({ title: '⏳ กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  
    const payload = {
      action: 'record_service',
      userId: this.foundUser.UserID,
      nameLine: this.foundUser.nameLine || '',
      statusMessage: this.foundUser.statusMessage || '',
      pictureUrl: this.foundUser.pictureUrl || '',
      brand: selectedVehicle.Brand || '',
      model: selectedVehicle.Model || '',
      year: selectedVehicle.Year || '',
      category: selectedVehicle.Category || '',
      serviceName: name,
      price,
      point,
      note,
      timestamp: scanner.getThaiDateTime(),
      admin: this.adminName
    };
  
    const res = await fetch(GAS_ENDPOINT + '?action=record_service', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  
    const result = await res.json();
    Swal.close();
  
    if (result.success) {
      this.logAction('บันทึกบริการ', `✅ ${name} (${price} บาท)`);
      Swal.fire('✅ บันทึกสำเร็จ', `บริการ: ${esc(name)}<br>แต้ม: ${esc(point)}`, 'success').then(() => liff.closeWindow());
    } else {
      this.logAction('บันทึกบริการ', `❌ ล้มเหลว: ${name}, เหตุ: ${result.message}`);
      Swal.fire('❌ บันทึกไม่สำเร็จ', result.message || '', 'error');
    }
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
    this.togglePopup(false); // ซ่อนหน้า scan
    setTimeout(() => this.showCustomerPopup(), 300);
  }


  loadServices() {
    // ฟังก์ชันนี้ถูกเรียก 2 ที่ (init กับ openScanPopup) ของเดิมจึงสร้าง
    // <datalist id="serviceOptions"> ซ้อนกัน 2 อัน id ชนกัน
    // ตอนนี้เลิกใช้ datalist แล้ว เก็บแต่รายการไว้ใน this.serviceList
    // แล้ววาดเป็นปุ่มให้แตะเลือกใน showCustomerPopup()
    if (this._loadingServices) return;
    this._loadingServices = true;
    fetch(`${GAS_ENDPOINT}?action=service_list`)
      .then(res => res.json())
      .then(data => { this.serviceList = Array.isArray(data) ? data : []; })
      .catch(err => console.warn('โหลดรายการบริการไม่สำเร็จ:', err))
      .finally(() => { this._loadingServices = false; });
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

    const chips = list.map(s => {
      const price = parseFloat(s.price) || 0;
      const on = String(s.name || '') === chosen ? ' is-on' : '';
      return `<button type="button" class="svc-chip${on}" data-name="${esc(s.name)}" data-price="${price}">`
        + esc(s.name)
        + (price > 0 ? `<span class="svc-price">${price}฿</span>` : '')
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
      warn.textContent = '⚠️ ' + (check.warn || 'กรอกทะเบียนให้ครบก่อนนะ');
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
          userId: this.foundUser.UserID,
          brand: v.Brand, model: v.Model, year: v.Year,
          plate, province: prov ? prov.value : '',
          admin: this.adminName
        })
      });
      const out = await res.json();
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
  
    const vehicleOptions = this.foundUser.vehicles.map((v, i) =>
      `<option value="${i}">${esc(v.Brand)} ${esc(v.Model)} (${esc(v.Year)}) - ${esc(v.point)} แต้ม</option>`
    ).join('');

    Swal.fire({
      title: 'ข้อมูลลูกค้า',
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
               onServiceSave() กับ updateCurrentPoint() อ่านค่าจาก #vehicleSelect
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
              pointInfo.textContent = `แต้มของคุณไม่พอใช้บริการนี้ค่ะ ❌`;
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
        this.svcAutoPrice = null;   // ราคาที่ "ระบบเติมให้" ครั้งล่าสุด
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
          const price = parseFloat(chip.dataset.price) || 0;
          const isSame = serviceInput.value.trim() === name;

          if (isSame) {
            // แตะซ้ำที่ตัวเดิม = ยกเลิก กลับไปเลือกใหม่ได้
            serviceInput.value = '';
            // คืนช่องราคาให้ว่างเฉพาะกรณีที่เลขนั้นระบบเติมให้เอง
            if (this.svcAutoPrice !== null && priceInput.value === String(this.svcAutoPrice)) {
              priceInput.value = '';
            }
            this.svcAutoPrice = null;
          } else {
            serviceInput.value = name;
            // เติมราคาให้เมื่อช่องยังว่าง หรือเลขเดิมเป็นเลขที่ระบบเติมให้
            // (ถ้าแอดมินพิมพ์ราคาเองไว้ จะไม่เขียนทับเด็ดขาด)
            const canFill = !priceInput.value ||
              (this.svcAutoPrice !== null && priceInput.value === String(this.svcAutoPrice));
            if (price > 0 && !this.isRedeeming && canFill) {
              priceInput.value = price;
              this.svcAutoPrice = price;
            }
          }

          // ล้างคำค้นเสมอ เพื่อให้รายการเต็มยังอยู่ เปลี่ยนใจได้ทันที
          this.svcFilter = '';
          this.renderServiceChips();
          updatePointDisplay();
        });

        setMode(false);         // เริ่มที่จ่ายเงินเสมอ
        updateCurrentPoint();   // โหลดครั้งแรก
      },
      preConfirm: () => this.onServiceSave()
    }).then(result => {
      // ปิดหน้านี้โดยไม่ได้บันทึก -> กลับไปพร้อมสแกนคนถัดไปทันที
      // ต้องเช็ค isDismissed เพราะกดบันทึกสำเร็จจะเข้า onServiceSave ซึ่งปิด LIFF ไปเอง
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

  async init() {
    //await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {});
    try {
      Swal.fire({
        title: 'กำลังโหลดข้อมูล...',
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

      await Promise.all([
        this.updateLineProfile(profile),
        this.checkAdmin()
      ]);

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

  async checkAdmin() {
    const res = await fetch(`${GAS_ENDPOINT}?action=check_admin&userId=${this.userId}&name=${encodeURIComponent(this.name)}&statusMessage=${encodeURIComponent(this.statusMessage)}&pictureUrl=${encodeURIComponent(this.pictureUrl)}`);
    const result = await res.json();

    Swal.close();

    if (result.blacklisted) {
      return Swal.fire({
        icon: 'error',
        title: '🚫 ถูกจำกัดสิทธิ์',
        text: 'คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้',
        confirmButtonText: 'ปิดหน้าต่าง'
      }).then(() => liff.closeWindow());
    }

    if (!result.isAdmin) {
      return Swal.fire({
        icon: 'error',
        title: '❌ ไม่ใช่ผู้ดูแลระบบ',
        text: 'ระบบจำกัดเฉพาะผู้ที่ได้รับอนุญาต',
        confirmButtonText: 'ปิดหน้าต่าง'
      }).then(() => liff.closeWindow());
    }

    await this.logAction(result.name, 'เข้าสู่ระบบ', 'มีการเข้าใช้งานหน้า admin');
    document.body.style.display = 'block';
    document.getElementById('adminName').textContent = result.name || 'ไม่ทราบชื่อ';
    document.getElementById('adminLevel').textContent = result.level || '1';
    document.getElementById('adminRole').textContent = result.role || '-';

    const level = parseInt(result.level || '1');
    if (level >= 1) document.querySelector('[data-menu="feedback"]')?.classList.remove("hidden");
    if (level >= 2) document.getElementById('scanBtn')?.classList.remove("hidden");{
      window.adminInfo = {
        userId: this.userId,
        name: this.name,
        token: this.token
      };
    }
    if (level >= 3) document.querySelector('[data-menu="stats"]')?.classList.remove("hidden");
    if (level >= 5) document.querySelector('[data-menu="settings"]')?.classList.remove("hidden");
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
