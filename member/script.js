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
    
async function showQRSection() {
  
  if (!document.getElementById('qrSection').classList.contains('hidden')) {
    return; // ถ้าแสดงอยู่แล้ว ไม่ต้องสร้างใหม่
  }

  const btn = document.getElementById("qrBtn");
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = "⏳ กำลังสร้าง QR...";

  try {
    const token = generateToken();
    window.qrToken = token;
    const latestDateStr = memberData?.serviceHistory?.[0]?.date;
    const createdAt = (latestDateStr ? toBangkokISOString(parseCustomDate(latestDateStr)) : new Date().toISOString());
    const payload = {
      action: "create_token",
      token,
      userId: currentUserId,
      createdAt
    };

    const res = await fetch(GAS_ENDPOINT + '?action=create_token', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("create_token failed");

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message || "QR สร้างไม่สำเร็จ");

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

    
function generateQRCode(text, userInfo) {
  const canvas = document.getElementById("qrCanvas");
  const qr = new QRious({
    element: canvas,
    value: text,
    size: 200
  });

  //document.getElementById('qrUserInfo').innerText = `${userInfo.name} - ${userInfo.brand} ${userInfo.model} (${userInfo.year})`;
  document.getElementById('qrUserInfo').innerText = `ชื่อ: ${userInfo.name} (แจ้งรุ่นรถกับพนักงานได้เลยค่ะ)`
  document.getElementById('closeQRBtn').addEventListener('click', closeQRSection);
}

    function closeQRSection() {
      document.getElementById('qrSection').classList.add('hidden');
      document.getElementById('qrUserInfo').innerText = '';
      clearInterval(qrInterval);
      deleteQRToken();
    }


    function startQRCountdown() {
      let count = 300;
      document.getElementById("qrCountdown").textContent = count;
      qrInterval = setInterval(() => {
        count--;
        document.getElementById("qrCountdown").textContent = count;
        if (count <= 0) {
          clearInterval(qrInterval);
          deleteQRToken();
          closeQRSection();
        }
      }, 1000);
    }
    
    
    async function deleteQRToken() {
      if (!window.qrToken) return;
      await fetch(GAS_ENDPOINT + '?action=delete_token', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: "delete_token", token: window.qrToken })
      });
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
    await silentlyUpdateLineProfile(profile);

    async function silentlyUpdateLineProfile(profile) {
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

    const userId = profile.userId;
    console.log("✅ userId:", userId);
    currentUserId = userId;

    const res = await fetch(`${GAS_ENDPOINT}?action=member&userId=${userId}`);
    console.log("✅ response status:", res.status);

    if (!res.ok) {
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
    memberData = data;

    if (!data || !data.name) {
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

        // แสดงข้อมูลส่วนตัวสมาชิกด้านบน
    const userInfoHtml = `
      <div class="card">
        <p><b>ชื่อ:</b> ${data.name || "-"}</p>
        <p><b>เบอร์โทร:</b> ${formatPhone(data.vehicles[0]?.phone || "-")}</p>
      </div>
    `;
    memberInfoEl.innerHTML = userInfoHtml;

    memberInfoEl.innerHTML += data.vehicles.map(vehicle => `
      <div class="card">
        <p><b>รถ:</b> ${vehicle.brand} ${vehicle.model} (${vehicle.year})</p>
        <p><b>แต้มสะสม:</b> ${vehicle.point} แต้ม</p>
        <p><b>แต้มหมดอายุ:</b> ${vehicle.expirationDate || '-'}</p>
      </div>
    `).join('');
    

/*
    memberInfoEl.innerHTML = `
      <p><b> ชื่อ : ${data.name}</b></p>
      <p> เบอร์โทร : ${formatPhone(data.phone)}</p>
      <p> รถ : ${data.brand} ${data.model} (${data.year})</p>
      <p> หมวดหมู่ : ${data.category}</p>
      <p> แต้มสะสม : ${data.point} แต้ม</p>
      <p> แต้มหมดอายุ : ${data.expirationDate && data.expirationDate.trim() ? data.expirationDate : '-'}</p>
    `;
*/
    toggleBtn.disabled = true;
    historySection.innerHTML = '<p>⏳ กำลังโหลดประวัติ...</p>';
    toggleBtn.disabled = false;

    if (!toggleBtn.classList.contains('bound')) {
      toggleBtn.addEventListener('click', () => {
        historySection.classList.toggle('hidden');
        toggleBtn.textContent = historySection.classList.contains('hidden')
          ? '▼ ดูประวัติการใช้บริการ'
          : '▲ ซ่อนประวัติการใช้บริการ';
      });
      toggleBtn.classList.add('bound');
    }

    const history = Array.isArray(data.serviceHistory) ? data.serviceHistory : [];

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

    hideLoadingOverlay();
    toggleBtn.disabled = false;
    toggleBtn.classList.remove("disabled");
    
    // ⭐ Event listeners for Rating/Feedback interactions
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
// Add the missing closing braces for the try and document.addEventListener blocks
  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
    hideLoadingOverlay();
  } // Close the try block
}); // Close the document.addEventListener
