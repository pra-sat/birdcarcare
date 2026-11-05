// 🩺 สถานะระบบ (23 ต.ค. 2569) — ส่วนตรวจระบบอ่านอย่างเดียว · ระดับ 4+
// 🛑 แจ้งวันหยุดร้าน (1 พ.ย. 2569) เขียนได้อย่างเดียวคือรายการวันหยุด: closed_add / closed_remove
// ข้อมูลชุดเดียวกับเมนูชีต "ตรวจสุขภาพระบบ" (bcSystemStatus_ ใน sys_admin.gs)
const ICON = { ok: '✅', warn: '⚠️', bad: '🔴' };

async function loadStatus() {
  $('status').textContent = '⏳ กำลังตรวจ...';
  let st;
  try {
    st = await sysCallRetry({ op: 'status' });
  } catch (e) {
    $('status').textContent = '⚠️ เชื่อมต่อไม่ได้ เช็คสัญญาณเน็ตแล้วกด "ตรวจอีกครั้ง"';
    renderTools(null);
    return;
  }
  if (!st) return;
  if (st.status !== 'success') { $('status').textContent = '⚠️ ' + (st.message || 'ตรวจไม่สำเร็จ'); renderTools(null); return; }
  $('status').textContent = 'ตรวจเมื่อ ' + st.at;
  render(st);
}

function render(st) {
  const nBad = st.items.filter(i => i.state === 'bad').length;
  const nWarn = st.items.filter(i => i.state === 'warn').length;
  const banner =
      st.worst === 'bad'  ? `<div class="sy-banner is-bad">🔴 ต้องจัดการ ${nBad} เรื่อง<small>ทำตามรายการด้านล่าง</small></div>`
    : st.worst === 'warn' ? `<div class="sy-banner is-warn">⚠️ มีเรื่องควรดู ${nWarn} เรื่อง<small>ระบบยังใช้งานได้</small></div>`
    :                       `<div class="sy-banner is-ok">✅ ระบบปกติดี<small>ไม่มีอะไรต้องทำ</small></div>`;
  const todo = st.todo.length
    ? `<div class="sy-todo"><b>📌 ต้องทำ</b><ol>${st.todo.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>` : '';
  // ปัญหาขึ้นก่อน ของปกติไว้ท้าย จะได้ไม่ต้องไล่อ่านทั้งหน้า
  const order = { bad: 0, warn: 1, ok: 2 };
  const cards = st.items.slice().sort((a, b) => order[a.state] - order[b.state]).map(it => {
    const tapRecover = it.key === 'failed' && it.state !== 'ok' && st.level >= 5;
    return `<div class="sy-card is-${it.state}${tapRecover ? ' is-tap' : ''}" ${tapRecover ? 'data-go="../recover/index.html" role="button" tabindex="0"' : ''}>
      <div class="sy-card-title">${ICON[it.state]} ${esc(it.title)}${tapRecover ? ' ›' : ''}</div>
      ${it.detail ? `<div class="sy-card-detail">${esc(it.detail)}</div>` : ''}
      ${it.todo ? `<div class="sy-card-todo">👉 ${esc(it.todo)}</div>` : ''}
    </div>`;
  }).join('');
  $('main').innerHTML = banner + todo + `<div class="sy-list">${cards}</div><div id="closedBox"></div>`;
  renderClosed(st.closed);
  renderEnforce(st.enforce, st.level);
  renderTools(st);
}

// ── 🔒 ด่านยืนยันตัวตนลูกค้า (5 พ.ย. 2569) · ระดับ 5 กดเปิด/ปิดได้ · ปิด = ลูกค้าใช้ได้ทันที ──
function renderEnforce(e, level) {
  if (!e || level < 5) return;
  const box = document.createElement('div');
  box.innerHTML = `<div class="sy-sec-title">🔒 ยืนยันตัวตนลูกค้า</div>
    <div class="sy-card">
      <div class="sy-card-detail">${e.on
        ? 'เปิดอยู่: ลูกค้าต้องเปิดหน้าจากเมนู LINE เท่านั้น คนนอกแอบดูหรือแก้ข้อมูลลูกค้าไม่ได้'
        : 'ปิดอยู่: ลูกค้าใช้ได้แบบเดิม ระบบแค่จดไว้ ไม่ปฏิเสธใคร'}${e.blockedToday ? ` · วันนี้ลูกค้าจริงโดนปฏิเสธ ${Number(e.blockedToday)} ครั้ง` : ''}</div>
      <button type="button" class="btn${e.on ? ' outline' : ''}" id="enforceBtn">${e.on ? 'ปิดโหมดบังคับ (ลูกค้าใช้ได้ทันที)' : 'เปิดโหมดบังคับ'}</button>
    </div>`;
  $('main').appendChild(box);
  $('enforceBtn').onclick = async () => {
    const ask = await Swal.fire({
      icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
      title: e.on ? 'ปิดโหมดบังคับ?' : 'เปิดโหมดบังคับ?',
      text: e.on ? 'ลูกค้าที่ใช้ไม่ได้จะใช้ได้ทันที ความปลอดภัยกลับเป็นแบบก่อน 5 พ.ย.'
                 : 'ลูกค้าต้องเปิดจากเมนู LINE ถ้ามีลูกค้าบ่นว่าใช้ไม่ได้ กลับมากดปิดที่นี่'
    });
    if (!ask.isConfirmed) return;
    $('enforceBtn').disabled = true;
    let r;
    try { r = await sysCallRetry({ op: 'enforce', on: !e.on }); }
    catch (err) { r = { status: 'error', message: 'เชื่อมต่อไม่ได้ เช็คสัญญาณเน็ตแล้วลองใหม่' }; }
    if (!r) { $('enforceBtn').disabled = false; return; }
    await Swal.fire({ icon: r.status === 'success' ? 'success' : 'error', title: r.status === 'success' ? 'เรียบร้อย' : 'ไม่สำเร็จ',
                      text: r.text || r.message || '', confirmButtonText: 'ปิด' });
    await loadStatus();
  };
}

// ── 🛑 วันหยุดร้าน ──────────────────────────────────────────────────────
function thDay(key) {
  const p = String(key).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return `${['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][d.getDay()]} ${p[2]}/${p[1]}/${p[0]}`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderClosed(c) {
  const box = $('closedBox');
  if (!box || !c) return;
  const days = (c.days || []).map(k => `<div class="sy-row sy-closed-row">
      <span>${esc(thDay(k))}</span>
      <span class="sy-link" role="button" tabindex="0" data-closed-del="${esc(k)}">ยกเลิก</span>
    </div>`).join('');
  const t = todayKey();
  box.innerHTML = `<div class="sy-sec-title">🛑 วันหยุดร้าน</div>
    <div class="sy-card">
      <div class="sy-card-detail">หยุดประจำทุกวันที่ ${esc((c.monthly || []).join(' และ '))} ของเดือน · วันหยุดไม่ส่งสรุป ยกเว้นมีรถลูกค้าหรือบันทึกไม่สำเร็จ</div>
      ${days ? `<div class="sy-closed-list">${days}</div>` : ''}
      <div class="sy-closed-form">
        <label>ตั้งแต่<input type="date" class="sy-q" id="closedFrom" value="${t}" min="${t}"></label>
        <label>ถึง<input type="date" class="sy-q" id="closedTo" value="${t}" min="${t}"></label>
      </div>
      <button type="button" class="btn sy-closed-save" id="closedSave">แจ้งร้านหยุด</button>
    </div>`;
  $('closedFrom').addEventListener('change', () => {
    if ($('closedTo').value < $('closedFrom').value) $('closedTo').value = $('closedFrom').value;
  });
  $('closedSave').onclick = () => closedCall({ op: 'closed_add', from: $('closedFrom').value, to: $('closedTo').value });
}

async function closedCall(body) {
  const btn = $('closedSave');
  if (btn) btn.disabled = true;
  let r;
  try { r = await sysCallRetry(body); }
  catch (e) { r = { status: 'error', message: 'เชื่อมต่อไม่ได้ เช็คสัญญาณเน็ตแล้วลองใหม่' }; }
  if (!r) return;
  if (r.status !== 'success') {
    if (btn) btn.disabled = false;
    Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: r.message || '', confirmButtonText: 'ปิด' });
    return;
  }
  await loadStatus();     // ถ้าแจ้งวันนี้ การ์ดสรุปด้านบนต้องเปลี่ยนตาม
}

function renderTools(st) {
  const box = document.createElement('div');
  box.className = 'sy-tools';
  box.innerHTML = `<button type="button" class="btn" id="again">🔄 ตรวจอีกครั้ง</button>`;
  if (!st) $('main').innerHTML = '';
  $('main').appendChild(box);
  $('again').onclick = loadStatus;
}

document.addEventListener('DOMContentLoaded', () => {
  $('main').addEventListener('click', ev => {
    const del = ev.target.closest('[data-closed-del]');
    if (del) return closedCall({ op: 'closed_remove', day: del.dataset.closedDel });
    const c = ev.target.closest('[data-go]');
    if (c) location.href = c.dataset.go;
  });
  sysBoot(loadStatus);
});
