// member/edit_request.js — ลูกค้า "ส่งคำขอแก้ไขข้อมูล" ผ่านปุ่ม ⋯ บนการ์ดรถ (5 ต.ค. 2569)
//
// เจ้าของร้านสั่ง: ยังไม่ให้ลูกค้าแก้เอง — แก้ในฟอร์มได้ แต่ปุ่มคือ "ส่งคำขอ" ไม่ใช่ "บันทึก"
// ร้านตรวจในหน้าผู้ดูแล → อนุมัติ → ข้อมูลเปลี่ยน + LINE แจ้งลูกค้า (edit_request.gs)
//
// เลือกยี่ห้อ/รุ่น/ปี จากฐานข้อมูลเดียวกับหน้าสมัคร (../register/all_car_model.js โหลดตอนเปิดฟอร์มเท่านั้น)
// รุ่นที่ไม่มีในรายการ เลือก "อื่น ๆ" แล้วพิมพ์เองได้ — ร้านจะเทียบกับฐานข้อมูลให้ตอนตรวจ
//
// ใช้ของจาก script.js: memberData, memberTokens, currentUserId, esc, renderMember, GAS_ENDPOINT
// ใช้ของจาก ../plate_data.js: plateProvinceOptions, plateCleanHead, plateValidate, platePretty
// ใช้ของจาก ../car_display.js: carDisplay
// ใช้ของจาก ../car_picker.js: ตัวเลือก ยี่ห้อ/รุ่น/ปี (ตัวเดียวกับหน้าตรวจของร้าน)

function erSplitPlate(p) {
  const m = String(p || '').trim().match(/^(.*?)\s*(\d{1,4})$/);
  return m ? { head: m[1].replace(/\s+/g, ''), tail: m[2] } : { head: String(p || '').replace(/\s+/g, ''), tail: '' };
}


// ── ปุ่ม ⋯ ─────────────────────────────────────────────────────────────────
document.addEventListener('click', ev => {
  const b = ev.target.closest ? ev.target.closest('.umore') : null;
  if (!b) return;
  ev.preventDefault();
  erOpenMenu(Number(b.dataset.vi) || 0);
});

async function erOpenMenu(i) {
  const v = memberData && memberData.vehicles && memberData.vehicles[i];
  if (!v) return;
  const d = typeof carDisplay === 'function' ? carDisplay(v.brand, v.model, v.year) : { brand: v.brand, family: v.model, sub: '' };
  const r = await Swal.fire({
    title: [d.brand, d.family, d.sub].filter(Boolean).join(' '),
    html: v.editPending
      ? '<p class="er-hint">⏳ คุณส่งคำขอแก้ไขรถคันนี้ไว้แล้ว รอร้านตรวจ<br>ส่งใหม่จะแทนที่คำขอเดิม</p>'
      : '<p class="er-hint">ข้อมูลไม่ถูกต้อง? ส่งคำขอให้ร้านแก้ไขได้<br>ชื่อ · เบอร์โทร · ยี่ห้อ/รุ่น/ปี · ทะเบียน</p>',
    showCancelButton: true,
    confirmButtonText: '✏️ ขอแก้ไขข้อมูล',
    cancelButtonText: 'ปิด'
  });
  if (r.isConfirmed) erOpenForm(i, null);
}


// ── ฟอร์มขอแก้ไข ───────────────────────────────────────────────────────────
async function erOpenForm(i, draft) {
  const v = memberData.vehicles[i];
  Swal.fire({ title: '⏳ กำลังโหลดรายชื่อรุ่นรถ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  const hasCat = await carPickLoad('../register/all_car_model.js');
  Swal.close();

  const cur = draft || {
    name: memberData.name || v.name || '', phone: String(v.phone || '').replace(/\D/g, '').replace(/^(\d{9})$/, '0$1'),
    brand: v.brand || '', model: v.model || '', year: String(v.year || ''),
    plate: v.plate || '', province: v.province || '', note: ''
  };
  const pl = erSplitPlate(cur.plate);
  const brandKnown = hasCat && carPickKnownBrand(cur.brand);
  const modelKnown = brandKnown && carPickKnownModel(cur.brand, cur.model);

  const r = await Swal.fire({
    title: 'ขอแก้ไขข้อมูล',
    html: `
      <div class="fld"><label class="fld-lbl" for="erName">ชื่อ</label>
        <input id="erName" class="swal2-input" maxlength="60" value="${esc(cur.name)}" autocomplete="off"></div>
      <div class="fld"><label class="fld-lbl" for="erPhone">เบอร์โทร</label>
        <input id="erPhone" class="swal2-input" type="tel" inputmode="numeric" maxlength="12" value="${esc(cur.phone)}" autocomplete="off"></div>

      <div class="fld"><label class="fld-lbl" for="erBrand">ยี่ห้อรถ</label>
        ${hasCat ? `<select id="erBrand" class="er-sel">${carPickBrandOptions(cur.brand)}</select>` : ''}
        <input id="erBrandOther" class="swal2-input${hasCat && brandKnown ? ' hidden' : ''}" placeholder="พิมพ์ยี่ห้อรถ" maxlength="40"
               value="${hasCat && brandKnown ? '' : esc(cur.brand)}" autocomplete="off"></div>
      <div class="fld"><label class="fld-lbl" for="erModel">รุ่น</label>
        ${hasCat ? `<select id="erModel" class="er-sel">${carPickModelOptions(brandKnown ? cur.brand : '', cur.model)}</select>` : ''}
        <input id="erModelOther" class="swal2-input${hasCat && modelKnown ? ' hidden' : ''}" placeholder="พิมพ์รุ่นรถ" maxlength="40"
               value="${hasCat && modelKnown ? '' : esc(cur.model)}" autocomplete="off"></div>
      <div class="fld"><label class="fld-lbl" for="erYear">ปีรถ</label>
        <select id="erYear" class="er-sel">${carPickYearOptions(cur.brand, cur.model, cur.year)}</select></div>

      <div class="fld"><label class="fld-lbl">ทะเบียน <span class="fld-sub">— เว้นว่างได้</span></label>
        <div class="er-plate">
          <input id="erPH" class="swal2-input" placeholder="หมวด เช่น 1กร" value="${esc(pl.head)}" autocomplete="off">
          <input id="erPT" class="swal2-input" placeholder="เลข" inputmode="numeric" maxlength="4" value="${esc(pl.tail)}" autocomplete="off">
        </div>
        <select id="erProv" class="er-sel">${typeof plateProvinceOptions === 'function' ? plateProvinceOptions(cur.province) : ''}</select></div>

      <div class="fld"><label class="fld-lbl" for="erNote">ข้อความถึงร้าน <span class="fld-sub">— ไม่บังคับ</span></label>
        <input id="erNote" class="swal2-input" maxlength="200" value="${esc(cur.note || '')}" placeholder="เช่น เปลี่ยนเบอร์ใหม่ / ขายรถคันเก่าแล้ว" autocomplete="off"></div>

      <p class="er-hint">ข้อมูลยังไม่เปลี่ยนทันที — ร้านจะตรวจแล้วแก้ให้ และแจ้งกลับทาง LINE</p>`,
    showCancelButton: true,
    confirmButtonText: '📨 ส่งคำขอแก้ไข',
    cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'er-pop' },
    didOpen: () => erWireForm(),
    preConfirm: () => erCollect()
  });
  if (r.isConfirmed && r.value) erSend(i, r.value);
}

// ผูกตัวเลือกรถ (car_picker.js) + ทำความสะอาดช่องทะเบียนระหว่างพิมพ์
let erReadCar = null;
function erWireForm() {
  const $ = id => document.getElementById(id);
  erReadCar = carPickWire(Swal.getHtmlContainer(),
    { brand: 'erBrand', brandOther: 'erBrandOther', model: 'erModel', modelOther: 'erModelOther', year: 'erYear' });
  $('erPH').addEventListener('input', e => {
    if (typeof plateCleanHead !== 'function') return;
    const c = plateCleanHead(e.target.value); if (c !== e.target.value) e.target.value = c;
  });
  $('erPT').addEventListener('input', e => {
    const c = e.target.value.replace(/\D/g, '').slice(0, 4); if (c !== e.target.value) e.target.value = c;
  });
}

function erCollect() {
  const $ = id => document.getElementById(id);
  const { brand, model, year } = erReadCar();
  const name = $('erName').value.trim().replace(/\s+/g, ' ');
  const phone = $('erPhone').value.replace(/\D/g, '');
  const head = $('erPH').value.trim(), tail = $('erPT').value.trim();

  if (!name) { Swal.showValidationMessage('กรุณากรอกชื่อ'); return false; }
  if (!/^0\d{8,9}$/.test(phone)) { Swal.showValidationMessage('เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก'); return false; }
  if (!brand) { Swal.showValidationMessage('กรุณาเลือกยี่ห้อรถ'); return false; }
  if (!model) { Swal.showValidationMessage('กรุณาเลือกรุ่นรถ'); return false; }
  if (!year) { Swal.showValidationMessage('กรุณาเลือกปีรถ'); return false; }
  if (typeof plateValidate === 'function') {
    const chk = plateValidate(head, tail, { required: false });
    if (!chk.ok) { Swal.showValidationMessage(chk.warn); return false; }
  }
  const plate = typeof platePretty === 'function' ? platePretty(head, tail) : (head + ' ' + tail).trim();
  return { name, phone, brand, model, year, plate, province: plate ? $('erProv').value : '', note: $('erNote').value.trim() };
}

// สิ่งที่จะขอแก้ (ไว้ให้ลูกค้าเห็นก่อนส่ง) — ต้องคิดแบบเดียวกับ bcEreqDiff_ ฝั่งเซิร์ฟเวอร์
function erDiff(v, d) {
  const out = [];
  const oldPhone = String(v.phone || '').replace(/\D/g, '').replace(/^(\d{9})$/, '0$1');
  if (d.name !== (memberData.name || v.name || '')) out.push(`ชื่อ → ${d.name}`);
  if (d.phone !== oldPhone) out.push(`เบอร์ → ${d.phone}`);
  if ([v.brand, v.model, String(v.year || '')].join('|') !== [d.brand, d.model, d.year].join('|')) {
    out.push(`รถ → ${d.brand} ${d.model} ปี ${d.year}`);
  }
  if (`${v.plate || ''} ${v.province || ''}`.trim() !== `${d.plate} ${d.province}`.trim()) {
    out.push(`ทะเบียน → ${`${d.plate} ${d.province}`.trim() || '(ลบออก)'}`);
  }
  return out;
}

async function erSend(i, d) {
  const v = memberData.vehicles[i];
  const diff = erDiff(v, d);
  if (!diff.length) {
    await Swal.fire({ icon: 'info', title: 'ข้อมูลเหมือนเดิม', text: 'ยังไม่ได้แก้อะไร', confirmButtonText: 'กลับไปแก้' });
    return erOpenForm(i, d);
  }
  const ok = await Swal.fire({
    icon: 'question', title: 'ส่งคำขอนี้ให้ร้าน?',
    html: `<ul class="er-diff">${diff.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`,
    showCancelButton: true, confirmButtonText: '📨 ส่งเลย', cancelButtonText: 'กลับไปแก้'
  });
  if (!ok.isConfirmed) return erOpenForm(i, d);

  Swal.fire({ title: '⏳ กำลังส่ง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let res;
  try {
    const r = await fetch(GAS_ENDPOINT + '?action=edit_req', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'edit_req', op: 'submit',
        idToken: memberTokens.id, accessToken: memberTokens.access,
        name: d.name, phone: d.phone, note: d.note,
        car: { from: { brand: v.brand, model: v.model, year: v.year },
               brand: d.brand, model: d.model, year: d.year, plate: d.plate, province: d.province }
      })
    });
    res = await r.json();
  } catch (err) {
    await Swal.fire('❌ ส่งไม่สำเร็จ', 'เช็คสัญญาณเน็ตแล้วลองใหม่อีกครั้ง', 'error');
    return erOpenForm(i, d);
  }
  if (!res || res.status !== 'success') {
    await Swal.fire('ส่งไม่สำเร็จ', (res && res.message) || '', 'error');
    if (res && res.code === 'IDTOKEN_INVALID') return;
    return erOpenForm(i, d);
  }
  v.editPending = true;
  try { renderMember(memberData, false); } catch (e) {}
  Swal.fire({ icon: 'success', title: 'ส่งคำขอแล้ว',
    html: res.replaced ? 'แทนที่คำขอเดิมของรถคันนี้แล้ว<br>ร้านจะตรวจและแจ้งกลับทาง LINE' : 'ร้านจะตรวจและแจ้งกลับทาง LINE ค่ะ',
    confirmButtonText: 'ตกลง' });
}
