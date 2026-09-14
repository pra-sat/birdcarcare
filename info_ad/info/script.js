const SHEET_API = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

// ═══════════════════════════════════════════════════════════════════════════
//  ของที่จำไว้ว่าใครเป็นแอดมิน — ใช้ร่วมกับหน้าแอดมิน
//  ⚠️ คีย์และรูปแบบต้องตรงกับ info_ad/main_admin/script.js เป๊ะ ๆ
//     (adminCacheKey / readAdminCache / writeAdminCache ที่นั่น)
//     ถ้าแก้ที่ไหน ต้องแก้ทั้งสองที่ ไม่งั้นจะเด้งช้าเหมือนเดิมแบบเงียบ ๆ
// ═══════════════════════════════════════════════════════════════════════════
const ADMIN_CACHE_HOURS = 12;

function readAdminCache(userId) {
  try {
    const raw = localStorage.getItem('bcAdmin_' + userId);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.isAdmin || !c.at) return null;
    if (Date.now() - c.at > ADMIN_CACHE_HOURS * 60 * 60 * 1000) return null;
    return c;
  } catch (e) { return null; }
}

function writeAdminCache(userId, result) {
  try {
    localStorage.setItem('bcAdmin_' + userId, JSON.stringify({
      isAdmin: true, name: result.name, role: result.role, level: result.level, at: Date.now()
    }));
  } catch (e) { /* โหมดส่วนตัวเขียนไม่ได้ ก็แค่ช้าเหมือนเดิม */ }
}

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

// ── ปุ่มเปิด/ปิดฟอร์มข้อเสนอแนะ และปุ่มส่ง ─────────────────────────────────
// ต้องผูกให้ได้ทันทีที่หน้าโผล่ ห้ามรอ fetch ไป Apps Script
// ctx = { userId, name, statusMessage, pictureUrl } จาก liff.getProfile()
function setupFeedback(ctx) {
  const panel = document.getElementById('feedbackPanel');
  const openBtn = document.getElementById('openFeedbackBtn');
  const closeBtn = document.getElementById('closeLiffBtn');
  const btn = document.getElementById('submitFeedbackBtn');
  const scoreInput = document.getElementById('scoreInput');
  const feedbackInput = document.getElementById('feedbackInput');
  if (!panel || !openBtn || !btn) {
    console.error('setupFeedback: หา element ไม่เจอ');
    return;
  }

  // กดปุ่มเดิมซ้ำเพื่อปิดฟอร์มได้ด้วย
  openBtn.addEventListener('click', () => {
    const willOpen = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willOpen);
    openBtn.textContent = willOpen ? '✕ ปิดฟอร์มข้อเสนอแนะ' : '✍️ ส่งข้อเสนอแนะ';
    if (willOpen) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (feedbackInput) setTimeout(() => feedbackInput.focus(), 320);
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', () => liff.closeWindow());

  btn.addEventListener('click', async () => {
    const score = scoreInput ? scoreInput.value.trim() : '';
    const feedback = feedbackInput ? feedbackInput.value.trim() : '';

    // เช็คก่อนปิดปุ่ม ไม่งั้นถ้าข้อมูลไม่ครบปุ่มจะค้างเป็น "กำลังส่ง"
    if (!feedback) {
      Swal.fire({ icon: 'warning', title: 'กรุณาพิมพ์ข้อเสนอแนะ' });
      if (feedbackInput) feedbackInput.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ กำลังส่ง...';

    const payload = {
      action: 'feedback_none',
      userId: ctx.userId,
      name: ctx.name,
      statusMessage: ctx.statusMessage,
      pictureUrl: ctx.pictureUrl,
      phone: "'0",
      score,
      feedback
    };

    try {
      const res = await fetch(`${SHEET_API}?action=feedback_none`, {
        redirect: 'follow',
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (['success', 'feedback_saved', 'entry_updated'].includes(result.status)) {
        Swal.fire({
          icon: 'success',
          title: '✅ ขอบคุณสำหรับข้อเสนอแนะ',
          confirmButtonText: 'ปิดหน้าต่าง'
        }).then(() => {
          if (scoreInput) scoreInput.value = '';
          if (feedbackInput) feedbackInput.value = '';
          liff.closeWindow();
        });
      } else {
        throw new Error(result.message || 'ไม่สามารถส่งข้อมูลได้');
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: '❌ เกิดข้อผิดพลาด', text: err.message });
      btn.disabled = false;
      btn.textContent = '✅ ส่งข้อเสนอแนะ';
    }
  });
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

    // ═══════════════════════════════════════════════════════════════════
    //  🔴 ทางลัดของแอดมิน (14 ก.ย. 2569)
    //
    //  แอดมินไม่ได้เปิดหน้าแอดมินตรง ๆ แต่เข้าทางหน้านี้ก่อนแล้วค่อยเด้งต่อ
    //  ของเดิมกว่าจะเด้งได้ ต้องรอ Apps Script 2 รอบเรียงกัน
    //     1. feedback_none  (บันทึกยอดเข้าดู — ไม่เกี่ยวกับการเด้งเลย)
    //     2. check_admin
    //  แอดมินจึงต้องนั่งดูหน้าข้อมูลร้านค้างอยู่หลายวินาทีทุกครั้ง
    //
    //  ถ้าเครื่องนี้เคยยืนยันแล้วว่าเป็นแอดมิน ให้เด้งทันทีโดยไม่ต้องรอเน็ตเลย
    //  ใช้ของที่หน้าแอดมินจำไว้ร่วมกัน (คีย์ bcAdmin_<userId>)
    //  ⚠️ รูปแบบและคีย์ต้องตรงกับ info_ad/main_admin/script.js เป๊ะ ๆ
    //
    //  ปลอดภัย เพราะการเด้งไปหน้าแอดมินไม่ได้ให้สิทธิ์อะไร
    //  หน้าแอดมินตรวจซ้ำเบื้องหลังเองอยู่แล้ว และทุกคำสั่งที่เขียนข้อมูล
    //  ถูกตรวจสิทธิ์ที่เซิร์ฟเวอร์ทุกครั้ง
    // ═══════════════════════════════════════════════════════════════════
    const goAdmin = () => {
      // replace ไม่ใช่ href — ไม่งั้นกดย้อนกลับจะเด้งไปมาระหว่างสองหน้า
      window.location.replace('../main_admin/index.html');
    };

    if (readAdminCache(userId)) {
      // ไม่ต้องแสดงหน้าข้อมูลร้านเลย บอกแค่ว่ากำลังพาไป
      const t = document.getElementById('loadingText');
      if (t) t.textContent = '⏳ กำลังเข้าหน้าผู้ดูแล...';
      goAdmin();
      return;
    }

    document.getElementById('userView').classList.remove('hidden');
    loading.classList.add('hidden');
    document.getElementById('loadingOverlay').classList.add('hidden');

    // ── ผูกปุ่มทั้งหมดตรงนี้ ก่อนยิง fetch ไป Apps Script ─────────────────
    // 🔴 บั๊กที่แก้ 13 ก.ย. 2569:
    //    ของเดิมผูกตัวฟังปุ่ม "ส่งข้อเสนอแนะ" ไว้ข้างล่าง หลัง await fetch 2 ครั้ง
    //    (feedback_none แล้ว check_admin · timeout 10 วินาทีต่อครั้ง)
    //    ระหว่างนั้นหน้าเว็บโผล่แล้วแต่ปุ่มยังไม่มีตัวฟัง กดไปก็ไม่มีอะไรเกิดขึ้น
    //    ข้อมูลที่ตัวฟังต้องใช้มีแค่ profile ซึ่งได้มาแล้วตรงนี้ จึงย้ายขึ้นมาผูกก่อน
    setupMapToggle();
    setupStarPicker();
    setupFeedback({ userId, name, statusMessage, pictureUrl });


    // ── บันทึกว่ามีคนเข้ามาดู — ยิงแล้วไม่รอผล ────────────────────────────
    // 🔴 แก้ 14 ก.ย. 2569: ของเดิม await ตัวนี้ "ก่อน" ตรวจแอดมิน
    //    แอดมินจึงต้องรอ Apps Script รอบเต็ม ๆ ก่อนถึงจะเริ่มตรวจสิทธิ์ด้วยซ้ำ
    //    ทั้งที่การบันทึกยอดเข้าดูไม่เกี่ยวกับการเด้งไปหน้าแอดมินเลย
    fetch(`${SHEET_API}?action=feedback_none`, {
      redirect: "follow",
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        userId, name, statusMessage, pictureUrl,
        phone: "'0", score: "", feedback: ""
      })
    }).catch(e => console.warn("⚠️ บันทึกยอดเข้าดูไม่สำเร็จ (ข้ามไป):", e.message));

    // ── ตรวจว่าเป็นแอดมินไหม ถ้าใช่ให้เด้งไปหน้าแอดมิน ──────────────────
    // ตรวจก่อนเป็นอย่างแรกเลย เพราะเป็นสิ่งเดียวที่กั้นการเด้งอยู่
    // ล้มเหลวก็ปล่อยให้เห็นหน้าลูกค้าไปก่อน ดีกว่าปิดหน้าต่างทิ้ง
    try {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 10000);
      const res2 = await fetch(`${SHEET_API}?action=check_admin`, {
        redirect: "follow",
        method: 'POST',
        signal: c2.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ userId, name, statusMessage, pictureUrl })
      });
      clearTimeout(t2);
      const checkResult = await res2.json();
      console.log("✅ ตรวจสอบแอดมิน:", checkResult);
      if (checkResult.isAdmin) {
        // จำไว้ด้วย ครั้งหน้าจะเด้งได้ทันทีโดยไม่ต้องรอเน็ต
        // และหน้าแอดมินก็ใช้ของชิ้นเดียวกันนี้ ไม่ต้องถามซ้ำอีกรอบ
        writeAdminCache(userId, checkResult);
        goAdmin();
      }
    } catch (e) {
      console.warn("⚠️ ตรวจสอบแอดมินไม่สำเร็จ (แสดงหน้าลูกค้าต่อ):", e.message);
    }

  } catch (err) {
    // เหลือแต่ความผิดพลาดของ LIFF เองเท่านั้น (init / getProfile)
    // กรณีนั้นทำอะไรต่อไม่ได้จริง ๆ จึงปิดหน้าต่าง
    console.error('❌ LIFF Init Error:', err);
    Swal.fire({
      icon: 'error',
      title: '❗️เปิดหน้านี้ไม่สำเร็จ',
      text: 'กรุณาลองใหม่อีกครั้ง หรือแจ้ง Admin',
      confirmButtonText: 'ปิด'
    }).then(() => liff.closeWindow());
  } finally {
    loading.classList.add('hidden');
  }
});
