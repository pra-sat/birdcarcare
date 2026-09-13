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

      // ชั้น 1 — ขอกล้องหลังตรง ๆ จากเบราว์เซอร์
      // แม่นที่สุดเพราะไม่ขึ้นกับชื่อกล้องหรือภาษาของเครื่อง
      try {
        await this.html5QrCode.start({ facingMode: { exact: "environment" } }, cfg, onOk);
        this.cameraList = await Html5Qrcode.getCameras().catch(() => []);
        this.currentCameraIndex = 0;
        return;
      } catch (errExact) {
        // เครื่องนี้ไม่มีกล้องหลัง (เช่นคอมพิวเตอร์) หรือไม่รองรับ exact -> ลองชั้นถัดไป
      }

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) throw new Error('ไม่พบกล้อง');
      this.cameraList = cameras;

      // ชั้น 2 — หาจากชื่อกล้องที่มีคำว่า back / rear / environment / หลัง
      const back = cameras.find(c => /back|rear|environment|หลัง/i.test(c.label || ''));

      // ชั้น 3 — ไม่เจอจริง ๆ ค่อยใช้ตัวแรกเหมือนโค้ดเดิม
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

  async manualSearch() {
    const phone = document.getElementById('manualPhone').value;
    if (!phone) return;
    Swal.fire({ title: '🔍 กำลังค้นหา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const res = await fetch(`${GAS_ENDPOINT}?action=search_phone&phone=${phone}`);
    const result = await res.json();
    Swal.close();

    if (!result.success) return Swal.fire('ไม่พบข้อมูลลูกค้า', '', 'error');
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
  
    const res = await fetch(`${GAS_ENDPOINT}?action=verify_token&token=${token}`);
    const result = await res.json();
    Swal.close();
  
    if (!result.success) {
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
    fetch(`${GAS_ENDPOINT}?action=service_list`)
      .then(res => res.json())
      .then(data => {
        this.serviceList = data;
        const datalist = document.createElement('datalist');
        datalist.id = 'serviceOptions';
        data.forEach(item => {
          const opt = document.createElement('option');
          opt.value = item.name;
          datalist.appendChild(opt);
        });
        document.body.appendChild(datalist);
      });
  }

  showCustomerPopup() {
    this.isRedeeming = false;
    this.currentPoint = 0;
  
    const vehicleOptions = this.foundUser.vehicles.map((v, i) =>
      `<option value="${i}">${esc(v.Brand)} ${esc(v.Model)} (${esc(v.Year)}) - ${esc(v.point)} แต้ม</option>`
    ).join('');

    Swal.fire({
      title: 'ข้อมูลลูกค้า',
      html: `
        <p>ชื่อ: ${esc(this.foundUser.Name)}</p>
        <p>เบอร์: ${esc(this.foundUser.Phone)}</p>
        <p>รถ: <select id="vehicleSelect" class="swal2-input">${vehicleOptions}</select></p>
        <input list="serviceOptions" id="serviceName" placeholder="ชื่อบริการ" class="swal2-input">
        <input type="number" id="priceInput" placeholder="ราคา" class="swal2-input">
        <button id="redeemBtn" class="swal2-confirm" style="margin-bottom: 6px;">🎁 แลกแต้ม</button>
        <p id="pointInfo">แต้มที่จะได้: <span id="pointPreview">0</span></p>
        <input type="text" id="noteInput" placeholder="หมายเหตุ" class="swal2-input">
      `,
      confirmButtonText: 'บันทึก',
      didOpen: () => {
        const priceInput = document.getElementById('priceInput');
        const pointPreview = document.getElementById('pointPreview');
        const pointInfo = document.getElementById('pointInfo');
        const redeemBtn = document.getElementById('redeemBtn');
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
  
        // ปุ่มสลับโหมดแลกแต้ม
        redeemBtn.addEventListener('click', () => {
          this.isRedeeming = !this.isRedeeming;
          redeemBtn.classList.toggle('redeem-active', this.isRedeeming);
          redeemBtn.textContent = this.isRedeeming ? '🟣 ใช้แต้มสะสม' : '🎁 แลกแต้ม';
          priceInput.placeholder = this.isRedeeming ? "จำนวนแต้มที่ใช้" : "ราคา";
          updatePointDisplay();
        });
  
        updateCurrentPoint(); // โหลดครั้งแรก
      },
      preConfirm: () => this.onServiceSave()
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
