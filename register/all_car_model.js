// all_car_model.js  —  ฐานข้อมูลรถสำหรับ Bird CarCare
// ปรับปรุง 13 ก.ย. 2569
//
// ═══════════════════════════════════════════════════════════════════════════
// ทำไมต้องรื้อใหม่
//   ลูกค้า 487 คนพิมพ์ช่อง "ยี่ห้อ" มา 70 แบบ ทั้งที่จริงมีแค่ 15 ยี่ห้อ
//   Isuzu ยี่ห้อเดียวมี 26 วิธีเขียน (Isuzu, อีซูซุ, อีซุซุ, IZUZU, ดีแม็ก, ...)
//   ทำให้ตอนนับยอดได้ Isuzu 135 คัน ทั้งที่จริง 188 คัน — หายไป 53 คัน
//
// โครงสร้างใหม่
//   brand.th[]              คำค้นภาษาไทย/คำที่คนสะกดผิดบ่อย -> พิมพ์ "อีซู" ก็กรองเจอ
//   model.category          ประเภทตัวถัง ใช้ตั้งราคาและเก็บลง Customer_Master
//   model.ev                true = รถไฟฟ้า (ห้ามฉีดน้ำแรงดันสูงในห้องเครื่องแบบรถน้ำมัน)
//   model.gens[]            โฉม/เจเนอเรชัน แทนการไล่เลือกทีละปี
//                           { code, label, from, to }   to = null คือยังขายอยู่
//
//   ถ้ารุ่นไหนไม่มี gens ให้ฟอร์มแสดงช่วงปีกว้าง ๆ แทน
//
// ระดับความมั่นใจของข้อมูล
//   ✅ ตรวจจากเว็บแล้ว : Toyota Hilux, Isuzu D-Max, และรุ่นขายดีของร้าน
//   ⚠️ best-effort     : ยี่ห้อหรู / แบรนด์ที่เพิ่งเข้าไทย — ปีอาจคลาดเคลื่อน ±1
//   รุ่นที่ยังขาด จะถูกเก็บอัตโนมัติในชีต Car_Model_Seen เมื่อมีลูกค้าพิมพ์เข้ามา
//   เดือนละครั้งเปิดดูแล้วเติมเข้าไฟล์นี้ได้เลย ฐานข้อมูลจะโตเองจากลูกค้าจริง
// ═══════════════════════════════════════════════════════════════════════════

const carData = {

  // ─────────────────────────────────────────────────────────────────────
  // อันดับ 1 ของร้าน : 188 คัน
  // ─────────────────────────────────────────────────────────────────────
  "Isuzu": {
    th: ["อีซูซุ", "อีซุซุ", "อีซุซู", "อีซูซู", "อิซุซุ", "อีซูชุ", "อีซุชู", "อีสุสุ", "อีสุ", "อีซู", "isuzu", "izuzu", "izusu", "isusu"],
    models: {
      "D-Max": {
        th: ["ดีแม็ก", "ดีแมค", "ดีแม็กซ์", "dmax", "d max", "วีครอส", "vcross", "v-cross", "ออลนิว", "ออนิว", "all new", "allnew"],
        category: "Pickup",
        gens: [
          { code: "Gen1",        label: "ดีแม็ก ตัวแรก",              from: 2002, to: 2005 },
          { code: "Gen1 FL",     label: "ดีแม็ก ไมเนอร์เชนจ์ (ตาหวาน)", from: 2006, to: 2011 },
          { code: "Gen2",        label: "ออลนิว ดีแม็ก",              from: 2012, to: 2015 },
          { code: "Gen2 Blue",   label: "ดีแม็ก บลูพาวเวอร์",          from: 2016, to: 2019 },
          { code: "Gen3",        label: "ออลนิว ดีแม็ก (โฉมปัจจุบัน)",  from: 2020, to: 2023 },
          { code: "Gen3 FL",     label: "ดีแม็ก ไมเนอร์เชนจ์ 2024",    from: 2024, to: null }
        ]
      },
      "MU-X": {
        th: ["มิวเอ็กซ์", "มิว-เอ็กซ์", "mux", "mu x"],
        category: "SUV",
        gens: [
          { code: "Gen1",    label: "มิวเอ็กซ์ รุ่นแรก",     from: 2013, to: 2020 },
          { code: "Gen2",    label: "ออลนิว มิวเอ็กซ์",      from: 2021, to: 2023 },
          { code: "Gen2 FL", label: "มิวเอ็กซ์ ไมเนอร์เชนจ์", from: 2024, to: null }
        ]
      },
      "MU-7": {
        th: ["มิวเซเว่น", "มิว7", "mu7", "mu 7"],
        category: "SUV",
        gens: [{ code: "MU-7", label: "มิวเซเว่น", from: 2004, to: 2013 }]
      },
      "D-Max Spark": {
        th: ["สปาร์ค", "spark", "ตอนเดียว", "หัวเดียว"],
        category: "Pickup"
      },
      "NLR / NMR (รถบรรทุก)": {
        th: ["nlr", "nmr", "npr", "หกล้อ", "สี่ล้อจัมโบ้", "รถบรรทุก"],
        category: "Truck"
      },
      "Elf": { th: ["เอลฟ์", "elf"], category: "Truck" }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // อันดับ 2 ของร้าน : 177 คัน
  // ─────────────────────────────────────────────────────────────────────
  "Toyota": {
    th: ["โตโยต้า", "โตโยตา", "โตโยต้ะ", "toyota", "toyoto"],
    models: {
      "Hilux": {
        th: ["ไฮลักซ์", "ไฮลัก", "hilux"],
        category: "Pickup",
        gens: [
          { code: "Tiger",      label: "ไทเกอร์",                  from: 1998, to: 2004 },
          { code: "Vigo",       label: "วีโก้",                    from: 2004, to: 2008 },
          { code: "Vigo FL",    label: "วีโก้ ไมเนอร์เชนจ์",        from: 2008, to: 2011 },
          { code: "Vigo Champ", label: "วีโก้ แชมป์",              from: 2011, to: 2015 },
          { code: "Revo",       label: "รีโว่",                    from: 2015, to: 2020 },
          { code: "Revo FL",    label: "รีโว่ ไมเนอร์เชนจ์",        from: 2020, to: 2024 },
          { code: "Travo",      label: "ทราโว่ (โฉมใหม่ล่าสุด)",    from: 2025, to: null }
        ]
      },
      "Fortuner": {
        th: ["ฟอร์จูนเนอร์", "ฟอจูนเนอร์", "fortuner"],
        category: "SUV",
        gens: [
          { code: "Gen1",    label: "ฟอร์จูนเนอร์ ตัวแรก",   from: 2005, to: 2015 },
          { code: "Gen2",    label: "ฟอร์จูนเนอร์ โฉมใหม่",  from: 2015, to: 2020 },
          { code: "Gen2 FL", label: "ฟอร์จูนเนอร์ ลีเจนเดอร์", from: 2020, to: null }
        ]
      },
      "Vios": {
        th: ["วีออส", "vios"],
        category: "Sedan",
        gens: [
          { code: "Gen1", label: "วีออส ตัวแรก",  from: 2002, to: 2007 },
          { code: "Gen2", label: "วีออส โฉม 2",   from: 2007, to: 2013 },
          { code: "Gen3", label: "วีออส โฉม 3",   from: 2013, to: 2022 },
          { code: "Gen4", label: "ยาริส เอทีฟ / วีออส ใหม่", from: 2023, to: null }
        ]
      },
      "Yaris": {
        th: ["ยาริส", "ยารีส", "yaris"],
        category: "Hatchback",
        gens: [
          { code: "Gen1", label: "ยาริส ตัวแรก", from: 2006, to: 2013 },
          { code: "Gen2", label: "ยาริส โฉม 2",  from: 2013, to: 2022 },
          { code: "Gen3", label: "ยาริส ใหม่",   from: 2023, to: null }
        ]
      },
      "Yaris Ativ": { th: ["ยาริส เอทีฟ", "ativ", "เอทีฟ"], category: "Sedan" },
      "Yaris Cross": { th: ["ยาริส ครอส", "yaris cross"], category: "SUV" },
      "Corolla Altis": {
        th: ["อัลติส", "โคโรลล่า", "altis", "corolla"],
        category: "Sedan",
        gens: [
          { code: "Gen9",  label: "อัลติส ตาเหยี่ยว", from: 2001, to: 2007 },
          { code: "Gen10", label: "อัลติส ตาหยี",     from: 2008, to: 2013 },
          { code: "Gen11", label: "อัลติส เอสโป",     from: 2014, to: 2018 },
          { code: "Gen12", label: "อัลติส โฉมปัจจุบัน", from: 2019, to: null }
        ]
      },
      "Corolla Cross": { th: ["โคโรลล่า ครอส", "corolla cross"], category: "SUV" },
      "Camry": {
        th: ["แคมรี่", "แคมรี", "camry"],
        category: "Sedan",
        gens: [
          { code: "ACV40", label: "แคมรี่ โฉมปี 2006", from: 2006, to: 2011 },
          { code: "XV50",  label: "แคมรี่ โฉมปี 2012", from: 2012, to: 2018 },
          { code: "XV70",  label: "แคมรี่ โฉมปี 2019", from: 2019, to: 2024 },
          { code: "XV80",  label: "แคมรี่ ใหม่",       from: 2025, to: null }
        ]
      },
      "C-HR": { th: ["ซีเอชอาร์", "chr", "c hr"], category: "SUV" },
      "Veloz": { th: ["เวลอซ", "veloz"], category: "MPV" },
      "Avanza": { th: ["อแวนซ่า", "avanza"], category: "MPV" },
      "Innova": { th: ["อินโนว่า", "innova", "ครอสต้า", "crysta"], category: "MPV" },
      "Sienta": { th: ["เซียนต้า", "sienta"], category: "MPV" },
      "Commuter": { th: ["คอมมิวเตอร์", "รถตู้", "commuter", "hiace", "ไฮเอซ"], category: "Van" },
      "Hiace": { th: ["ไฮเอซ", "hiace"], category: "Van" },
      "Alphard": { th: ["อัลพาร์ด", "alphard"], category: "MPV" },
      "Soluna": { th: ["โซลูน่า", "soluna"], category: "Sedan" },
      "Vigo Champ": { th: ["วีโก้แชมป์"], category: "Pickup" },
      "bZ4X": { th: ["บีแซด", "bz4x"], category: "SUV", ev: true }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // อันดับ 3 ของร้าน : 47 คัน
  // ─────────────────────────────────────────────────────────────────────
  "Honda": {
    th: ["ฮอนด้า", "ฮ้อนด้า", "ฮอนดา", "honda"],
    models: {
      "Civic": {
        th: ["ซีวิค", "ซิวิค", "civic"],
        category: "Sedan",
        gens: [
          { code: "EK",  label: "ซีวิค ตาโต",        from: 1996, to: 2000 },
          { code: "ES",  label: "ซีวิค ไดเมนชั่น",    from: 2001, to: 2005 },
          { code: "FD",  label: "ซีวิค FD",          from: 2006, to: 2011 },
          { code: "FB",  label: "ซีวิค FB",          from: 2012, to: 2015 },
          { code: "FC",  label: "ซีวิค FC",          from: 2016, to: 2021 },
          { code: "FE",  label: "ซีวิค FE",          from: 2022, to: null }
        ]
      },
      "City": {
        th: ["ซิตี้", "city"],
        category: "Sedan",
        gens: [
          { code: "GD",  label: "ซิตี้ ZX",          from: 2002, to: 2007 },
          { code: "GM",  label: "ซิตี้ โฉมปี 2008",   from: 2008, to: 2013 },
          { code: "GM6", label: "ซิตี้ โฉมปี 2014",   from: 2014, to: 2019 },
          { code: "GN",  label: "ซิตี้ เทอร์โบ",      from: 2020, to: null }
        ]
      },
      "Jazz": {
        th: ["แจ๊ส", "แจส", "jazz"],
        category: "Hatchback",
        gens: [
          { code: "GD", label: "แจ๊ส ตัวแรก",   from: 2003, to: 2007 },
          { code: "GE", label: "แจ๊ส โฉม 2",    from: 2008, to: 2013 },
          { code: "GK", label: "แจ๊ส โฉม 3",    from: 2014, to: 2020 }
        ]
      },
      "CR-V": {
        th: ["ซีอาร์วี", "crv", "cr v"],
        category: "SUV",
        gens: [
          { code: "G3", label: "ซีอาร์วี โฉมปี 2007", from: 2007, to: 2012 },
          { code: "G4", label: "ซีอาร์วี โฉมปี 2013", from: 2013, to: 2016 },
          { code: "G5", label: "ซีอาร์วี โฉมปี 2017", from: 2017, to: 2023 },
          { code: "G6", label: "ซีอาร์วี ใหม่",       from: 2024, to: null }
        ]
      },
      "HR-V": { th: ["เอชอาร์วี", "hrv", "hr v"], category: "SUV" },
      "BR-V": { th: ["บีอาร์วี", "brv", "br v"], category: "MPV" },
      "WR-V": { th: ["ดับเบิลยูอาร์วี", "wrv", "wr v"], category: "SUV" },
      "Accord": {
        th: ["แอคคอร์ด", "accord"],
        category: "Sedan",
        gens: [
          { code: "G7", label: "แอคคอร์ด ปลาวาฬ",  from: 2003, to: 2007 },
          { code: "G8", label: "แอคคอร์ด โฉมปี 2008", from: 2008, to: 2012 },
          { code: "G9", label: "แอคคอร์ด โฉมปี 2013", from: 2013, to: 2019 },
          { code: "G10", label: "แอคคอร์ด โฉมปี 2020", from: 2020, to: null }
        ]
      },
      "Mobilio": { th: ["โมบิลิโอ", "mobilio"], category: "MPV" },
      "Brio": { th: ["บริโอ", "brio"], category: "Hatchback" },
      "Brio Amaze": { th: ["อเมซ", "amaze"], category: "Sedan" },
      "Freed": { th: ["ฟรีด", "freed"], category: "MPV" },
      "Odyssey": { th: ["โอดิสซีย์", "odyssey"], category: "MPV" },
      "e:N1": { th: ["อีเอ็น1", "en1"], category: "SUV", ev: true },

      // ── มอเตอร์ไซค์ Honda ──
      // อยู่ใต้ยี่ห้อ Honda เดียวกับรถยนต์โดยตั้งใจ เพราะข้อมูลเดิมในระบบ
      // เก็บ PCX / Wave / Forza ไว้ใต้ "Honda" อยู่แล้ว
      // การแยกประเภทใช้ category: "Motorcycle" ไม่ใช่แยกเป็นคนละยี่ห้อ
      // ครอบครัวเวฟ / คับ
      "Wave 110i": { th: ["เวฟ110", "wave 110", "เวฟ"], category: "Motorcycle" },
      "Wave 125i": { th: ["เวฟ125", "wave 125"], category: "Motorcycle" },
      "Dream 110i": { th: ["ดรีม", "dream"], category: "Motorcycle" },
      "Super Cub C125": { th: ["ซุปเปอร์คับ", "super cub", "cub"], category: "Motorcycle" },
      "MSX125 (Grom)": { th: ["เอ็มเอสเอ็กซ์", "msx", "grom"], category: "Motorcycle" },
      // สกู๊ตเตอร์
      "Scoopy i": { th: ["สกู๊ปปี้", "สกูปปี้", "scoopy"], category: "Motorcycle" },
      "Click 125i": { th: ["คลิก125", "click 125"], category: "Motorcycle" },
      "Click 160": { th: ["คลิก160", "click 160", "คลิก"], category: "Motorcycle" },
      "Zoomer-X": { th: ["ซูมเมอร์", "zoomer"], category: "Motorcycle" },
      "Giorno+": { th: ["จอร์โน่", "giorno"], category: "Motorcycle" },
      "Moove": { th: ["มูฟ", "moove"], category: "Motorcycle" },
      "Lead 125": { th: ["ลีด", "lead"], category: "Motorcycle" },
      "PCX 160": { th: ["พีซีเอ็กซ์", "pcx 160", "pcx"], category: "Motorcycle" },
      "PCX e:HEV": { th: ["พีซีเอ็กซ์ไฮบริด", "pcx hybrid", "pcx hev"], category: "Motorcycle" },
      "ADV 160": { th: ["เอดีวี", "adv", "adv160"], category: "Motorcycle" },
      "Forza 350": { th: ["ฟอร์ซ่า", "forza 350", "forza"], category: "Motorcycle" },
      // สปอร์ต / เนคเก็ด
      "CBR150R": { th: ["ซีบีอาร์150", "cbr150", "cbr"], category: "Motorcycle" },
      "CBR250RR": { th: ["ซีบีอาร์250", "cbr250"], category: "Motorcycle" },
      "CBR300R": { th: ["ซีบีอาร์300", "cbr300"], category: "Motorcycle" },
      "CBR500R": { th: ["ซีบีอาร์500", "cbr500"], category: "Motorcycle" },
      "CB150R": { th: ["ซีบี150", "cb150", "cb 150r", "exmotion"], category: "Motorcycle" },
      "CB300R": { th: ["ซีบี300", "cb300"], category: "Motorcycle" },
      "CB500F": { th: ["ซีบี500", "cb500"], category: "Motorcycle" },
      "CB650R": { th: ["ซีบี650", "cb650"], category: "Motorcycle" },
      "CB1000R": { th: ["ซีบี1000", "cb1000"], category: "Motorcycle" },
      // วิบาก / แอดเวนเจอร์
      "CRF250L": { th: ["ซีอาร์เอฟ250", "crf250", "crf"], category: "Motorcycle" },
      "CRF250 Rally": { th: ["ซีอาร์เอฟแรลลี่", "crf rally"], category: "Motorcycle" },
      "CRF300L": { th: ["ซีอาร์เอฟ300", "crf300"], category: "Motorcycle" },
      "CT125": { th: ["ซีที125", "ct125", "ฮันเตอร์คับ"], category: "Motorcycle" },
      "NX500": { th: ["เอ็นเอ็กซ์500", "nx500"], category: "Motorcycle" },
      // ครุยเซอร์ / คลาสสิก
      "Rebel 300": { th: ["รีเบล300", "rebel 300"], category: "Motorcycle" },
      "Rebel 500": { th: ["รีเบล", "rebel"], category: "Motorcycle" },
      "GB350": { th: ["จีบี350", "gb350"], category: "Motorcycle" },
      "GB350C": { th: ["จีบี350ซี", "gb350c"], category: "Motorcycle" },
      // ไฟฟ้า
      "UC3": { th: ["ยูซี3", "uc3"], category: "Motorcycle", ev: true }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  "Mitsubishi": {
    th: ["มิตซูบิชิ", "มิตซู", "มิด", "mitsubishi", "mitsu"],
    models: {
      "Triton": {
        th: ["ไทรทัน", "triton", "l200"],
        category: "Pickup",
        gens: [
          { code: "Gen4",    label: "ไทรทัน โฉมปี 2005",  from: 2005, to: 2014 },
          { code: "Gen5",    label: "ไทรทัน โฉมปี 2015",  from: 2015, to: 2018 },
          { code: "Gen5 FL", label: "ไทรทัน ไมเนอร์เชนจ์", from: 2019, to: 2023 },
          { code: "Gen6",    label: "ออลนิว ไทรทัน",      from: 2024, to: null }
        ]
      },
      "Pajero Sport": {
        th: ["ปาเจโร", "ปาเจโร่ สปอร์ต", "pajero"],
        category: "SUV",
        gens: [
          { code: "Gen1", label: "ปาเจโร่ สปอร์ต ตัวแรก", from: 2008, to: 2015 },
          { code: "Gen2", label: "ปาเจโร่ สปอร์ต โฉม 2",  from: 2015, to: 2019 },
          { code: "Gen3", label: "ปาเจโร่ สปอร์ต ใหม่",   from: 2020, to: null }
        ]
      },
      "Attrage": { th: ["แอททราจ", "attrage"], category: "Sedan" },
      "Mirage": { th: ["มิราจ", "mirage"], category: "Hatchback" },
      "Xpander": { th: ["เอ็กซ์แพนเดอร์", "xpander"], category: "MPV" },
      "Xforce": { th: ["เอ็กซ์ฟอร์ซ", "xforce"], category: "SUV" },
      "Lancer": { th: ["แลนเซอร์", "lancer"], category: "Sedan" },
      "Space Wagon": { th: ["สเปซวากอน"], category: "MPV" }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  "Ford": {
    th: ["ฟอร์ด", "ford"],
    models: {
      "Ranger": {
        th: ["เรนเจอร์", "แรนเจอร์", "ranger", "แร็พเตอร์", "raptor", "ไวล์แทรค", "wildtrak"],
        category: "Pickup",
        gens: [
          { code: "Gen2",    label: "เรนเจอร์ โฉมปี 2006",  from: 2006, to: 2011 },
          { code: "Gen3",    label: "เรนเจอร์ T6",          from: 2012, to: 2015 },
          { code: "Gen3 FL", label: "เรนเจอร์ ไมเนอร์เชนจ์", from: 2015, to: 2021 },
          { code: "Gen4",    label: "ออลนิว เรนเจอร์",       from: 2022, to: null }
        ]
      },
      "Everest": {
        th: ["เอเวอเรสต์", "เอเวอร์เรส", "everest"],
        category: "SUV",
        gens: [
          { code: "Gen2", label: "เอเวอเรสต์ โฉมปี 2015", from: 2015, to: 2021 },
          { code: "Gen3", label: "ออลนิว เอเวอเรสต์",     from: 2022, to: null }
        ]
      },
      "Fiesta": { th: ["เฟียสต้า", "fiesta"], category: "Hatchback" },
      "Focus": { th: ["โฟกัส", "focus"], category: "Hatchback" },
      "EcoSport": { th: ["อีโคสปอร์ต", "ecosport"], category: "SUV" },
      "Mustang": { th: ["มัสแตง", "mustang"], category: "Coupe" }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  "Mazda": {
    th: ["มาสด้า", "มาสดา", "mazda"],
    models: {
      "Mazda2": {
        th: ["มาสด้า2", "mazda 2"],
        category: "Hatchback",
        gens: [
          { code: "DE", label: "มาสด้า2 โฉมปี 2009", from: 2009, to: 2014 },
          { code: "DJ", label: "มาสด้า2 สกายแอคทีฟ", from: 2015, to: null }
        ]
      },
      "Mazda3": {
        th: ["มาสด้า3", "mazda 3"],
        category: "Sedan",
        gens: [
          { code: "BK", label: "มาสด้า3 ตัวแรก",    from: 2005, to: 2010 },
          { code: "BL", label: "มาสด้า3 โฉม 2",     from: 2011, to: 2014 },
          { code: "BM", label: "มาสด้า3 สกายแอคทีฟ", from: 2014, to: 2019 },
          { code: "BP", label: "มาสด้า3 ใหม่",      from: 2019, to: null }
        ]
      },
      "BT-50": {
        th: ["บีที50", "bt50", "bt 50"],
        category: "Pickup",
        gens: [
          { code: "Gen1", label: "บีที50 ตัวแรก",  from: 2006, to: 2011 },
          { code: "Gen2", label: "บีที50 โปร",     from: 2012, to: 2020 },
          { code: "Gen3", label: "ออลนิว บีที50",  from: 2021, to: null }
        ]
      },
      "CX-3": { th: ["ซีเอ็กซ์3", "cx3", "cx 3"], category: "SUV" },
      "CX-30": { th: ["ซีเอ็กซ์30", "cx30"], category: "SUV" },
      "CX-5": { th: ["ซีเอ็กซ์5", "cx5", "cx 5"], category: "SUV" },
      "CX-8": { th: ["ซีเอ็กซ์8", "cx8"], category: "SUV" },
      "CX-60": { th: ["ซีเอ็กซ์60", "cx60"], category: "SUV" }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  "Nissan": {
    th: ["นิสสัน", "นิสัน", "นิดสัน", "nissan"],
    models: {
      "Navara": {
        th: ["นาวารา", "navara", "np300"],
        category: "Pickup",
        gens: [
          { code: "D40", label: "นาวารา โฉมปี 2007",   from: 2007, to: 2014 },
          { code: "NP300", label: "นาวารา NP300",      from: 2014, to: 2020 },
          { code: "NP300 FL", label: "นาวารา ไมเนอร์เชนจ์", from: 2021, to: null }
        ]
      },
      "Almera": {
        th: ["อัลเมร่า", "almera"],
        category: "Sedan",
        gens: [
          { code: "Gen1", label: "อัลเมร่า ตัวแรก",  from: 2011, to: 2019 },
          { code: "Gen2", label: "อัลเมร่า เทอร์โบ", from: 2020, to: null }
        ]
      },
      "March": { th: ["มาร์ช", "march"], category: "Hatchback" },
      "Sylphy": { th: ["ซิลฟี่", "sylphy"], category: "Sedan" },
      "Teana": { th: ["เทียน่า", "teana"], category: "Sedan" },
      "X-Trail": { th: ["เอ็กซ์เทรล", "xtrail"], category: "SUV" },
      "Terra": { th: ["เทอร์ร่า", "terra"], category: "SUV" },
      "Kicks": { th: ["คิกส์", "คิ๊กส์", "kicks"], category: "SUV" },
      "Note": { th: ["โน๊ต", "note"], category: "Hatchback" },
      "Leaf": { th: ["ลีฟ", "leaf"], category: "Hatchback", ev: true },
      "Ariya": { th: ["อาริยะ", "ariya"], category: "SUV", ev: true },
      "Urvan": { th: ["เออร์แวน", "urvan", "รถตู้"], category: "Van" }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  "MG": {
    th: ["เอ็มจี", "mg"],
    models: {
      "MG3": { th: ["เอ็มจี3", "mg 3"], category: "Hatchback" },
      "MG5": { th: ["เอ็มจี5", "mg 5"], category: "Sedan" },
      "MG ZS": { th: ["แซดเอส", "zs"], category: "SUV" },
      "MG HS": { th: ["เอชเอส", "hs"], category: "SUV" },
      "MG Extender": { th: ["เอ็กซ์เทนเดอร์", "extender"], category: "Pickup" },
      "MG4 Electric": { th: ["เอ็มจี4", "mg4"], category: "Hatchback", ev: true },
      "MG ZS EV": { th: ["แซดเอส อีวี", "zs ev"], category: "SUV", ev: true },
      "MG ES": { th: ["อีเอส", "mg es"], category: "SUV", ev: true },
      "MG Maxus 9": { th: ["แม็กซัส", "maxus"], category: "MPV", ev: true },
      "MG VS HEV": { th: ["วีเอส", "mg vs"], category: "SUV" }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  "Chevrolet": {
    th: ["เชฟโรเลต", "เชพโลเลต", "เชฟ", "chevrolet", "chevy"],
    models: {
      "Colorado": {
        th: ["โคโลราโด", "colorado"],
        category: "Pickup",
        gens: [
          { code: "Gen1", label: "โคโลราโด ตัวแรก", from: 2003, to: 2011 },
          { code: "Gen2", label: "โคโลราโด โฉม 2",  from: 2012, to: 2020 }
        ]
      },
      "Trailblazer": { th: ["เทรลเบลเซอร์", "trailblazer"], category: "SUV" },
      "Captiva": { th: ["แคปติva", "captiva"], category: "SUV" },
      "Cruze": { th: ["ครูซ", "cruze"], category: "Sedan" },
      "Sonic": { th: ["โซนิค", "sonic"], category: "Hatchback" }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // รถไฟฟ้า — กลุ่มที่โตเร็วที่สุดในไทย (จีนครองส่วนแบ่ง ~85% ของตลาด EV)
  // ─────────────────────────────────────────────────────────────────────
  "BYD": {
    th: ["บีวายดี", "บีวายดี", "byd", "ถัง", "tang", "ซีล", "ดอลฟิน"],
    models: {
      "Atto 3": { th: ["แอตโต้", "atto"], category: "SUV", ev: true },
      "Dolphin": { th: ["ดอลฟิน", "dolphin"], category: "Hatchback", ev: true },
      "Seal": { th: ["ซีล", "seal"], category: "Sedan", ev: true },
      "Sealion 6": { th: ["ซีไลอ้อน6", "sealion 6"], category: "SUV", ev: true },
      "Sealion 7": { th: ["ซีไลอ้อน7", "sealion 7"], category: "SUV", ev: true },
      "Seal U": { th: ["ซีล ยู", "seal u"], category: "SUV", ev: true },
      "M6": { th: ["เอ็ม6", "byd m6"], category: "MPV", ev: true },
      "Tang": { th: ["ถัง", "tang"], category: "SUV", ev: true },
      "Han": { th: ["ฮาน", "han"], category: "Sedan", ev: true }
    }
  },

  "Neta": {
    th: ["เนต้า", "เนตา", "neta"],
    models: {
      "Neta V": { th: ["เนต้าวี", "neta v"], category: "Hatchback", ev: true },
      "Neta X": { th: ["เนต้าเอ็กซ์", "neta x"], category: "SUV", ev: true },
      "Neta S": { th: ["เนต้าเอส", "neta s"], category: "Sedan", ev: true }
    }
  },

  "Ora": {
    th: ["โอร่า", "ora", "เกรทวอลล์", "gwm", "great wall", "กู๊ดแคท", "แมวดี"],
    models: {
      "Good Cat": { th: ["กู๊ดแคท", "แมวดี", "good cat"], category: "Hatchback", ev: true },
      "Ora 07": { th: ["โอร่า07", "ora 07"], category: "Sedan", ev: true }
    }
  },

  "Haval": {
    th: ["ฮาวาล", "ฮาวาว", "haval"],
    models: {
      "Jolion": { th: ["โจลิออน", "jolion"], category: "SUV" },
      "H6": { th: ["เอช6", "haval h6"], category: "SUV" },
      "H6 PHEV": { th: ["เอช6 ปลั๊กอิน"], category: "SUV" }
    }
  },

  "Deepal": {
    th: ["ดีพอล", "deepal"],
    models: {
      "S07": { th: ["เอส07", "s07"], category: "SUV", ev: true },
      "L07": { th: ["แอล07", "l07"], category: "Sedan", ev: true },
      "E07": { th: ["อี07", "e07"], category: "Pickup", ev: true }
    }
  },

  "Changan": {
    th: ["ฉางอาน", "changan", "ลูมิน", "lumin"],
    models: {
      "Lumin": { th: ["ลูมิน", "lumin"], category: "Hatchback", ev: true },
      "CS55 Plus": { th: ["ซีเอส55", "cs55"], category: "SUV" }
    }
  },

  "AION": {
    th: ["ไอออน", "เอออน", "aion", "gac", "ไฮเทค", "hyptec"],
    models: {
      "AION Y Plus": { th: ["วายพลัส", "y plus"], category: "SUV", ev: true },
      "AION V": { th: ["เอออนวี", "aion v"], category: "SUV", ev: true },
      "AION ES": { th: ["เอออนอีเอส", "aion es"], category: "Sedan", ev: true },
      "HYPTEC HT": { th: ["ไฮเทค เอชที", "hyptec ht"], category: "SUV", ev: true },
      "HYPTEC GT": { th: ["ไฮเทค จีที", "hyptec gt"], category: "Sedan", ev: true }
    }
  },

  "Tesla": {
    th: ["เทสล่า", "เทสลา", "tesla"],
    models: {
      "Model 3": { th: ["โมเดล3", "model 3"], category: "Sedan", ev: true },
      "Model Y": { th: ["โมเดลวาย", "model y"], category: "SUV", ev: true },
      "Model S": { th: ["โมเดลเอส", "model s"], category: "Sedan", ev: true },
      "Model X": { th: ["โมเดลเอ็กซ์", "model x"], category: "SUV", ev: true }
    }
  },

  "XPENG": {
    th: ["เอ็กซ์เผิง", "xpeng"],
    models: {
      "G6": { th: ["จี6", "xpeng g6"], category: "SUV", ev: true },
      "X9": { th: ["เอ็กซ์9", "xpeng x9"], category: "MPV", ev: true }
    }
  },

  "ZEEKR": {
    th: ["ซีเคอร์", "zeekr"],
    models: {
      "Zeekr X": { th: ["ซีเคอร์เอ็กซ์", "zeekr x"], category: "SUV", ev: true },
      "Zeekr 009": { th: ["ซีเคอร์009", "zeekr 009"], category: "MPV", ev: true },
      "Zeekr 001": { th: ["ซีเคอร์001", "zeekr 001"], category: "Sedan", ev: true }
    }
  },

  "Jaecoo": {
    th: ["เจคู", "jaecoo", "เชอรี่", "chery"],
    models: {
      "Jaecoo 5": { th: ["เจคู5", "jaecoo 5"], category: "SUV" },
      "Jaecoo 6": { th: ["เจคู6", "jaecoo 6"], category: "SUV", ev: true },
      "Jaecoo 7": { th: ["เจคู7", "jaecoo 7"], category: "SUV" }
    }
  },

  "Omoda": {
    th: ["โอโมดา", "omoda", "เชอรี่", "chery"],
    models: {
      "Omoda C5": { th: ["ซี5", "omoda c5"], category: "SUV" },
      "Omoda C7": { th: ["ซี7", "omoda c7"], category: "SUV" }
    }
  },

  "Leapmotor": {
    th: ["ลีปมอเตอร์", "leapmotor"],
    models: {
      "C10": { th: ["ซี10", "c10"], category: "SUV", ev: true },
      "B10": { th: ["บี10", "b10"], category: "SUV", ev: true }
    }
  },

  "Wuling": {
    th: ["อู่หลิง", "หวู่หลิง", "wuling"],
    models: {
      "Binguo": { th: ["บิงกัว", "binguo"], category: "Hatchback", ev: true },
      "Air EV": { th: ["แอร์อีวี", "air ev"], category: "Hatchback", ev: true }
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // ยี่ห้ออื่นที่มีขายในไทย
  // ─────────────────────────────────────────────────────────────────────
  "Suzuki": {
    th: ["ซูซูกิ", "ซุซุกิ", "suzuki"],
    models: {
      "Swift": { th: ["สวิฟท์", "swift"], category: "Hatchback" },
      "Ciaz": { th: ["เซียส", "ciaz"], category: "Sedan" },
      "Celerio": { th: ["เซเลริโอ", "celerio"], category: "Hatchback" },
      "Ertiga": { th: ["เออร์ติก้า", "ertiga"], category: "MPV" },
      "XL7": { th: ["เอ็กซ์แอล7", "xl7"], category: "MPV" },
      "Carry": { th: ["แครี่", "carry"], category: "Pickup" },
      "Jimny": { th: ["จิมนี่", "jimny"], category: "SUV" },

      // ── มอเตอร์ไซค์ Suzuki ── (เหตุผลเดียวกับ Honda)
      "GSX-R150": { th: ["จีเอสเอ็กซ์อาร์150", "gsx r150", "gsx"], category: "Motorcycle" },
      "GSX-S150": { th: ["จีเอสเอ็กซ์เอส", "gsx s150"], category: "Motorcycle" },
      "GSX-R1000": { th: ["จีเอสเอ็กซ์อาร์1000", "gsx r1000"], category: "Motorcycle" },
      "Burgman 400": { th: ["เบอร์แมน", "burgman"], category: "Motorcycle" },
      "Burgman Street": { th: ["เบอร์แมนสตรีท", "burgman street"], category: "Motorcycle" },
      "Smash": { th: ["สแมช", "smash"], category: "Motorcycle" },
      "Avenis": { th: ["อเวนิส", "avenis"], category: "Motorcycle" },
      "Address": { th: ["แอดเดรส", "address"], category: "Motorcycle" },
      "Raider R150": { th: ["ไรเดอร์", "raider"], category: "Motorcycle" },
      "V-Strom 250": { th: ["วีสตรอม", "v strom", "vstrom"], category: "Motorcycle" }
    }
  },

  "Hyundai": {
    th: ["ฮุนได", "ฮุนไดย์", "hyundai"],
    models: {
      "H-1": { th: ["เอชวัน", "h1", "รถตู้"], category: "Van" },
      "Staria": { th: ["สตาเรีย", "staria"], category: "Van" },
      "Creta": { th: ["เครต้า", "creta"], category: "SUV" },
      "Ioniq 5": { th: ["ไอออนิค5", "ioniq 5"], category: "SUV", ev: true },
      "Ioniq 6": { th: ["ไอออนิค6", "ioniq 6"], category: "Sedan", ev: true },
      "Kona": { th: ["โคน่า", "kona"], category: "SUV", ev: true }
    }
  },

  "Kia": {
    th: ["เกีย", "kia"],
    models: {
      "Carnival": { th: ["คาร์นิวัล", "carnival"], category: "MPV" },
      "Sorento": { th: ["โซเรนโต้", "sorento"], category: "SUV" },
      "Seltos": { th: ["เซลทอส", "seltos"], category: "SUV" },
      "EV6": { th: ["อีวี6", "ev6"], category: "SUV", ev: true },
      "EV9": { th: ["อีวี9", "ev9"], category: "SUV", ev: true }
    }
  },

  "Subaru": {
    th: ["ซูบารุ", "subaru"],
    models: {
      "Forester": { th: ["ฟอเรสเตอร์", "forester"], category: "SUV" },
      "XV": { th: ["เอ็กซ์วี", "subaru xv"], category: "SUV" },
      "Outback": { th: ["เอาท์แบ็ค", "outback"], category: "SUV" },
      "WRX": { th: ["ดับเบิลยูอาร์เอ็กซ์", "wrx"], category: "Sedan" },
      "BRZ": { th: ["บีอาร์แซด", "brz"], category: "Coupe" }
    }
  },

  "BMW": {
    th: ["บีเอ็มดับเบิลยู", "บีเอ็ม", "bmw"],
    models: {
      "1 Series": { th: ["ซีรี่ส์1", "116", "118"], category: "Hatchback" },
      "2 Series": { th: ["ซีรี่ส์2", "220"], category: "Coupe" },
      "3 Series": { th: ["ซีรี่ส์3", "320", "330", "320d"], category: "Sedan" },
      "4 Series": { th: ["ซีรี่ส์4", "430"], category: "Coupe" },
      "5 Series": { th: ["ซีรี่ส์5", "520", "530", "520d"], category: "Sedan" },
      "7 Series": { th: ["ซีรี่ส์7", "730", "740"], category: "Sedan" },
      "X1": { th: ["เอ็กซ์1"], category: "SUV" },
      "X3": { th: ["เอ็กซ์3"], category: "SUV" },
      "X5": { th: ["เอ็กซ์5"], category: "SUV" },
      "X7": { th: ["เอ็กซ์7"], category: "SUV" },
      "i4": { th: ["ไอ4", "bmw i4"], category: "Sedan", ev: true },
      "iX3": { th: ["ไอเอ็กซ์3", "ix3"], category: "SUV", ev: true }
    }
  },

  "Mercedes-Benz": {
    th: ["เมอร์เซเดส", "เบนซ์", "benz", "mercedes"],
    models: {
      "A-Class": { th: ["เอคลาส", "a class"], category: "Hatchback" },
      "C-Class": { th: ["ซีคลาส", "c class", "c200", "c250"], category: "Sedan" },
      "E-Class": { th: ["อีคลาส", "e class", "e200", "e300"], category: "Sedan" },
      "S-Class": { th: ["เอสคลาส", "s class", "s350"], category: "Sedan" },
      "GLA": { th: ["จีแอลเอ"], category: "SUV" },
      "GLC": { th: ["จีแอลซี"], category: "SUV" },
      "GLE": { th: ["จีแอลอี"], category: "SUV" },
      "EQS": { th: ["อีคิวเอส", "eqs"], category: "Sedan", ev: true },
      "EQE": { th: ["อีคิวอี", "eqe"], category: "Sedan", ev: true },
      "V-Class": { th: ["วีคลาส", "vito"], category: "Van" }
    }
  },

  "Audi": {
    th: ["ออดี้", "audi"],
    models: {
      "A3": { th: ["เอ3"], category: "Hatchback" },
      "A4": { th: ["เอ4"], category: "Sedan" },
      "A5": { th: ["เอ5"], category: "Coupe" },
      "A6": { th: ["เอ6"], category: "Sedan" },
      "Q3": { th: ["คิว3"], category: "SUV" },
      "Q5": { th: ["คิว5"], category: "SUV" },
      "Q7": { th: ["คิว7"], category: "SUV" },
      "e-tron": { th: ["อีตรอน", "etron"], category: "SUV", ev: true }
    }
  },

  "Lexus": {
    th: ["เล็กซัส", "เลกซัส", "lexus"],
    models: {
      "ES": { th: ["อีเอส", "es300"], category: "Sedan" },
      "IS": { th: ["ไอเอส"], category: "Sedan" },
      "NX": { th: ["เอ็นเอ็กซ์"], category: "SUV" },
      "RX": { th: ["อาร์เอ็กซ์"], category: "SUV" },
      "LM": { th: ["แอลเอ็ม"], category: "MPV" },
      "UX": { th: ["ยูเอ็กซ์"], category: "SUV" }
    }
  },

  "Volvo": {
    th: ["วอลโว่", "วอลโว", "volvo"],
    models: {
      "XC40": { th: ["เอ็กซ์ซี40", "xc40"], category: "SUV" },
      "XC60": { th: ["เอ็กซ์ซี60", "xc60"], category: "SUV" },
      "XC90": { th: ["เอ็กซ์ซี90", "xc90"], category: "SUV" },
      "S60": { th: ["เอส60", "s60"], category: "Sedan" },
      "S90": { th: ["เอส90", "s90"], category: "Sedan" },
      "EX30": { th: ["อีเอ็กซ์30", "ex30"], category: "SUV", ev: true },
      "EX40": { th: ["อีเอ็กซ์40", "ex40"], category: "SUV", ev: true }
    }
  },

  "Volkswagen": {
    th: ["โฟล์คสวาเกน", "โฟล์ค", "volkswagen", "vw"],
    models: {
      "Golf": { th: ["กอล์ฟ", "golf"], category: "Hatchback" },
      "Tiguan": { th: ["ทิกวน", "tiguan"], category: "SUV" },
      "Caravelle": { th: ["คาราเวล", "caravelle"], category: "Van" }
    }
  },

  "MINI": {
    th: ["มินิ", "mini", "คูเปอร์", "cooper"],
    models: {
      "Cooper": { th: ["คูเปอร์", "cooper"], category: "Hatchback" },
      "Countryman": { th: ["คันทรีแมน", "countryman"], category: "SUV" },
      "Cooper SE": { th: ["คูเปอร์เอสอี", "cooper se"], category: "Hatchback", ev: true }
    }
  },

  "Porsche": {
    th: ["ปอร์เช่", "ปอเช่", "porsche"],
    models: {
      "911": { th: ["911"], category: "Coupe" },
      "Cayenne": { th: ["คาเยนน์", "cayenne"], category: "SUV" },
      "Macan": { th: ["มาคัน", "macan"], category: "SUV" },
      "Panamera": { th: ["พานาเมร่า", "panamera"], category: "Sedan" },
      "Taycan": { th: ["ไทคานน์", "taycan"], category: "Sedan", ev: true }
    }
  },

  "Land Rover": {
    th: ["แลนด์โรเวอร์", "land rover", "เรนจ์โรเวอร์", "range rover"],
    models: {
      "Defender": { th: ["ดีเฟนเดอร์", "defender"], category: "SUV" },
      "Discovery": { th: ["ดิสคัฟเวอรี่", "discovery"], category: "SUV" },
      "Range Rover": { th: ["เรนจ์โรเวอร์", "range rover"], category: "SUV" },
      "Evoque": { th: ["อีโวค", "evoque"], category: "SUV" }
    }
  },

  "Peugeot": {
    th: ["เปอโยต์", "peugeot"],
    models: {
      "3008": { th: ["3008"], category: "SUV" },
      "5008": { th: ["5008"], category: "SUV" },
      "2008": { th: ["2008"], category: "SUV" }
    }
  },

  "Jaguar": { th: ["จากัวร์", "jaguar"], models: { "XE": { th: ["เอ็กซ์อี"], category: "Sedan" }, "XF": { th: ["เอ็กซ์เอฟ"], category: "Sedan" }, "F-Pace": { th: ["เอฟเพซ"], category: "SUV" } } },
  "Bentley": { th: ["เบนท์ลีย์", "bentley"], models: { "Continental GT": { th: ["คอนติเนนทัล"], category: "Coupe" }, "Bentayga": { th: ["เบนเทก้า"], category: "SUV" }, "Flying Spur": { th: ["ฟลายอิ้งสเปอร์"], category: "Sedan" } } },
  "Ferrari": { th: ["เฟอร์รารี่", "ferrari"], models: { "Roma": { th: ["โรม่า"], category: "Coupe" }, "296": { th: ["296"], category: "Coupe" }, "Purosangue": { th: ["ปูโรซังเก"], category: "SUV" } } },
  "Lamborghini": { th: ["ลัมโบร์กินี", "lamborghini", "ลัมโบ"], models: { "Urus": { th: ["อูรุส", "urus"], category: "SUV" }, "Huracan": { th: ["ฮูราแคน"], category: "Coupe" } } },
  "Maserati": { th: ["มาเซราติ", "maserati"], models: { "Ghibli": { th: ["กิบลี"], category: "Sedan" }, "Levante": { th: ["เลวานเต้"], category: "SUV" }, "Grecale": { th: ["เกรกาเล่"], category: "SUV" } } },
  "Rolls-Royce": { th: ["โรลส์รอยซ์", "rolls royce"], models: { "Ghost": { th: ["โกสต์"], category: "Sedan" }, "Cullinan": { th: ["คัลลินัน"], category: "SUV" }, "Phantom": { th: ["แฟนธ่อม"], category: "Sedan" } } },
  "Thairung": { th: ["ไทยรุ่ง", "thairung", "ทีอาร์"], models: { "TR Transformer": { th: ["ทรานส์ฟอร์เมอร์", "transformer"], category: "SUV" } } },
  "Foton": { th: ["โฟตอน", "foton"], models: { "Tunland": { th: ["ทันแลนด์"], category: "Pickup" }, "View": { th: ["วิว"], category: "Van" } } },
  "Hino": { th: ["ฮีโน่", "hino"], models: { "300 Series": { th: ["300", "หกล้อ"], category: "Truck" }, "500 Series": { th: ["500", "สิบล้อ"], category: "Truck" } } },

  // ─────────────────────────────────────────────────────────────────────
  // มอเตอร์ไซค์ — ร้านรับล้างด้วย (ปัจจุบันมีในระบบแล้ว 6 คัน)
  // ─────────────────────────────────────────────────────────────────────
  "Yamaha": {
    th: ["ยามาฮ่า", "ยามาฮา", "yamaha", "เอ็นแม็กซ์", "nmax", "เอ็กซ์แม็กซ์", "xmax", "แกรนด์ฟิลาโน่", "ฟีโน่", "aerox"],
    moto: true,
    models: {
      // สกู๊ตเตอร์
      "Grand Filano Hybrid": { th: ["แกรนด์ฟิลาโน่", "ฟิลาโน่", "filano"], category: "Motorcycle" },
      "Fino 125": { th: ["ฟีโน่", "fino"], category: "Motorcycle" },
      "Fazzio": { th: ["แฟซซิโอ", "fazzio"], category: "Motorcycle" },
      "QBIX": { th: ["คิวบิกซ์", "qbix"], category: "Motorcycle" },
      "Freego": { th: ["ฟรีโก", "freego"], category: "Motorcycle" },
      "Mio": { th: ["มีโอ", "mio"], category: "Motorcycle" },
      "GT125": { th: ["จีที125", "gt125"], category: "Motorcycle" },
      "Aerox 155": { th: ["แอร็อกซ์", "แอโรกซ์", "aerox"], category: "Motorcycle" },
      "NMAX 155": { th: ["เอ็นแม็กซ์", "nmax", "n max"], category: "Motorcycle" },
      "XMAX 300": { th: ["เอ็กซ์แม็กซ์", "xmax", "x-max", "x max"], category: "Motorcycle" },
      "TMAX 560": { th: ["ทีแม็กซ์", "tmax"], category: "Motorcycle" },
      // ครอบครัวเวฟ / คับ
      "Finn": { th: ["ฟินน์", "finn"], category: "Motorcycle" },
      "Spark 135": { th: ["สปาร์ค", "spark"], category: "Motorcycle" },
      "Exciter 155": { th: ["เอ็กไซเตอร์", "exciter"], category: "Motorcycle" },
      "PG-1": { th: ["พีจี1", "pg1", "pg-1"], category: "Motorcycle" },
      // สปอร์ต / เนคเก็ด
      "YZF-R15": { th: ["อาร์15", "r15", "yzf r15"], category: "Motorcycle" },
      "YZF-R3": { th: ["อาร์3", "r3", "yzf r3"], category: "Motorcycle" },
      "YZF-R7": { th: ["อาร์7", "r7", "yzf r7"], category: "Motorcycle" },
      "YZF-R1": { th: ["อาร์1", "r1", "yzf r1"], category: "Motorcycle" },
      "MT-15": { th: ["เอ็มที15", "mt15", "mt 15"], category: "Motorcycle" },
      "MT-03": { th: ["เอ็มที03", "mt03", "mt 03"], category: "Motorcycle" },
      "MT-07": { th: ["เอ็มที07", "mt07", "mt 07"], category: "Motorcycle" },
      "MT-09": { th: ["เอ็มที09", "mt09", "mt 09"], category: "Motorcycle" },
      "XSR155": { th: ["เอ็กซ์เอสอาร์155", "xsr155", "xsr"], category: "Motorcycle" },
      "XSR700": { th: ["เอ็กซ์เอสอาร์700", "xsr700"], category: "Motorcycle" },
      "XSR900": { th: ["เอ็กซ์เอสอาร์900", "xsr900"], category: "Motorcycle" },
      "SR400": { th: ["เอสอาร์400", "sr400"], category: "Motorcycle" },
      // วิบาก / ทัวริ่ง
      "WR155R": { th: ["ดับเบิลยูอาร์155", "wr155", "wr"], category: "Motorcycle" },
      "Tenere 700": { th: ["เทเนเร่", "tenere"], category: "Motorcycle" },
      "Tracer 9 GT": { th: ["เทรเซอร์", "tracer"], category: "Motorcycle" }
    }
  },

  "Kawasaki": {
    th: ["คาวาซากิ", "คาวา", "kawasaki", "เคเอสอาร์", "ksr", "นินจา", "ninja"],
    moto: true,
    models: {
      "Ninja 250": { th: ["นินจา250", "ninja 250"], category: "Motorcycle" },
      "Ninja 400": { th: ["นินจา400", "ninja 400", "นินจา"], category: "Motorcycle" },
      "Ninja 650": { th: ["นินจา650", "ninja 650"], category: "Motorcycle" },
      "Ninja ZX-4R": { th: ["zx4r", "zx-4r"], category: "Motorcycle" },
      "Ninja ZX-10R": { th: ["zx10r", "zx-10r"], category: "Motorcycle" },
      "Z250": { th: ["แซด250", "z250"], category: "Motorcycle" },
      "Z400": { th: ["แซด400", "z400"], category: "Motorcycle" },
      "Z650": { th: ["แซด650", "z650"], category: "Motorcycle" },
      "Z900": { th: ["แซด900", "z900"], category: "Motorcycle" },
      "KSR Pro": { th: ["เคเอสอาร์", "ksr"], category: "Motorcycle" },
      "W175": { th: ["ดับเบิลยู175", "w175"], category: "Motorcycle" },
      "W800": { th: ["ดับเบิลยู800", "w800"], category: "Motorcycle" },
      "Versys 650": { th: ["เวอร์ซิส", "versys"], category: "Motorcycle" },
      "Versys-X 300": { th: ["เวอร์ซิสเอ็กซ์", "versys x"], category: "Motorcycle" },
      "KLX230": { th: ["เคแอลเอ็กซ์", "klx"], category: "Motorcycle" },
      "Eliminator 450": { th: ["อิลิมิเนเตอร์", "eliminator"], category: "Motorcycle" },
      "Vulcan S": { th: ["วัลแคน", "vulcan"], category: "Motorcycle" }
    }
  },

  "GPX": {
    th: ["จีพีเอ็กซ์", "gpx", "เดโมน", "demon", "เลเจนด้า", "legend"],
    moto: true,
    models: {
      "Demon 150GR": { th: ["เดโมน150", "demon 150"], category: "Motorcycle" },
      "Demon GR200R": { th: ["เดโมน200", "demon gr200", "เดโมน"], category: "Motorcycle" },
      "Legend 150S": { th: ["เลเจนด้า150", "legend 150"], category: "Motorcycle" },
      "Legend 250 Twin": { th: ["เลเจนด้า250", "legend 250", "เลเจนด้า"], category: "Motorcycle" },
      "Drone 150": { th: ["โดรน", "drone"], category: "Motorcycle" },
      "Razer 220": { th: ["เรเซอร์", "razer"], category: "Motorcycle" },
      "Rock 110": { th: ["ร็อค", "rock"], category: "Motorcycle" },
      "Popz 110": { th: ["ป๊อปซ์", "popz"], category: "Motorcycle" },
      "Gentleman 200": { th: ["เจนเทิลแมน", "gentleman"], category: "Motorcycle" },
      "MAD 300": { th: ["แมด", "gpx mad"], category: "Motorcycle" }
    }
  },

  "Vespa": {
    th: ["เวสป้า", "เวสปา", "vespa"],
    moto: true,
    models: {
      "Sprint": { th: ["สปรินท์", "sprint"], category: "Motorcycle" },
      "Primavera": { th: ["พรีมาเวร่า", "primavera"], category: "Motorcycle" },
      "GTS 300": { th: ["จีทีเอส", "gts"], category: "Motorcycle" },
      "LX 125": { th: ["แอลเอ็กซ์", "vespa lx"], category: "Motorcycle" },
      "Sei Giorni": { th: ["เซอิจอร์นี่", "sei giorni"], category: "Motorcycle" },
      "946": { th: ["946"], category: "Motorcycle" },
      "Elettrica": { th: ["อิเล็กทริก้า", "elettrica"], category: "Motorcycle", ev: true }
    }
  },

  "Ducati": { th: ["ดูคาติ", "ducati"], moto: true, models: { "Monster": { th: ["มอนสเตอร์", "monster"], category: "Motorcycle" }, "Panigale V2": { th: ["ปานิกาเล่วี2", "panigale v2"], category: "Motorcycle" }, "Panigale V4": { th: ["ปานิกาเล่วี4", "panigale v4", "ปานิกาเล่"], category: "Motorcycle" }, "Scrambler": { th: ["สแครมเบลอร์", "scrambler"], category: "Motorcycle" }, "Multistrada": { th: ["มัลติสตราด้า", "multistrada"], category: "Motorcycle" }, "Diavel": { th: ["ดิอาเวล", "diavel"], category: "Motorcycle" }, "Streetfighter": { th: ["สตรีทไฟท์เตอร์", "streetfighter"], category: "Motorcycle" }, "Hypermotard": { th: ["ไฮเปอร์โมทาร์ด", "hypermotard"], category: "Motorcycle" } } },
  "Triumph": { th: ["ไทรอัมพ์", "triumph"], moto: true, models: { "Bonneville T100": { th: ["บอนเนวิลล์t100", "bonneville t100"], category: "Motorcycle" }, "Bonneville T120": { th: ["บอนเนวิลล์", "bonneville"], category: "Motorcycle" }, "Speed Twin": { th: ["สปีดทวิน", "speed twin"], category: "Motorcycle" }, "Speed 400": { th: ["สปีด400", "speed 400"], category: "Motorcycle" }, "Scrambler 400X": { th: ["สแครมเบลอร์400", "scrambler 400"], category: "Motorcycle" }, "Tiger 900": { th: ["ไทเกอร์900", "tiger 900"], category: "Motorcycle" }, "Rocket 3": { th: ["ร็อคเก็ต", "rocket"], category: "Motorcycle" }, "Street Triple": { th: ["สตรีททริปเปิ้ล", "street triple"], category: "Motorcycle" } } },
  "Harley-Davidson": { th: ["ฮาร์เลย์", "harley", "ฮาเล่", "hd"], moto: true, models: { "Sportster S": { th: ["สปอร์ตสเตอร์", "sportster"], category: "Motorcycle" }, "Nightster": { th: ["ไนท์สเตอร์", "nightster"], category: "Motorcycle" }, "Street Glide": { th: ["สตรีทไกลด์", "street glide"], category: "Motorcycle" }, "Road Glide": { th: ["โร้ดไกลด์", "road glide"], category: "Motorcycle" }, "Fat Boy": { th: ["แฟตบอย", "fat boy"], category: "Motorcycle" }, "Pan America": { th: ["แพนอเมริกา", "pan america"], category: "Motorcycle" }, "X440": { th: ["x440"], category: "Motorcycle" } } },
  "Royal Enfield": { th: ["รอยัลเอนฟีลด์", "royal enfield", "เอนฟีลด์"], moto: true, models: { "Classic 350": { th: ["คลาสสิค350", "classic 350"], category: "Motorcycle" }, "Hunter 350": { th: ["ฮันเตอร์", "hunter"], category: "Motorcycle" }, "Meteor 350": { th: ["มีเทีย", "meteor"], category: "Motorcycle" }, "Himalayan": { th: ["หิมาลายัน", "himalayan"], category: "Motorcycle" }, "Interceptor 650": { th: ["อินเตอร์เซปเตอร์", "interceptor"], category: "Motorcycle" }, "Continental GT 650": { th: ["คอนติเนนทัลจีที", "continental gt"], category: "Motorcycle" }, "Scram 411": { th: ["สแครม", "scram"], category: "Motorcycle" } } },
  "Lambretta": { th: ["แลมเบรตต้า", "lambretta", "แลมเบรต"], moto: true, models: { "V125": { th: ["วี125"], category: "Motorcycle" }, "V200": { th: ["วี200"], category: "Motorcycle" }, "X300": { th: ["เอ็กซ์300"], category: "Motorcycle" }, "G350": { th: ["จี350"], category: "Motorcycle" } } },
  "Scomadi": { th: ["สโกมาดิ", "scomadi", "สโคมาดิ"], moto: true, models: { "TL125": { th: ["ทีแอล125", "tl125"], category: "Motorcycle" }, "TL200": { th: ["ทีแอล200", "tl200"], category: "Motorcycle" }, "TT200": { th: ["ทีที200", "tt200"], category: "Motorcycle" } } },
  "Benelli": { th: ["เบเนลลี่", "benelli"], moto: true, models: { "TNT 300": { th: ["ทีเอ็นที", "tnt"], category: "Motorcycle" }, "Leoncino 250": { th: ["ลีออนชิโน่", "leoncino"], category: "Motorcycle" }, "TRK 502": { th: ["ทีอาร์เค", "trk"], category: "Motorcycle" }, "Imperiale 400": { th: ["อิมพีเรียล", "imperiale"], category: "Motorcycle" }, "502C": { th: ["502c"], category: "Motorcycle" } } },
  "KTM": { th: ["เคทีเอ็ม", "ktm"], moto: true, models: { "Duke 200": { th: ["ดุ๊ก200", "duke 200"], category: "Motorcycle" }, "Duke 250": { th: ["ดุ๊ก250", "duke 250"], category: "Motorcycle" }, "Duke 390": { th: ["ดุ๊ก390", "duke 390", "ดุ๊ก"], category: "Motorcycle" }, "RC 390": { th: ["อาร์ซี390", "rc 390", "อาร์ซี"], category: "Motorcycle" }, "Adventure 390": { th: ["แอดเวนเจอร์390", "adventure 390"], category: "Motorcycle" }, "SX-F": { th: ["เอสเอ็กซ์เอฟ", "sxf"], category: "Motorcycle" } } },
  "Zeeho": { th: ["ซีโฮ่", "zeeho"], moto: true, models: { "AE8": { th: ["เออี8"], category: "Motorcycle", ev: true }, "AE6": { th: ["เออี6"], category: "Motorcycle", ev: true } } },
  "Deco": { th: ["เดโค", "deco"], moto: true, models: { "Espresso": { th: ["เอสเพรสโซ่", "espresso"], category: "Motorcycle", ev: true }, "Chill": { th: ["ชิล", "chill"], category: "Motorcycle", ev: true } } },

  // ── มอเตอร์ไซค์ไฟฟ้า ที่เริ่มเห็นตามถนนในไทย ──
  "ETRAN": { th: ["อีทราน", "etran"], moto: true, models: { "MYRA": { th: ["ไมร่า", "myra"], category: "Motorcycle", ev: true }, "KRAF": { th: ["คราฟ", "kraf"], category: "Motorcycle", ev: true } } },
  "NIU": { th: ["นิว", "niu"], moto: true, models: { "NQi": { th: ["เอ็นคิว", "nqi"], category: "Motorcycle", ev: true }, "MQi": { th: ["เอ็มคิว", "mqi"], category: "Motorcycle", ev: true } } },
  "Yadea": { th: ["ยาเดีย", "yadea"], moto: true, models: { "G5": { th: ["จี5"], category: "Motorcycle", ev: true }, "T9": { th: ["ที9"], category: "Motorcycle", ev: true } } },
  "SLEEK": { th: ["สลีค", "sleek"], moto: true, models: { "Play": { th: ["เพลย์", "play"], category: "Motorcycle", ev: true } } },
  "Strom": { th: ["สตรอม", "strom"], moto: true, models: { "Sport": { th: ["สปอร์ต"], category: "Motorcycle", ev: true } } },

  // ─────────────────────────────────────────────────────────────────────
  // ยี่ห้อหายาก — ยกมาจากไฟล์เดิมเพื่อไม่ให้ลูกค้าที่ขับรถพวกนี้ลงทะเบียนไม่ได้
  // ─────────────────────────────────────────────────────────────────────
  "Jeep": { th: ["จี๊ป", "jeep"], models: { "Wrangler": { th: ["แรงเลอร์", "wrangler"], category: "SUV" }, "Grand Cherokee": { th: ["เชโรกี", "cherokee"], category: "SUV" }, "Compass": { th: ["คอมพาส"], category: "SUV" } } },
  "Chrysler": { th: ["ไครสเลอร์", "chrysler"], models: { "300C": { th: ["300c"], category: "Sedan" }, "Voyager": { th: ["วอยเอเจอร์"], category: "MPV" } } },
  "Proton": { th: ["โปรตอน", "proton"], models: { "Saga": { th: ["ซาก้า"], category: "Sedan" }, "Exora": { th: ["เอ็กซ์โซร่า"], category: "MPV" } } },
  "Tata": { th: ["ทาทา", "tata"], models: { "Xenon": { th: ["ซีนอน", "xenon"], category: "Pickup" }, "Super Ace": { th: ["ซุปเปอร์เอซ"], category: "Truck" } } },
  "Mitsuoka": { th: ["มิตซึโอกะ", "mitsuoka"], models: { "Buddy": { th: ["บั๊ดดี้"], category: "SUV" }, "Viewt": { th: ["วิวท์"], category: "Sedan" } } },
  "Aston Martin": { th: ["แอสตันมาร์ติน", "aston martin"], models: { "DB11": { th: ["ดีบี11"], category: "Coupe" }, "DBX": { th: ["ดีบีเอ็กซ์"], category: "SUV" }, "Vantage": { th: ["แวนเทจ"], category: "Coupe" } } },
  "McLaren": { th: ["แมคลาเรน", "mclaren"], models: { "720S": { th: ["720s"], category: "Coupe" }, "Artura": { th: ["อาร์ทูร่า"], category: "Coupe" }, "GT": { th: ["จีที"], category: "Coupe" } } },

  "Aprilia": { th: ["อาพริเลีย", "aprilia"], moto: true, models: { "RS 660": { th: ["อาร์เอส660"], category: "Motorcycle" }, "SR GT": { th: ["เอสอาร์จีที"], category: "Motorcycle" } } },
  "Husqvarna": { th: ["ฮุสควาน่า", "husqvarna"], moto: true, models: { "Svartpilen": { th: ["สวาร์ทพิลเลน"], category: "Motorcycle" }, "Vitpilen": { th: ["วิทพิลเลน"], category: "Motorcycle" } } },
  "Indian": { th: ["อินเดียน", "indian"], moto: true, models: { "Scout": { th: ["สเกาท์"], category: "Motorcycle" }, "Chief": { th: ["ชีฟ"], category: "Motorcycle" } } },
  "Keeway": { th: ["คีย์เวย์", "keeway"], moto: true, models: { "K-Light": { th: ["เคไลท์"], category: "Motorcycle" }, "V302C": { th: ["วี302"], category: "Motorcycle" } } },
  "Moto Guzzi": { th: ["โมโต กุซซี่", "moto guzzi"], moto: true, models: { "V7": { th: ["วี7"], category: "Motorcycle" }, "V85 TT": { th: ["วี85"], category: "Motorcycle" } } },
  "Stallions": { th: ["สตอลเลี่ยน", "stallions"], moto: true, models: { "Centaur": { th: ["เซนทอร์"], category: "Motorcycle" }, "Rapid": { th: ["ราปิด"], category: "Motorcycle" } } }
};

// ═══════════════════════════════════════════════════════════════════════════
// ตัวช่วยค้นหา — ใช้ในหน้าฟอร์มลงทะเบียน
// ═══════════════════════════════════════════════════════════════════════════

// ทำข้อความให้เทียบกันได้
//   - ตัดช่องว่าง ขีด จุด ทับ
//   - ตัวพิมพ์เล็กทั้งหมด
//   - ตัดวรรณยุกต์ไทยทิ้ง (่ ้ ๊ ๋ ์ ็)  ->  "รีโว้" กับ "รีโว่" กลายเป็นคำเดียวกัน
//     จุดนี้สำคัญมาก เพราะจากข้อมูลจริงลูกค้าใส่วรรณยุกต์ไม่ตรงกันเป็นประจำ
//     (โตโยต้า/โตโยตา, อีซูซุ/อีซุซุ, รีโว่/รีโว้) แก้ที่นี่ทีเดียวครอบคลุมทุกแบบ
function normalizeKey(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[่-์็]/g, '')   // วรรณยุกต์ + ไม้ไต่คู้ + ทัณฑฆาต
    .replace(/ๆ/g, '')                  // ไม้ยมก (ๆ) เช่น "อีซุๆ"
    .replace(/[\s\-._/]/g, '');
}

// เทียบว่า "ตรงกันไหม" แบบสองทาง
//   - คีย์มีคำที่พิมพ์อยู่ข้างใน  -> พิมพ์ทีละน้อยแล้วกรอง (กรณีปกติ)
//   - คำที่พิมพ์มีคีย์อยู่ข้างใน  -> วางข้อความยาว ๆ มาทั้งก้อนก็ยังเจอ
//     (เช่น "โตโยต้า ฟอร์จูนเนอร์" ควรเจอ Toyota)
//     จำกัดเฉพาะคีย์ยาว 3 ตัวขึ้นไป กัน "mg" ไปโผล่ในทุกคำ
function keyMatches(key, q) {
  const k = normalizeKey(key);
  if (!k) return false;

  // ทางปกติ: คีย์มีคำที่พิมพ์อยู่ข้างใน -> พิมพ์ทีละน้อยแล้วกรอง
  if (k.indexOf(q) >= 0) return true;

  // ทางย้อนกลับ: คำที่พิมพ์มีคีย์อยู่ข้างใน -> วางข้อความยาวมาทั้งก้อนก็ยังเจอ
  //   เงื่อนไขเข้มกว่าเพราะเสี่ยงจับผิด:
  //   - คีย์ต้องยาว 4 ตัวขึ้นไป
  //   - ห้ามเป็นตัวเลขล้วน  ("300" ของ Hino ไปโผล่ใน "X-max300" ของ Yamaha)
  if (k.length >= 4 && !/^\d+$/.test(k) && q.indexOf(k) >= 0) return true;

  return false;
}

// รวบคำค้นทั้งหมดของรุ่นหนึ่ง: ชื่อรุ่น + ชื่อไทย + ชื่อโฉม + รหัสโฉม
// คนไทยเรียกรถด้วยชื่อโฉมเป็นหลัก ("รีโว่" "วีโก้" "ไทเกอร์" "ตาหวาน")
// ไม่ใช่ชื่อรุ่นทางการ ("Hilux") จึงต้องค้นชื่อโฉมด้วย
function modelSearchKeys(model) {
  let keys = [].concat(model.th || []);
  (model.gens || []).forEach(g => {
    if (g.label) keys.push(g.label);
    if (g.code) keys.push(g.code);
  });
  return keys;
}

// ค้นยี่ห้อจากคำที่พิมพ์ — รองรับทั้งอังกฤษและไทย
// พิมพ์ "อีซู" / "isu" / "ดีแม็ก" ก็เจอ Isuzu
function searchBrands(q) {
  const k = normalizeKey(q);
  if (!k) return Object.keys(carData);
  const hit = [];
  for (const brand in carData) {
    const keys = [brand].concat(carData[brand].th || []);
    if (keys.some(x => keyMatches(x, k))) { hit.push(brand); continue; }
    // ถ้าพิมพ์ชื่อรุ่นมา ให้เจอยี่ห้อด้วย เช่นพิมพ์ "วีโก้" -> Toyota
    const models = carData[brand].models || {};
    for (const m in models) {
      const mk = [m].concat(modelSearchKeys(models[m]));
      if (mk.some(x => keyMatches(x, k))) { hit.push(brand); break; }
    }
  }
  return hit;
}

// ค้นรุ่นภายในยี่ห้อที่เลือก
function searchModels(brand, q) {
  const b = carData[brand];
  if (!b) return [];
  const all = Object.keys(b.models || {});
  const k = normalizeKey(q);
  if (!k) return all;
  return all.filter(m => {
    const keys = [m].concat(modelSearchKeys(b.models[m]));
    return keys.some(x => keyMatches(x, k));
  });
}

// คืนรายการโฉมของรุ่นนั้น
function getGenerations(brand, model) {
  const m = carData[brand] && carData[brand].models[model];
  return (m && m.gens) ? m.gens : [];
}

// คืนช่วงปีที่เลือกได้ของโฉมนั้น (ถ้าไม่มีโฉม ให้ช่วงกว้าง)
function getYearsForGen(gen) {
  const now = new Date().getFullYear();
  const from = (gen && gen.from) ? gen.from : 1990;
  const to = (gen && gen.to) ? gen.to : now;
  const out = [];
  for (let y = to; y >= from; y--) out.push(y);
  return out;
}

function getCategory(brand, model) {
  const m = carData[brand] && carData[brand].models[model];
  return (m && m.category) ? m.category : "Unknown";
}

function isEV(brand, model) {
  const m = carData[brand] && carData[brand].models[model];
  return !!(m && m.ev);
}

// ═══════════════════════════════════════════════════════════════════════════
// เข้ากันได้ย้อนหลัง — สร้าง model.years[] ให้อัตโนมัติ
// ═══════════════════════════════════════════════════════════════════════════
// ฟอร์มสมัครรุ่นปัจจุบัน (register/script.js) อ่าน carData[b].models[m].years
// โครงสร้างใหม่ไม่มีช่องนั้นแล้ว ถ้าปล่อยไว้ ฟอร์มเดิมจะพังทันทีที่ deploy
//
// บล็อกนี้เติม years[] กลับให้ทุกรุ่น โดยคำนวณจาก gens ที่มีอยู่
// -> ไฟล์นี้จึงใช้ได้กับทั้งฟอร์มเดิมและฟอร์มใหม่ ปลอดภัยที่จะ push ก่อนแก้ฟอร์ม
//
// เมื่อเขียนฟอร์มใหม่เสร็จแล้ว จะลบบล็อกนี้ทิ้งได้
(function buildLegacyYears() {
  const nowYear = new Date().getFullYear();
  for (const b in carData) {
    const models = carData[b].models || {};
    for (const m in models) {
      const mo = models[m];
      if (mo.years) continue;

      let from, to;
      if (mo.gens && mo.gens.length) {
        from = Math.min.apply(null, mo.gens.map(g => g.from || nowYear));
        to = Math.max.apply(null, mo.gens.map(g => g.to || nowYear));
      } else {
        // รุ่นที่ยังไม่ได้ใส่โฉม ใช้ช่วงกว้าง ๆ ไปก่อน
        // รถไฟฟ้าเพิ่งเข้าไทยไม่กี่ปี ไม่ต้องย้อนไปถึงปี 2000
        from = mo.ev ? 2018 : 2000;
        to = nowYear;
      }

      const ys = [];
      for (let y = from; y <= to; y++) ys.push(y);
      mo.years = ys;
      if (!mo.variants) mo.variants = [];
    }
  }
})();
