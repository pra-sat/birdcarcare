// queue/script.js — ตรวจสอบคิว (15 ก.ย. 2569)
//
// หน้านี้ไม่ใช้ LIFF และไม่ต้องรู้ว่าใครเปิด — ดูคำอธิบายใน index.html
// ยิง action=queue ครั้งเดียวแล้ววาด ไม่มีอะไรมาคั่นก่อน

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';

// ข้อความของแต่ละสถานะ
// เขียนให้เป็น "การประเมิน" ทุกอัน ห้ามเขียนให้ฟังดูเหมือนนับรถจริง
// เพราะข้อมูลที่มีคือเวลาเก็บเงิน ไม่ใช่จำนวนรถในร้าน
const STATUS = {
  free:    { dot: '🟢', title: 'น่าจะไม่ต้องรอนาน',   cls: 'is-free' },
  normal:  { dot: '🟡', title: 'คนปานกลาง',           cls: 'is-normal' },
  busy:    { dot: '🔴', title: 'กำลังคึก อาจต้องรอ',  cls: 'is-busy' },
  closed:  { dot: '⚪', title: 'ตอนนี้ร้านปิดอยู่',    cls: 'is-closed' },
  unknown: { dot: '⚪', title: 'ยังบอกไม่ได้',         cls: 'is-closed' }
};

const $ = id => document.getElementById(id);
const hh = h => String(h).padStart(2, '0') + ':00';

function show(el, yes) { if (el) el.classList.toggle('hidden', !yes); }

async function loadQueue() {
  const btn = $('refreshBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังดู...'; }

  try {
    const res = await fetch(`${GAS_ENDPOINT}?action=queue`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    render(d);
  } catch (err) {
    console.warn('โหลดสถานะคิวไม่สำเร็จ:', err);
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
  const s = STATUS[d.status] || STATUS.unknown;

  $('statusDot').textContent = s.dot;
  $('statusTitle').textContent = s.title;
  $('statusCard').className = 'q-card ' + s.cls;
  if (d.openText) $('openText').textContent = d.openText;

  // ── บรรทัดขยายความ ────────────────────────────────────────────────────
  let sub = '';
  if (d.status === 'closed') {
    sub = `เปิดอีกครั้ง ${d.openText || '07:30'} น.`;
    if (d.todayCount) sub += ` · วันนี้ให้บริการไป ${d.todayCount} คัน`;
  } else if (d.status === 'unknown') {
    sub = d.enoughData === false
      ? `ข้อมูลวัน${d.dowName || 'นี้'}ยังน้อยอยู่ (มี ${d.sampleDays || 0} วัน) ประเมินให้ยังไม่ได้`
      : 'ยังประเมินให้ไม่ได้ตอนนี้';
  } else if (d.lastHourCount === 0) {
    // ชั่วโมงที่ผ่านมาไม่มีรถเสร็จเลย — อาจว่างจริง หรืออาจมีคันใหญ่กำลังทำอยู่
    // ต้องพูดให้ตรง ไม่ฟันธงว่าว่างแน่นอน
    sub = 'ชั่วโมงที่ผ่านมายังไม่มีรถเสร็จ อาจว่างหรืออาจกำลังทำคันใหญ่อยู่';
  } else {
    sub = `ชั่วโมงที่ผ่านมาเสร็จไป ${d.lastHourCount} คัน`;
    if (d.expected > 0) sub += ` · ช่วงนี้ปกติ ${d.expected} คัน`;
  }
  $('statusSub').textContent = sub;

  // ── ตัวเลขจริง ────────────────────────────────────────────────────────
  const hasFacts = d.status !== 'unknown' && typeof d.todayCount === 'number';
  show($('facts'), hasFacts);
  if (hasFacts) {
    $('factToday').textContent = d.todayCount;
    $('factHour').textContent = d.lastHourCount;
    $('factLast').textContent = d.minsSinceLast === null || d.minsSinceLast > 600
      ? '–' : d.minsSinceLast;
  }

  if (d.cycleMin) {
    $('cycleNote').textContent = `โดยเฉลี่ยร้านให้บริการเสร็จประมาณคันละ ${d.cycleMin} นาที`;
    show($('cycleNote'), true);
  }

  // ── ช่วงที่คนน้อย ─────────────────────────────────────────────────────
  // ส่วนนี้มีประโยชน์ที่สุดในหน้านี้ เพราะเอาไปวางแผนได้จริง
  // และใช้สถิติล้วน ไม่ต้องพึ่งข้อมูลสด จึงแสดงได้แม้ร้านปิดอยู่
  if (Array.isArray(d.quietHours) && d.quietHours.length && d.enoughData) {
    const list = d.quietHours.map(h => `${hh(h)}–${hh(h + 1)}`).join(' และ ');
    const later = d.quietHours[0] > (d.nowHour ?? 0);
    $('quietBody').innerHTML = later
      ? `วัน${d.dowName} ช่วง <b>${list}</b> ปกติคนน้อยที่สุด`
      : `วัน${d.dowName} ช่วงที่คนน้อยที่สุดคือ <b>${list}</b>`;
    show($('quietCard'), true);
  }

  // ── กราฟความคึกของวันนี้ ──────────────────────────────────────────────
  if (Array.isArray(d.hours) && d.hours.length && d.enoughData) {
    $('chartDow').textContent = 'วัน' + d.dowName;
    const max = Math.max(...d.hours.map(x => x.avg), 0.1);
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
