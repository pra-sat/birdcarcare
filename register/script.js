// ตรวจสอบการโหลด LIFF SDK


let userId = '';
let profile = null;
const liffId = '2007421084-0VKG7anQ';
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxdxUvmwLS3_nETwGLk4J8ipPq2LYNSWyhJ2ZwVsEJQgONG11NSSX3jVaeqWCU1TXvE5g/exec';
const confirmText = 'ตกลง';


async function initLIFF() {
    try {
        console.log('Initializing LIFF');
        await liff.init({ liffId });
        console.log('LIFF Init OK');

        if(!liff.isLoggedIn()){
            liff.login();
        }  


        // if (!liff.isInClient()) {
        //     showSwal({
        //         icon: 'error',
        //         title: '❗️ข้อผิดพลาด-0',
        //         text: 'กรุณาเปิดหน้านี้ใน LINE App เท่านั้น',
        //         confirmButtonText: confirmText
        //     });
        //     return;
        // }

        profile = await liff.getProfile();
        await silentlyUpdateLineProfile(profile);

        async function silentlyUpdateLineProfile(profile) {
          try {
            const payload = {
              action: 'update_line_profile',
              userId: profile.userId,
              nameLine: profile.displayName,
              statusMessage: profile.statusMessage || "",
              pictureUrl: profile.pictureUrl || ""
            };
        
            const res = await fetch(GAS_ENDPOINT + '?action=update_line_profile', {
              method: 'POST',
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify(payload)
            });
        
            const data = await res.json();
            console.log("✅ LINE Profile อัปเดตอัตโนมัติ:", data);
          } catch (err) {
            console.warn("⚠️ อัปเดตโปรไฟล์ LINE ล้มเหลว:", err);
          }
        }

        
        console.log('Profile retrieved:', profile);

       if (!profile.userId) {
            Swal.fire("❗️User ID ไม่ถูกต้อง", "กรุณาลองใหม่อีกครั้งใน LINE APP", "error");
            return;
        }

        // เก็บ userId เต็มไว้ในตัวแปรนี้ที่เดียว — เป็นค่าที่ใช้ส่งตอนสมัครจริง
        // ไม่ได้เอาไปโชว์บนหน้าจอแล้ว (เอาช่อง User ID ออกเมื่อ 19 ก.ย. 2569)
        userId = profile.userId;

    } catch (err) {
        console.error('LIFF Init Error:', err);
        Swal.fire({
            icon: 'error',
            title: '❗️เกิดปัญหาการเชื่อมต่อ LIFF-1',
            text: 'กรุณาลองใหม่อีกครั้งหรือติดต่อ Admin',
            confirmButtonText: confirmText
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ตัวช่วยเลือกรถ (เพิ่ม 13 ก.ย. 2569)
//
//  ทำไมเปลี่ยน: ของเดิมเป็นช่อง <input list="..."> 3 ช่อง ลูกค้าพิมพ์เองได้อิสระ
//  ผลคือ Isuzu ยี่ห้อเดียวมี 26 วิธีเขียนในชีต ตอนนับยอดจึงเพี้ยน
//
//  ของใหม่: แตะเลือกทีละขั้น ยี่ห้อ -> รุ่น -> ปี
//    • พิมพ์เพื่อกรอง รองรับทั้งไทย/อังกฤษ/คำสะกดผิด (ผ่าน searchBrands ใน all_car_model.js)
//    • แยกรถยนต์กับมอเตอร์ไซค์ออกจากกันสนิท ไม่มีปนกัน
//    • ปีจัดกลุ่มตามโฉม เพื่อไม่ต้องเลื่อนหาทีละปี
//    • ยังพิมพ์เองได้ถ้าไม่มีในรายการ (ปุ่ม "ใช้ตามที่พิมพ์") ของที่พิมพ์เองจะถูก
//      เก็บในชีต Car_Model_Seen โดย bcLogCarModel_ อยู่แล้ว เอามาเติมฐานข้อมูลภายหลังได้
//
//  ⚠️ ห้ามเปลี่ยนสิ่งที่เขียนลง hidden input เพราะเป็นกุญแจ join กับ Service_History
// ═══════════════════════════════════════════════════════════════════════════

function escHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ยี่ห้อนี้มีรถประเภทที่กำลังเลือกอยู่ไหม
// Honda มีทั้งรถยนต์และมอเตอร์ไซค์ จึงต้องเช็คระดับรุ่น ไม่ใช่ระดับยี่ห้อ
function brandHasType(brandName, wantMoto) {
  const models = (carData[brandName] && carData[brandName].models) || {};
  for (const m in models) {
    if ((models[m].category === 'Motorcycle') === wantMoto) return true;
  }
  return false;
}

function modelIsMoto(brandName, modelName) {
  const m = carData[brandName] && carData[brandName].models[modelName];
  return !!(m && m.category === 'Motorcycle');
}

function setupCarPicker(els) {
  const box = document.getElementById('carPicker');
  const btnCar = document.getElementById('tyCar');
  const btnMoto = document.getElementById('tyMoto');
  if (!box || !btnCar || !btnMoto) {
    console.error('carPicker elements not found');
    return;
  }

  // สถานะของตัวช่วย — ค่าจริงอยู่ใน hidden input เสมอ ตัวนี้เป็นแค่สำเนาใช้วาดจอ
  const st = { moto: false, brand: '', model: '', year: '', qBrand: '', qModel: '', showOldYears: false };

  function commit() {
    els.brand.value = st.brand;
    els.model.value = st.model;
    els.year.value = st.year;
    if (st.brand && st.model) {
      // รุ่นที่มีในฐานข้อมูล ใช้ประเภทตัวถังจริง
      // รุ่นที่พิมพ์เอง ยังรู้ได้ว่าเป็นมอเตอร์ไซค์หรือไม่จากแถบที่เลือกไว้
      const cat = getCategory(st.brand, st.model);
      els.category.value = (cat !== 'Unknown') ? cat : (st.moto ? 'Motorcycle' : 'Unknown');
    } else {
      els.category.value = '';
    }
  }

  // ── ปีรถจัดกลุ่มตามโฉม ──────────────────────────────────────────────
  function yearGroups() {
    const gens = getGenerations(st.brand, st.model);
    if (gens.length) {
      // gens เก็บเรียงจากเก่าไปใหม่ กลับด้านให้โฉมล่าสุดอยู่บน (ลูกค้าส่วนใหญ่รถใหม่)
      return gens.slice().reverse().map(g => ({ label: g.label || '', years: getYearsForGen(g) }));
    }
    const m = carData[st.brand] && carData[st.brand].models[st.model];
    const ys = (m && m.years) ? m.years.slice().reverse() : [];
    return ys.length ? [{ label: '', years: ys }] : [];
  }

  // แบ่งปีเป็นส่วนที่โชว์เลย กับส่วนที่ซ่อนไว้ใต้ปุ่ม "ดูปีเก่ากว่านี้"
  //
  // ทำไมต้องมี: ในฐานข้อมูลมีแค่ 24 รุ่นจาก 438 รุ่นที่ใส่ข้อมูลโฉมไว้
  // อีก 414 รุ่นจึงได้ช่วงปีกว้าง ๆ (รถน้ำมัน 2000-ปีนี้ = 27 ปี) ถ้าโชว์หมด
  // จะกลายเป็นชิป 27 อันเลื่อนยาว และเสี่ยงกดปีที่รุ่นนั้นยังไม่ออกขาย
  // จึงโชว์ 12 ปีล่าสุดก่อน ที่เหลือซ่อนไว้ให้กดดู
  //
  // (ทางที่ดีกว่าคือใส่ปีที่เริ่มขายให้ครบทั้ง 414 รุ่น แต่ยังหาข้อมูลยืนยันไม่ได้
  //  จึงไม่เดาใส่ไป — รุ่นที่ลูกค้าพิมพ์เองจะถูกเก็บในชีต Car_Model_Seen ให้ทยอยเติม)
  const HEAD_YEARS = 12;
  function yearSections() {
    const groups = yearGroups();
    const head = [], rest = [];
    let n = 0;
    for (const g of groups) {
      if (n >= HEAD_YEARS) { rest.push(g); continue; }
      if (head.length === 0 && g.years.length > HEAD_YEARS) {
        // กลุ่มเดียวแต่ยาวมาก (รุ่นที่ไม่มีข้อมูลโฉม) ตัดครึ่งเอาปีล่าสุดขึ้นก่อน
        head.push({ label: g.label, years: g.years.slice(0, HEAD_YEARS) });
        rest.push({ label: g.label, years: g.years.slice(HEAD_YEARS) });
        n = HEAD_YEARS;
      } else {
        head.push(g);
        n += g.years.length;
      }
    }
    return { head, rest };
  }

  function chip(text, dataAttr, on) {
    return `<button type="button" class="pk-chip${on ? ' is-on' : ''}" ${dataAttr}>${escHtml(text)}</button>`;
  }

  function stepHead(no, title, state) {
    return `<div class="pk-no ${state}">${no}</div><div class="pk-title">${escHtml(title)}</div>`;
  }

  function render() {
    let html = '';

    // ── ขั้น 1 ยี่ห้อ ──
    if (st.brand) {
      html += `<div class="pk-step done">
        ${stepHead('✓', 'ยี่ห้อ', 'done')}
        <div class="pk-body">
          <span class="pk-picked">${escHtml(st.brand)}
            <button type="button" class="pk-x" data-clear="brand" aria-label="เปลี่ยนยี่ห้อ">✕</button>
          </span>
        </div>
      </div>`;
    } else {
      const hits = searchBrands(st.qBrand).filter(b => brandHasType(b, st.moto));
      const shown = hits.slice(0, 24);
      html += `<div class="pk-step now">
        ${stepHead('1', 'ยี่ห้อ — พิมพ์เพื่อค้นหา', 'now')}
        <div class="pk-body">
          <input type="text" class="pk-input" id="pkBrandQ" autocomplete="off"
                 placeholder="เช่น อีซูซุ / isuzu / ${st.moto ? 'ฮอนด้า' : 'โตโยต้า'}"
                 value="${escHtml(st.qBrand)}">
          <div class="pk-chips">${shown.map(b => chip(b, `data-brand="${escHtml(b)}"`, false)).join('')}</div>
          ${hits.length > shown.length ? `<div class="pk-hint">มี ${hits.length} ยี่ห้อที่ตรง — พิมพ์เพิ่มเพื่อกรองให้แคบลง</div>` : ''}
          ${(!hits.length && st.qBrand.trim())
            ? `<button type="button" class="pk-own" data-ownbrand="1">➕ ใช้ “${escHtml(st.qBrand.trim())}” ตามที่พิมพ์</button>
               <div class="pk-hint">ไม่พบยี่ห้อนี้ในรายการ — กรอกเองได้ ทางร้านจะเพิ่มเข้าระบบให้ภายหลัง</div>`
            : ''}
        </div>
      </div>`;
    }

    // ── ขั้น 2 รุ่น ──
    if (st.brand) {
      if (st.model) {
        const ev = isEV(st.brand, st.model);
        html += `<div class="pk-step done">
          ${stepHead('✓', 'รุ่น', 'done')}
          <div class="pk-body">
            <span class="pk-picked">${escHtml(st.model)}
              ${ev ? '<span class="pk-ev">EV</span>' : ''}
              <button type="button" class="pk-x" data-clear="model" aria-label="เปลี่ยนรุ่น">✕</button>
            </span>
          </div>
        </div>`;
      } else {
        const hits = searchModels(st.brand, st.qModel)
          .filter(m => modelIsMoto(st.brand, m) === st.moto);
        const shown = hits.slice(0, 30);
        html += `<div class="pk-step now">
          ${stepHead('2', st.moto ? 'รุ่น — เห็นเฉพาะมอเตอร์ไซค์' : 'รุ่น — พิมพ์เพื่อค้นหา', 'now')}
          <div class="pk-body">
            <input type="text" class="pk-input" id="pkModelQ" autocomplete="off"
                   placeholder="พิมพ์ชื่อรุ่น หรือชื่อโฉมที่คนเรียกกัน" value="${escHtml(st.qModel)}">
            <div class="pk-chips">${shown.map(m => chip(m, `data-model="${escHtml(m)}"`, false)).join('')}</div>
            ${hits.length > shown.length ? `<div class="pk-hint">มี ${hits.length} รุ่นที่ตรง — พิมพ์เพิ่มเพื่อกรองให้แคบลง</div>` : ''}
            ${(!hits.length && st.qModel.trim())
              ? `<button type="button" class="pk-own" data-ownmodel="1">➕ ใช้ “${escHtml(st.qModel.trim())}” ตามที่พิมพ์</button>
                 <div class="pk-hint">ไม่พบรุ่นนี้ในรายการ — กรอกเองได้เลย</div>`
              : ''}
            ${(!hits.length && !st.qModel.trim())
              ? `<div class="pk-hint">ยี่ห้อนี้ยังไม่มี${st.moto ? 'มอเตอร์ไซค์' : 'รถยนต์'}ในระบบ — พิมพ์ชื่อรุ่นได้เลย</div>`
              : ''}
          </div>
        </div>`;
      }
    }

    // ── ขั้น 3 ปี ──
    if (st.brand && st.model) {
      const { head, rest } = yearSections();
      const renderGroup = g => `
        ${g.label ? `<div class="pk-gh">${escHtml(g.label)}</div>` : ''}
        <div class="pk-chips">${g.years.map(y => chip(String(y), `data-year="${y}"`, String(y) === st.year)).join('')}</div>`;

      // ช่วงปีที่ซ่อนอยู่ เอาไปเขียนบนปุ่มให้รู้ว่ากดแล้วจะเจออะไร
      const restYears = rest.reduce((a, g) => a.concat(g.years), []);
      const restRange = restYears.length
        ? ` (${Math.min.apply(null, restYears)}–${Math.max.apply(null, restYears)})` : '';

      html += `<div class="pk-step ${st.year ? 'done' : 'now'}">
        ${stepHead(st.year ? '✓' : '3', 'ปีรถ — แตะปีได้เลย', st.year ? 'done' : 'now')}
        <div class="pk-body">
          ${head.map(renderGroup).join('')}
          ${rest.length ? (st.showOldYears
            ? rest.map(renderGroup).join('') + `<button type="button" class="pk-more" data-oldyears="0">▲ ซ่อนปีเก่า</button>`
            : `<button type="button" class="pk-more" data-oldyears="1">▼ ดูปีเก่ากว่านี้${restRange}</button>`) : ''}
          <div class="pk-own-year">
            <label for="pkYearOwn">ไม่มีปีที่ต้องการ? พิมพ์เอง</label>
            <input type="text" inputmode="numeric" id="pkYearOwn" class="pk-input pk-input-sm"
                   placeholder="เช่น 2015" value="${escHtml(st.year)}">
          </div>
          <div class="pk-hint">${head.length
            ? 'ชื่อโฉมเป็นแค่หัวข้อช่วยหา ระบบเก็บแค่ “ปี”'
            : 'รุ่นนี้ยังไม่มีข้อมูลปีในระบบ — พิมพ์ปีรถได้เลย'}</div>
        </div>
      </div>`;
    }

    box.innerHTML = html;

    // คืนโฟกัสให้ช่องที่กำลังพิมพ์ เพราะ innerHTML สร้าง element ใหม่ทุกครั้ง
    if (st._focus) {
      const el = document.getElementById(st._focus);
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  }

  // ── ตัวฟังเหตุการณ์: ผูกไว้ที่กล่องแม่ตัวเดียว เพราะข้างในถูกวาดใหม่ทุกครั้ง ──
  box.addEventListener('click', ev => {
    const t = ev.target.closest('button');
    if (!t) return;

    if (t.dataset.brand)      { st.brand = t.dataset.brand; st.qBrand = ''; st.model = ''; st.year = ''; st.qModel = ''; st._focus = 'pkModelQ'; }
    else if (t.dataset.ownbrand) { st.brand = st.qBrand.trim(); st.qBrand = ''; st.model = ''; st.year = ''; st._focus = 'pkModelQ'; }
    else if (t.dataset.model) { st.model = t.dataset.model; st.qModel = ''; st.year = ''; st._focus = null; }
    else if (t.dataset.ownmodel) { st.model = st.qModel.trim(); st.qModel = ''; st.year = ''; st._focus = null; }
    else if (t.dataset.year)  { st.year = t.dataset.year; st._focus = null; }
    else if (t.dataset.clear === 'brand') { st.brand = ''; st.model = ''; st.year = ''; st.qBrand = ''; st.qModel = ''; st._focus = 'pkBrandQ'; }
    else if (t.dataset.clear === 'model') { st.model = ''; st.year = ''; st.qModel = ''; st._focus = 'pkModelQ'; }
    else if (t.dataset.oldyears !== undefined) { st.showOldYears = t.dataset.oldyears === '1'; st._focus = null; }
    else return;

    commit();
    render();
  });

  box.addEventListener('input', ev => {
    const id = ev.target.id;
    if (id === 'pkBrandQ')      { st.qBrand = ev.target.value; st._focus = id; }
    else if (id === 'pkModelQ') { st.qModel = ev.target.value; st._focus = id; }
    else if (id === 'pkYearOwn') {
      // ปีพิมพ์เอง — รับแค่ตัวเลข 4 หลัก ไม่ต้องวาดจอใหม่ระหว่างพิมพ์
      st.year = ev.target.value.replace(/\D/g, '').slice(0, 4);
      if (ev.target.value !== st.year) ev.target.value = st.year;
      commit();
      return;
    }
    else return;

    commit();
    render();
  });

  // ── สลับรถยนต์ / มอเตอร์ไซค์ — ล้างที่เลือกไว้ทั้งหมด เพราะรายการไม่เกี่ยวกันเลย ──
  function setType(moto) {
    st.moto = moto;
    st.brand = ''; st.model = ''; st.year = '';
    st.qBrand = ''; st.qModel = ''; st.showOldYears = false; st._focus = null;
    btnCar.classList.toggle('is-on', !moto);
    btnMoto.classList.toggle('is-on', moto);
    btnCar.setAttribute('aria-pressed', String(!moto));
    btnMoto.setAttribute('aria-pressed', String(moto));
    commit();
    render();
  }
  btnCar.addEventListener('click', () => setType(false));
  btnMoto.addEventListener('click', () => setType(true));

  // form.reset() ในตอนท้ายของ handler ล้าง hidden input ทิ้ง
  // ถ้าไม่ล้างตัวช่วยด้วย จอจะยังโชว์รถที่เลือกไว้ทั้งที่ค่าหายแล้ว
  window.resetCarPicker = () => setType(false);

  setType(false);   // เริ่มที่รถยนต์
}

// ═══════════════════════════════════════════════════════════════════════════
//  ช่องทะเบียนรถ (เพิ่ม 13 ก.ย. 2569) — ไม่บังคับกรอก
//  ใช้ตัวช่วยจาก ../plate_data.js  (platePretty / plateValidate / plateHtml)
//  ถ้าไฟล์นั้นโหลดไม่ขึ้น ทั้งบล็อกนี้จะเงียบไปเอง ฟอร์มสมัครยังใช้ได้ปกติ
// ═══════════════════════════════════════════════════════════════════════════
function setupPlateFields() {
  try {
    if (typeof plateProvinceOptions !== 'function') {
      console.warn('plate_data.js ไม่ได้โหลด — ซ่อนช่องทะเบียนไว้');
      const g = document.getElementById('plateGroup');
      if (g) g.hidden = true;
      return;
    }

    const head = document.getElementById('plateHead');
    const tail = document.getElementById('plateTail');
    const prov = document.getElementById('plateProvince');
    const prev = document.getElementById('platePreview');
    const warn = document.getElementById('plateWarn');
    if (!head || !tail || !prov) return;

    prov.innerHTML = plateProvinceOptions('');

    // เลขท้ายรับแต่ตัวเลข
    tail.addEventListener('input', () => {
      const clean = tail.value.replace(/\D/g, '').slice(0, 4);
      if (tail.value !== clean) tail.value = clean;
      paint();
    });

    // หมวดรับแต่เลขกับพยัญชนะไทย — กันพิมพ์อังกฤษตั้งแต่แรก ไม่ต้องรอเตือน
    // ⚠️ ถ้าตัดทิ้งเฉย ๆ ตอนพิมพ์ผิด เคอร์เซอร์จะเด้งไปท้ายช่อง
    //    จึงจำตำแหน่งเคอร์เซอร์ไว้แล้วเลื่อนกลับตามจำนวนตัวที่ถูกตัด
    head.addEventListener('input', () => {
      const before = head.value;
      const clean = plateCleanHead(before);
      if (before !== clean) {
        const pos = head.selectionStart || 0;
        const removed = before.slice(0, pos).length - plateCleanHead(before.slice(0, pos)).length;
        head.value = clean;
        try { head.setSelectionRange(pos - removed, pos - removed); } catch (e) {}
        typedWrongScript = /[A-Za-z]/.test(before);
      } else {
        typedWrongScript = false;
      }
      paint();
    });
    prov.addEventListener('change', paint);

    let typedWrongScript = false;

    function paint() {
      const plate = platePretty(head.value, tail.value);
      const v = plateValidate(head.value, tail.value, { required: true });

      // แสดงตัวอย่างป้ายตามที่พิมพ์ (สีเทา = ยังไม่บันทึก)
      if (plate) {
        prev.innerHTML = plateHtml(plate, prov.value, true) +
          '<div class="pl-eg">ตัวอย่างที่จะบันทึก</div>';
        prev.hidden = false;
      } else {
        prev.innerHTML = '';
        prev.hidden = true;
      }

      // ยังไม่ได้เริ่มกรอกเลย ไม่ต้องขึ้นเตือนสีส้มตั้งแต่เปิดหน้า
      const untouched = !head.value && !tail.value && !prov.value;
      let msg = '';
      if (typedWrongScript) msg = '⚠️ ทะเบียนไทยไม่มีภาษาอังกฤษ — สลับแป้นเป็นภาษาไทยก่อนนะ';
      else if (!untouched && v.warn) msg = '⚠️ ' + v.warn;
      else if (!untouched && v.ok && !prov.value) msg = '⚠️ ยังไม่ได้เลือกจังหวัด';

      warn.textContent = msg;
      warn.hidden = !msg;
    }

    // form.reset() ล้างช่องกรอกให้ แต่ไม่ล้างตัวอย่างป้ายกับข้อความเตือน
    window.resetPlateFields = () => { head.value = ''; tail.value = ''; prov.value = ''; paint(); };

    paint();
  } catch (e) {
    console.warn('setupPlateFields:', e);
  }
}

// อ่านค่าทะเบียนที่กรอกไว้ ออกมาเป็นรูปแบบที่จะส่งไปเก็บ
// ทะเบียนเป็นข้อมูลบังคับ (เปลี่ยน 13 ก.ย. 2569) เพราะใช้เป็นตัวกันสมัครรถซ้ำด้วย
// คืน { error } ถ้ายังใช้ไม่ได้ · คืน { plate, province } ถ้าผ่าน
function readPlateFields() {
  const head = document.getElementById('plateHead');
  const tail = document.getElementById('plateTail');
  const prov = document.getElementById('plateProvince');

  // ถ้า plate_data.js โหลดไม่ขึ้น จะบังคับไม่ได้ ปล่อยผ่านดีกว่าสมัครไม่ได้เลย
  if (!head || !tail || typeof plateValidate !== 'function') return { plate: '', province: '' };

  const v = plateValidate(head.value, tail.value, { required: true });
  if (!v.ok) return { error: v.warn };

  const province = prov ? prov.value.trim() : '';
  if (!province) return { error: 'กรุณาเลือกจังหวัดที่จดทะเบียน' };

  return { plate: platePretty(head.value, tail.value), province };
}

function validatePhone(phoneInput) {
    let phoneRaw = phoneInput.value.replace(/\D/g, '');

    // ไม่กรอกเลย ต้องบอกให้ตรง (19 ก.ย. 2569)
    // ของเดิมตกไปเข้าเงื่อนไขล่างแล้วขึ้นว่า "ควรเริ่มด้วย 0 และมี 9-15 หลัก"
    // ซึ่งอ่านแล้วงง เพราะยังไม่ได้พิมพ์อะไรเลยสักตัว
    //
    // เบอร์โทรสำคัญกว่าที่คิด — เป็นทางเดียวที่พนักงานจะค้นเจอลูกค้า
    // ตอนสแกน QR ไม่ได้ (เช่นลูกค้ามือถือแบตหมด/เน็ตไม่มี)
    if (!phoneRaw) {
        Swal.fire('กรุณากรอกเบอร์โทร',
                  'ใช้สำหรับค้นหาข้อมูลของคุณที่หน้าร้าน กรณีสแกน QR ไม่ได้',
                  'warning');
        phoneInput.focus();
        return null;
    }

    if (/^0[689]/.test(phoneRaw)) {
        if (!/^0[689][0-9]{8}$/.test(phoneRaw)) {
            Swal.fire("Invalid Phone", "เบอร์ขึ้นต้นด้วย 08, 06, 09 ต้องมี 10 หลักเท่านั้น", "warning");
            return null;
        }
    } else {
        if (!/^0[0-9]{8,14}$/.test(phoneRaw)) {
            Swal.fire("Invalid Phone", "เบอร์โทรควรเริ่มด้วย 0 และมี 9-15 หลัก", "warning");
            return null;
        }
    }
    return phoneRaw.length === 10 ? `${phoneRaw.slice(0, 3)}-${phoneRaw.slice(3, 6)}-${phoneRaw.slice(6)}` : phoneRaw;
}

document.addEventListener('DOMContentLoaded', () => {
    initLIFF();
    
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', () => {
        let raw = phoneInput.value.replace(/\D/g, '');
        if (raw.length > 10) raw = raw.slice(0, 10);
        if (raw.length > 6) {
            phoneInput.value = `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
        } else if (raw.length > 3) {
            phoneInput.value = `${raw.slice(0, 3)}-${raw.slice(3)}`;
        } else {
            phoneInput.value = raw;
        }
    });
    const name = document.getElementById('name');
    const brand = document.getElementById('brand');
    const model = document.getElementById('model');
    const year = document.getElementById('year');
    const category = document.getElementById('category');

    if (!brand || !model || !year || !category) {
        console.error('Required form elements not found');
        return;
    }

    if (typeof carData === 'undefined') {
        console.error('carData is not defined. Ensure all_car_model.js is loaded.');
        Swal.fire({
            icon: 'error',
            title: '❗️ข้อผิดพลาด-3',
            text: 'ไม่สามารถโหลดข้อมูลยี่ห้อรถได้ กรุณาลองใหม่หรือติดต่อ Admin',
            confirmButtonText: confirmText
        });
        return;
    }

    // ── ตัวช่วยเลือกรถแบบทีละขั้น ───────────────────────────────────────
    // เขียนค่าที่เลือกลง input hidden 4 ช่อง (brand/model/year/category)
    // โค้ดส่งข้อมูลด้านล่างไม่ถูกแตะเลย ยังอ่านจาก 4 ช่องนี้เหมือนเดิม
    setupCarPicker({ brand, model, year, category });

    // ── ช่องทะเบียนรถ (ไม่บังคับ) ───────────────────────────────────────
    setupPlateFields();


        const form = document.getElementById('registrationForm');
    if (!form) {
        console.error('Registration form not found');
        return;
    }


        // เมื่อคลิกสมัครสมาชิก
        // Form submission handler
form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!userId) {
        Swal.fire("Error", "❗️Could not get LINE user profile. Please try again in LINE app.-4", "error");
        return;
    }

    const phoneInputElement = document.getElementById('phone');
    let phoneRaw = phoneInputElement.value.replace(/\D/g, '');
    const validatedPhone = validatePhone(phoneInputElement);
    if (!validatedPhone) return;

    const phone = validatedPhone;  // ส่ง display ให้ user เป็น format
    const name = document.getElementById('name').value.trim();
    const brand = document.getElementById('brand').value;
    const model = document.getElementById('model').value;
    const year = document.getElementById('year').value.trim();
    const category = document.getElementById('category').value;
    const channelElement = document.getElementById('channel');
    const channel = channelElement ? channelElement.value.trim() : 'LINE';

    // บอกให้ชัดว่าขาดอะไร เพราะยี่ห้อ/รุ่น/ปี เป็น hidden input แล้ว
    // ถ้าขึ้นแค่ "กรอกไม่ครบ" ลูกค้าจะหาไม่เจอว่าต้องแตะตรงไหน
    const missing = [];
    if (!name) missing.push('ชื่อ');
    if (!phone) missing.push('เบอร์โทร');
    if (!brand) missing.push('ยี่ห้อรถ');
    else if (!model) missing.push('รุ่นรถ');
    else if (!year) missing.push('ปีรถ');
    if (missing.length) {
        Swal.fire('กรอกข้อมูลไม่ครบ', `ยังขาด: ${missing.join(' · ')}`, 'warning');
        return;
    }

    const currentYear = new Date().getFullYear();
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear) {
        Swal.fire('ปีรถไม่ถูกต้อง', `กรุณาเลือกหรือกรอกปีระหว่าง 1900 - ${currentYear}`, 'warning');
        return;
    }

    // ทะเบียนรถ — บังคับกรอกให้ครบ (ใช้กันสมัครรถซ้ำด้วย)
    const plateData = readPlateFields();
    if (plateData.error) {
        Swal.fire('ทะเบียนรถยังไม่ถูกต้อง', plateData.error, 'warning');
        document.getElementById('plateHead')?.focus();
        return;
    }

    const payload = {
        userId,
        phone,
        name: name.trim(),
        brand: brand.trim(),
        model: model.trim(),
        year: year.trim(),
        category,
        channel,
        // เพิ่ม 13 ก.ย. 2569 — Apps Script รุ่นเก่าที่ยังไม่รู้จัก 2 ช่องนี้จะเมินไปเอง
        // จึง push หน้าเว็บก่อน deploy GAS ได้ ไม่พัง
        plate: plateData.plate,
        province: plateData.province,
        "name-line": profile.displayName,
        statusMessage: profile.statusMessage || "",
        pictureUrl: profile.pictureUrl || ""
    };

    // ── ตรวจรถซ้ำก่อน แล้วค่อยให้ยืนยัน ────────────────────────────────
    //
    // ของเดิมเรียก ?action=register&check=1 ซึ่งดาวน์โหลด "เบอร์ลูกค้าทั้ง 487 คน"
    // มาเทียบในเบราว์เซอร์ · ตอนนี้ย้ายไปเทียบฝั่งเซิร์ฟเวอร์ที่ action=check_duplicate
    // ส่งกลับมาแค่ซ้ำ/ไม่ซ้ำ ไม่มีข้อมูลของใครติดมาด้วย
    //
    // ตัดสินจากทะเบียนเป็นหลัก เพราะ 1 คัน = 1 ทะเบียน แม่นกว่า ยี่ห้อ+รุ่น+ปี
    // ที่ใช้เดิม (ซึ่งทั้งพลาดจับและจับผิด เพราะรถรุ่นเดียวกัน 2 คันก็มีจริง)
    //
    // ถ้าตรวจไม่ได้ (เน็ตหลุด / ยังไม่ deploy) ให้ไปต่อ ไม่ขวางการสมัคร
    // เพราะฝั่ง Apps Script กันซ้ำอยู่อีกชั้นตอนบันทึกจริงอยู่แล้ว
    let dup = null;
    try {
        const dupRes = await fetch(`${GAS_ENDPOINT}?action=check_duplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'check_duplicate',
                userId, phone, brand, model, year,
                plate: payload.plate, province: payload.province
            })
        });
        dup = await dupRes.json();
    } catch (checkError) {
        console.warn('ตรวจข้อมูลซ้ำไม่สำเร็จ (ไปต่อ):', checkError);
    }

    if (dup && dup.status === 'block') {
        await Swal.fire({
            icon: 'error',
            title: dup.title || 'ข้อมูลซ้ำ',
            text: dup.message || 'รถคันนี้มีอยู่ในระบบแล้ว',
            confirmButtonText: confirmText
        });
        return;
    }

    if (dup && dup.status === 'warn') {
        const go = await Swal.fire({
            icon: 'warning',
            title: dup.title || 'ข้อมูลใกล้เคียงกับที่มีอยู่',
            text: dup.message || '',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน สมัครต่อ',
            cancelButtonText: 'กลับไปแก้ไข'
        });
        if (!go.isConfirmed) return;
    }

    const confirm = await Swal.fire({
        title: 'ยืนยันข้อมูลก่อนส่ง',
        html: `ชื่อ: ${escHtml(payload.name)}<br>
            เบอร์โทร: ${escHtml(payload.phone)}<br>
            ยี่ห้อ: ${escHtml(payload.brand)}<br>
            รุ่น: ${escHtml(payload.model)}<br>
            ปี: ${escHtml(payload.year)}<br>
            ทะเบียน: ${payload.plate
              ? escHtml(payload.plate) + (payload.province ? ' ' + escHtml(payload.province) : '')
              : '<i>ยังไม่กรอก</i>'}`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันส่งข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });
    if (!confirm.isConfirmed) return;

    const submitBtn = document.getElementById('submitBtn');  // ✅ ตรงนี้ควรอยู่ใน handler เสมอ
    if (submitBtn.disabled) return;  // ดักทันที
    submitBtn.disabled = true;
    submitBtn.textContent = "กำลังส่ง...";

    Swal.fire({
        title: 'กำลังส่งข้อมูล...',
        text: 'กรุณารอสักครู่',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

        console.log("Preparing to send payload:", payload);

    try {
        const response = await fetch(GAS_ENDPOINT + '?action=register', {
            redirect: "follow",
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const textData = await response.text();
        console.log('Full Response:', textData);

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${textData}`);
        }

        let data;
        try {
            data = JSON.parse(textData);
        } catch (parseError) {
            throw new Error(`Invalid JSON response: ${textData}`);
        }

        if (data.status === "success") {
          await Swal.fire("✅ สมัครสมาชิกสำเร็จ", "แตะ 'OK' เพื่อดูข้อมูลสมาชิกของคุณ", "success");
          submitBtn.textContent = "✅Submit";
          liff.openWindow({
            url: 'https://liff.line.me/2007421084-WXmXrzZY',
            external: false
          });
          return;
        } else {
            throw new Error(data.message || "Registration failed");
        }

    } catch (error) {
        console.error("Error during fetch:", error);
        await Swal.fire({
            icon: 'error',
            title: '❗️Registration Failed',
            text: error.message,
            confirmButtonText: confirmText
        });
        liff.closeWindow();
    }

    finally {
            form.reset();
            if (typeof window.resetCarPicker === 'function') window.resetCarPicker();
            if (typeof window.resetPlateFields === 'function') window.resetPlateFields();
            // form.reset() ล้างเฉพาะช่องในฟอร์ม ไม่แตะตัวแปร userId
            // จึงไม่ต้องเขียนคืนอะไรตรงนี้แล้ว (เดิมเขียนคืนเพราะมีช่องโชว์ UID อยู่)
            // document.getElementById('name').focus();
            submitBtn.disabled = false;
        }
    });
});
