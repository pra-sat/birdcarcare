/* theme.js — พื้นหลังฟองสบู่ Bird CarCare
   ปรับปรุง 13 ก.ย. 2569

   วิธีใช้: ใส่ <script src="../theme.js" defer></script> ในหน้าที่ต้องการ

   ⚠️ ออกแบบให้ "พังไม่ได้" :
     - ห่อ try/catch ทั้งก้อน ถ้ามีอะไรผิดพลาดจะเงียบ ไม่กระทบสคริปต์อื่นของหน้า
     - canvas เป็น pointer-events:none และ z-index 0 จึงกดทะลุได้เสมอ ไม่มีทางบังปุ่ม
     - ไม่แตะ DOM อื่นเลยนอกจาก append canvas ลง body 1 ตัว
     - เครื่องที่ตั้ง "ลดการเคลื่อนไหว" จะไม่สร้าง canvas เลย
     - หยุดวาดเมื่อสลับแท็บ ไม่กินแบต
*/
(function () {
  'use strict';
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.getElementById('bcBubbles')) return;

    var start = function () {
      try {
        if (!document.body) return;

        var c = document.createElement('canvas');
        c.id = 'bcBubbles';
        c.setAttribute('aria-hidden', 'true');
        // กันไว้อีกชั้นเผื่อ theme.css โหลดไม่ทัน
        c.style.position = 'fixed';
        c.style.left = '0';
        c.style.top = '0';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.zIndex = '0';
        c.style.pointerEvents = 'none';
        document.body.insertBefore(c, document.body.firstChild);

        var ctx = c.getContext('2d');
        if (!ctx) return;

        var w = 0, h = 0, list = [], raf = null;

        function born(below) {
          var d = Math.random(), r, a, v;
          if (d < 0.30)      { r = 20 + Math.random() * 32; a = 0.30; v = 0.16; }
          else if (d < 0.70) { r = 10 + Math.random() * 16; a = 0.48; v = 0.30; }
          else               { r =  4 + Math.random() *  9; a = 0.66; v = 0.50; }
          return {
            x: Math.random() * w,
            y: below ? h + r + Math.random() * 40 : Math.random() * h,
            r: r, a: a,
            v: v * (0.7 + Math.random() * 0.7),
            drift: (Math.random() - 0.5) * 0.22,
            ph: Math.random() * Math.PI * 2,
            sw: 0.5 + Math.random() * 0.8
          };
        }

        function size() {
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          w = Math.max(1, window.innerWidth);
          h = Math.max(1, window.innerHeight);
          c.width = Math.floor(w * dpr);
          c.height = Math.floor(h * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function build() {
          var n = Math.round(Math.min(40, Math.max(10, (w * h) / 26000)));
          list = [];
          for (var i = 0; i < n; i++) list.push(born(false));
        }

        function frame() {
          try {
            ctx.clearRect(0, 0, w, h);
            for (var i = 0; i < list.length; i++) {
              var b = list[i];
              b.y -= b.v;
              b.ph += 0.014;
              b.x += b.drift + Math.sin(b.ph) * 0.3;
              if (b.y + b.r < -12) { list[i] = born(true); continue; }

              var g = ctx.createRadialGradient(b.x, b.y, b.r * 0.15, b.x, b.y, b.r);
              g.addColorStop(0,    'rgba(255,255,255,' + (b.a * 0.10) + ')');
              g.addColorStop(0.70, 'rgba(255,255,255,' + (b.a * 0.26) + ')');
              g.addColorStop(0.93, 'rgba(255,255,255,' + (b.a * 0.80) + ')');
              g.addColorStop(1,    'rgba(214,240,253,' + (b.a * 0.45) + ')');
              ctx.beginPath();
              ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
              ctx.fillStyle = g;
              ctx.fill();

              ctx.lineWidth = b.sw;
              ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.95, b.a + 0.30) + ')';
              ctx.stroke();

              ctx.beginPath();
              ctx.ellipse(b.x - b.r * 0.34, b.y - b.r * 0.36, b.r * 0.22, b.r * 0.15, -0.7, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.92, b.a + 0.38) + ')';
              ctx.fill();

              if (b.r > 9) {
                ctx.beginPath();
                ctx.arc(b.x + b.r * 0.40, b.y + b.r * 0.34, b.r * 0.09, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, b.a + 0.14) + ')';
                ctx.fill();
              }
            }
            raf = window.requestAnimationFrame(frame);
          } catch (e) {
            raf = null;   // มีปัญหาระหว่างวาด -> หยุดเงียบ ๆ ไม่รบกวนหน้าเว็บ
          }
        }

        function go()  { if (!raf) frame(); }
        function halt() { if (raf) { window.cancelAnimationFrame(raf); raf = null; } }

        size(); build(); go();

        var t = null;
        window.addEventListener('resize', function () {
          clearTimeout(t);
          t = setTimeout(function () { try { size(); build(); } catch (e) {} }, 180);
        });

        document.addEventListener('visibilitychange', function () {
          if (document.hidden) halt(); else go();
        });

      } catch (e) { /* เงียบ */ }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }

  } catch (e) { /* เงียบ */ }
})();
