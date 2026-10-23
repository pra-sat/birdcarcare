// 🛟 กู้รายการที่บันทึกไม่สำเร็จ (23 ต.ค. 2569) — ระดับ 5 · คู่กับ sys_admin.gs + recover.gs
// เดิมต้องเปิดชีตแล้วกดเมนู ตอนนี้ทำจากมือถือได้ทีละรายการ
//   ไว   : เห็นทุกอย่างที่ต้องใช้ตัดสินในการ์ดเดียว (รถ บริการ ราคา ใครบันทึก ทำไมพัง ผลถ้ากู้)
//   ชัวร์ : ผล "ถ้ากู้" มาจากพรีวิวที่เดินด่านเดียวกับของจริง · กู้ทีละรายการ ถามยืนยันก่อน
//           กดซ้ำ/อีกเครื่องกู้ไปแล้ว เซิร์ฟเวอร์ตรวจในล็อกแล้วตอบว่าทำไปแล้ว ไม่บวกแต้มซ้ำ
let pending = [];

async function loadList() {
  $('status').textContent = '⏳ กำลังโหลด...';
  let d;
  try { d = await sysCallRetry({ op: 'fail_list' }); }
  catch (e) { $('status').textContent = '⚠️ เชื่อมต่อไม่ได้ เช็คสัญญาณเน็ตแล้วลองใหม่'; return; }
  if (!d) return;
  if (d.status !== 'success') { $('status').textContent = '⚠️ ' + (d.message || 'โหลดไม่สำเร็จ'); return; }
  pending = d.pending || [];
  $('status').textContent = pending.length ? `ค้างรอตัดสิน ${pending.length} รายการ` : '';
  render(d);
}

function previewHtml(p) {
  const pv = p.preview;
  if (!pv) return `<div class="sy-preview is-skip">ยังคำนวณผลไม่ได้ (กดกู้แล้วระบบจะตรวจให้อีกรอบ)</div>`;
  if (pv.kind === 'ok') return `<div class="sy-preview">✅ กู้ได้: ลูกค้าได้ <b>+${pv.point} แต้ม</b> (${pv.before} → ${pv.after})</div>`;
  if (pv.kind === 'skip') return `<div class="sy-preview is-skip">⏭️ ${esc(pv.text)}</div>`;
  return `<div class="sy-preview is-fail">❌ ${esc(pv.text)}</div>`;
}

function render(d) {
  const cards = pending.map((p, i) => {
    const kind = p.preview ? p.preview.kind : 'ok';
    const main = kind === 'skip' ? '✔️ ปิดรายการนี้' : kind === 'fail' ? '' : '🛟 กู้รายการนี้';
    return `<div class="sy-card is-bad">
      <div class="sy-row"><span class="sy-card-title">🚗 ${esc(p.car || '-')}</span><span class="sy-money">${Number(p.price || 0).toLocaleString()} บาท</span></div>
      <div class="sy-meta">${esc(p.service || '-')}${p.payWay ? ' · ' + esc(p.payWay) : ''}</div>
      <div class="sy-meta">👤 ${esc(p.customer || '-')} · บันทึกโดย ${esc(p.admin || '-')}</div>
      <div class="sy-when">🕒 ${esc(p.whenText)} · ${esc(p.reason)}</div>
      ${previewHtml(p)}
      <div class="sy-acts">
        ${main ? `<button type="button" class="btn" data-act="recover" data-i="${i}">${main}</button>` : ''}
        <span class="sy-link" role="button" tabindex="0" data-act="dismiss" data-i="${i}">ไม่กู้</span>
      </div>
    </div>`;
  }).join('');
  const recent = (d.recent || []).map(r => `<div class="sy-card is-ok">
      <div class="sy-row"><span>${esc(r.car)} · ${esc(r.service)}</span><span class="sy-money">${Number(r.price || 0).toLocaleString()}</span></div>
      <div class="sy-when">${esc(r.whenText)} · ${esc(r.status)}</div></div>`).join('');
  $('main').innerHTML =
    (pending.length ? `<div class="sy-list">${cards}</div>`
                    : `<div class="sy-banner is-ok">✅ ไม่มีรายการค้าง<small>ทุกงานถูกบันทึกครบแล้ว</small></div>`) +
    (recent ? `<div class="sy-sec-title">จัดการล่าสุด</div><div class="sy-list">${recent}</div>` : '');
}

async function doRecover(p, btn) {
  const pv = p.preview || {};
  const skip = pv.kind === 'skip';
  const ask = await Swal.fire({
    title: skip ? 'ปิดรายการนี้?' : 'กู้รายการนี้?',
    html: `<div style="text-align:left;font-size:14.5px;line-height:1.6">
        🚗 ${esc(p.car)}<br>🧽 ${esc(p.service)} · <b>${Number(p.price || 0).toLocaleString()} บาท</b><br>
        🕒 ลงวันที่เกิดเหตุ ${esc(p.whenText)}<br>
        ${skip ? `⏭️ ${esc(pv.text)} — ระบบจะไม่ให้แต้มซ้ำ`
               : `⭐ ลูกค้าได้ <b>+${pv.point || 0} แต้ม</b> และได้ LINE แจ้งว่าเป็นรายการย้อนหลัง`}
      </div>`,
    showCancelButton: true,
    confirmButtonText: skip ? 'ปิดรายการ' : 'กู้เลย',
    cancelButtonText: 'ยกเลิก'
  });
  if (!ask.isConfirmed) return;
  btn.disabled = true;
  Swal.fire({ title: 'กำลังกู้...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let r;
  try { r = await sysCallRetry({ op: 'recover', row: p.row }); }
  catch (e) {
    await Swal.fire({ icon: 'warning', title: 'ส่งข้อมูลไม่สำเร็จ', text: 'เช็คสัญญาณเน็ตแล้วกดอีกครั้งได้เลย ระบบกันกู้ซ้ำให้แล้ว' });
    btn.disabled = false;
    return;
  }
  if (!r) return;
  if (r.status !== 'success') {
    await Swal.fire({ icon: 'error', title: 'กู้ไม่สำเร็จ', text: r.message || '' });
  } else {
    await Swal.fire({
      icon: r.kind === 'ok' ? 'success' : r.kind === 'fail' ? 'error' : 'info',
      title: r.kind === 'ok' ? 'กู้แล้ว' : r.already ? 'จัดการไปแล้ว' : 'ปิดรายการแล้ว',
      text: r.text + (r.after != null && r.kind === 'ok' ? ` · แต้มคงเหลือ ${r.after}` : ''),
      timer: r.kind === 'ok' ? 2200 : undefined
    });
  }
  loadList();
}

async function doDismiss(p) {
  const reasons = ['ลูกค้าไม่ได้ใช้บริการจริง', 'คีย์ใหม่เองไปแล้ว', 'ข้อมูลผิด'];
  const ask = await Swal.fire({
    title: 'ไม่กู้รายการนี้?',
    html: `<div style="text-align:left;font-size:14px">${esc(p.car)} · ${esc(p.service)} ${Number(p.price || 0).toLocaleString()} บาท
      <div class="sy-chips" id="rsChips">${reasons.map(r => `<div class="sy-chip" role="button" data-r="${esc(r)}"><b>${esc(r)}</b></div>`).join('')}</div>
      <input class="sy-name" id="rsText" placeholder="หรือพิมพ์เหตุผลเอง" maxlength="120"></div>
      <p class="sy-note">ไม่แตะแต้มลูกค้า · ทำเครื่องหมายในชีตว่าไม่กู้ พร้อมชื่อคุณและเหตุผล</p>`,
    showCancelButton: true, confirmButtonText: 'ยืนยันไม่กู้', cancelButtonText: 'ยกเลิก',
    didOpen: () => {
      $('rsChips').addEventListener('click', ev => {
        const c = ev.target.closest('.sy-chip'); if (!c) return;
        document.querySelectorAll('#rsChips .sy-chip').forEach(x => x.classList.toggle('is-on', x === c));
        $('rsText').value = c.dataset.r;
      });
    },
    preConfirm: () => {
      const v = $('rsText').value.trim();
      if (!v) { Swal.showValidationMessage('เลือกหรือพิมพ์เหตุผลก่อน'); return false; }
      return v;
    }
  });
  if (!ask.isConfirmed) return;
  let r;
  try { r = await sysCallRetry({ op: 'dismiss', row: p.row, reason: ask.value }); }
  catch (e) { await Swal.fire({ icon: 'warning', title: 'ส่งข้อมูลไม่สำเร็จ', text: 'เช็คสัญญาณเน็ตแล้วลองใหม่' }); return; }
  if (!r) return;
  await Swal.fire({ icon: r.status === 'success' ? 'success' : 'error', title: r.status === 'success' ? 'เรียบร้อย' : 'ไม่สำเร็จ',
    text: r.text || r.message || '', timer: r.status === 'success' ? 1600 : undefined });
  loadList();
}

document.addEventListener('DOMContentLoaded', () => {
  $('main').addEventListener('click', ev => {
    const a = ev.target.closest('[data-act]');
    if (!a) return;
    const p = pending[Number(a.dataset.i)];
    if (!p) return;
    if (a.dataset.act === 'recover') doRecover(p, a);
    else doDismiss(p);
  });
  sysBoot(loadList);
});
