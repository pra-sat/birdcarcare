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

async function loadQueue() {
  const btn = $('refreshBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังดู...'; }
  try {
    const res = await fetch(`${GAS_ENDPOINT}?action=queue`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    render(await res.json());
  } catch (err) {
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
  if (d.openText) $('openText').textContent = d.openText;

  // ── การ์ดสถานะ ────────────────────────────────────────────────────────
  // ถ้อยคำต่างกันตามว่าร้านนี้ "มีคิวจริงไหม"
  // ร้านที่แทบไม่มีคิว การขึ้นไฟเหลืองเพราะมีรถเสร็จไป 1 คันจะทำให้เข้าใจผิด
  // ว่าต้องรอ ทั้งที่ความจริงคือเดินเข้าไปได้เลย
  let dot, title, sub, cls;

  if (d.status === 'closed') {
    dot = '⚪'; cls = 'is-closed';
    title = 'ตอนนี้ร้านปิดอยู่';
    sub = `เปิดอีกครั้ง ${d.openText || '07:30'} น.`;
    if (d.todayCount) sub += ` · วันนี้ให้บริการไป ${d.todayCount} คัน`;

  } else if (d.status === 'unknown' || !d.enoughData) {
    dot = '⚪'; cls = 'is-closed';
    title = 'ยังบอกไม่ได้';
    sub = 'ข้อมูลยังไม่พอจะประเมินให้ โทรถามร้านได้เลยค่ะ';

  } else if (d.status === 'busy') {
    dot = '🔴'; cls = 'is-busy';
    title = 'ช่วงนี้คึกกว่าปกติ';
    sub = `ชั่วโมงที่ผ่านมามีรถเสร็จไป ${d.lastHourCount} คัน ซึ่งมากกว่าที่ร้านนี้ปกติเป็น อาจต้องรอสักหน่อย`;

  } else if (d.rarelyBusy) {
    // ร้านแทบไม่มีคิว -> เขียวทั้ง free และ normal แต่ข้อความต่างกันนิดหน่อย
    dot = '🟢'; cls = 'is-free';
    title = 'ปกติมาได้เลย ไม่ต้องรอ';
    sub = d.lastHourCount > 0
      ? `เพิ่งมีรถเสร็จไป ${d.lastHourCount} คันในชั่วโมงที่ผ่านมา อาจมีรถอยู่หน้าคุณสักคัน`
      : 'ชั่วโมงที่ผ่านมายังไม่มีรถเสร็จ';

  } else if (d.status === 'free') {
    dot = '🟢'; cls = 'is-free';
    title = 'น่าจะไม่ต้องรอ';
    sub = 'ชั่วโมงที่ผ่านมายังไม่มีรถเสร็จ';

  } else {
    dot = '🟡'; cls = 'is-normal';
    title = 'คนปานกลาง';
    sub = `ชั่วโมงที่ผ่านมามีรถเสร็จไป ${d.lastHourCount} คัน`;
  }

  $('statusDot').textContent = dot;
  $('statusTitle').textContent = title;
  $('statusSub').textContent = sub;
  $('statusCard').className = 'q-card ' + cls;

  // ── บรรทัดบอกขนาดร้าน ─────────────────────────────────────────────────
  // สำคัญมาก เป็นบริบทที่ทำให้ตัวเลขอื่นอ่านแล้วเข้าใจถูก
  if (d.perDay) {
    $('baseline').textContent = d.rarelyBusy
      ? `ร้านรับเฉลี่ยวันละ ${d.perDay} คัน ส่วนใหญ่ลูกค้ามาถึงแล้วได้เลย`
      : `ร้านรับเฉลี่ยวันละ ${d.perDay} คัน`;
    show($('baseline'), true);
  }

  // ── ตัวเลขจริง ────────────────────────────────────────────────────────
  const hasFacts = d.enoughData && typeof d.todayCount === 'number';
  show($('facts'), hasFacts);
  if (hasFacts) {
    $('factToday').textContent = d.todayCount;
    $('factHour').textContent = d.lastHourCount;
    $('factLast').textContent =
      (d.minsSinceLast === null || d.minsSinceLast === undefined || d.minsSinceLast > 600)
        ? '–' : d.minsSinceLast;
  }

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
  if (d.dowPatternReal && Array.isArray(d.dows) && d.dows.length) {
    const DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
    const top = d.dows.slice().sort((a, b) => b.avg - a.avg);
    note = `วัน${DOW[top[0].dow]}คนเยอะที่สุด · วัน${DOW[top[top.length - 1].dow]}เงียบที่สุด`;
  }
  if (note) $('dowNote').textContent = note;
  show($('dowNote'), !!note);

  // การ์ดนี้โผล่เมื่อมีอย่างน้อยหนึ่งอย่างที่ผ่านการทดสอบแล้ว
  // ทั้งสองส่วนเป็นอิสระต่อกัน ห้ามให้ส่วนหนึ่งบังอีกส่วน
  show($('quietCard'), !!(hasQuiet || note));
  $('quietHead').textContent = hasQuiet ? '🟢 ช่วงที่คนน้อย' : '🟢 ช่วงที่คนเยอะ-คนน้อย';

  // ── กราฟรายชั่วโมง ────────────────────────────────────────────────────
  if (d.hourPatternReal && Array.isArray(d.hours) && d.hours.length) {
    const max = Math.max.apply(null, d.hours.map(x => x.avg).concat([0.1]));
    $('chart').innerHTML = d.hours.map(x => {
      const pct = Math.max(4, Math.round((x.avg / max) * 100));
      const isNow = x.hour === d.nowHour && d.openNow;
      return `
        <div class="q-bar-wrap${isNow ? ' now' : ''}" title="${hh(x.hour)} เฉลี่ย ${x.avg} คัน">
          <div class="q-bar-track"><div class="q-bar" style="height:${pct}%"></div></div>
          <div class="q-bar-lbl">${x.hour}</div>
        </div>`;
    }).join('');
    show($('chartCard'), true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('refreshBtn').addEventListener('click', loadQueue);
  loadQueue();

  // กลับมาที่หน้านี้อีกครั้ง (สลับแอปแล้วกลับมา) ให้ดูใหม่ให้เลย
  // ไม่งั้นลูกค้าจะเห็นตัวเลขค้างจากเมื่อครู่โดยไม่รู้ตัว
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadQueue();
  });
});
