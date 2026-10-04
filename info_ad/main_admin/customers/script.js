// หน้า "👥 ข้อมูลลูกค้า" ของผู้ดูแล (4 ต.ค. 2569) — คู่กับ customer_admin.gs
//
// แก้ได้: ชื่อ · เบอร์โทร · ทะเบียน/จังหวัด ของรถแต่ละคัน
// 🔴 แก้ไม่ได้โดยตั้งใจ: ยี่ห้อ/รุ่น/ปี (กุญแจผูกกับประวัติ) และแต้ม (แต้ม = เงินสด)
//    ด่านจริงอยู่ที่เซิร์ฟเวอร์ (bcGuardAdmin_ + ระดับ) หน้านี้แค่ไม่มีช่องให้กรอก
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';

const $ = id => document.getElementById(id);

let adminUserId = '', idToken = '';
let list = [];          // ผลค้นที่แสดงอยู่
let lastQuery = '';

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
async function call(body) {
  const res = await fetch(`${GAS_ENDPOINT}?action=cust_admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ adminUserId, idToken }, body))
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
          <span class="cu-go">แก้ไข ›</span>
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
      <p class="cu-note">ยี่ห้อ/รุ่น/ปี และแต้ม แก้ที่หน้านี้ไม่ได้ — ยี่ห้อ/รุ่น/ปีใช้ผูกกับประวัติการใช้บริการ ถ้าแก้แล้วประวัติกับแต้มจะหลุดจากรถคันนั้น</p>`,
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
    const chk = plateValidate(head, tail, { required: false });
    if (!chk.ok) {
      Swal.showValidationMessage(`${carTitle(v)}: ${chk.warn}`);
      return false;
    }
    const plate = platePretty(head, tail);
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


// ═══════════════════════════════════════════════════════════════════════════
//  เริ่มทำงาน
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  $('searchForm').addEventListener('submit', ev => {
    ev.preventDefault();
    $('q').blur();                         // ปิดคีย์บอร์ดมือถือ จะได้เห็นผล
    search($('q').value.trim());
  });
  $('list').addEventListener('click', ev => {
    const card = ev.target.closest('.cu-card');
    if (card) openEdit(Number(card.dataset.i));
  });
  $('list').addEventListener('keydown', ev => {
    const card = ev.target.closest('.cu-card');
    if (card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openEdit(Number(card.dataset.i)); }
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
