// script.js - สำหรับหน้า Settings

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

let userId = "N/A";

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
  }).then(() => liff.closeWindow());
}

document.addEventListener('DOMContentLoaded', async () => {
  showLoading();
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) return liff.login();

    const profile = await liff.getProfile();
    userId = profile.userId;
    const name = profile.displayName;
    const statusMessage = profile.statusMessage || "";
    const pictureUrl = profile.pictureUrl || "";

    const res = await fetch(`${GAS_ENDPOINT}?action=check_admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'check_admin', userId, idToken: liff.getIDToken(), accessToken: liff.getAccessToken() })
    });
    const result = await res.json();

    if (!result.isAdmin || result.level < 5) {
      showError('คุณไม่มีสิทธิ์เข้าถึงเมนู Settings');
      return;
    }

    document.body.classList.remove('hidden');
    document.getElementById('adminName').textContent = result.name || '-';
    document.getElementById('adminLevel').textContent = result.level || '-';
    document.getElementById('adminRole').textContent = result.role || '-';

    hideLoading();

    await fetch(GAS_ENDPOINT + '?action=log_admin', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'log_admin',
        name: result.name,
        userId: userId,
        actionTitle: 'เข้าสู่หน้า Settings',
        detail: 'เข้าถึงเมนูการตั้งค่าระบบ',
        device: navigator.userAgent,
        token: await liff.getIDToken()
      })
    });
    
  } catch (err) {
    console.error(err);
    hideLoading();
    showError('ไม่สามารถโหลดข้อมูลได้');
  }
});
