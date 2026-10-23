// 🩺 สถานะระบบ (23 ต.ค. 2569) — อ่านอย่างเดียว ไม่แก้ข้อมูลใด ๆ · ระดับ 4+
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
  $('main').innerHTML = banner + todo + `<div class="sy-list">${cards}</div>`;
  renderTools(st);
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
    const c = ev.target.closest('[data-go]');
    if (c) location.href = c.dataset.go;
  });
  sysBoot(loadStatus);
});
