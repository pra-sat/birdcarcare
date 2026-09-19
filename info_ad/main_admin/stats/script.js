// stats/script.js — หน้าสรุปยอดของผู้ดูแล (18 ก.ย. 2569)
//
// 🔴 หน้านี้ต้องยืนยันตัวตนจริง ไม่ใช้ทางลัดแบบหน้าคิว
//    เพราะข้อมูลที่ขอมาคือยอดขายกับรายชื่อลูกค้า
//    ต้องส่ง adminUserId + idToken ให้ bcGuardAdmin_ ตรวจทุกครั้ง
//    (การ "เห็นหน้าจอ" ไม่ใช่ด่านกัน — ด่านจริงอยู่ที่เซิร์ฟเวอร์)

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

const $ = id => document.getElementById(id);
const show = (el, yes) => { if (el) el.classList.toggle('hidden', !yes); };
const baht = n => (Number(n) || 0).toLocaleString('th-TH');

let adminUserId = '', idToken = '';
// เก็บผลรวมของทั้ง core และ deep ไว้ก้อนเดียว เพราะมาคนละรอบ
let lastData = {};

// จำผลไว้ในเครื่องแอดมินเอง หน้าจะได้ไม่ว่างระหว่างรอ Apps Script
// ⚠️ นี่เป็นข้อมูลยอดขาย เก็บได้เฉพาะในเครื่องของแอดมินที่ยืนยันตัวตนแล้ว
//    และล้างทิ้งทันทีถ้าเซิร์ฟเวอร์ตอบว่าไม่มีสิทธิ์
const CACHE_KEY = 'bcStatsSeen';
const CACHE_MAX_AGE = 6 * 60 * 60 * 1000;   // 6 ชม.

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.at || !c.data || Date.now() - c.at > CACHE_MAX_AGE) return null;
    return c;
  } catch (e) { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) {}
}
function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
}


// ═══════════════════════════════════════════════════════════════════════════
//  ดึงข้อมูล
// ═══════════════════════════════════════════════════════════════════════════
// ยิงขอเป็นส่วน ๆ — core มาก่อนแล้ววาดเลย ไม่ต้องรอ deep
//   core = ยอดวันนี้ / เดือนนี้ / กราฟรายวัน  (ของที่ดูทุกวัน)
//   deep = อันดับบริการ / รายเดือน / ลูกค้า   (ช้ากว่ามาก เพราะอ่านอีกชีต)
async function fetchPart(part) {
  const res = await fetch(`${GAS_ENDPOINT}?action=stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ adminUserId, idToken, part })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadStats(silent) {
  const btn = $('refreshBtn');
  if (btn && !silent) { btn.disabled = true; btn.textContent = '⏳ กำลังโหลด...'; }

  try {
    const data = await fetchPart('core');

    if (data.status === 'error') {
      // สิทธิ์ถูกปฏิเสธ -> ล้างของที่จำไว้ ไม่ให้ค้างอยู่ในเครื่อง
      clearCache();
      const relogin = data.code === 'IDTOKEN_INVALID';
      Swal.fire({
        icon: 'error',
        title: relogin ? 'เซสชันหมดอายุ' : 'ไม่มีสิทธิ์ดูข้อมูลนี้',
        text: data.message || '',
        confirmButtonText: relogin ? 'เข้าสู่ระบบใหม่' : 'ปิด'
      }).then(() => { relogin ? liff.login() : liff.closeWindow(); });
      return;
    }

    // วาดส่วนที่ดูทุกวันทันที ไม่รอส่วนที่เหลือ
    lastData = Object.assign({}, lastData, data);
    writeCache(lastData);
    render(lastData);
    $('updating').textContent = '⏳ กำลังโหลดอันดับบริการและข้อมูลลูกค้า...';
    show($('updating'), true);

    // ── ส่วนที่ช้า ตามมาทีหลัง ────────────────────────────────────────
    // ไม่ await ตรงนี้ เพื่อให้ finally ปลดปุ่มได้เลย หน้าจะได้ไม่ดูค้าง
    fetchPart('deep').then(deep => {
      if (!deep || deep.status === 'error') { show($('updating'), false); return; }
      lastData = Object.assign({}, lastData, deep);
      writeCache(lastData);
      render(lastData);
      show($('updating'), false);
    }).catch(err => {
      console.warn('โหลดส่วนละเอียดไม่สำเร็จ:', err);
      $('updating').textContent = '⚠️ โหลดอันดับบริการไม่สำเร็จ · ยอดด้านบนถูกต้อง';
    });

  } catch (err) {
    console.warn('โหลดสรุปยอดไม่สำเร็จ:', err);
    if (readCache()) {
      $('updating').textContent = '⚠️ เชื่อมต่อไม่ได้ · กำลังแสดงข้อมูลที่บันทึกไว้';
      show($('updating'), true);
    } else {
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ',
        text: 'เช็คสัญญาณเน็ตแล้วลองใหม่อีกครั้ง', confirmButtonText: 'ปิด' });
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 โหลดใหม่'; }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  วาดหน้าจอ
// ═══════════════════════════════════════════════════════════════════════════
function render(d) {
  if (d.empty) {
    $('genAt').textContent = 'ยังไม่มีข้อมูลบริการในระบบ';
    return;
  }
  // บอกให้ชัดว่าตัดรถของแอดมินออกแล้ว ไม่งั้นเจ้าของร้านจะงงว่าทำไมยอดน้อยลง
  let head = 'ข้อมูล ณ ' + (d.generatedAt || '-');
  if (d.excludedAdmin > 0) head += ` · ไม่รวมรถของแอดมิน ${d.excludedAdmin} รายการ`;
  $('genAt').textContent = head;

  // ── วันนี้ ──────────────────────────────────────────────────────────
  $('tdRevenue').textContent = baht(d.today.revenue);
  $('tdCars').textContent = d.today.cars;
  $('tdCmp').innerHTML = cmpLine('เมื่อวาน', d.today.revenue, d.yesterday.revenue,
                                 d.yesterday.cars + ' คัน · ' + baht(d.yesterday.revenue) + ' บาท');

  // ── เดือนนี้ ────────────────────────────────────────────────────────
  $('moRevenue').textContent = baht(d.month.revenue) + ' บาท';
  $('moCars').textContent = d.month.cars + ' คัน';
  $('moAvg').textContent = baht(d.month.avg) + ' บาท';
  $('moRedeem').textContent = d.month.redeemCount > 0
    ? `${d.month.redeemCount} ครั้ง (${baht(d.month.redeemValue)} แต้ม)`
    : 'ไม่มี';

  // แยกยอดตามช่องทางรับเงิน — แถวเก่าก่อน 19 ก.ย. 2569 ยังไม่มีข้อมูลนี้
  // จึงมีส่วนที่ไม่เข้าทั้งสองช่อง ต้องบอกให้รู้ ไม่ใช่ปล่อยให้ยอดไม่ตรงแล้วงง
  const known = (d.month.transfer || 0) + (d.month.cash || 0);
  const unknown = Math.max(0, d.month.revenue - known);
  $('moTransfer').textContent = baht(d.month.transfer || 0) + ' บาท';
  $('moCash').textContent = baht(d.month.cash || 0) + ' บาท'
    + (unknown > 0 ? ` · ไม่ระบุ ${baht(unknown)}` : '');
  $('moRange').textContent = `วันที่ 1–${d.dayOfMonth}`;

  // เทียบช่วงวันเดียวกันของเดือนก่อน
  $('moCmp').innerHTML = cmpLine(
    `เดือนก่อน วันที่ 1–${d.dayOfMonth}`,
    d.month.revenue, d.prevSame.revenue,
    d.prevSame.cars + ' คัน · ' + baht(d.prevSame.revenue) + ' บาท'
  ) + (d.prevFull.revenue > 0
      ? `<div class="st-cmp-extra">เดือนก่อนทั้งเดือน ${d.prevFull.cars} คัน · ${baht(d.prevFull.revenue)} บาท</div>`
      : '');

  // ── กราฟรายวัน ─────────────────────────────────────────────────────
  const DOW_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const dailyCtl = drawBars($('dailyChart'), d.daily.map(x => ({
    key: x.date,                            // 'yyyy-MM-dd' = ค่าที่ input[type=date] ใช้
    value: x.revenue,
    cars: x.cars,
    label: x.label,
    full: `วัน${DOW_TH[x.dow]}ที่ ${x.label}`,
    // เสาร์-อาทิตย์ทำสีต่าง เพราะสถิติบอกว่าวันหยุดคนเยอะกว่า 39%
    weekend: x.dow === 0 || x.dow === 6,
    title: `${x.label} · ${x.cars} คัน · ${baht(x.revenue)} บาท`
  })), true, $('dailyPick'));
  // วันนี้ = ตัวท้ายสุด · เมื่อวาน = ถัดเข้ามาหนึ่ง
  bindPicker(dailyCtl, 'dayInput', 'dayPrev', 'dayNext', '[data-day]',
             (b, n) => b.dataset.day === 'yesterday' ? n - 2 : n - 1);
  const best = d.daily.reduce((m, x) => (x.revenue > m.revenue ? x : m), d.daily[0]);
  $('dailyFoot').textContent = best && best.revenue > 0
    ? `วันที่ดีที่สุดใน 30 วัน: ${best.label} · ${baht(best.revenue)} บาท (${best.cars} คัน)` : '';

  // ── ตั้งแต่ตรงนี้ลงไปเป็นส่วน deep ซึ่งมาทีหลัง ────────────────────
  //    ตอนวาดรอบแรก (core) ยังไม่มีข้อมูลพวกนี้ ต้องซ่อนการ์ดไว้ก่อน
  //    ห้ามเข้าถึงตรง ๆ ไม่งั้นพังตั้งแต่รอบแรก แล้วยอดวันนี้ก็ไม่ขึ้นด้วย
  const hasDeep = Array.isArray(d.months) && d.months.length > 0;
  ['monthCard', 'svcCard', 'cuCard', 'lapsedCard', 'admCard'].forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !hasDeep);
  });
  if (!hasDeep) return;

  // ── กราฟรายเดือน ───────────────────────────────────────────────────
  const MON_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthCtl = drawBars($('monthChart'), d.months.map(x => {
    const p = String(x.ym || '').split('-');     // 'yyyy-MM'
    const full = p.length === 2 ? `${MON_TH[Number(p[1]) - 1]} ${p[0]}` : x.label;
    return {
      key: x.ym,                                 // 'yyyy-MM' = ค่าที่ input[type=month] ใช้
      value: x.revenue,
      cars: x.cars,
      label: x.label,
      full: full,
      partial: x.partial,
      title: `${x.label} · ${x.cars} คัน · ${baht(x.revenue)} บาท`
    };
  }), false, $('monthPick'));
  bindPicker(monthCtl, 'monInput', 'monPrev', 'monNext', '[data-mon]',
             (b, n) => b.dataset.mon === 'prev' ? n - 2 : n - 1);

  // ── อันดับบริการ ───────────────────────────────────────────────────
  const maxSvc = d.services.length ? d.services[0].revenue : 0;
  $('svcRank').innerHTML = d.services.slice(0, 10).map((s, i) => `
    <div class="st-rank-row">
      <div class="st-rank-top">
        <span class="st-rank-no">${i + 1}</span>
        <span class="st-rank-name">${esc(s.name)}</span>
        <span class="st-rank-val">${baht(s.revenue)}</span>
      </div>
      <div class="st-rank-bar">
        <div class="st-rank-fill" style="width:${maxSvc > 0 ? Math.max(2, Math.round(s.revenue / maxSvc * 100)) : 0}%"></div>
      </div>
      <div class="st-rank-sub">${s.count} ครั้ง · ${s.pct}% ของยอดทั้งหมด</div>
    </div>`).join('') || '<p class="st-hint">ยังไม่มีข้อมูล</p>';

  // ── ลูกค้า ─────────────────────────────────────────────────────────
  $('cuTotal').textContent = d.customers.total + ' คัน';
  $('cuActive').textContent = d.activeThisMonth + ' คน';
  $('cuNew').textContent = d.customers.newThisMonth + ' คัน';
  $('cuRating').textContent = d.rating.avg !== null
    ? `${d.rating.avg} / 5 (${d.rating.count} รีวิว)` : 'ยังไม่มีรีวิว';

  // ── ลูกค้าที่หายไป ─────────────────────────────────────────────────
  $('lapsedSum').textContent = d.customers.lapsed > 0
    ? `มี ${d.customers.lapsed} คันที่ไม่ได้มาเกิน 3 เดือน`
    : 'ไม่มีลูกค้าที่หายไปนาน 👍';
  show($('lapsedBtn'), d.customers.lapsed > 0);
  $('lapsedList').innerHTML = (d.customers.lapsedList || []).map(c => `
    <div class="st-lap">
      <div class="st-lap-top">
        <span class="st-lap-name">${esc(c.name)}</span>
        <span class="st-lap-pt">${c.point} แต้ม</span>
      </div>
      <div class="st-lap-sub">
        ${esc(c.brand)} ${esc(c.model)}${c.plate ? ' · ' + esc(c.plate) : ''}<br>
        มาล่าสุด ${c.last} (${c.daysAgo} วันก่อน)
      </div>
      ${c.phone ? `<a class="st-lap-tel" href="tel:${esc(c.phone)}">📞 ${esc(formatPhone(c.phone))}</a>` : ''}
    </div>`).join('');

  // ── แอดมิน ─────────────────────────────────────────────────────────
  const maxAdm = d.admins.length ? d.admins[0].count : 0;
  $('admRank').innerHTML = d.admins.slice(0, 8).map(a => `
    <div class="st-rank-row">
      <div class="st-rank-top">
        <span class="st-rank-name">${esc(a.name)}</span>
        <span class="st-rank-val">${a.count} ครั้ง</span>
      </div>
      <div class="st-rank-bar">
        <div class="st-rank-fill" style="width:${maxAdm > 0 ? Math.max(2, Math.round(a.count / maxAdm * 100)) : 0}%"></div>
      </div>
      <div class="st-rank-sub">${baht(a.revenue)} บาท</div>
    </div>`).join('') || '<p class="st-hint">ยังไม่มีข้อมูล</p>';
}


// เทียบกับช่วงก่อนหน้า — บอกทั้งทิศทางและตัวเลขจริง
// ⚠️ ถ้าช่วงก่อนหน้าเป็น 0 ห้ามคิดเป็นเปอร์เซ็นต์ (หารศูนย์ / ขึ้น ∞%)
function cmpLine(label, cur, prev, detail) {
  if (!prev) {
    return `<span class="st-cmp-flat">${label}: ${detail}</span>`;
  }
  const pct = Math.round((cur / prev - 1) * 100);
  const cls = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat');
  const arrow = pct > 0 ? '▲' : (pct < 0 ? '▼' : '=');
  return `<span class="st-cmp-${cls}">${arrow} ${Math.abs(pct)}%</span>` +
         `<span class="st-cmp-flat"> เทียบ${label} (${detail})</span>`;
}


// วาดกราฟแท่ง — ไม่ใช้ไลบรารี หน้าจะได้ไม่หนัก
//
// แตะที่แท่งแล้วเห็นยอดของช่วงนั้น (เพิ่ม 19 ก.ย. 2569 ตามที่เจ้าของร้านขอ
// ให้กดดูเป็นรายวัน/รายเดือนได้)
// ข้อมูลมีอยู่ในมือแล้วทั้งก้อน จึงไม่ต้องยิงถามเซิร์ฟเวอร์ใหม่ = กดแล้วขึ้นทันที
//
// คืน "ตัวควบคุม" กลับไปให้ปฏิทินเรียกใช้ทางเดียวกัน (pick) จะได้ไม่มี
// โค้ดเลือกช่วงสองชุดที่ค่อย ๆ เพี้ยนออกจากกัน
function drawBars(box, items, dense, pickBox) {
  const max = Math.max.apply(null, items.map(x => x.value).concat([1]));
  box.style.gridTemplateColumns = `repeat(${items.length}, 1fr)`;
  box.innerHTML = items.map((x, i) => {
    const pct = x.value > 0 ? Math.max(3, Math.round(x.value / max * 100)) : 0;
    const cls = [x.weekend ? 'is-weekend' : '', x.partial ? 'is-partial' : ''].join(' ').trim();
    return `<div class="st-bar-wrap" data-i="${i}" title="${esc(x.title)}">
              <div class="st-bar-track"><div class="st-bar ${cls}" style="height:${pct}%"></div></div>
              <div class="st-bar-lbl${dense ? ' dense' : ''}">${esc(x.label)}</div>
            </div>`;
  }).join('');

  const pick = i => {
    const x = items[i];
    if (!x || !pickBox) return;

    // เน้นแท่งที่เลือกอยู่ ให้รู้ว่ากำลังดูอันไหน
    box.querySelectorAll('.st-bar-wrap').forEach(w => w.classList.remove('is-pick'));
    const wrap = box.querySelector(`.st-bar-wrap[data-i="${i}"]`);
    if (wrap) wrap.classList.add('is-pick');

    const avg = x.cars > 0 ? Math.round(x.value / x.cars) : 0;
    pickBox.innerHTML =
      `<span class="st-pick-when">${esc(x.full || x.label)}</span>` +
      `<span class="st-pick-main">${baht(x.value)} บาท</span>` +
      `<span class="st-pick-sub">${x.cars} คัน` +
      (x.cars > 0 ? ` · เฉลี่ย ${baht(avg)} บาท/คัน` : '') +
      (x.partial ? ' · เดือนนี้ยังไม่จบ' : '') + `</span>`;
    pickBox.classList.remove('hidden');
  };

  // onBarPick ถูกเติมทีหลังโดย bindPicker เพื่อให้ปฏิทินขยับตามแท่งที่แตะ
  const api = { items, pick, onBarPick: null,
                indexOfKey: k => items.findIndex(x => x.key === k) };

  if (pickBox) {
    // ผูกด้วยการ "กำหนดค่า" ไม่ใช่ addEventListener
    // เพราะ render() ถูกเรียกหลายรอบ (แคช -> core -> deep) ถ้าใช้ addEventListener
    // ตัวจับเหตุการณ์จะทับถมกันทุกรอบ
    box.onclick = e => {
      const wrap = e.target.closest('.st-bar-wrap');
      if (!wrap) return;
      const i = Number(wrap.dataset.i);
      if (!items[i]) return;
      pick(i);
      if (api.onBarPick) api.onBarPick(i);
    };
  }

  return api;
}


// ── ปฏิทินเลือกวัน/เดือน (19 ก.ย. 2569) ───────────────────────────────
// ของเดิมเลือกได้ทางเดียวคือแตะแท่ง ซึ่งรายวัน 30 แท่งเบียดกันจนกดพลาด
//
// 🔴 ห้ามใช้ toISOString() สร้างค่าให้ input ที่ไหนในนี้
//    มันแปลงเป็นเวลา UTC ก่อน ไทยเร็วกว่า 7 ชม. วันจะเลื่อนไป 1 วันแบบเงียบ ๆ
//    ค่าที่ใส่คือคีย์ที่เซิร์ฟเวอร์ส่งมาตรง ๆ (daily[].date / months[].ym)
//    ซึ่ง stats.gs คำนวณด้วยเขตเวลาของชีตแล้ว = เป็นวันที่ไทยแน่นอน
//
// คีย์เป็น 'yyyy-MM-dd' และ 'yyyy-MM' จึงเทียบด้วย < > ตรง ๆ ได้
// (เรียงตามตัวอักษร = เรียงตามเวลา) ไม่ต้องแปลงเป็น Date เลย
function bindPicker(ctl, inpId, prevId, nextId, quickSel, quickPos) {
  const inp = document.getElementById(inpId);
  const prev = document.getElementById(prevId);
  const next = document.getElementById(nextId);
  if (!ctl || !inp || !prev || !next) return;

  const items = ctl.items;
  if (!items.length) return;

  inp.min = items[0].key;
  inp.max = items[items.length - 1].key;

  // Safari/iOS ไม่รองรับ input type=month — มันจะกลายเป็นช่องพิมพ์ธรรมดา
  // ปล่อยให้พิมพ์เองจะได้ค่ามั่ว จึงล็อกไม่ให้พิมพ์ แล้วใช้ลูกศร/ปุ่มลัด/แตะแท่งแทน
  // (ทั้งสามทางใช้ได้ปกติทุกเบราว์เซอร์) · type=date รองรับทุกตัวอยู่แล้ว
  if (inp.type === 'text') inp.readOnly = true;

  function apply(n) {
    n = Math.max(0, Math.min(items.length - 1, n));
    inp.value = items[n].key;
    prev.disabled = (n === 0);
    next.disabled = (n === items.length - 1);
    ctl.pick(n);
    return n;
  }

  // หาว่าตอนนี้ค้างอยู่ที่ช่องไหน — ถ้าผู้ใช้เลือกไว้แล้วต้องคงไว้
  // ไม่งั้นพอข้อมูลส่วน deep มาถึงแล้ว render() รอบสอง จะเด้งกลับไปวันล่าสุดเอง
  function currentIndex() {
    const n = ctl.indexOfKey(inp.value);
    if (n >= 0) return n;
    // พิมพ์/เลือกวันที่นอกช่วงที่มีข้อมูล -> เด้งไปขอบที่ใกล้ที่สุด
    if (inp.value && inp.value < items[0].key) return 0;
    return items.length - 1;                     // ไม่มีค่า = เปิดมาครั้งแรก -> ล่าสุด
  }

  let cur = apply(currentIndex());

  inp.onchange = () => { cur = apply(currentIndex()); };
  prev.onclick = () => { cur = apply(cur - 1); };
  next.onclick = () => { cur = apply(cur + 1); };

  document.querySelectorAll(quickSel).forEach(b => {
    b.onclick = () => { cur = apply(quickPos(b, items.length)); };
  });

  // แตะแท่งกราฟ -> ปฏิทินด้านบนต้องขยับตามด้วย ไม่งั้นสองที่จะบอกคนละวัน
  ctl.onBarPick = i => {
    cur = i;
    inp.value = items[i].key;
    prev.disabled = (i === 0);
    next.disabled = (i === items.length - 1);
  };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatPhone(p) {
  const d = String(p).replace(/\D/g, '');
  return d.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}


// ═══════════════════════════════════════════════════════════════════════════
//  เริ่มทำงาน
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // ปุ่มดูรายชื่อ ผูกไว้ก่อนเลย ไม่ต้องรอเน็ต
  $('lapsedBtn').addEventListener('click', () => {
    const list = $('lapsedList');
    const open = list.classList.contains('hidden');
    show(list, open);
    $('lapsedBtn').textContent = open ? '▲ ซ่อนรายชื่อ' : '▼ ดูรายชื่อ';
  });
  $('refreshBtn').addEventListener('click', () => loadStats(false));

  // วาดของที่จำไว้ก่อน หน้าจะได้ไม่ว่างระหว่างรอ
  const cached = readCache();
  if (cached) {
    render(cached.data);
    $('updating').textContent = '⏳ กำลังโหลดข้อมูลล่าสุด...';
    show($('updating'), true);
  }

  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) return liff.login();

    const profile = await liff.getProfile();
    adminUserId = profile.userId;
    if (liff.getIDToken && typeof liff.getIDToken === 'function') {
      idToken = await liff.getIDToken();
    }
    loadStats(!!cached);

  } catch (err) {
    console.error('LIFF ผิดพลาด:', err);
    Swal.fire({ icon: 'error', title: 'เปิดหน้านี้ไม่สำเร็จ',
      text: 'กรุณาปิดแล้วเปิดใหม่อีกครั้ง', confirmButtonText: 'ปิดหน้าต่าง'
    }).then(() => liff.closeWindow());
  }
});
