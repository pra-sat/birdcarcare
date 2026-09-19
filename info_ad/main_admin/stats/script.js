// stats/script.js — หน้าสรุปยอดของผู้ดูแล (18 ก.ย. 2569)
//
// 🔴 หน้านี้ต้องยืนยันตัวตนจริง ไม่ใช้ทางลัดแบบหน้าคิว
//    เพราะข้อมูลที่ขอมาคือยอดขายกับรายชื่อลูกค้า
//    ต้องส่ง adminUserId + idToken ให้ bcGuardAdmin_ ตรวจทุกครั้ง
//    (การ "เห็นหน้าจอ" ไม่ใช่ด่านกัน — ด่านจริงอยู่ที่เซิร์ฟเวอร์)
//
// ── โครงหน้าจอ (20 ก.ย. 2569) ─────────────────────────────────────────────
//  ช่วงเวลาที่เลือกด้านบน "คุมทั้งหน้า" — ยอดหลัก · ช่องทางรับเงิน ·
//  บริการที่ทำ · กราฟ เปลี่ยนตามช่วงที่เลือกทั้งหมด
//
//  ของเดิมเป็นการ์ด "วันนี้" กับ "เดือนนี้" ตายตัว อยากดูว่าเมื่อวานขายอะไรบ้าง
//  ก็ดูไม่ได้ ทั้งที่ข้อมูล 30 วัน/12 เดือนถูกส่งมาพร้อมกันอยู่แล้วตั้งแต่แรก
//
//  🔴 กฎที่ห้ามพลาดในไฟล์นี้
//     ก. render() ถูกเรียกได้ถึง 3 รอบ (แคช -> core -> deep)
//        ต้องผูกเหตุการณ์ด้วย el.onclick = ห้ามใช้ addEventListener
//        ไม่งั้นตัวจับเหตุการณ์ทับถมกันทุกรอบ
//     ข. ต้องจำช่วงที่แอดมินเลือกไว้ (view) ไม่งั้นพอ deep มาถึง
//        หน้าจะเด้งกลับไปวันล่าสุดแล้วทิ้งสิ่งที่กำลังดูอยู่
//     ค. ห้ามใช้ toISOString() สร้างค่าให้ input — มันแปลงเป็น UTC
//        แล้ววันเลื่อนไป 1 วัน · คีย์จากเซิร์ฟเวอร์เป็นวันที่ไทยอยู่แล้ว
//     ง. โหมดรายเดือน/ภาพรวมต้องรอข้อมูลส่วน deep — ปิดปุ่มไว้ก่อน
//        ดีกว่าให้กดแล้วเจอหน้าว่างโดยไม่รู้ว่าเพราะอะไร

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

const $ = id => document.getElementById(id);
const show = (el, yes) => { if (el) el.classList.toggle('hidden', !yes); };
const baht = n => (Number(n) || 0).toLocaleString('th-TH');

const DOW_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const MON_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

let adminUserId = '', idToken = '';
// เก็บผลรวมของทั้ง core และ deep ไว้ก้อนเดียว เพราะมาคนละรอบ
let lastData = {};

// ช่วงที่แอดมินกำลังดูอยู่ — ต้องอยู่นอก render() เพราะ render ถูกเรียกหลายรอบ
let view = { mode: 'day', dayKey: '', monKey: '' };

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
//   deep = อันดับบริการ / รายเดือน / ภาพรวม / ลูกค้า   (ช้ากว่ามาก เพราะอ่านอีกชีต)
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
    $('updating').textContent = '⏳ กำลังโหลดรายเดือน ภาพรวม และข้อมูลลูกค้า...';
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
      $('updating').textContent = '⚠️ โหลดรายเดือน/ลูกค้าไม่สำเร็จ · ยอดรายวันด้านบนถูกต้อง';
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

  renderPeriod(d);
  renderDeep(d);
}


// ── รายการของแต่ละโหมด ────────────────────────────────────────────────────
// bucket คือก้อนตัวเลขเต็มใบของช่วงนั้น (ยอดเงิน · แต้ม · ช่องทาง · บริการ)
// ซึ่ง stats.gs ส่งมาให้ครบทุกวัน/ทุกเดือนแล้ว จึงไม่ต้องยิงถามใหม่เวลาเปลี่ยนช่วง
function dayItems(d) {
  return (d.daily || []).map(x => ({
    key: x.date,                       // 'yyyy-MM-dd' = ค่าที่ input[type=date] ใช้
    label: x.label,
    value: x.revenue,
    cars: x.cars,
    dow: x.dow,
    weekend: x.dow === 0 || x.dow === 6,
    full: `วัน${DOW_TH[x.dow]}ที่ ${x.label}`,
    title: `${x.label} · ${x.cars} คัน · ${baht(x.revenue)} บาท`,
    bucket: x
  }));
}

function monItems(d) {
  return (d.months || []).map(x => {
    const p = String(x.ym || '').split('-');           // 'yyyy-MM'
    const full = p.length === 2 ? `${MON_TH[Number(p[1]) - 1]} ${p[0]}` : x.label;
    return {
      key: x.ym,
      label: x.label,
      value: x.revenue,
      cars: x.cars,
      partial: x.partial,
      full: full,
      title: `${x.label} · ${x.cars} คัน · ${baht(x.revenue)} บาท`,
      bucket: x
    };
  });
}


// ── ส่วนที่ขึ้นกับช่วงที่เลือก ─────────────────────────────────────────────
function renderPeriod(d) {
  const hasDeep = Array.isArray(d.months) && d.months.length > 0;

  // โหมดรายเดือน/ภาพรวมต้องรอข้อมูลส่วน deep — ปิดปุ่มไว้ก่อนดีกว่าให้กดแล้วหน้าว่าง
  document.querySelectorAll('#segView .st-seg-b').forEach(b => {
    const needDeep = b.dataset.mode !== 'day';
    b.disabled = needDeep && !hasDeep;
    b.classList.toggle('is-on', b.dataset.mode === view.mode);
  });
  if (!hasDeep && view.mode !== 'day') view.mode = 'day';

  const mode = view.mode;
  const items = mode === 'day' ? dayItems(d) : monItems(d);
  if (!items.length) return;

  // ── เลือกช่วง ────────────────────────────────────────────────────────
  const keyField = mode === 'day' ? 'dayKey' : 'monKey';
  let idx = items.findIndex(x => x.key === view[keyField]);
  if (idx < 0) idx = items.length - 1;                 // ยังไม่เคยเลือก = ล่าสุด
  view[keyField] = items[idx].key;

  const isAll = mode === 'all';
  show($('pickWrap'), !isAll);
  show($('allCard'), isAll);
  show($('chartNote'), mode !== 'day');

  if (!isAll) bindPicker(items, idx, mode);

  // ── ก้อนตัวเลขที่จะเอามาวาด ──────────────────────────────────────────
  const cur = isAll ? (d.overview || null) : items[idx].bucket;
  if (!cur) return;

  drawHero(d, cur, items, idx, mode);
  drawPay(cur);
  drawServices(isAll ? { services: d.services || [] } : cur, isAll);
  drawChart(d, items, isAll ? -1 : idx, mode);
  if (isAll) drawOverview(d.overview, d);
}


// ── ยอดหลัก + บรรทัดเทียบ ─────────────────────────────────────────────────
function drawHero(d, cur, items, idx, mode) {
  $('hRevenue').textContent = baht(cur.revenue);
  $('hCars').textContent = cur.cars;
  $('hPoints').textContent = baht(cur.points || 0);

  const cmp = $('hCmp');

  if (mode === 'all') {
    cmp.innerHTML = '<span class="st-cmp-flat">ทั้งหมดที่ผ่านมา · ไม่รวมรถของแอดมิน</span>';
    return;
  }

  if (mode === 'day') {
    const prev = idx > 0 ? items[idx - 1].bucket : null;
    cmp.innerHTML = prev
      ? cmpLine('วันก่อนหน้า', cur.revenue, prev.revenue,
                `${prev.cars} คัน · ${baht(prev.revenue)} บาท`)
      : '<span class="st-cmp-flat">ไม่มีข้อมูลวันก่อนหน้า</span>';
    return;
  }

  // ── รายเดือน ──────────────────────────────────────────────────────────
  // 🔴 เดือนที่ยังไม่จบ ห้ามเอาไปเทียบกับเดือนก่อน "ทั้งเดือน"
  //    ไม่งั้นทุกต้นเดือนจะเห็นยอดตกฮวบทั้งที่เดือนยังไม่จบ
  //    เซิร์ฟเวอร์ส่ง prevSame (เดือนก่อน เฉพาะวันที่ 1–วันนี้) มาให้ใช้ตรงนี้
  if (items[idx].partial && d.prevSame) {
    cmp.innerHTML = cmpLine(
      `เดือนก่อน วันที่ 1–${d.dayOfMonth}`,
      cur.revenue, d.prevSame.revenue,
      `${d.prevSame.cars} คัน · ${baht(d.prevSame.revenue)} บาท`
    ) + (d.prevFull && d.prevFull.revenue > 0
      ? `<div class="st-cmp-extra">เดือนก่อนทั้งเดือน ${d.prevFull.cars} คัน · ${baht(d.prevFull.revenue)} บาท</div>`
      : '');
    return;
  }

  const prev = idx > 0 ? items[idx - 1].bucket : null;
  cmp.innerHTML = prev
    ? cmpLine('เดือนก่อน', cur.revenue, prev.revenue,
              `${prev.cars} คัน · ${baht(prev.revenue)} บาท`)
    : '<span class="st-cmp-flat">ไม่มีข้อมูลเดือนก่อน</span>';
}


// ── ช่องทางรับเงิน ────────────────────────────────────────────────────────
// ⚠️ แถวก่อน 19 ก.ย. 2569 ไม่มีข้อมูลนี้ ต้องโชว์เป็น "ไม่ระบุ" แยกไว้ต่างหาก
//    ห้ามเหมาเข้าเงินสดหรือเงินโอน ไม่งั้นยอดรวมไม่ตรงแล้วหาสาเหตุไม่เจอ
function drawPay(b) {
  const transfer = Number(b.transfer) || 0;
  const cash = Number(b.cash) || 0;
  const revenue = Number(b.revenue) || 0;
  const unknown = Math.max(0, revenue - transfer - cash);

  const pc = n => (revenue > 0 ? (n / revenue * 100) : 0);

  $('payBar').innerHTML = revenue > 0
    ? `<i class="st-pb t" style="width:${pc(transfer)}%"></i>` +
      `<i class="st-pb c" style="width:${pc(cash)}%"></i>` +
      `<i class="st-pb u" style="width:${pc(unknown)}%"></i>`
    : '<i class="st-pb u" style="width:100%"></i>';

  if (revenue > 0) {
    const part = (cls, name, val) => val > 0
      ? `<span><i class="st-sw ${cls}"></i>${name} ${baht(val)} (${Math.round(pc(val))}%)</span>` : '';
    $('payKey').innerHTML = part('t', 'เงินโอน', transfer) + part('c', 'เงินสด', cash) +
      part('u', 'ไม่ระบุ', unknown);
  } else {
    $('payKey').innerHTML = '<span>ไม่มียอดรับเงินในช่วงนี้</span>';
  }

  // เฉลี่ยต่อคัน — หารด้วยเฉพาะคันที่จ่ายเงินจริง ไม่รวมคันที่แลกด้วยแต้ม
  const paying = Math.max(0, (Number(b.cars) || 0) - (Number(b.redeemCount) || 0));
  $('payAvg').textContent = paying > 0 ? baht(Math.round(revenue / paying)) + ' บาท' : '–';
  $('payRedeem').textContent = b.redeemCount > 0
    ? `${b.redeemCount} ครั้ง (${baht(b.redeemValue)} แต้ม)` : 'ไม่มี';
}


// ── บริการที่ทำในช่วงที่เลือก ─────────────────────────────────────────────
function drawServices(b, isAll) {
  const list = (b.services || []).slice(0, isAll ? 10 : 8);
  $('psvcSub').textContent = list.length
    ? `(${list.length} ประเภท)` + (isAll ? ' ทั้งหมดที่ผ่านมา' : '') : '';

  if (!list.length) {
    $('psvcList').innerHTML = '<p class="st-empty">ช่วงนี้ยังไม่มีรถเข้าเลย</p>';
    return;
  }

  const max = Math.max.apply(null, list.map(s => s.revenue).concat([1]));
  $('psvcList').innerHTML = list.map(s => `
    <div class="st-psvc">
      <div class="st-psvc-top">
        <span class="st-psvc-n">${esc(s.name)}</span>
        <span class="st-psvc-c">${s.count} คัน</span>
        <span class="st-psvc-v">${baht(s.revenue)}</span>
      </div>
      <div class="st-psvc-bar">
        <div class="st-psvc-fill" style="width:${Math.max(3, Math.round(s.revenue / max * 100))}%"></div>
      </div>
    </div>`).join('');
}


// ── ภาพรวมทั้งหมด ─────────────────────────────────────────────────────────
function drawOverview(o, d) {
  if (!o) return;

  // ⚠️ "เฉลี่ยต่อวัน" หารด้วยวันที่มีรถจริง ไม่ใช่วันในปฏิทิน
  //    เพราะร้านไม่ได้เปิดทุกวัน และโค้ดไม่รู้ว่าวันไหนปิด
  const rows = [
    ['ช่วงข้อมูล', o.firstDate ? `${thaiDate(o.firstDate)} ถึงวันนี้ (${o.spanDays} วัน)` : '–'],
    ['วันที่มีรถเข้า', `${o.daysWithCars} วัน`],
    ['เฉลี่ยเฉพาะวันที่มีรถ', `${baht(o.avgPerActiveDay)} บาท · ${o.avgCarsPerActiveDay} คัน/วัน`],
    ['วันที่ขายดีที่สุด', o.bestDay
      ? `${thaiDate(o.bestDay.date)} · ${baht(o.bestDay.revenue)} บาท (${o.bestDay.cars} คัน)` : '–'],
    ['แต้มที่แจกไปทั้งหมด', `${baht(o.points)} แต้ม`],
    ['แลกแต้มไปแล้ว', o.redeemCount > 0
      ? `${o.redeemCount} ครั้ง · ${baht(o.redeemValue)} แต้ม` : 'ยังไม่มี']
  ];

  $('allRows').innerHTML = rows.map(r =>
    `<div class="st-row"><span class="st-k">${r[0]}</span><span class="st-v">${esc(r[1])}</span></div>`
  ).join('');
}


// ── ส่วนที่ไม่ขึ้นกับช่วงที่เลือก (มาพร้อม deep) ──────────────────────────
function renderDeep(d) {
  const hasDeep = Array.isArray(d.months) && d.months.length > 0;
  ['svcCard', 'cuCard', 'lapsedCard', 'admCard'].forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !hasDeep);
  });
  if (!hasDeep) return;

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


// ── กราฟแท่ง — ไม่ใช้ไลบรารี หน้าจะได้ไม่หนัก ────────────────────────────
// แตะที่แท่ง = เลือกช่วงนั้น ซึ่งเป็นทางเดียวกับปฏิทินด้านบน
// ข้อมูลอยู่ในมือแล้วทั้งก้อน ไม่ยิงถามเซิร์ฟเวอร์ใหม่ = กดแล้วขึ้นทันที
function drawChart(d, items, selectedIdx, mode) {
  const box = $('chart');
  const dense = mode === 'day';

  $('chartHead').textContent = dense
    ? 'ยอดเงินรายวัน 30 วันล่าสุด' : 'ยอดเงินรายเดือน 12 เดือนล่าสุด';

  const max = Math.max.apply(null, items.map(x => x.value).concat([1]));
  box.style.gridTemplateColumns = `repeat(${items.length}, 1fr)`;
  box.innerHTML = items.map((x, i) => {
    const pct = x.value > 0 ? Math.max(3, Math.round(x.value / max * 100)) : 0;
    const cls = [x.weekend ? 'is-weekend' : '', x.partial ? 'is-partial' : ''].join(' ').trim();
    const wrapCls = i === selectedIdx ? ' is-pick' : '';
    return `<div class="st-bar-wrap${wrapCls}" data-i="${i}" title="${esc(x.title)}">
              <div class="st-bar-track"><div class="st-bar ${cls}" style="height:${pct}%"></div></div>
              <div class="st-bar-lbl${dense ? ' dense' : ''}">${esc(x.label)}</div>
            </div>`;
  }).join('');

  // ผูกด้วยการ "กำหนดค่า" ไม่ใช่ addEventListener
  // เพราะ render() ถูกเรียกหลายรอบ ถ้าใช้ addEventListener ตัวจับเหตุการณ์จะทับถมกัน
  box.onclick = e => {
    const wrap = e.target.closest('.st-bar-wrap');
    if (!wrap) return;
    const i = Number(wrap.dataset.i);
    if (!items[i]) return;

    // อยู่ในโหมดภาพรวมแล้วแตะแท่ง = อยากดูเดือนนั้น พาไปโหมดรายเดือนเลย
    if (view.mode === 'all') view.mode = 'month';
    view[view.mode === 'day' ? 'dayKey' : 'monKey'] = items[i].key;
    renderPeriod(lastData);
  };

  const best = items.reduce((m, x) => (x.value > m.value ? x : m), items[0]);
  $('chartFoot').textContent = best && best.value > 0
    ? `${dense ? 'วันที่ดีที่สุดใน 30 วัน' : 'เดือนที่ดีที่สุด'}: ${best.full || best.label} · ${baht(best.value)} บาท (${best.cars} คัน)`
    : '';
}


// ── ปฏิทินเลือกวัน/เดือน ──────────────────────────────────────────────────
// 🔴 ห้ามใช้ toISOString() สร้างค่าให้ input ที่ไหนในนี้
//    มันแปลงเป็นเวลา UTC ก่อน ไทยเร็วกว่า 7 ชม. วันจะเลื่อนไป 1 วันแบบเงียบ ๆ
//    ค่าที่ใส่คือคีย์ที่เซิร์ฟเวอร์ส่งมาตรง ๆ (daily[].date / months[].ym)
//    ซึ่ง stats.gs คำนวณด้วยเขตเวลาของชีตแล้ว = เป็นวันที่ไทยแน่นอน
//
// คีย์เป็น 'yyyy-MM-dd' และ 'yyyy-MM' จึงเทียบด้วย < > ตรง ๆ ได้
// (เรียงตามตัวอักษร = เรียงตามเวลา) ไม่ต้องแปลงเป็น Date เลย
function bindPicker(items, idx, mode) {
  const isDay = mode === 'day';
  const inp = isDay ? $('dayInput') : $('monInput');
  const other = isDay ? $('monInput') : $('dayInput');
  show(inp, true);
  show(other, false);

  inp.min = items[0].key;
  inp.max = items[items.length - 1].key;
  inp.value = items[idx].key;

  // Safari/iOS ไม่รองรับ input type=month — มันจะกลายเป็นช่องพิมพ์ธรรมดา
  // ปล่อยให้พิมพ์เองจะได้ค่ามั่ว จึงล็อกไม่ให้พิมพ์ แล้วใช้ลูกศร/ปุ่มลัด/แตะแท่งแทน
  if (inp.type === 'text') inp.readOnly = true;

  $('periodPrev').disabled = (idx === 0);
  $('periodNext').disabled = (idx === items.length - 1);

  // ── ห่างจากปัจจุบันเท่าไหร่ ────────────────────────────────────────
  // รายการเรียงติดกันทีละวัน/ทีละเดือนอยู่แล้ว จึงนับจากระยะห่างในอาร์เรย์
  // ไม่ต้องคำนวณวันที่เลย = ไม่มีทางพลาดเรื่องเขตเวลา
  const back = items.length - 1 - idx;
  let rel;
  if (isDay) {
    rel = back === 0 ? 'วันนี้' : back === 1 ? 'เมื่อวาน'
        : back < 7 ? `${back} วันก่อน` : `${Math.floor(back / 7)} สัปดาห์ก่อน`;
    // ใช้ dow ที่เซิร์ฟเวอร์คำนวณด้วยเขตเวลาของชีตมาแล้ว
    // ห้ามสร้าง Date จากคีย์เองตรงนี้ เรื่องเขตเวลาพลาดง่ายโดยไม่มีอะไรฟ้อง
    rel = `วัน${DOW_TH[items[idx].dow]} · ${rel}`;
  } else {
    rel = back === 0 ? 'เดือนนี้ (ยังไม่จบเดือน)'
        : back === 1 ? 'เดือนก่อน' : `${back} เดือนก่อน`;
    rel = `${items[idx].full} · ${rel}`;
  }
  $('pickRel').textContent = rel;

  const go = n => {
    n = Math.max(0, Math.min(items.length - 1, n));
    view[isDay ? 'dayKey' : 'monKey'] = items[n].key;
    renderPeriod(lastData);
  };

  $('periodPrev').onclick = () => go(idx - 1);
  $('periodNext').onclick = () => go(idx + 1);
  inp.onchange = () => {
    const n = items.findIndex(x => x.key === inp.value);
    if (n >= 0) return go(n);
    // เลือกช่วงที่ไม่มีข้อมูล -> เด้งไปขอบที่ใกล้ที่สุด แล้วบอกให้รู้
    $('pickRel').textContent = 'ไม่มีข้อมูลของช่วงนั้น';
    go(inp.value && inp.value < items[0].key ? 0 : items.length - 1);
  };

  // ── ปุ่มลัด — เปลี่ยนตามโหมด ───────────────────────────────────────
  const quick = isDay
    ? [['วันนี้', items.length - 1], ['เมื่อวาน', items.length - 2]]
    : [['เดือนนี้', items.length - 1], ['เดือนก่อน', items.length - 2]];
  $('quickRow').innerHTML = quick
    .filter(q => q[1] >= 0)
    .map(q => `<button type="button" class="st-q" data-n="${q[1]}">${q[0]}</button>`).join('');
  $('quickRow').onclick = e => {
    const b = e.target.closest('[data-n]');
    if (b) go(Number(b.dataset.n));
  };
}


// 'yyyy-MM-dd' -> '19 ก.ย. 2026' · ไม่แปลงเป็น Date เพื่อเลี่ยงเรื่องเขตเวลา
function thaiDate(key) {
  const p = String(key || '').split('-');
  if (p.length !== 3) return key || '–';
  return `${Number(p[2])} ${MON_TH[Number(p[1]) - 1]} ${p[0]}`;
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
  // ปุ่มที่ไม่ต้องรอข้อมูล ผูกไว้ก่อนเลย
  $('lapsedBtn').addEventListener('click', () => {
    const list = $('lapsedList');
    const open = list.classList.contains('hidden');
    show(list, open);
    $('lapsedBtn').textContent = open ? '▲ ซ่อนรายชื่อ' : '▼ ดูรายชื่อ';
  });
  $('refreshBtn').addEventListener('click', () => loadStats(false));

  $('segView').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b || b.disabled) return;
    view.mode = b.dataset.mode;
    renderPeriod(lastData);
  });

  // วาดของที่จำไว้ก่อน หน้าจะได้ไม่ว่างระหว่างรอ
  const cached = readCache();
  if (cached) {
    lastData = cached.data;
    render(lastData);
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
