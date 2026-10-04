// หน้า "📝 คำขอแก้ไขข้อมูล" ของผู้ดูแล (5 ต.ค. 2569) — คู่กับ edit_request.gs
//
// ลูกค้าส่งคำขอจากปุ่ม ⋯ ในหน้าสมาชิก -> หน้านี้แสดงของเดิม/ที่ขอ + เช็คกับฐานข้อมูลรถ
// ผู้ดูแลแก้ค่าสุดท้ายได้ก่อนกด (เผื่อลูกค้าพิมพ์ผิด) -> อนุมัติ = ข้อมูลเปลี่ยนจริง + LINE แจ้งลูกค้า
// 🔴 ด่านจริงอยู่ที่เซิร์ฟเวอร์ (bcGuardAdmin_ + ระดับ) และการเปลี่ยนรถทำทุกชีตพร้อมกันที่นั่น
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const liffId = '2007421084-2OgzWbpV';
const CATALOG_SRC = '../../../register/all_car_model.js';

const $ = id => document.getElementById(id);
let adminUserId = '', idToken = '';
let pending = [];
const readers = [];      // ตัวอ่านค่ารถของแต่ละการ์ด (car_picker.js)

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 10 ? d.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : d || '-';
}
function carText(c) {
  if (!c) return '-';
  const d = typeof carDisplay === 'function' ? carDisplay(c.brand, c.model, c.year) : null;
  return d ? [d.brand, d.family, d.sub].filter(Boolean).join(' ') + (c.year ? ' ปี ' + c.year : '')
           : [c.brand, c.model, c.year].filter(Boolean).join(' ');
}
function splitPlate(p) {
  const m = String(p || '').trim().match(/^(.*?)\s*(\d{1,4})$/);
  return m ? { head: m[1].replace(/\s+/g, ''), tail: m[2] } : { head: String(p || '').replace(/\s+/g, ''), tail: '' };
}

async function call(body) {
  const res = await fetch(`${GAS_ENDPOINT}?action=edit_req`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ adminUserId, idToken }, body))
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'error' && data.code) {
    const relogin = data.code === 'IDTOKEN_INVALID';
    await Swal.fire({ icon: 'error', title: relogin ? 'เซสชันหมดอายุ' : 'ไม่มีสิทธิ์ใช้เมนูนี้',
      text: data.message || '', confirmButtonText: relogin ? 'เข้าสู่ระบบใหม่' : 'ปิด' });
    if (relogin) liff.login(); else liff.closeWindow();
    return null;
  }
  return data;
}


// ── โหลด + แสดง ────────────────────────────────────────────────────────────
async function load() {
  $('status').textContent = '⏳ กำลังโหลดคำขอ...';
  $('reloadBtn').disabled = true;
  try {
    const [data, hasCat] = await Promise.all([call({ op: 'list' }), carPickLoad(CATALOG_SRC)]);
    if (!data) return;
    if (data.status !== 'success') throw new Error(data.message || 'โหลดไม่สำเร็จ');
    pending = data.pending || [];
    render(hasCat);
    renderDone(data.done || []);
    $('status').textContent = pending.length ? `รอตรวจ ${pending.length} รายการ` : '✅ ไม่มีคำขอรอตรวจ';
  } catch (err) {
    console.warn('โหลดคำขอไม่สำเร็จ:', err);
    $('status').textContent = '⚠️ เชื่อมต่อไม่ได้ เช็คสัญญาณเน็ตแล้วลองใหม่';
  } finally {
    $('reloadBtn').disabled = false;
  }
}

function carCheckHtml(r) {
  const w = (r.want || {}).car || {};
  if (r.carKnown) return `<div class="rq-chk ok">✅ รุ่นนี้มีในฐานข้อมูล</div>`;
  if (r.suggest && r.suggest.model) {
    return `<div class="rq-chk warn">⚠️ "${esc(w.brand)} ${esc(w.model)}" ไม่มีในฐานข้อมูล<br>` +
      `น่าจะเป็น <b>${esc(r.suggest.brand)} ${esc(r.suggest.model)}</b>` +
      `${r.suggest.sure ? ' (ใส่ให้ในช่องด้านล่างแล้ว)' : ' — ตรวจก่อนนะ'}</div>`;
  }
  return `<div class="rq-chk warn">⚠️ ไม่รู้จัก "${esc(w.brand)} ${esc(w.model)}" — เลือกยี่ห้อ/รุ่นให้ถูกก่อนอนุมัติ</div>`;
}

function render(hasCat) {
  readers.length = 0;
  $('list').innerHTML = pending.map((r, i) => {
    const b = r.before || {}, w = r.want || {};
    const wc = Object.assign({}, w.car || {});
    // ลูกค้าพิมพ์รุ่นเองแล้วตัวจับคู่มั่นใจ -> ใส่ค่าที่ถูกให้เลย ผู้ดูแลแค่ตรวจ
    if (!r.carKnown && r.suggest && r.suggest.sure && r.suggest.model) { wc.brand = r.suggest.brand; wc.model = r.suggest.model; }
    const pl = splitPlate(wc.plate);
    const bk = hasCat && carPickKnownBrand(wc.brand), mk = bk && carPickKnownModel(wc.brand, wc.model);
    return `<div class="rq-card" data-i="${i}">
      <div class="rq-top">
        <div><div class="rq-name">${esc(r.custName || b.name || '-')}</div>
             <div class="rq-meta">📞 ${esc(fmtPhone(b.phone))} · ส่งเมื่อ ${esc(r.at)}${r.points !== null && r.points !== undefined ? ` · ⭐ ${r.points} แต้ม` : ''}</div></div>
      </div>
      <div class="rq-car">🚗 ตอนนี้: ${esc(carText(b.car))}${b.car && b.car.plate ? ' · ' + esc(b.car.plate) : ''}</div>
      <div class="rq-lbl">ลูกค้าขอแก้</div>
      <ul class="rq-diff">${(r.changes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${w.note ? `<div class="rq-note">💬 ${esc(w.note)}</div>` : ''}
      ${r.stale ? `<div class="rq-chk bad">⛔ รถคันนี้ถูกแก้ไปแล้วหลังลูกค้าส่งคำขอ — อนุมัติไม่ได้ ให้กด "ไม่อนุมัติ" แล้วให้ลูกค้าส่งใหม่</div>` : carCheckHtml(r)}

      <div class="rq-lbl">ค่าที่จะบันทึก <span class="rq-lbl-sub">— แก้ได้ก่อนกดอนุมัติ</span></div>
      <div class="rq-grid">
        <label>ชื่อ<input class="rq-in" data-f="name" maxlength="60" value="${esc(w.name)}"></label>
        <label>เบอร์โทร<input class="rq-in" data-f="phone" type="tel" inputmode="numeric" maxlength="12" value="${esc(w.phone)}"></label>
        <label>ยี่ห้อ
          ${hasCat ? `<select class="rq-in" data-cp="b${i}">${carPickBrandOptions(wc.brand)}</select>` : ''}
          <input class="rq-in${hasCat && bk ? ' hidden' : ''}" data-cp="bo${i}" maxlength="40" placeholder="พิมพ์ยี่ห้อ" value="${hasCat && bk ? '' : esc(wc.brand)}"></label>
        <label>รุ่น
          ${hasCat ? `<select class="rq-in" data-cp="m${i}">${carPickModelOptions(bk ? wc.brand : '', wc.model)}</select>` : ''}
          <input class="rq-in${hasCat && mk ? ' hidden' : ''}" data-cp="mo${i}" maxlength="40" placeholder="พิมพ์รุ่น" value="${hasCat && mk ? '' : esc(wc.model)}"></label>
        <label>ปี<select class="rq-in" data-cp="y${i}">${carPickYearOptions(wc.brand, wc.model, wc.year)}</select></label>
        <label>ทะเบียน
          <span class="rq-plate"><input class="rq-in" data-f="ph" placeholder="หมวด" value="${esc(pl.head)}"><input class="rq-in" data-f="pt" inputmode="numeric" maxlength="4" placeholder="เลข" value="${esc(pl.tail)}"></span>
          <select class="rq-in" data-f="prov">${typeof plateProvinceOptions === 'function' ? plateProvinceOptions(wc.province) : ''}</select></label>
      </div>
      <div class="rq-btns">
        <button type="button" class="btn" data-act="ok" data-i="${i}"${r.stale ? ' disabled' : ''}>✅ อนุมัติ</button>
        <button type="button" class="btn outline" data-act="no" data-i="${i}">❌ ไม่อนุมัติ</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.rq-card').forEach(card => {
    const i = Number(card.dataset.i);
    readers[i] = carPickWire(card, { brand: 'b' + i, brandOther: 'bo' + i, model: 'm' + i, modelOther: 'mo' + i, year: 'y' + i });
    card.querySelector('[data-f="ph"]').addEventListener('input', e => {
      if (typeof plateCleanHead === 'function') { const c = plateCleanHead(e.target.value); if (c !== e.target.value) e.target.value = c; }
    });
  });
}

function renderDone(done) {
  $('doneBox').classList.toggle('hidden', !done.length);
  $('doneList').innerHTML = done.map(d => `<div class="rq-done-item">
      <b>${esc(d.custName)}</b> · <span class="${d.status === 'อนุมัติ' ? 'ok' : 'no'}">${esc(d.status)}</span>
      · ${esc(d.reviewer)} · ${esc(d.reviewedAt)}
      ${d.applied ? `<div class="rq-done-sub">${esc(d.applied)}</div>` : ''}${d.note ? `<div class="rq-done-sub">💬 ${esc(d.note)}</div>` : ''}
    </div>`).join('');
}


// ── อนุมัติ / ไม่อนุมัติ ───────────────────────────────────────────────────
function readFinal(i) {
  const card = document.querySelector(`.rq-card[data-i="${i}"]`);
  const f = k => card.querySelector(`[data-f="${k}"]`).value.trim();
  const car = readers[i] ? readers[i]() : { brand: '', model: '', year: '' };
  const head = f('ph'), tail = f('pt');
  // ตรวจรูปแบบเฉพาะเมื่อทะเบียนต่างจากของเดิมในระบบ — ทะเบียนเก่ารูปแบบแปลก ๆ ต้องไม่ขวางการอนุมัติเรื่องอื่น
  const cur = ((pending[i] || {}).before || {}).car || {};
  const o = splitPlate(cur.plate);
  const plateSame = head === o.head && tail === o.tail;
  const chk = plateSame || typeof plateValidate !== 'function' ? { ok: true } : plateValidate(head, tail, { required: false });
  const plate = plateSame ? String(cur.plate || '').trim()
    : (typeof platePretty === 'function' ? platePretty(head, tail) : (head + ' ' + tail).trim());
  return {
    err: !f('name') ? 'ชื่อว่างไม่ได้'
       : !/^0\d{8,9}$/.test(f('phone').replace(/\D/g, '')) ? 'เบอร์โทรไม่ถูกต้อง'
       : !car.brand || !car.model ? 'เลือกยี่ห้อ/รุ่นให้ครบ'
       : !car.year ? 'เลือกปีรถ'
       : !chk.ok ? chk.warn : '',
    final: { name: f('name').replace(/\s+/g, ' '), phone: f('phone').replace(/\D/g, ''),
             brand: car.brand, model: car.model, year: car.year, plate, province: plate ? f('prov') : '' }
  };
}

async function approve(i) {
  const r = pending[i];
  const { err, final } = readFinal(i);
  if (err) return Swal.fire({ icon: 'warning', title: err });
  const b = r.before || {}, bc = b.car || {};
  const lines = [];
  if (final.name !== b.name) lines.push(`ชื่อ: ${b.name || '-'} → ${final.name}`);
  if (final.phone !== b.phone) lines.push(`เบอร์: ${fmtPhone(b.phone)} → ${fmtPhone(final.phone)}`);
  if ([bc.brand, bc.model, String(bc.year)].join('|') !== [final.brand, final.model, final.year].join('|')) {
    lines.push(`รถ: ${carText(bc)} → ${carText(final)}`);
  }
  if (`${bc.plate || ''} ${bc.province || ''}`.trim() !== `${final.plate} ${final.province}`.trim()) {
    lines.push(`ทะเบียน: ${`${bc.plate || ''} ${bc.province || ''}`.trim() || '-'} → ${`${final.plate} ${final.province}`.trim() || '(ลบออก)'}`);
  }
  const unknown = !carPickKnownModel(final.brand, final.model);
  const ok = await Swal.fire({
    icon: 'question', title: 'อนุมัติคำขอนี้?',
    html: (lines.length ? `<ul class="rq-diff">${lines.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : 'ไม่มีอะไรเปลี่ยนจากเดิม') +
          (unknown ? '<p class="rq-warn">⚠️ ยี่ห้อ/รุ่นนี้ไม่มีในฐานข้อมูล จะบันทึกตามที่พิมพ์</p>' : '') +
          '<p class="rq-warn">ลูกค้าจะได้รับ LINE แจ้งว่าแก้ให้แล้ว</p>',
    showCancelButton: true, confirmButtonText: '✅ อนุมัติ', cancelButtonText: 'กลับไปแก้'
  });
  if (!ok.isConfirmed) return;
  Swal.fire({ title: '⏳ กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  try {
    const res = await call({ op: 'approve', reqId: r.reqId, final });
    if (!res) return;
    if (res.status !== 'success') return Swal.fire('❌ อนุมัติไม่สำเร็จ', res.message || '', 'error');
    await Swal.fire({ icon: 'success', title: 'อนุมัติแล้ว',
      html: (res.changes || []).length ? `<ul class="rq-diff">${res.changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '',
      timer: 2200, showConfirmButton: false });
    load();
  } catch (e) {
    Swal.fire('❌ ส่งไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วลองใหม่', 'error');
  }
}

async function reject(i) {
  const r = pending[i];
  const ans = await Swal.fire({
    icon: 'warning', title: 'ไม่อนุมัติคำขอนี้?',
    input: 'text', inputPlaceholder: 'เหตุผล (ลูกค้าจะเห็นใน LINE) — ไม่บังคับ',
    inputAttributes: { maxlength: 200 },
    showCancelButton: true, confirmButtonText: '❌ ไม่อนุมัติ', cancelButtonText: 'กลับ'
  });
  if (!ans.isConfirmed) return;
  try {
    const res = await call({ op: 'reject', reqId: r.reqId, reason: ans.value || '' });
    if (!res) return;
    if (res.status !== 'success') return Swal.fire('ทำไม่สำเร็จ', res.message || '', 'error');
    await Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1500, showConfirmButton: false });
    load();
  } catch (e) {
    Swal.fire('❌ ส่งไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วลองใหม่', 'error');
  }
}


// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  $('reloadBtn').addEventListener('click', load);
  $('list').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    const i = Number(b.dataset.i);
    if (b.dataset.act === 'ok') approve(i); else reject(i);
  });
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) return liff.login();
    adminUserId = (await liff.getProfile()).userId;
    if (liff.getIDToken && typeof liff.getIDToken === 'function') idToken = await liff.getIDToken();
    load();
  } catch (err) {
    console.error('LIFF ผิดพลาด:', err);
    Swal.fire({ icon: 'error', title: 'เปิดหน้านี้ไม่สำเร็จ', text: 'กรุณาปิดแล้วเปิดใหม่อีกครั้ง', confirmButtonText: 'ปิดหน้าต่าง' })
      .then(() => liff.closeWindow());
  }
});
