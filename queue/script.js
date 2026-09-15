// queue/script.js — ตรวจสอบคิว (15 ก.ย. 2569)
//
// หน้านี้ไม่ใช้ LIFF และไม่ต้องรู้ว่าใครเปิด — ดูคำอธิบายใน index.html
//
// ⚠️ ข้อความทุกอันในไฟล์นี้ต้องไม่ทำให้ลูกค้าเข้าใจว่าเป็นการนับรถจริง
//    ข้อมูลที่มีคือเวลา "เก็บเงิน" = ตอนรถเสร็จ ไม่ใช่ตอนรถเข้า
//    และร้านขนาดนี้ (ราว 5 คัน/วัน) แทบไม่มีคิวอยู่แล้ว
//    หน้านี้จึงไม่ทำท่าว่ามีคิวให้ตรวจ แต่บอกตรง ๆ ว่าปกติมาได้เลย

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';

const $ = id => document.getElementById(id);
const hh = h => String(h).padStart(2, '0') + ':00';
const show = (el, yes) => { if (el) el.classList.toggle('hidden', !yes); };

// ═══════════════════════════════════════════════════════════════════════════
//  สถานะร้าน เปิด/ปิด — คำนวณเองในเครื่อง ไม่ต้องรอเน็ต
//
//  เวลาทำการเป็นค่าคงที่ และเครื่องก็รู้เวลาอยู่แล้ว
//  จึงวาดได้ตั้งแต่วินาทีแรกที่หน้าเปิด ไม่ต้องรอ Apps Script ตอบ (1–5 วินาที)
//
//  ⚠️ ห้ามใช้ getHours() ตรง ๆ เพราะได้เวลาตามเขตเวลาของ "เครื่อง"
//     ลูกค้าที่ตั้งเครื่องเป็นเขตเวลาอื่นจะเห็นผิด
//     ต้องบวกออฟเซ็ตให้เป็นเวลาไทยเสมอ ไม่ว่าเครื่องจะตั้งไว้ยังไง
//
//  ถ้านาฬิกาในเครื่องเพี้ยนไปเลย ผลจาก Apps Script ที่ตามมาจะทับให้ถูกเอง
// ═══════════════════════════════════════════════════════════════════════════
const OPEN_MIN = 7 * 60 + 30;    // 07:30
const CLOSE_MIN = 17 * 60 + 30;  // 17:30
const OPEN_TEXT = 'ทุกวัน 07:30 – 17:30';

function thaiMinutesNow() {
  const d = new Date();
  // getTimezoneOffset() เป็นนาทีที่ต้องบวกเพื่อไปถึง UTC · ไทยคือ UTC+7
  const th = new Date(d.getTime() + (d.getTimezoneOffset() + 7 * 60) * 60000);
  return th.getHours() * 60 + th.getMinutes();
}

function paintShopState(openNow) {
  const mins = thaiMinutesNow();
  const open = (openNow === undefined || openNow === null)
    ? (mins >= OPEN_MIN && mins < CLOSE_MIN)
    : openNow;

  $('shopState').classList.toggle('is-shut', !open);
  $('ssTitle').textContent = open ? 'เปิดอยู่' : 'ปิดแล้ว';

  if (open) {
    const left = CLOSE_MIN - mins;
    $('ssSub').textContent = left <= 60
      ? `${OPEN_TEXT} · อีก ${left} นาทีร้านปิด`
      : OPEN_TEXT;
  } else {
    $('ssSub').textContent = mins < OPEN_MIN
      ? `${OPEN_TEXT} · เปิดอีกครั้ง 07:30 น.`
      : `${OPEN_TEXT} · เปิดอีกครั้งพรุ่งนี้ 07:30 น.`;
  }
  return open;
}

// ── จำผลไว้ในเครื่อง เพื่อไม่ให้หน้าว่างระหว่างรอเน็ต ──────────────────────
// ส่วนสถิติ (ช่วงคนน้อย กราฟ วันหยุด) แทบไม่เปลี่ยนวันต่อวัน แสดงจากของเก่าได้เลย
// ส่วนสถานะคิว "ตอนนี้" เปลี่ยนเร็ว จึงใช้ของเก่าได้แค่ถ้าเพิ่งเก็บมาไม่นาน
const CACHE_KEY = 'bcQueueSeen';
const STAT_MAX_AGE = 24 * 60 * 60 * 1000;  // สถิติ: 24 ชม.
const LIVE_MAX_AGE = 10 * 60 * 1000;       // สถานะคิว: 10 นาที

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.at || !c.data) return null;
    if (Date.now() - c.at > STAT_MAX_AGE) return null;
    return c;
  } catch (e) { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); }
  catch (e) { /* เครื่องปิด localStorage ก็แค่ช้าเหมือนเดิม */ }
}

// รวมชั่วโมงที่ติดกันให้อ่านง่าย: [15,16,17] -> "15:00–18:00"
function joinHours(list) {
  if (!list || !list.length) return '';
  const s = list.slice().sort((a, b) => a - b);
  const runs = [];
  let start = s[0], prev = s[0];
  for (let i = 1; i <= s.length; i++) {
    if (i < s.length && s[i] === prev + 1) { prev = s[i]; continue; }
    runs.push([start, prev]);
    start = prev = s[i];
  }
  return runs.map(([a, b]) => `${hh(a)}–${hh(b + 1)}`).join(' และ ');
}

async function loadQueue(silent) {
  const btn = $('refreshBtn');
  if (btn && !silent) { btn.disabled = true; btn.textContent = '⏳ กำลังดู...'; }
  try {
    const res = await fetch(`${GAS_ENDPOINT}?action=queue`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    writeCache(data);
    render(data);
    show($('updating'), false);
  } catch (err) {
    // มีของเก่าค้างจออยู่แล้ว -> ปล่อยให้ดูต่อ ดีกว่าล้างทิ้งเป็นหน้าว่าง
    if (silent || $('statusCard').dataset.painted === '1') {
      console.warn('อัปเดตไม่สำเร็จ ใช้ของที่จำไว้:', err);
      $('updating').textContent = '⚠️ เชื่อมต่อไม่ได้ · กำลังแสดงข้อมูลที่บันทึกไว้';
      show($('updating'), true);
      if (btn) { btn.disabled = false; btn.textContent = '🔄 ดูอีกครั้ง'; }
      return;
    }
    console.warn('โหลดสถานะไม่สำเร็จ:', err);
    // ไม่มี SweetAlert ในหน้านี้ (ตั้งใจไม่โหลด) เขียนลงการ์ดตรง ๆ
    $('statusDot').textContent = '⚠️';
    $('statusTitle').textContent = 'ดูสถานะไม่ได้ตอนนี้';
    $('statusSub').textContent = 'เช็คสัญญาณเน็ตแล้วกดดูอีกครั้ง หรือโทรถามร้านได้เลยค่ะ';
    $('statusCard').className = 'q-card is-closed';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 ดูอีกครั้ง'; }
  }
}

function render(d) {
  // ยืนยันสถานะร้านจากเซิร์ฟเวอร์ทับที่คำนวณไว้เอง (เผื่อนาฬิกาเครื่องเพี้ยน)
  paintShopState(d.openNow);
  $('statusCard').dataset.painted = '1';

  // ── การ์ดสถานะ ────────────────────────────────────────────────────────
  // ถ้อยคำต่างกันตามว่าร้านนี้ "มีคิวจริงไหม"
  // ร้านที่แทบไม่มีคิว การขึ้นไฟเหลืองเพราะมีรถเสร็จไป 1 คันจะทำให้เข้าใจผิด
  // ว่าต้องรอ ทั้งที่ความจริงคือเดินเข้าไปได้เลย
  let dot, title, sub, cls;

  // ⚠️ ห้ามใส่จำนวนรถลงในข้อความเหล่านี้ (เจ้าของร้านสั่ง 15 ก.ย. 2569)
  //    บอกได้แค่ว่าคึกหรือว่าง ไม่บอกว่ากี่คัน
  // ร้านปิด -> ซ่อนการ์ดคิวไปเลย แถบด้านบนบอกครบแล้ว
  // ขึ้นสองอันซ้อนกันบอกเรื่องเดียวกันไม่ได้ช่วยอะไร แค่ทำให้หน้ารก
  // ส่วนช่วงคนน้อยกับกราฟยังโชว์อยู่ เพราะเอาไว้วางแผนว่าจะมาพรุ่งนี้ตอนไหน
  if (d.status === 'closed') {
    show($('statusCard'), false);
    renderPlanning(d);
    return;
  }
  show($('statusCard'), true);

  if (d.status === 'unknown' || !d.enoughData) {
    dot = '⚪'; cls = 'is-closed';
    title = 'ยังบอกไม่ได้';
    sub = 'ยังประเมินให้ไม่ได้ตอนนี้ โทรถามร้านได้เลยค่ะ';

  } else if (d.status === 'busy') {
    dot = '🔴'; cls = 'is-busy';
    title = 'ช่วงนี้คึกกว่าปกติ';
    sub = 'มีรถเข้ามาถี่กว่าที่ร้านปกติเป็น อาจต้องรอสักหน่อย';

  } else if (d.rarelyBusy) {
    // ร้านแทบไม่มีคิว -> เขียวทั้ง free และ normal แต่ข้อความต่างกันนิดหน่อย
    dot = '🟢'; cls = 'is-free';
    title = 'ปกติมาได้เลย ไม่ต้องรอ';
    sub = d.recentActivity
      ? 'เมื่อครู่มีรถเข้ามาบ้าง อาจมีรถอยู่หน้าคุณสักคัน'
      : 'ช่วงนี้ร้านว่าง';

  } else if (d.status === 'free') {
    dot = '🟢'; cls = 'is-free';
    title = 'น่าจะไม่ต้องรอ';
    sub = 'ช่วงนี้ร้านว่าง';

  } else {
    dot = '🟡'; cls = 'is-normal';
    title = 'คนปานกลาง';
    sub = 'มีรถเข้ามาบ้างประปราย';
  }

  $('statusDot').textContent = dot;
  $('statusTitle').textContent = title;
  $('statusSub').textContent = sub;
  $('statusCard').className = 'q-card ' + cls;

  renderPlanning(d);
}

// ส่วนที่เอาไว้วางแผน (ช่วงคนน้อย · วันหยุด · กราฟ)
// ใช้สถิติล้วน จึงแสดงได้ทั้งตอนร้านเปิดและร้านปิด
function renderPlanning(d) {
  // ── ช่วงที่คนน้อย ─────────────────────────────────────────────────────
  // 🔴 แสดงเฉพาะเมื่อ hourPatternReal เท่านั้น
  //    ถ้ารูปแบบยังไม่ต่างจากความบังเอิญ การแนะนำช่วงเวลาก็คือการเดา
  const hasQuiet = d.hourPatternReal && d.quietHours && d.quietHours.length;
  if (hasQuiet) {
    $('quietBody').innerHTML =
      `ช่วง <b>${joinHours(d.quietHours)}</b> ปกติคนน้อยที่สุด` +
      (d.busyHours && d.busyHours.length
        ? `<br><span class="q-quiet-busy">ช่วง ${joinHours(d.busyHours)} คนเยอะกว่าช่วงอื่น</span>` : '');
  }
  show($('quietBody'), hasQuiet);

  // ── วันหยุด / วันในสัปดาห์ — พูดเฉพาะเมื่อผ่านการทดสอบแล้ว ─────────────
  //
  // เรียงจากคำถามแคบไปกว้าง เพราะคำถามแคบตอบได้ด้วยข้อมูลน้อยกว่า
  //   1. วันหยุด vs วันธรรมดา  (ผ่านแล้วด้วยข้อมูลปัจจุบัน)
  //   2. ไล่ทีละวัน             (ยังไม่ผ่าน จะเริ่มพูดเองเมื่อข้อมูลพอ)
  let note = '';
  if (d.weekendReal && d.weekendPct) {
    note = d.isWeekendNow
      ? `วันหยุดคนเยอะกว่าวันธรรมดาประมาณ ${d.weekendPct}% · วันนี้เป็นวันหยุด`
      : `เสาร์-อาทิตย์คนเยอะกว่าวันธรรมดาประมาณ ${d.weekendPct}%`;
  }
  if (d.dowPatternReal && d.dowBusiest !== undefined && d.dowQuietest !== undefined) {
    const DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
    note = `วัน${DOW[d.dowBusiest]}คนเยอะที่สุด · วัน${DOW[d.dowQuietest]}เงียบที่สุด`;
  }
  if (note) $('dowNote').textContent = note;
  show($('dowNote'), !!note);

  // การ์ดนี้โผล่เมื่อมีอย่างน้อยหนึ่งอย่างที่ผ่านการทดสอบแล้ว
  // ทั้งสองส่วนเป็นอิสระต่อกัน ห้ามให้ส่วนหนึ่งบังอีกส่วน
  show($('quietCard'), !!(hasQuiet || note));
  $('quietHead').textContent = hasQuiet ? '🟢 ช่วงที่คนน้อย' : '🟢 ช่วงที่คนเยอะ-คนน้อย';

  // ── กราฟรายชั่วโมง ────────────────────────────────────────────────────
  // rel = สัดส่วนเทียบชั่วโมงที่คึกที่สุด (0–1) ไม่ใช่จำนวนรถ
  // แท่งสูงเท่าเดิม เพราะเดิมก็หารด้วยค่าสูงสุดอยู่แล้ว
  // ⚠️ คำอธิบายเมื่อชี้ (title) ห้ามมีจำนวนรถด้วย
  if (d.hourPatternReal && Array.isArray(d.hours) && d.hours.length) {
    $('chart').innerHTML = d.hours.map(x => {
      const pct = Math.max(4, Math.round((x.rel || 0) * 100));
      const isNow = x.hour === d.nowHour && d.openNow;
      return `
        <div class="q-bar-wrap${isNow ? ' now' : ''}" title="${hh(x.hour)}">
          <div class="q-bar-track"><div class="q-bar" style="height:${pct}%"></div></div>
          <div class="q-bar-lbl">${x.hour}</div>
        </div>`;
    }).join('');
    show($('chartCard'), true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // ── 1. วาดสถานะร้านทันที จากนาฬิกาในเครื่อง ไม่แตะเน็ตเลย ──────────────
  paintShopState();

  // ── 2. วาดของที่จำไว้ทันที ถ้าเคยเปิดหน้านี้แล้ว ───────────────────────
  // ของเดิมหน้าจะว่างอยู่ 1–5 วินาทีระหว่างรอ Apps Script ตอบ
  const cached = readCache();
  if (cached) {
    const age = Date.now() - cached.at;
    if (age <= LIVE_MAX_AGE) {
      // เพิ่งเก็บมา ใช้ได้ทั้งใบ
      render(cached.data);
      $('updating').textContent = '⏳ กำลังตรวจสอบข้อมูลล่าสุด...';
      show($('updating'), true);
    } else {
      // เก่าเกินกว่าจะบอกว่า "ตอนนี้" เป็นยังไง
      // แต่ส่วนสถิติยังใช้ได้ วาดไปก่อนเลย
      show($('statusCard'), false);
      renderPlanning(cached.data);
      $('updating').textContent = '⏳ กำลังตรวจสอบสถานะตอนนี้...';
      show($('updating'), true);
    }
  }

  // ── 3. ค่อยไปถามของจริง ──────────────────────────────────────────────
  $('refreshBtn').addEventListener('click', () => loadQueue(false));
  loadQueue(!!cached);

  // กลับมาที่หน้านี้อีกครั้ง (สลับแอปแล้วกลับมา) ให้ดูใหม่ให้เลย
  // ไม่งั้นลูกค้าจะเห็นสถานะค้างจากเมื่อครู่โดยไม่รู้ตัว
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    paintShopState();          // เวลาเดินไปแล้ว ร้านอาจปิดไปแล้วก็ได้
    loadQueue(true);
  });
});
