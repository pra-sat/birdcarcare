/* car_picker.js — ตัวเลือก ยี่ห้อ / รุ่น / ปี จากฐานข้อมูลเดียวกับหน้าสมัคร (5 ต.ค. 2569)
   ใช้ร่วมกัน 2 หน้า: member/ (ลูกค้าส่งคำขอแก้ไข) · info_ad/main_admin/requests/ (ร้านตรวจคำขอ)
   ทั้งสองฝั่งต้องเห็นรายการเหมือนกัน ไม่งั้นลูกค้าเลือกแล้วร้านหาไม่เจอ

   ฐานข้อมูลเต็ม (register/all_car_model.js ~75 KB) โหลดตอนเรียก carPickLoad() เท่านั้น
   ต้องโหลด ../car_display.js ก่อน ถ้าอยากให้ตัวเลือกปีมีชื่อรุ่นย่อย ("2024 · Revo")
   ไฟล์นี้ไม่แตะ DOM เอง มีแต่สร้าง <option> */

var CAR_PICK_OTHER = '__other__';
// ยี่ห้อที่ลูกค้าร้านใช้บ่อย ขึ้นก่อน (ที่เหลือเรียงตามตัวอักษร)
var CAR_PICK_TOP = ['Toyota', 'Isuzu', 'Honda', 'Mitsubishi', 'Ford', 'Nissan', 'Mazda', 'MG',
                    'Chevrolet', 'Suzuki', 'BYD', 'Mercedes-Benz', 'BMW'];

var carPickPromise = null;
// src = ทางไปไฟล์ all_car_model.js จากหน้านั้น ๆ · คืน true ถ้าโหลดได้
function carPickLoad(src) {
  if (typeof carData !== 'undefined') return Promise.resolve(true);
  if (carPickPromise) return carPickPromise;
  carPickPromise = new Promise(function (resolve) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { resolve(typeof carData !== 'undefined'); };
    s.onerror = function () { carPickPromise = null; resolve(false); };   // โหลดไม่ได้ -> ให้พิมพ์เองแทน
    document.head.appendChild(s);
  });
  return carPickPromise;
}

function carPickCat() { return (typeof carData !== 'undefined') ? carData : null; }

function carPickEsc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function carPickKnownBrand(b) { var c = carPickCat(); return !!(c && c[b]); }
function carPickKnownModel(b, m) { var c = carPickCat(); return !!(c && c[b] && c[b].models && c[b].models[m]); }

function carPickBrandOptions(sel) {
  var cat = carPickCat();
  var all = cat ? Object.keys(cat) : [];
  var top = CAR_PICK_TOP.filter(function (b) { return all.indexOf(b) >= 0; });
  var rest = all.filter(function (b) { return top.indexOf(b) < 0; }).sort(function (a, b) { return a.localeCompare(b); });
  var opt = function (b) { return '<option value="' + carPickEsc(b) + '"' + (b === sel ? ' selected' : '') + '>' + carPickEsc(b) + '</option>'; };
  return '<option value="">— เลือกยี่ห้อ —</option>' +
    (top.length ? '<optgroup label="ที่เจอบ่อย">' + top.map(opt).join('') + '</optgroup>' : '') +
    (rest.length ? '<optgroup label="ทุกยี่ห้อ">' + rest.map(opt).join('') + '</optgroup>' : '') +
    '<option value="' + CAR_PICK_OTHER + '"' + (sel && all.indexOf(sel) < 0 ? ' selected' : '') + '>อื่น ๆ (พิมพ์เอง)</option>';
}

function carPickModelOptions(brand, sel) {
  var cat = carPickCat();
  var models = cat && cat[brand] ? Object.keys(cat[brand].models || {}) : [];
  return '<option value="">— เลือกรุ่น —</option>' +
    models.map(function (m) { return '<option value="' + carPickEsc(m) + '"' + (m === sel ? ' selected' : '') + '>' + carPickEsc(m) + '</option>'; }).join('') +
    '<option value="' + CAR_PICK_OTHER + '"' + (sel && models.indexOf(sel) < 0 ? ' selected' : '') + '>อื่น ๆ (พิมพ์เอง)</option>';
}

// ปีของรุ่นนั้น (ใหม่ไปเก่า) พร้อมรุ่นย่อย/โฉม ให้เลือกถูก เช่น "2024 · Revo ไมเนอร์เชนจ์"
function carPickYearOptions(brand, model, sel) {
  var cat = carPickCat();
  var M = cat && cat[brand] && cat[brand].models && cat[brand].models[model];
  var now = new Date().getFullYear();
  var years = (M && M.years && M.years.length) ? M.years.slice() : [];
  if (!years.length) for (var y = now + 1; y >= 1980; y--) years.push(y);
  years = years.filter(function (y) { return y <= now + 1; }).sort(function (a, b) { return b - a; });
  if (sel && years.indexOf(Number(sel)) < 0) years.unshift(Number(sel));
  return '<option value="">— เลือกปี —</option>' + years.map(function (y) {
    var d = typeof carDisplay === 'function' ? carDisplay(brand, model, y) : null;
    var tag = d ? [d.sub, d.nick].filter(Boolean).join(' ') : '';
    return '<option value="' + y + '"' + (String(y) === String(sel) ? ' selected' : '') + '>' + y + (tag ? ' · ' + carPickEsc(tag) : '') + '</option>';
  }).join('');
}

// ผูกตัวเลือก 3 ช่องเข้าด้วยกันในฟอร์มหนึ่ง (ids = { brand, brandOther, model, modelOther, year })
// เปลี่ยนยี่ห้อ -> รายการรุ่นใหม่ · เปลี่ยนรุ่น -> รายการปีใหม่ · "อื่น ๆ" -> โผล่ช่องพิมพ์
// root = กล่องที่มีช่องเหล่านี้ (ป๊อปอัปหรือการ์ด) · คืนฟังก์ชันอ่านค่า { brand, model, year }
function carPickWire(root, ids) {
  var q = function (id) { return root.querySelector('#' + id) || root.querySelector('[data-cp="' + id + '"]'); };
  var bSel = q(ids.brand), bTxt = q(ids.brandOther), mSel = q(ids.model), mTxt = q(ids.modelOther), ySel = q(ids.year);
  var brandVal = function () { return (bSel && bSel.value && bSel.value !== CAR_PICK_OTHER ? bSel.value : (bTxt ? bTxt.value : '')).trim(); };
  var modelVal = function () { return (mSel && mSel.value && mSel.value !== CAR_PICK_OTHER ? mSel.value : (mTxt ? mTxt.value : '')).trim(); };
  var refreshYears = function () { var y = ySel.value; ySel.innerHTML = carPickYearOptions(brandVal(), modelVal(), y); };
  if (bSel) bSel.addEventListener('change', function () {
    var other = bSel.value === CAR_PICK_OTHER;
    if (bTxt) bTxt.classList.toggle('hidden', !other);
    if (mSel) mSel.innerHTML = carPickModelOptions(other ? '' : bSel.value, '');
    if (mTxt) mTxt.classList.toggle('hidden', !other);
    if (other && mSel) { mSel.value = CAR_PICK_OTHER; if (bTxt) bTxt.focus(); }
    refreshYears();
  });
  if (mSel) mSel.addEventListener('change', function () {
    var other = mSel.value === CAR_PICK_OTHER;
    if (mTxt) mTxt.classList.toggle('hidden', !other);
    if (other && mTxt) mTxt.focus();
    refreshYears();
  });
  if (mTxt) mTxt.addEventListener('change', refreshYears);
  return function () { return { brand: brandVal(), model: modelVal(), year: ySel ? ySel.value : '' }; };
}
