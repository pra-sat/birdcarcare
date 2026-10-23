// หน้า "👥 ข้อมูลลูกค้า" ของผู้ดูแล (4 ต.ค. 2569) — คู่กับ customer_admin.gs
//
// แก้ได้: ชื่อ · เบอร์โทร · ทะเบียน/จังหวัด ของรถแต่ละคัน
// 🔴 แก้ไม่ได้โดยตั้งใจ: ยี่ห้อ/รุ่น/ปี (กุญแจผูกกับประวัติ) และแต้ม (แต้ม = เงินสด)
//    ด่านจริงอยู่ที่เซิร์ฟเวอร์ (bcGuardAdmin_ + ระดับ) หน้านี้แค่ไม่มีช่องให้กรอก
// ⭐ เพิ่มแต้ม (5 ต.ค. 2569) — บวกได้อย่างเดียว ผ่านเส้นทางแยก action=bonus_points (points_bonus.gs)
//    ใช้กับบัตรสะสมกระดาษเดิม / ชดเชย · มีเหตุผลกำกับ ลงชีต Point_Adjust_Log · ลูกค้าได้ LINE แจ้ง
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

const $ = id => document.getElementById(id);

let adminUserId = '', idToken = '';
let list = [];          // ผลค้นที่แสดงอยู่
let lastQuery = '';
let canBonus = false;     // ⭐ เพิ่มแต้ม — เซิร์ฟเวอร์บอกมากับผลค้น (canBonus)

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return d.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  if (d.length === 9) return d.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  return d || '-';
}

// "1กร 1723" -> { head: '1กร', tail: '1723' } · เขียนติดกันก็แยกได้
function splitPlate(p) {
  const s = String(p || '').trim();
  if (!s) return { head: '', tail: '' };
  const m = s.match(/^(.*?)\s*(\d{1,4})$/);
  return m ? { head: m[1].replace(/\s+/g, ''), tail: m[2] } : { head: s.replace(/\s+/g, ''), tail: '' };
}

function carTitle(v) {
  return [v.brand, v.model].filter(Boolean).join(' ') + (v.year ? ` (${v.year})` : '');
}


// ── เรียกเซิร์ฟเวอร์ ─────────────────────────────────────────────────────
// คืน data เมื่อสำเร็จ · ถ้าโดนด่านสิทธิ์ จัดการให้เองแล้วคืน null
// access token = ทางสำรองเมื่อ ID token (อายุ 1 ชม.) หมด · เซิร์ฟเวอร์ใช้แทนให้เอง (7 ต.ค. 2569)
function accessTok() {
  try { return (typeof liff !== 'undefined' && liff.getAccessToken && liff.getAccessToken()) || ''; }
  catch (e) { return ''; }
}

async function call(body, action) {
  const res = await fetch(`${GAS_ENDPOINT}?action=${action || 'cust_admin'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ adminUserId, idToken, accessToken: accessTok() }, body))
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // มี code = โดนด่าน (เซสชัน/สิทธิ์) · ไม่มี code = ข้อมูลที่กรอกไม่ผ่าน ให้แก้ต่อได้
  if (data.status === 'error' && data.code) {
    const relogin = data.code === 'IDTOKEN_INVALID';
    await Swal.fire({
      icon: 'error',
      title: relogin ? 'เซสชันหมดอายุ' : 'ไม่มีสิทธิ์ใช้เมนูนี้',
      text: data.message || '',
      confirmButtonText: relogin ? 'เข้าสู่ระบบใหม่' : 'ปิด'
    });
    if (relogin) liff.login(); else liff.closeWindow();
    return null;
  }
  return data;
}


// ── ค้นและแสดงรายชื่อ ────────────────────────────────────────────────────
async function search(q) {
  lastQuery = q;
  const btn = $('searchBtn');
  btn.disabled = true;
  $('status').textContent = q ? '⏳ กำลังค้น...' : '⏳ กำลังโหลดลูกค้าล่าสุด...';
  try {
    const data = await call({ op: 'search', q });
    if (!data) return;
    if (data.status !== 'success') throw new Error(data.message || 'ค้นไม่สำเร็จ');
    if (q !== lastQuery) return;          // พิมพ์คำใหม่ไปแล้ว ทิ้งผลเก่า
    list = data.list || [];
    // ⭐ เพิ่มแต้มโชว์เฉพาะระดับที่เซิร์ฟเวอร์ยอมให้ (BONUS_MIN_LEVEL · 23 ต.ค. 2569 = ระดับ 4+)
    // เซิร์ฟเวอร์รุ่นเก่าไม่ส่ง canBonus มา = ซ่อนไว้ก่อน (กดแล้วโดนปฏิเสธแย่กว่าไม่เห็น)
    canBonus = data.canBonus === true;
    renderList();
    const more = data.total > list.length ? ` · แสดง ${list.length} คนแรก พิมพ์ให้เจาะจงขึ้นได้` : '';
    $('status').textContent = q
      ? (data.total ? `เจอ ${data.total} คน${more}` : 'ไม่เจอลูกค้าที่ตรงกับคำค้น')
      : `ลูกค้าที่มาล่าสุด ${list.length} คน · ค้นเพื่อหาคนอื่น`;
  } catch (err) {
    console.warn('ค้นลูกค้าไม่สำเร็จ:', err);
    $('status').textContent = '⚠️ เชื่อมต่อไม่ได้ เช็คสัญญาณเน็ตแล้วลองใหม่';
  } finally {
    btn.disabled = false;
  }
}

function renderList() {
  $('list').innerHTML = list.map((c, i) => {
    const cars = (c.cars || []).map(v =>
      `<span class="cu-car">🚗 ${esc([v.brand, v.model].filter(Boolean).join(' '))}` +
      (v.plate ? ` · <b>${esc(v.plate)}</b>` : ' · <i>ไม่มีทะเบียน</i>') + `</span>`
    ).join('');
    const pts = (c.cars || []).reduce((s, v) => s + (v.points || 0), 0);
    const line = c.nameLine && c.nameLine !== c.name ? ` <span class="cu-line">LINE: ${esc(c.nameLine)}</span>` : '';
    // ⚠️ ใช้ div ไม่ใช่ button — กฎปุ่มใน theme.css ระบายทุก <button> เป็นสีฟ้าทึบ
    return `<div class="cu-card" role="button" tabindex="0" data-i="${i}">
        <div class="cu-top">
          <div class="cu-name">${esc(c.name || '(ไม่มีชื่อ)')}${line}</div>
          <span class="cu-acts">
            ${canBonus ? `<span class="cu-bonus" role="button" tabindex="0" data-bonus="${i}">⭐ เพิ่มแต้ม</span>` : ''}
            <span class="cu-go">แก้ไข ›</span>
          </span>
        </div>
        <div class="cu-phone">📞 ${esc(fmtPhone(c.phone))} <span class="cu-pts">⭐ ${pts} แต้ม</span></div>
        <div class="cu-cars">${cars}</div>
      </div>`;
  }).join('');
}


// ── ฟอร์มแก้ไข ───────────────────────────────────────────────────────────
// pre = ค่าที่กรอกค้างไว้ (ตอนกดกลับไปแก้) · c = ของเดิมในชีต ใช้เทียบว่าเปลี่ยนอะไร
function openEdit(i, pre) {
  const c = list[i];
  if (!c) return;
  const show = pre || c;

  const carsHtml = (c.cars || []).map((v, k) => {
    const sv = (show.cars && show.cars[k]) || v;
    const pl = splitPlate(sv.plate);
    return `<div class="cu-ecar" data-k="${k}">
        <div class="cu-ecar-h">🚗 ${esc(carTitle(v))} <span class="cu-ecar-pts">${v.points || 0} แต้ม</span></div>
        <div class="cu-plate-row">
          <input class="swal2-input cu-ph" placeholder="หมวด เช่น 1กร" value="${esc(pl.head)}" autocomplete="off">
          <input class="swal2-input cu-pt" placeholder="เลข" inputmode="numeric" maxlength="4" value="${esc(pl.tail)}" autocomplete="off">
        </div>
        <select class="cu-prov">${plateProvinceOptions(sv.province)}</select>
      </div>`;
  }).join('');

  Swal.fire({
    title: 'แก้ข้อมูลลูกค้า',
    html: `
      <div class="fld"><label class="fld-lbl" for="eName">ชื่อลูกค้า</label>
        <input id="eName" class="swal2-input" value="${esc(show.name)}" maxlength="60" autocomplete="off"></div>
      <div class="fld"><label class="fld-lbl" for="ePhone">เบอร์โทร</label>
        <input id="ePhone" class="swal2-input" type="tel" inputmode="numeric" maxlength="12" value="${esc(show.phone)}" autocomplete="off"></div>
      <div class="fld"><label class="fld-lbl">ทะเบียนรถ <span class="fld-sub">— เว้นว่างได้</span></label>${carsHtml}</div>
      <p class="cu-note">ยี่ห้อ/รุ่น/ปี และแต้ม แก้ที่หน้านี้ไม่ได้ — ยี่ห้อ/รุ่น/ปีใช้ผูกกับประวัติการใช้บริการ ถ้าแก้แล้วประวัติกับแต้มจะหลุดจากรถคันนั้น${canBonus ? ' · จะเพิ่มแต้มจากบัตรสะสม กดปุ่ม ⭐ เพิ่มแต้ม ที่การ์ดลูกค้า' : ''}</p>`,
    showCancelButton: true,
    confirmButtonText: '💾 บันทึก',
    cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'cu-pop' },
    didOpen: () => {
      // หมวดรับแต่เลขกับพยัญชนะไทย · เลขท้ายรับแต่ตัวเลข 4 หลัก (เหมือนหน้าสแกน)
      Swal.getHtmlContainer().addEventListener('input', ev => {
        const t = ev.target;
        if (t.classList.contains('cu-ph')) {
          const v = plateCleanHead(t.value);
          if (t.value !== v) t.value = v;
        } else if (t.classList.contains('cu-pt')) {
          const v = t.value.replace(/\D/g, '').slice(0, 4);
          if (t.value !== v) t.value = v;
        }
      });
    },
    preConfirm: () => collectEdit(c)
  }).then(r => {
    if (r.isConfirmed && r.value) confirmAndSave(i, r.value);
  });
}

// ตรวจและเก็บค่า — ทำใน preConfirm ห้ามเปิดป๊อปอัปอื่นในนี้ (Swal เปิดได้ทีละอัน)
function collectEdit(c) {
  const box = Swal.getHtmlContainer();
  const name = $('eName').value.trim().replace(/\s+/g, ' ');
  const phone = $('ePhone').value.replace(/\D/g, '');
  if (!name) { Swal.showValidationMessage('กรุณากรอกชื่อ'); return false; }
  if (!/^0\d{8,9}$/.test(phone)) {
    Swal.showValidationMessage('เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก');
    return false;
  }

  const cars = [];
  const changes = [];
  if (name !== c.name) changes.push(`ชื่อ: ${c.name || '-'} → ${name}`);
  if (phone !== c.phone) changes.push(`เบอร์: ${fmtPhone(c.phone)} → ${fmtPhone(phone)}`);

  const rows = box.querySelectorAll('.cu-ecar');
  for (const row of rows) {
    const v = c.cars[Number(row.dataset.k)];
    const head = row.querySelector('.cu-ph').value.trim();
    const tail = row.querySelector('.cu-pt').value.trim();
    // ตรวจรูปแบบเฉพาะคันที่แก้ทะเบียน (5 ต.ค. 2569)
    // 🔴 ของเดิมตรวจทุกคัน -> ลูกค้าที่มีทะเบียนเก่ารูปแบบแปลก ๆ อยู่คันหนึ่ง (เช่น "3ok 557")
    //    แก้ชื่อ/เบอร์/คันอื่นไม่ได้เลย ทั้งที่ไม่ได้แตะคันนั้น (เจอตอนทดสอบบนระบบจริง)
    const orig = splitPlate(v.plate);
    const plateSame = head === orig.head && tail === orig.tail;
    if (!plateSame) {
      const chk = plateValidate(head, tail, { required: false });
      if (!chk.ok) {
        Swal.showValidationMessage(`${carTitle(v)}: ${chk.warn}`);
        return false;
      }
    }
    const plate = plateSame ? String(v.plate || '').trim() : platePretty(head, tail);
    const province = plate ? row.querySelector('.cu-prov').value : '';
    cars.push({ brand: v.brand, model: v.model, year: v.year, plate, province });
    if (plate !== (v.plate || '') || province !== (v.province || '')) {
      const before = `${v.plate || ''} ${v.province || ''}`.trim() || '-';
      const after = `${plate} ${province}`.trim() || '(ลบออก)';
      changes.push(`${[v.brand, v.model].join(' ')}: ${before} → ${after}`);
    }
  }

  return { userId: c.userId, name, phone, cars, changes };
}

async function confirmAndSave(i, d) {
  if (!d.changes.length) {
    Swal.fire({ icon: 'info', title: 'ไม่มีอะไรเปลี่ยน', timer: 1400, showConfirmButton: false });
    return;
  }
  const ok = await Swal.fire({
    icon: 'question',
    title: 'ยืนยันการแก้ไข',
    html: `<ul class="cu-diff">${d.changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`,
    showCancelButton: true,
    confirmButtonText: '✅ ยืนยัน',
    cancelButtonText: 'กลับไปแก้'
  });
  if (!ok.isConfirmed) return openEditWith(i, d);

  Swal.fire({ title: '⏳ กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let res;
  try {
    res = await call({ op: 'save', userId: d.userId, name: d.name, phone: d.phone, cars: d.cars });
  } catch (err) {
    console.warn('บันทึกไม่สำเร็จ:', err);
    await Swal.fire('❌ ส่งข้อมูลไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วลองใหม่', 'error');
    return openEditWith(i, d);
  }
  if (!res) return;
  if (res.status !== 'success') {
    await Swal.fire('❌ บันทึกไม่สำเร็จ', res.message || '', 'error');
    return openEditWith(i, d);
  }

  if (res.customer) list[i] = res.customer;
  renderList();
  const shared = (res.phoneSharedWith || []).length
    ? `<p class="cu-warn">ℹ️ เบอร์นี้มีลูกค้าอีก ${res.phoneSharedWith.length} คนใช้อยู่ด้วย (${res.phoneSharedWith.map(esc).join(', ')}) — ถ้าเป็นคนในบ้านเดียวกันก็ไม่เป็นไร</p>`
    : '';
  Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', html: shared || undefined,
              timer: shared ? undefined : 1500, showConfirmButton: !!shared });
}

// กด "กลับไปแก้" / บันทึกไม่ผ่าน -> เปิดฟอร์มพร้อมค่าที่กรอกไว้ ไม่ใช่ค่าเดิมในชีต
function openEditWith(i, d) {
  openEdit(i, { name: d.name, phone: d.phone, cars: d.cars });
}


// ── ⭐ เพิ่มแต้ม (บัตรสะสมเดิม / ชดเชย) ──────────────────────────────────────
// บวกได้อย่างเดียว · ครั้งละ 1–BONUS_MAX แต้ม (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น)
// ไม่ลงประวัติการใช้บริการ ไม่ต่ออายุแต้ม — เป็นแต้มของขวัญ ไม่ใช่การมาใช้บริการ
const BONUS_MAX = 500;
const BONUS_AMOUNTS = [10, 20, 50, 100];
const BONUS_REASONS = ['บัตรสะสมเดิม (ล้าง 10 ฟรี 1)', 'ชดเชยงานที่บันทึกไม่ได้'];

// ต่อการกดยืนยัน 1 ครั้ง — เน็ตหลุดแล้วกดส่งซ้ำ เซิร์ฟเวอร์จะคืนผลเดิม ไม่บวกซ้ำ
function newReqId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// pre = ค่าที่กรอกค้างไว้ (กดกลับไปแก้ / ส่งไม่ผ่าน)
function openBonus(i, pre) {
  const c = list[i];
  if (!c || !(c.cars || []).length) return;
  pre = pre || {};
  const k0 = pre.k != null ? pre.k : (c.cars.length === 1 ? 0 : -1);
  const reason0 = pre.reason != null ? pre.reason : BONUS_REASONS[0];

  const carHtml = c.cars.length === 1
    ? `<div class="bp-one">🚗 ${esc(carTitle(c.cars[0]))} <span class="cu-ecar-pts">${c.cars[0].points || 0} แต้ม</span></div>`
    : `<div class="bp-chips" id="bpCars">${c.cars.map((v, k) =>
        `<button type="button" class="bp-chip${k === k0 ? ' is-on' : ''}" data-k="${k}">🚗 ${esc(carTitle(v))} · ${v.points || 0}</button>`).join('')}</div>`;

  Swal.fire({
    title: '⭐ เพิ่มแต้ม',
    html: `
      <p class="bp-who">${esc(c.name || '(ไม่มีชื่อ)')}</p>
      <div class="fld"><label class="fld-lbl">รถคันไหน</label>${carHtml}</div>
      <div class="fld"><label class="fld-lbl" for="bpPts">กี่แต้ม</label>
        <div class="bp-chips" id="bpAmts">${BONUS_AMOUNTS.map(a =>
          `<button type="button" class="bp-chip${Number(pre.pts) === a ? ' is-on' : ''}" data-a="${a}">+${a}</button>`).join('')}</div>
        <input id="bpPts" class="swal2-input" type="text" inputmode="numeric" maxlength="3" placeholder="หรือพิมพ์จำนวนแต้ม" value="${esc(pre.pts || '')}" autocomplete="off"></div>
      <div class="fld"><label class="fld-lbl" for="bpReason">เหตุผล <span class="fld-sub">— ลูกค้าจะเห็นใน LINE</span></label>
        <div class="bp-chips" id="bpReasons">${BONUS_REASONS.map(r =>
          `<button type="button" class="bp-chip${r === reason0 ? ' is-on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
        <input id="bpReason" class="swal2-input" maxlength="120" value="${esc(reason0)}" autocomplete="off"></div>
      <p class="cu-note">เพิ่มได้ครั้งละไม่เกิน ${BONUS_MAX} แต้ม · ไม่ลงประวัติการใช้บริการ · ลูกค้าได้ LINE แจ้งทันที · เก็บบันทึกไว้ที่ชีต Point_Adjust_Log</p>`,
    showCancelButton: true,
    confirmButtonText: 'ถัดไป ›',
    cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'cu-pop' },
    didOpen: () => {
      const box = Swal.getHtmlContainer();
      box.dataset.k = k0;
      box.addEventListener('click', ev => {
        const b = ev.target.closest('.bp-chip');
        if (!b) return;
        b.parentElement.querySelectorAll('.bp-chip').forEach(x => x.classList.toggle('is-on', x === b));
        if (b.dataset.k != null) box.dataset.k = b.dataset.k;
        if (b.dataset.a != null) $('bpPts').value = b.dataset.a;
        if (b.dataset.r != null) $('bpReason').value = b.dataset.r;
        Swal.resetValidationMessage();
      });
      box.addEventListener('input', ev => {
        if (ev.target.id === 'bpPts') {
          const v = ev.target.value.replace(/\D/g, '').slice(0, 3);
          if (ev.target.value !== v) ev.target.value = v;
          $('bpAmts').querySelectorAll('.bp-chip').forEach(x => x.classList.toggle('is-on', x.dataset.a === v));
        } else if (ev.target.id === 'bpReason') {
          $('bpReasons').querySelectorAll('.bp-chip').forEach(x => x.classList.toggle('is-on', x.dataset.r === ev.target.value));
        }
      });
    },
    preConfirm: () => collectBonus(c)
  }).then(r => {
    if (r.isConfirmed && r.value) confirmBonus(i, r.value);
  });
}

// ตรวจค่า — ทำใน preConfirm ห้ามเปิดป๊อปอัปอื่นในนี้ (Swal เปิดได้ทีละอัน)
function collectBonus(c) {
  const k = Number(Swal.getHtmlContainer().dataset.k);
  if (!(k >= 0) || !c.cars[k]) { Swal.showValidationMessage('เลือกรถก่อน'); return false; }
  const raw = $('bpPts').value.trim();
  const pts = Number(raw);
  if (!raw || !Number.isInteger(pts) || pts < 1) { Swal.showValidationMessage('ใส่จำนวนแต้ม (ตัวเลข 1 ขึ้นไป)'); return false; }
  if (pts > BONUS_MAX) { Swal.showValidationMessage(`เพิ่มได้ครั้งละไม่เกิน ${BONUS_MAX} แต้ม`); return false; }
  const reason = $('bpReason').value.replace(/\s+/g, ' ').trim();
  if (!reason.replace(/^[=+\-@\s]+/, '')) { Swal.showValidationMessage('ใส่เหตุผล'); return false; }
  return { k, pts, reason };
}

async function confirmBonus(i, d) {
  const c = list[i];
  const v = c.cars[d.k];
  const before = v.points || 0;
  const ok = await Swal.fire({
    icon: 'question',
    title: `เพิ่ม ${d.pts} แต้ม?`,
    html: `<ul class="cu-diff">
        <li>ลูกค้า: <b>${esc(c.name || '-')}</b></li>
        <li>รถ: ${esc(carTitle(v))}${v.plate ? ' · ' + esc(v.plate) : ''}</li>
        <li>แต้ม: ${before} → <b>${before + d.pts}</b></li>
        <li>เหตุผล: ${esc(d.reason)}</li>
      </ul>`,
    showCancelButton: true,
    confirmButtonText: '✅ ยืนยันเพิ่มแต้ม',
    cancelButtonText: 'กลับไปแก้'
  });
  if (!ok.isConfirmed) return openBonus(i, d);

  // reqId ติดไปกับ d — ส่งไม่ผ่านเพราะเน็ตแล้วกดยืนยันใหม่ ใช้ตัวเดิม เซิร์ฟเวอร์จะไม่บวกซ้ำ
  if (!d.reqId) d.reqId = newReqId();
  Swal.fire({ title: '⏳ กำลังเพิ่มแต้ม...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let res;
  try {
    res = await call({ op: 'add', userId: c.userId, brand: v.brand, model: v.model, year: v.year,
                       points: d.pts, reason: d.reason, reqId: d.reqId }, 'bonus_points');
  } catch (err) {
    console.warn('เพิ่มแต้มไม่สำเร็จ:', err);
    await Swal.fire('❌ ส่งข้อมูลไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วกดยืนยันใหม่ได้เลย (ระบบกันบวกซ้ำให้แล้ว)', 'error');
    return confirmBonus(i, d);
  }
  if (!res) return;
  if (res.status !== 'success') {
    await Swal.fire('❌ เพิ่มแต้มไม่สำเร็จ', res.message || '', 'error');
    return openBonus(i, { k: d.k, pts: d.pts, reason: d.reason });   // แก้ค่าแล้วส่งใหม่ = คำขอใหม่
  }

  v.points = res.after;
  renderList();
  Swal.fire({ icon: 'success', title: `เพิ่ม ${d.pts} แต้มแล้ว`,
    html: `แต้มคงเหลือ <b>${res.after}</b> แต้ม<br><span class="cu-warn">ลูกค้าได้ LINE แจ้งแล้ว</span>` });
}


// ═══════════════════════════════════════════════════════════════════════════
//  เริ่มทำงาน
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  $('searchForm').addEventListener('submit', ev => {
    ev.preventDefault();
    $('q').blur();                         // ปิดคีย์บอร์ดมือถือ จะได้เห็นผล
    search($('q').value.trim());
  });
  // ⭐ อยู่ในการ์ด -> ต้องเช็คก่อน ไม่งั้นกดแล้วไปเปิดฟอร์มแก้ไขแทน
  $('list').addEventListener('click', ev => {
    const b = ev.target.closest('.cu-bonus');
    if (b) return openBonus(Number(b.dataset.bonus));
    const card = ev.target.closest('.cu-card');
    if (card) openEdit(Number(card.dataset.i));
  });
  $('list').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const b = ev.target.closest('.cu-bonus');
    if (b) { ev.preventDefault(); return openBonus(Number(b.dataset.bonus)); }
    const card = ev.target.closest('.cu-card');
    if (card) { ev.preventDefault(); openEdit(Number(card.dataset.i)); }
  });

  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) return liff.login();
    const profile = await liff.getProfile();
    adminUserId = profile.userId;
    if (liff.getIDToken && typeof liff.getIDToken === 'function') {
      idToken = await liff.getIDToken();
    }
    search('');
  } catch (err) {
    console.error('LIFF ผิดพลาด:', err);
    Swal.fire({ icon: 'error', title: 'เปิดหน้านี้ไม่สำเร็จ',
      text: 'กรุณาปิดแล้วเปิดใหม่อีกครั้ง', confirmButtonText: 'ปิดหน้าต่าง'
    }).then(() => liff.closeWindow());
  }
});
