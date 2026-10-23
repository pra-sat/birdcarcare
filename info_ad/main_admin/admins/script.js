// 👤 จัดการแอดมิน (23 ต.ค. 2569) — ระดับ 5 · คู่กับ sys_admin.gs
// เพิ่มพนักงาน: ให้เขาเปิดเมนู "ข้อมูลร้าน" ใน LINE ก่อน 1 ครั้ง ชื่อจะโผล่ในรายชื่อด้านล่าง แตะแล้วเลือกระดับ
//   (ระบบจดคนที่เปิดเมนูแล้วไม่ใช่แอดมินไว้ในชีต Blacklist — เซิร์ฟเวอร์ปลดให้เองตอนเพิ่ม)
// กันล็อกตัวเองออก: แถวของตัวเองแก้/ถอดไม่ได้ (เซิร์ฟเวอร์กันซ้ำอีกชั้น)
let data = { admins: [], candidates: [], levels: [2, 3, 4, 5] };
let lastQ = '';

function ava(url) {
  return url ? `<img class="sy-ava" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
             : `<div class="sy-ava sy-ava-ph">👤</div>`;
}

async function loadAll(q) {
  lastQ = q || '';
  $('status').textContent = '⏳ กำลังโหลด...';
  let d;
  try { d = await sysCallRetry({ op: 'admins', q: lastQ }); }
  catch (e) { $('status').textContent = '⚠️ เชื่อมต่อไม่ได้ เช็คสัญญาณเน็ตแล้วลองใหม่'; return; }
  if (!d) return;
  if (d.status !== 'success') { $('status').textContent = '⚠️ ' + (d.message || 'โหลดไม่สำเร็จ'); return; }
  data = d;
  $('status').textContent = `ผู้ดูแล ${d.admins.length} คน`;
  render();
}

function levelChips(cur) {
  return `<div class="sy-chips" id="lvChips">${data.levels.map(l =>
    `<div class="sy-chip${l === cur ? ' is-on' : ''}" role="button" data-lv="${l}"><b>ระดับ ${l} · ${esc(LEVEL_INFO[l].name)}</b><span>${esc(LEVEL_INFO[l].can)}</span></div>`
  ).join('')}</div>`;
}
function bindChips() {
  $('lvChips').addEventListener('click', ev => {
    const c = ev.target.closest('.sy-chip'); if (!c) return;
    document.querySelectorAll('#lvChips .sy-chip').forEach(x => x.classList.toggle('is-on', x === c));
  });
}
function pickedLevel() {
  const on = document.querySelector('#lvChips .sy-chip.is-on');
  return on ? Number(on.dataset.lv) : 0;
}

function render() {
  const legend = `<div class="sy-legend">${[2, 3, 4, 5].map(l =>
    `<div><b>${l}</b> ${esc(LEVEL_INFO[l].name)} — ${esc(LEVEL_INFO[l].can)}</div>`).join('')}</div>`;
  const admins = data.admins.map((a, i) => `
    <div class="sy-card${a.isMe ? '' : ' is-tap'}" ${a.isMe ? '' : `role="button" tabindex="0" data-admin="${i}"`}>
      <div class="sy-person">${ava(a.picture)}
        <div><div class="sy-pname">${esc(a.name)}${a.isMe ? '<span class="sy-me">คุณ</span>' : ''}</div>
             <div class="sy-pline">LINE: ${esc(a.nameLine || '-')} · …${esc(a.tail)}</div></div>
        <div class="sy-lv"><b>ระดับ ${a.level}</b>${esc((LEVEL_INFO[a.level] || {}).name || '')}</div>
      </div></div>`).join('');
  const cands = data.candidates.length ? data.candidates.map((c, i) => `
    <div class="sy-card is-tap" role="button" tabindex="0" data-cand="${i}">
      <div class="sy-person">${ava(c.picture)}
        <div><div class="sy-pname">${esc(c.nameLine || '(ไม่มีชื่อ)')}</div>
             <div class="sy-pline">เปิดเมนูครั้งแรก ${esc(c.seen || '-')} · …${esc(c.tail)}</div></div>
        <div class="sy-lv"><b>＋ เพิ่ม</b></div>
      </div></div>`).join('')
    : `<div class="sy-empty">${lastQ ? 'ไม่เจอชื่อนี้' : 'ยังไม่มีใครเปิดเมนูข้อมูลร้าน'}</div>`;

  $('main').innerHTML = legend +
    `<div class="sy-sec-title">ผู้ดูแลตอนนี้ (แตะเพื่อเปลี่ยนระดับ/ถอดสิทธิ์)</div><div class="sy-list">${admins}</div>
     <div class="sy-sec-title">＋ เพิ่มผู้ดูแล</div>
     <div class="sy-steps">ขั้นตอน<ol><li>ให้พนักงานเปิดเมนู <b>ข้อมูลร้าน</b> ใน LINE ของร้าน 1 ครั้ง</li><li>กด 🔄 ด้านล่าง ชื่อเขาจะขึ้นบนสุด</li><li>แตะชื่อ แล้วเลือกระดับ</li></ol></div>
     <form class="sy-search" id="sf" autocomplete="off">
       <input type="search" class="sy-q" id="q" placeholder="ค้นชื่อ LINE" value="${esc(lastQ)}" enterkeyhint="search">
       <button type="submit" class="btn">🔄</button>
     </form>
     <div class="sy-list">${cands}</div>`;
  $('sf').addEventListener('submit', ev => { ev.preventDefault(); $('q').blur(); loadAll($('q').value.trim()); });
}

async function editAdmin(a) {
  const ask = await Swal.fire({
    title: esc(a.name),
    html: `<div class="sy-note">LINE: ${esc(a.nameLine || '-')} · ตอนนี้ระดับ ${a.level}</div>${levelChips(a.level)}
           <p class="sy-note">มีผลตอนเขาเปิดหน้าแอดมินครั้งถัดไป</p>`,
    showCancelButton: true, showDenyButton: true,
    confirmButtonText: 'บันทึกระดับ', denyButtonText: 'ถอดสิทธิ์', cancelButtonText: 'ปิด',
    didOpen: bindChips,
    preConfirm: () => pickedLevel()
  });
  if (ask.isDenied) return removeAdmin(a);
  if (!ask.isConfirmed || !ask.value || ask.value === a.level) return;
  await send({ op: 'admin_level', userId: a.userId, level: ask.value });
}

async function removeAdmin(a) {
  const ok = await Swal.fire({
    icon: 'warning', title: 'ถอดสิทธิ์ ' + esc(a.name) + '?',
    html: `<div class="sy-note">เขาจะเข้าหน้าแอดมินและบันทึกงานไม่ได้อีก · เก็บสำเนาไว้ที่ชีต Admin_Removed เพิ่มกลับได้ภายหลัง</div>`,
    showCancelButton: true, confirmButtonText: 'ถอดสิทธิ์', cancelButtonText: 'ยกเลิก'
  });
  if (!ok.isConfirmed) return;
  await send({ op: 'admin_remove', userId: a.userId });
}

async function addAdmin(c) {
  const ask = await Swal.fire({
    title: 'เพิ่มผู้ดูแล',
    html: `<div class="sy-person" style="justify-content:center">${ava(c.picture)}<div class="sy-pname">${esc(c.nameLine || '-')}</div></div>
           <div class="sy-note">ชื่อที่จะใช้ในระบบ (ขึ้นในประวัติว่าใครบันทึก)</div>
           <input class="sy-name" id="nm" maxlength="40" value="${esc(c.nameLine || '')}">
           ${levelChips(2)}`,
    showCancelButton: true, confirmButtonText: 'เพิ่มเลย', cancelButtonText: 'ยกเลิก',
    didOpen: bindChips,
    preConfirm: () => {
      const name = $('nm').value.trim();
      if (!name) { Swal.showValidationMessage('ใส่ชื่อก่อน'); return false; }
      return { name, level: pickedLevel() || 2 };
    }
  });
  if (!ask.isConfirmed) return;
  await send({ op: 'admin_add', userId: c.userId, name: ask.value.name, level: ask.value.level });
}

async function send(body) {
  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let r;
  try { r = await sysCallRetry(body); }
  catch (e) { await Swal.fire({ icon: 'warning', title: 'ส่งข้อมูลไม่สำเร็จ', text: 'เช็คสัญญาณเน็ตแล้วลองใหม่ ระบบกันทำซ้ำให้แล้ว' }); return; }
  if (!r) return;
  await Swal.fire({ icon: r.status === 'success' ? 'success' : 'error', title: r.status === 'success' ? 'เรียบร้อย' : 'ไม่สำเร็จ',
    text: r.text || r.message || '', timer: r.status === 'success' ? 2000 : undefined });
  loadAll(lastQ);
}

document.addEventListener('DOMContentLoaded', () => {
  const pick = ev => {
    const a = ev.target.closest('[data-admin]');
    if (a) return editAdmin(data.admins[Number(a.dataset.admin)]);
    const c = ev.target.closest('[data-cand]');
    if (c) return addAdmin(data.candidates[Number(c.dataset.cand)]);
  };
  $('main').addEventListener('click', pick);
  $('main').addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.closest('[data-admin],[data-cand]')) pick(ev); });
  sysBoot(() => loadAll(''));
});
