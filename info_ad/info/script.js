const SHEET_API = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

// ═══════════════════════════════════════════════════════════════════════════
//  ส่วนหน้าตา (เพิ่ม 13 ก.ย. 2569) — ไม่แตะข้อมูลที่ส่งไป Apps Script เลย
//  ทั้งสองฟังก์ชันห่อ try/catch ไว้ ถ้าพังจะไม่ลากหน้าทั้งหน้าตายไปด้วย
// ═══════════════════════════════════════════════════════════════════════════

// กดปุ่ม "แผนที่ร้าน" แล้วค่อยโหลดแผนที่
// ของเดิม iframe โหลดทุกครั้งที่เปิดหน้า กินเน็ตและทำให้หน้ากระตุก
function setupMapToggle() {
  try {
    const btn = document.getElementById('mapBtn');
    const panel = document.getElementById('mapPanel');
    const frame = document.getElementById('mapFrame');
    if (!btn || !panel || !frame) return;

    btn.addEventListener('click', () => {
      const willOpen = panel.classList.contains('hidden');
      if (willOpen && !frame.getAttribute('src')) {
        frame.setAttribute('src', frame.dataset.src || '');   // โหลดครั้งเดียว
      }
      panel.classList.toggle('hidden', !willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      btn.textContent = willOpen ? '📍 ซ่อนแผนที่' : '📍 แผนที่ร้าน';
      if (willOpen) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  } catch (e) { console.warn('setupMapToggle:', e); }
}

// ดาวกดให้คะแนน — เขียนค่าลง #scoreInput ที่โค้ดส่งข้อมูลอ่านอยู่เหมือนเดิม
function setupStarPicker() {
  try {
    const wrap = document.getElementById('starPick');
    const input = document.getElementById('scoreInput');
    const txt = document.getElementById('starText');
    if (!wrap || !input) return;

    const stars = Array.from(wrap.querySelectorAll('.sp'));
    const words = ['', 'ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก', 'ดีเยี่ยม'];

    const paint = (v) => {
      stars.forEach(s => {
        const on = Number(s.dataset.v) <= v;
        s.textContent = on ? '★' : '☆';
        s.classList.toggle('on', on);
        s.setAttribute('aria-checked', Number(s.dataset.v) === v ? 'true' : 'false');
      });
      if (txt) txt.textContent = v ? `${v} ดาว — ${words[v]}` : 'แตะดาวเพื่อให้คะแนน';
    };

    stars.forEach(s => s.addEventListener('click', () => {
      input.value = s.dataset.v;
      paint(Number(s.dataset.v));
    }));
    paint(0);
  } catch (e) { console.warn('setupStarPicker:', e); }
}

document.addEventListener('DOMContentLoaded', async () => {
  
  const loading = document.getElementById('loadingOverlay');
  
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    
    const profile = await liff.getProfile();
    const userId = profile.userId;
    const name = profile.displayName;
    const statusMessage = profile.statusMessage || "";
    const pictureUrl = profile.pictureUrl || "";

    document.getElementById('userView').classList.remove('hidden');
    loading.classList.add('hidden');
    document.getElementById('loadingOverlay').classList.add('hidden');

    // ── ปุ่มแผนที่ ───────────────────────────────────────────────────────
    // ผูกตรงนี้ (ก่อน fetch ตรวจแอดมิน) เพื่อให้ปุ่มใช้ได้ทันทีที่หน้าโผล่
    // ไม่ต้องรอเซิร์ฟเวอร์ตอบ · iframe ยังไม่มี src จนกดปุ่มครั้งแรก
    setupMapToggle();
    setupStarPicker();


    // ✅ ส่งข้อมูล LINE ก่อน
    
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 10000); // timeout 10 วินาที
    
    const sendLineRes = await fetch(`${SHEET_API}?action=feedback_none`, {
      redirect: "follow",
      method: 'POST',
      signal: controller1.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        userId, name, statusMessage, pictureUrl,
        phone: "'0", score: "", feedback: ""
      })
    });
    clearTimeout(timeoutId1);
    await sendLineRes.json();
    console.log("✅ ส่งข้อมูล LINE:", sendLineRes);

    // ✅ ตรวจสอบว่าเป็นแอดมินหรือไม่
        
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 10000); // timeout 10 วินาที
    
    const checkRes = await fetch(`${SHEET_API}?action=check_admin`, {
      redirect: "follow",
      method: 'POST',
      signal: controller2.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ userId, name, statusMessage, pictureUrl })
    });
    
    clearTimeout(timeoutId2);    
    const checkResult = await checkRes.json();

    console.log("✅ ตรวจสอบว่าเป็นแอดมินหรือไม่:", checkResult);
      
    if (checkResult.isAdmin) {
      window.location.href = '../main_admin/index.html';
    } else {
    
      const scoreInput = document.getElementById('scoreInput');
      const feedbackInput = document.getElementById('feedbackInput');
      const btn = document.getElementById('submitFeedbackBtn');

      document.getElementById('openFeedbackBtn').addEventListener('click', () => {
        document.getElementById('feedbackPanel').classList.remove('hidden');
      });

      document.getElementById('closeLiffBtn').addEventListener('click', () => {
        liff.closeWindow();
      });

      document.getElementById('submitFeedbackBtn').addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = "⏳ กำลังส่ง...";

        const score = scoreInput.value.trim();
        const feedback = feedbackInput.value.trim();
        const phone = "'0";

        if (!feedback) {
          Swal.fire({ icon: 'warning', title: 'กรุณาพิมพ์ข้อเสนอแนะ' });
          btn.disabled = false;
          btn.textContent = "✅ ส่งข้อเสนอแนะ";
          return;
        }

        const payload = {
          action: "feedback_none",
          userId, name, statusMessage, pictureUrl,
          phone, score, feedback
        };

        try {
          const res = await fetch(`${SHEET_API}?action=feedback_none`, {
            redirect: "follow",
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });

          const result = await res.json();
          if (["success", "feedback_saved", "entry_updated"].includes(result.status)) {
            Swal.fire({
              icon: 'success',
              title: '✅ ขอบคุณสำหรับข้อเสนอแนะ',
              confirmButtonText: 'ปิดหน้าต่าง',
            }).then(() => {
              scoreInput.value = "";
              feedbackInput.value = "";
              liff.closeWindow();
            });
          } else {
            throw new Error(result.message || "ไม่สามารถส่งข้อมูลได้");
          }
        } catch (err) {
          Swal.fire({ icon: 'error', title: '❌ เกิดข้อผิดพลาด', text: err.message });
          btn.disabled = false;
          btn.textContent = "✅ ส่งข้อเสนอแนะ";
        }
      });
    }
  } catch (err) {
    console.error('❌ LIFF Init Error:', err);
    await liff.closeWindow();
  } finally {
    loading.classList.add('hidden');
  }
});
