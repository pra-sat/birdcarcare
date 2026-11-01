// ✅ script.js - สำหรับหน้า Service Management (เวอร์ชันปรับปรุงแบบละเอียด)

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

let userId = "N/A";
let currentAdmin = {}; // เก็บข้อมูล admin หลัง login
let currentService = null; // บริการที่ถูกเลือกปัจจุบัน

function logout() {
  liff.logout();
  liff.closeWindow();
}

function showLoading() {
  Swal.fire({
    title: 'กำลังโหลดข้อมูล...',
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });
}

function hideLoading() {
  Swal.close();
}

function showError(message) {
  Swal.fire({
    icon: 'error',
    title: 'เกิดข้อผิดพลาด',
    text: message,
    confirmButtonText: 'ปิด'
  });
}

function openAddPopup() {
  document.getElementById('addPopup').classList.remove('hidden');
}

function closeAddPopup() {
  document.getElementById('addPopup').classList.add('hidden');
}

function closeViewPopup() {
  document.getElementById('viewPopup').classList.add('hidden');
  document.getElementById('saveBtn').classList.add('hidden');
  document.getElementById('editBtn').classList.remove('hidden');
  toggleEditMode(false);
}

function toggleServiceList() {
  document.getElementById('serviceList').classList.toggle('hidden');
}

function toggleServiceStatus() {
  // ไม่ต้องทำอะไรเลยถ้ายังไม่ได้ enable edit
  // หรือจะเอาไว้ future use ก็ได้
}

async function logAdminAction(action, detail) {
  try {
    await fetch(GAS_ENDPOINT + '?action=log_admin', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'log_admin',
        name: currentAdmin.name,
        userId: userId,
        actionTitle: action,
        detail: detail,
        device: navigator.userAgent,
        token: await liff.getIDToken()
      })
    });
  } catch (err) {
    console.warn('Log failed:', err);
  }
}

function createServiceCard(service) {
  const card = document.createElement('div');
  card.className = 'service-card';
  card.draggable = true;
  card.dataset.id = service.serviceId;
  card.innerHTML = `
    <h3>${service.name}</h3>
    <p>ราคา: ${service.price} บาท</p>
    <p>แต้ม: ${service.point}</p>
    <p>รายละเอียด: ${service.detail}</p>
    <label class="toggle-switch">
      <input type="checkbox" ${service.status === 'on' ? 'checked' : ''} data-id="${service.serviceId}">
      <span class="slider"></span>
    </label>
  `;
  card.addEventListener('click', () => showServiceDetailPopup(service));
  card.addEventListener('dragstart', dragStart);
  card.addEventListener('dragover', dragOver);
  card.addEventListener('drop', drop);
  return card;
}

function renderServiceList(list) {
  const listEl = document.getElementById('serviceList');
  listEl.innerHTML = '';
  list.forEach(service => listEl.appendChild(createServiceCard(service)));
  listEl.classList.remove('hidden');
}

async function fetchServices() {
  showLoading();
  try {
    const res = await fetch(GAS_ENDPOINT + '?action=service&sub_action=get_service_list');
    const data = await res.json();
    renderServiceList(data.services);
    await logAdminAction('เปิดดูบริการทั้งหมด', 'โหลดข้อมูลจาก Service_List');
  } catch (err) {
    console.error(err);
    showError('โหลดรายการบริการไม่สำเร็จ');
  } finally {
    hideLoading();
  }
}

async function submitAddService() {
  const name = document.getElementById('addName').value.trim();
  const price = document.getElementById('addPrice').value.trim();
  const point = document.getElementById('addPoint').value.trim();
  const detail = document.getElementById('addDetail').value.trim();

  if (!name || !price || !point) {
    showError('กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  showLoading();
  try {
    const payload = {
      action: 'add_service',
      name,
      price,
      point,
      detail,
      createdBy: currentAdmin.name
    };

    const res = await fetch(GAS_ENDPOINT + '?action=service', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
        if (result.status !== 'success') {
      showError(result.message || 'ไม่สามารถเพิ่ม/แก้ไขข้อมูลได้');
      return;
    }
    await logAdminAction('เพิ่มบริการ', `ชื่อ: ${name}, ราคา: ${price}, แต้ม: ${point}`);
    closeAddPopup(); // สำหรับ add
    fetchServices();
  } catch (err) {
    console.error(err);
    showError('ไม่สามารถเพิ่มบริการได้');
  } finally {
    hideLoading();
  }
}

function showServiceDetailPopup(service) {
  currentService = service;
  document.getElementById('popupTitle').textContent = `📄 รายละเอียดบริการ`;
  document.getElementById('viewName').value = service.name;
  document.getElementById('viewPrice').value = service.price;
  document.getElementById('viewPoint').value = service.point;
  document.getElementById('viewDetail').value = service.detail;
  document.getElementById('viewStatus').checked = (service.status === 'on');
  document.getElementById('viewPopup').classList.remove('hidden');
  document.getElementById('viewPopup').dataset.serviceId = service.serviceId;
}

function toggleEditMode(enable = true) {
  document.getElementById('viewName').disabled = !enable;
  document.getElementById('viewPrice').disabled = !enable;
  document.getElementById('viewPoint').disabled = !enable;
  document.getElementById('viewDetail').disabled = !enable;

  document.getElementById('editBtn').classList.toggle('hidden', enable);
  document.getElementById('saveBtn').classList.toggle('hidden', !enable);
}


async function saveEditedService() {
  const name = document.getElementById('viewName').value.trim();
  const price = document.getElementById('viewPrice').value.trim();
  const point = document.getElementById('viewPoint').value.trim();
  const detail = document.getElementById('viewDetail').value.trim();
  const status = document.getElementById('viewStatus').checked ? 'on' : 'off';
  const serviceId = document.getElementById('viewPopup').dataset.serviceId;

  if (!name || !price || !point) {
    showError('กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  showLoading();
  try {
    const res = await fetch(GAS_ENDPOINT + '?action=service', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'update_service',
        serviceId,
        name,
        price,
        point,
        detail,
        status,
        updatedBy: currentAdmin.name
      })
    });

    const result = await res.json();
    if (result.status !== 'success') {
      showError(result.message || 'ไม่สามารถเพิ่ม/แก้ไขข้อมูลได้');
      return;
    }

    await logAdminAction('แก้ไขบริการ', `ชื่อ: ${name}, ราคา: ${price}, แต้ม: ${point}, สถานะ: ${status}`);
    closeViewPopup(); // สำหรับ save / delete
    fetchServices();
  } catch (err) {
    console.error(err);
    showError('ไม่สามารถแก้ไขบริการได้');
  } finally {
    hideLoading();
  }
}

async function deleteService() {
  const serviceId = document.getElementById('viewPopup').dataset.serviceId;

  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'ต้องการลบบริการ?',
    text: 'การลบนี้ไม่สามารถย้อนกลับได้',
    showCancelButton: true,
    confirmButtonText: 'ลบเลย',
    cancelButtonText: 'ยกเลิก'
  });

  if (!confirm.isConfirmed) return;

  showLoading();
  try {
    await fetch(GAS_ENDPOINT + '?action=service', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete_service',
        serviceId,
        adminName: currentAdmin.name,
        userId: userId,
        token: await liff.getIDToken(),
        device: navigator.userAgent
      })
    });
    await logAdminAction('ลบบริการ', `ID: ${serviceId}`);
    closeViewPopup(); // สำหรับ save / delete
    fetchServices();
  } catch (err) {
    console.error(err);
    showError('ลบบริการไม่สำเร็จ');
  } finally {
    hideLoading();
  }
}

// ✅ Drag-and-drop support
let dragSrcEl = null;

function dragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.outerHTML);
  this.classList.add('dragElem');
}

function dragOver(e) {
  e.preventDefault();
  this.classList.add('over');
}

function drop(e) {
  e.preventDefault();
  if (dragSrcEl !== this) {
    const list = document.getElementById('serviceList');
    list.insertBefore(dragSrcEl, this);
    updateServiceOrder();
  }
  this.classList.remove('over');
  dragSrcEl.classList.remove('dragElem');
}

async function updateServiceOrder() {
  const ids = [...document.querySelectorAll('#serviceList .service-card')].map(el => el.dataset.id);
  try {
    await fetch(GAS_ENDPOINT + '?action=service', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'update_order',
        order: ids
      })
    });
    await logAdminAction('เรียงลำดับบริการใหม่', ids.join(", "));
  } catch (err) {
    console.warn('อัปเดตลำดับล้มเหลว:', err);
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  closeAddPopup();
  closeViewPopup();
  document.body.classList.remove('hidden');
  showLoading();
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) return liff.login();

    const profile = await liff.getProfile();
    userId = profile.userId;

    const res = await fetch(`${GAS_ENDPOINT}?action=check_admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'check_admin', userId, idToken: liff.getIDToken(), accessToken: liff.getAccessToken() })
    });
    const result = await res.json();

    if (!result.isAdmin || result.level < 5) {
      showError('คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้');
      return;
    }

    currentAdmin = result;
    document.getElementById('adminName').textContent = result.name;
    document.getElementById('adminLevel').textContent = result.level;
    document.getElementById('adminRole').textContent = result.role;

    await logAdminAction('เข้าสู่หน้า Services', 'เปิดหน้าเมนูจัดการบริการ');
  } catch (err) {
    console.error(err);
    showError('ไม่สามารถโหลดข้อมูลผู้ดูแลได้');
  } finally {
    hideLoading();
  }

  const addBtn = document.getElementById('addServiceBtn');
  const listBtn = document.getElementById('showAllBtn');
  const backBtn = document.getElementById('backBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (addBtn) addBtn.addEventListener('click', openAddPopup);
  if (listBtn) listBtn.addEventListener('click', fetchServices);
  if (backBtn) backBtn.addEventListener('click', () => location.href = '../index.html');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
});
