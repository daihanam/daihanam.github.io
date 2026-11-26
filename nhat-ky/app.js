(function(){
  "use strict";
  const $ = id => document.getElementById(id);
  const LEGACY = "nk-entries-v1", SET = "nk-settings-v1", LAST = "nk-last-user";
  const FIELDS = ["viec1","viec2","viec3","hoc1","hoc2","hoc3","on1","ctx1","on2","ctx2","on3","ctx3","tuhao","visao","ytuong","buoc"];
  const WD = ["Chủ nhật","Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy"];
  const pad = n => String(n).padStart(2,"0");
  const ymd = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const todayStr = () => ymd(new Date());
  const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
  const addDays = (s,n) => { const d = parse(s); d.setDate(d.getDate()+n); return ymd(d); };
  const fmt = s => { const [y,m,d] = s.split("-"); return d+"/"+m+"/"+y; };
  const fmtTime = iso => { const d = new Date(iso); return pad(d.getHours())+":"+pad(d.getMinutes())+" "+pad(d.getDate())+"/"+pad(d.getMonth()+1); };
  const t = s => (typeof s === "string" ? s : "").trim();
  const appUrl = () => location.origin + location.pathname;

  // ---------- Lưu trữ cục bộ ----------
  function load(k, fb){ try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : fb; } catch(e){ return fb; } }
  function store(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ toast("Không lưu được trên máy này. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn."); return false; } }
  function drop(k){ try { localStorage.removeItem(k); } catch(e){} }
  let settings = Object.assign({remTime:"21:00", notif:false}, load(SET, {}));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});

  function toast(msg){ const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3600); }
  function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const arr = x => Array.isArray(x) ? x : [];

  // Dữ liệu của người đang đăng nhập: entries[ngày] = {viec, baiHoc, bietOn, tuHao, yTuong, capNhat} hoặc {deleted:true, capNhat}
  let user = null, entries = {}, dirty = new Set(), lastSync = null;
  const userKey = () => "nk-u-" + user.id;
  function persist(){ if (user) store(userKey(), {entries, dirty:[...dirty], lastSync}); }

  function hasContent(d){
    if (!d || d.deleted) return false;
    const vals = [].concat(arr(d.viec), arr(d.baiHoc), arr(d.bietOn).flatMap(b => [b&&b.dieu, b&&b.boiCanh]),
      [(d.tuHao||{}).dieu,(d.tuHao||{}).viSao,(d.yTuong||{}).yTuong,(d.yTuong||{}).buocDau]);
    return vals.some(x => t(x));
  }
  const live = d => hasContent(entries[d]);
  const liveDays = () => Object.keys(entries).filter(live);

  function toDoc(){
    const v = id => t($(id).value);
    return {
      viec:[v("viec1"),v("viec2"),v("viec3")],
      baiHoc:[v("hoc1"),v("hoc2"),v("hoc3")],
      bietOn:[1,2,3].map(i => ({dieu:v("on"+i), boiCanh:v("ctx"+i)})),
      tuHao:{dieu:v("tuhao"), viSao:v("visao")},
      yTuong:{yTuong:v("ytuong"), buocDau:v("buoc")},
      capNhat:new Date().toISOString()
    };
  }
  function fromDoc(d){
    d = (d && !d.deleted) ? d : {};
    const a = (x,i) => (Array.isArray(x) && typeof x[i] === "string") ? x[i] : "";
    const set = (id,val) => { $(id).value = typeof val === "string" ? val : ""; };
    [0,1,2].forEach(i => {
      set("viec"+(i+1), a(d.viec,i)); set("hoc"+(i+1), a(d.baiHoc,i));
      const b = (Array.isArray(d.bietOn) && d.bietOn[i]) || {}; set("on"+(i+1), b.dieu); set("ctx"+(i+1), b.boiCanh);
    });
    set("tuhao",(d.tuHao||{}).dieu); set("visao",(d.tuHao||{}).viSao);
    set("ytuong",(d.yTuong||{}).yTuong); set("buoc",(d.yTuong||{}).buocDau);
    requestAnimationFrame(() => FIELDS.forEach(id => grow($(id))));
  }
  function grow(el){ el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight+2, 420)+"px"; }

  // ---------- Supabase ----------
  const initHash = location.hash;
  let recovering = /type=recovery/.test(initHash);
  const cfg = window.NK_CONFIG || {};
  const sb = (window.supabase && cfg.supabaseUrl && cfg.supabaseKey)
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}})
    : null;

  // ---------- Đồng bộ ----------
  let syncing = false, syncAgain = false, syncTimer = null, syncErr = "";
  function setSyncLine(){
    const s = $("syncLine"); if (!user) { s.textContent = ""; return; }
    if (syncing) s.textContent = "Đang đồng bộ…";
    else if (!navigator.onLine) s.textContent = "Đang ngoại tuyến · " + (dirty.size ? dirty.size + " ngày chờ gửi lên" : "đã lưu trên máy");
    else if (syncErr) s.textContent = "Chưa đồng bộ được, app sẽ thử lại";
    else if (dirty.size) s.textContent = dirty.size + " ngày chờ đồng bộ";
    else if (lastSync) s.textContent = "Đã đồng bộ lúc " + fmtTime(lastSync);
    else s.textContent = "";
    if (!$("view-caidat").hidden) renderSettings();
  }
  function scheduleSync(ms){ clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms == null ? 1500 : ms); }
  const noiDung = e => ({viec:e.viec, baiHoc:e.baiHoc, bietOn:e.bietOn, tuHao:e.tuHao, yTuong:e.yTuong});

  async function sync(){
    if (!sb || !user || !online) return;
    if (syncing) { syncAgain = true; return; }
    if (!navigator.onLine) { setSyncLine(); return; }
    syncing = true; syncErr = ""; setSyncLine();
    try {
      const {data, error} = await sb.from("entries").select("ngay,noi_dung,da_xoa,cap_nhat");
      if (error) throw error;
      const server = {}; let curChanged = false;
      data.forEach(r => { server[r.ngay] = r; });
      // Lấy về: bản trên máy chủ mới hơn thì thay bản trên máy
      data.forEach(r => {
        const loc = entries[r.ngay];
        if (!loc || new Date(r.cap_nhat) > new Date(loc.capNhat || 0)) {
          entries[r.ngay] = r.da_xoa ? {deleted:true, capNhat:r.cap_nhat} : Object.assign({}, r.noi_dung, {capNhat:r.cap_nhat});
          dirty.delete(r.ngay);
          if (r.ngay === cur) curChanged = true;
        }
      });
      // Gửi lên: ngày có thay đổi trên máy, hoặc máy chủ chưa có
      Object.keys(entries).forEach(d => { if (!server[d] && live(d)) dirty.add(d); });
      const rows = [...dirty].filter(d => entries[d] && (!server[d] || new Date(entries[d].capNhat) > new Date(server[d].cap_nhat)))
        .map(d => ({user_id:user.id, ngay:d, noi_dung: entries[d].deleted ? {} : noiDung(entries[d]), da_xoa: !hasContent(entries[d]), cap_nhat: entries[d].capNhat}));
      const sent = new Map(rows.map(r => [r.ngay, r.cap_nhat]));
      [...dirty].forEach(d => { if (!sent.has(d)) dirty.delete(d); });
      for (let i = 0; i < rows.length; i += 200) {
        const {error: e2} = await sb.from("entries").upsert(rows.slice(i, i+200), {onConflict:"user_id,ngay"});
        if (e2) throw e2;
      }
      // Chỉ bỏ cờ những ngày không bị sửa thêm trong lúc gửi
      sent.forEach((cn, d) => { if (entries[d] && entries[d].capNhat === cn) dirty.delete(d); });
      lastSync = new Date().toISOString();
      persist();
      if (migrating) { drop(LEGACY); if (migrating > 0) toast("Đã đưa " + migrating + " ngày nhật ký cũ trên máy lên tài khoản."); migrating = 0; }
      if (curChanged && !saveTimer && !dirty.has(cur)) { fromDoc(entries[cur]); setState(); }
      if (!$("view-tonghop").hidden) renderSummary();
    } catch(err) {
      syncErr = (err && (err.message || err.code)) || "lỗi";
      if (err && (err.code === "PGRST301" || /JWT|jwt|401/.test(String(err.message)))) { await checkSession(); }
      scheduleSync(30000);
    } finally {
      syncing = false; setSyncLine();
      if (syncAgain) { syncAgain = false; scheduleSync(300); }
    }
  }
  window.addEventListener("online", async () => {
    setSyncLine();
    if (user && !online && sb) {
      try { const {data} = await sb.auth.getSession(); if (data.session) { online = true; scheduleSync(200); } else { await checkSession(); } } catch(e){}
      return;
    }
    scheduleSync(200);
  });
  window.addEventListener("offline", setSyncLine);
  setInterval(() => { if (!document.hidden) sync(); }, 60000);

  // ---------- Viết ----------
  let cur = todayStr(), saveTimer = null;
  function saveNow(){
    clearTimeout(saveTimer); saveTimer = null;
    if (!user) return;
    const doc = toDoc();
    if (hasContent(doc)) entries[cur] = doc;
    else if (entries[cur] && !entries[cur].deleted) entries[cur] = {deleted:true, capNhat:doc.capNhat};
    else { setState(); return; }
    dirty.add(cur); persist(); setState(); setSyncLine(); scheduleSync();
  }
  FIELDS.forEach(id => $(id).addEventListener("input", e => {
    grow(e.target); $("state").textContent = "Đang lưu…"; $("state").className = "pill";
    clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400);
  }));
  window.addEventListener("pagehide", () => { if (saveTimer) saveNow(); });

  function setState(){
    const s = $("state");
    if (live(cur)) { s.textContent = "Đã lưu"; s.className = "pill saved"; }
    else { s.textContent = "Chưa ghi"; s.className = "pill"; }
  }
  function openDate(d){
    if (saveTimer) saveNow();
    cur = d; $("date").value = d; $("date").max = todayStr();
    $("weekday").textContent = WD[parse(d).getDay()] + (d === todayStr() ? " · hôm nay" : "");
    $("next").disabled = d >= todayStr();
    fromDoc(entries[d]); setState();
  }
  $("date").addEventListener("change", () => { const v = $("date").value; if (v && v <= todayStr()) openDate(v); else $("date").value = cur; });
  $("prev").onclick = () => openDate(addDays(cur,-1));
  $("next").onclick = () => { if (cur < todayStr()) openDate(addDays(cur,1)); };

  // ---------- Tab ----------
  const TABS = ["viet","tonghop","caidat"];
  function showTab(name){
    if (saveTimer) saveNow();
    TABS.forEach(n => { $("tab-"+n).setAttribute("aria-selected", n === name); $("view-"+n).hidden = n !== name; });
    if (name === "tonghop") renderSummary();
    if (name === "caidat") renderSettings();
    try { history.replaceState(null, "", name === "viet" ? location.pathname : "#"+name); } catch(e){}
  }
  TABS.forEach(n => $("tab-"+n).onclick = () => showTab(n));

  // ---------- Tổng hợp ----------
  let range = "month", calMonth = todayStr().slice(0,7);
  $("ranges").addEventListener("click", e => {
    const b = e.target.closest("button[data-r]"); if (!b) return;
    range = b.dataset.r;
    [...$("ranges").children].forEach(x => x.setAttribute("aria-pressed", x === b));
    renderSummary();
  });
  function bounds(){
    const td = todayStr();
    if (range === "7") return [addDays(td,-6), td];
    if (range === "week") { const wd = (parse(td).getDay()+6)%7; return [addDays(td,-wd), td]; }
    if (range === "month") return [td.slice(0,8)+"01", td];
    const ks = liveDays().sort(); return [ks[0] || td, td];
  }
  function streak(){ let d = todayStr(); if (!live(d)) d = addDays(d,-1); let n = 0; while (live(d)) { n++; d = addDays(d,-1); } return n; }
  const GROUPS = [
    ["Bài học", e => arr(e.baiHoc).map(text => ({text}))],
    ["Điều biết ơn", e => arr(e.bietOn).map(b => ({text:(b||{}).dieu, ctx:(b||{}).boiCanh}))],
    ["Điều tự hào", e => [{text:(e.tuHao||{}).dieu, ctx:(e.tuHao||{}).viSao}]],
    ["Ý tưởng", e => [{text:(e.yTuong||{}).yTuong, ctx: t((e.yTuong||{}).buocDau) ? "Bước đầu: " + e.yTuong.buocDau : ""}]],
    ["Việc quan trọng", e => arr(e.viec).map(text => ({text}))]
  ];
  function rangeDays(){ const [from,to] = bounds(); return liveDays().filter(d => d >= from && d <= to).sort().reverse(); }

  function renderCal(){
    const cal = $("cal"); cal.replaceChildren();
    const td = todayStr();
    const [y,m] = calMonth.split("-").map(Number);
    $("calTitle").textContent = "Tháng " + m + "/" + y;
    $("calNext").disabled = calMonth >= td.slice(0,7);
    ["T2","T3","T4","T5","T6","T7","CN"].forEach(h => cal.appendChild(el("div","h",h)));
    const first = calMonth + "-01";
    const lead = (parse(first).getDay()+6)%7;
    for (let i=0;i<lead;i++) cal.appendChild(el("div"));
    const last = ymd(new Date(y, m, 0));
    for (let d = first; d <= last; d = addDays(d,1)) {
      const b = el("button", (live(d) ? "on" : "") + (d === td ? " today" : ""), String(+d.slice(8)));
      b.type = "button"; b.setAttribute("aria-label", fmt(d) + (live(d) ? ", đã ghi" : ", chưa ghi"));
      if (d > td) b.disabled = true;
      b.onclick = () => { showTab("viet"); openDate(d); window.scrollTo({top:0}); };
      cal.appendChild(b);
    }
  }
  $("calPrev").onclick = () => { const [y,m] = calMonth.split("-").map(Number); calMonth = ymd(new Date(y,m-2,1)).slice(0,7); renderCal(); };
  $("calNext").onclick = () => { const [y,m] = calMonth.split("-").map(Number); calMonth = ymd(new Date(y,m,1)).slice(0,7); renderCal(); };

  function renderSummary(){
    const [from, to] = bounds();
    const days = rangeDays();
    let span = 0; for (let d = from; d <= to; d = addDays(d,1)) span++;
    $("s-days").textContent = days.length;
    $("s-days-l").textContent = "ngày đã ghi, trên " + span + " ngày";
    $("s-streak").textContent = streak();
    $("s-ideas").textContent = days.filter(d => t((entries[d].yTuong||{}).yTuong)).length;
    renderCal();
    const g = $("groups"); g.replaceChildren();
    if (!days.length) { g.appendChild(el("p","empty","Chưa có ngày nào được ghi trong khoảng này. Mở tab Viết để bắt đầu.")); return; }
    GROUPS.forEach(([title, pick]) => {
      const items = []; days.forEach(d => pick(entries[d]).forEach(it => { if (t(it.text)) items.push(Object.assign({d}, it)); }));
      const box = el("div","group"); box.appendChild(el("h3",null,title + " (" + items.length + ")"));
      const ul = el("ul");
      if (!items.length) ul.appendChild(el("li","empty","Chưa có."));
      items.forEach(it => { const li = el("li"); li.appendChild(el("span","d",fmt(it.d))); li.appendChild(document.createTextNode(it.text)); if (t(it.ctx)) li.appendChild(el("span","ctx",it.ctx)); ul.appendChild(li); });
      box.appendChild(ul); g.appendChild(box);
    });
  }
  $("copyRange").onclick = async () => {
    const days = rangeDays(); if (!days.length) { toast("Khoảng này chưa có gì để chép."); return; }
    const label = {"7":"7 ngày qua","week":"Tuần này","month":"Tháng này","all":"Tất cả"}[range];
    let s = "TỔNG HỢP NHẬT KÝ · " + label + " (" + days.length + " ngày)\n";
    GROUPS.forEach(([title, pick]) => {
      const items = []; days.forEach(d => pick(entries[d]).forEach(it => { if (t(it.text)) items.push("- " + fmt(d) + ": " + t(it.text) + (t(it.ctx) ? " (" + t(it.ctx) + ")" : "")); }));
      if (items.length) s += "\n" + title.toUpperCase() + "\n" + items.join("\n") + "\n";
    });
    try { await navigator.clipboard.writeText(s); toast("Đã chép tổng hợp. Dán vào ghi chú hoặc tin nhắn là được."); }
    catch(e){ download("tong-hop.txt", s, "text/plain"); }
  };

  // ---------- Sao lưu ----------
  function download(name, text, type){
    const blob = new Blob([text], {type: type + ";charset=utf-8"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function toMarkdown(d, e){
    const L = [];
    L.push("# Nhật ký ngày " + fmt(d), "", "## 1. Ba việc quan trọng nhất hôm nay");
    [0,1,2].forEach(i => L.push((i+1) + ". " + t(arr(e.viec)[i])));
    L.push("", "## 2. Ba bài học của tôi"); [0,1,2].forEach(i => L.push((i+1) + ". " + t(arr(e.baiHoc)[i])));
    L.push("", "## 3. Ba điều tôi biết ơn");
    [0,1,2].forEach(i => { const b = arr(e.bietOn)[i] || {}; L.push((i+1) + ". Điều biết ơn: " + t(b.dieu), "   Bối cảnh: " + t(b.boiCanh)); });
    L.push("", "## 4. Điều tôi thấy tự hào nhất hôm nay", "- Điều tự hào: " + t((e.tuHao||{}).dieu), "- Vì sao tôi tự hào: " + t((e.tuHao||{}).viSao));
    L.push("", "## 5. Ý tưởng có thể triển khai", "- Ý tưởng: " + t((e.yTuong||{}).yTuong), "- Bước nhỏ đầu tiên để bắt đầu: " + t((e.yTuong||{}).buocDau), "");
    return L.join("\n");
  }
  function liveEntries(){ const o = {}; liveDays().sort().forEach(d => o[d] = entries[d]); return o; }
  $("exportJson").onclick = () => {
    if (saveTimer) saveNow();
    const o = liveEntries();
    if (!Object.keys(o).length) { toast("Chưa có trang nhật ký nào để sao lưu."); return; }
    download("nhat-ky-toi-" + todayStr() + ".json", JSON.stringify({app:"so-nhat-ky-toi", phienBan:1, xuatLuc:new Date().toISOString(), entries:o}, null, 2), "application/json");
  };
  $("exportMd").onclick = () => {
    if (saveTimer) saveNow();
    const ks = liveDays().sort().reverse();
    if (!ks.length) { toast("Chưa có trang nhật ký nào để xuất."); return; }
    download("nhat-ky-toi-" + todayStr() + ".md", ks.map(d => toMarkdown(d, entries[d])).join("\n---\n\n"), "text/markdown");
  };
  // Gộp một bộ nhật ký vào tài khoản: ngày chưa có thì thêm, ngày đã có thì giữ bản sửa sau cùng
  function mergeIn(inc){
    let added = 0, updated = 0;
    Object.keys(inc || {}).forEach(d => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !hasContent(inc[d])) return;
      const mine = entries[d], doc = Object.assign({}, inc[d], {capNhat: inc[d].capNhat || new Date().toISOString()});
      if (!live(d)) { if (mine && mine.capNhat > doc.capNhat) doc.capNhat = new Date().toISOString(); entries[d] = doc; dirty.add(d); added++; }
      else if (doc.capNhat > (mine.capNhat || "")) { entries[d] = doc; dirty.add(d); updated++; }
    });
    return [added, updated];
  }
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const inc = data && typeof data.entries === "object" ? data.entries : data;
      if (!inc || typeof inc !== "object") throw 0;
      const [added, updated] = mergeIn(inc);
      persist(); openDate(cur); renderSettings(); scheduleSync(200);
      toast("Đã nhập: " + added + " ngày mới, " + updated + " ngày cập nhật.");
    } catch(err) { toast("Tệp này không phải bản sao lưu của Sổ nhật ký tối."); }
  };
  $("wipe").onclick = () => {
    const n = liveDays().length;
    if (!n) { toast("Không có gì để xóa."); return; }
    if (!confirm("Xóa toàn bộ " + n + " ngày nhật ký trong tài khoản, trên mọi thiết bị? Không thể hoàn tác.")) return;
    const now = new Date().toISOString();
    liveDays().forEach(d => { entries[d] = {deleted:true, capNhat:now}; dirty.add(d); });
    persist(); openDate(todayStr()); renderSettings(); scheduleSync(100); toast("Đã xóa toàn bộ.");
  };

  // ---------- Nhắc giờ ----------
  $("remTime").value = settings.remTime;
  $("remTime").onchange = () => { settings.remTime = $("remTime").value || "21:00"; store(SET, settings); scheduleNotif(); };
  $("addCal").onclick = () => {
    const [h,m] = (settings.remTime || "21:00").split(":");
    const start = todayStr().replace(/-/g,"") + "T" + h + m + "00";
    const stamp = new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
    const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//So nhat ky toi//VI","CALSCALE:GREGORIAN","BEGIN:VEVENT",
      "UID:nhat-ky-toi-" + Date.now() + "@nhat-ky","DTSTAMP:" + stamp,
      "DTSTART:" + start, "DURATION:PT10M", "RRULE:FREQ=DAILY",
      "SUMMARY:🌙 Viết nhật ký tối","DESCRIPTION:5 phút cho 5 câu hỏi. Mở app: " + appUrl(), "URL:" + appUrl(),
      "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Viết nhật ký tối","TRIGGER:PT0M","END:VALARM",
      "END:VEVENT","END:VCALENDAR"].join("\r\n");
    download("nhac-nhat-ky-toi.ics", ics, "text/calendar");
    toast("Mở tệp vừa tải rồi bấm Thêm vào lịch.");
  };
  const notifOK = "Notification" in window && "serviceWorker" in navigator;
  $("notifBtn").onclick = async () => {
    if (!notifOK) { toast("Máy này chưa hỗ trợ thông báo từ app. Hãy dùng nhắc qua lịch."); return; }
    const p = await Notification.requestPermission();
    settings.notif = p === "granted"; store(SET, settings); renderSettings(); scheduleNotif();
    if (settings.notif) toast("Đã bật. App sẽ nhắc nếu nó đang mở lúc đến giờ.");
  };
  let notifTimer = null;
  function scheduleNotif(){
    clearTimeout(notifTimer);
    if (!settings.notif || !notifOK || Notification.permission !== "granted") return;
    const [h,m] = (settings.remTime || "21:00").split(":").map(Number);
    const now = new Date(), at = new Date(); at.setHours(h, m, 0, 0);
    if (at <= now) at.setDate(at.getDate()+1);
    notifTimer = setTimeout(async () => {
      if (user && !live(todayStr())) {
        try { const reg = await navigator.serviceWorker.ready; reg.showNotification("Sổ nhật ký tối", {body:"Đến giờ viết nhật ký rồi. 5 phút thôi.", icon:"icon-192.png", badge:"icon-192.png", tag:"nhac-toi"}); } catch(e){}
      }
      scheduleNotif();
    }, Math.min(at - now, 2147483000));
  }
  function renderSettings(){
    if (!user) return;
    const n = liveDays().length;
    $("acctInfo").textContent = "Đang đăng nhập: " + (user.email || "") + ". " + n + " ngày nhật ký. "
      + (dirty.size ? dirty.size + " ngày chưa gửi lên." : lastSync ? "Đồng bộ lần cuối lúc " + fmtTime(lastSync) + "." : "");
    $("dataInfo").textContent = "Nhật ký đã lưu trong tài khoản. Bạn vẫn có thể tải một bản về máy để cất riêng hoặc chép sang chỗ khác.";
    const perm = notifOK ? Notification.permission : "unsupported";
    $("notifInfo").textContent = perm === "unsupported" ? "Thông báo trong app chưa hỗ trợ trên máy này. Nhắc qua lịch luôn hoạt động."
      : (settings.notif && perm === "granted") ? "Thông báo trong app: đang bật. Chỉ báo được khi app còn mở hoặc chạy nền, nên vẫn nên thêm nhắc vào lịch."
      : perm === "denied" ? "Bạn đã chặn thông báo cho trang này. Nhắc qua lịch vẫn dùng được."
      : "Thông báo trong app chỉ báo khi app còn mở. Nhắc qua lịch đáng tin hơn.";
    $("notifBtn").hidden = !notifOK || (settings.notif && perm === "granted");
  }
  $("syncNow").onclick = () => { if (saveTimer) saveNow(); if (!navigator.onLine) { toast("Đang không có mạng."); return; } sync().then(() => toast(syncErr ? "Chưa đồng bộ được: " + syncErr : "Đã đồng bộ.")); };

  // ---------- Đăng nhập ----------
  let authMode = "login", online = false, migrating = 0;
  function authMsg(text, err){ const m = $("authMsg"); m.textContent = text; m.className = "msg" + (err ? " err" : ""); m.hidden = !text; }
  function setAuthMode(mode){
    authMode = mode; authMsg("");
    const T = {login:["Đăng nhập","Đăng nhập để nhật ký được lưu vào tài khoản và đồng bộ giữa điện thoại và máy tính.","Đăng nhập"],
      signup:["Tạo tài khoản","Đăng ký bằng email. Sau khi đăng ký, bạn mở email và bấm link xác nhận.","Đăng ký"],
      forgot:["Quên mật khẩu","Nhập email đã đăng ký, app sẽ gửi link đặt lại mật khẩu.","Gửi link đặt lại"],
      reset:["Đặt mật khẩu mới","Nhập mật khẩu mới cho tài khoản của bạn.","Lưu mật khẩu mới"]}[mode];
    $("authTitle").textContent = T[0]; $("authLead").textContent = T[1]; $("authBtn").textContent = T[2];
    $("emailField").hidden = mode === "reset";
    $("pwField").hidden = mode === "forgot";
    $("pw2Field").hidden = !(mode === "signup" || mode === "reset");
    $("pw").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("toSignup").textContent = mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập";
    $("toSignup").hidden = mode === "reset";
    $("toForgot").hidden = mode !== "login";
    $("resendBtn").hidden = true;
  }
  $("toSignup").onclick = () => setAuthMode(authMode === "login" ? "signup" : "login");
  $("toForgot").onclick = () => setAuthMode("forgot");
  function viErr(e){
    const m = String((e && e.message) || e || "");
    const code = e && (e.code || e.status);
    if (/Invalid login credentials/i.test(m)) return "Email hoặc mật khẩu chưa đúng.";
    if (/Email not confirmed/i.test(m)) { $("resendBtn").hidden = false; return "Email này chưa được xác nhận. Mở email (xem cả mục Spam) và bấm link xác nhận."; }
    if (/already registered|already been registered|User already/i.test(m)) return "Email này đã có tài khoản. Hãy đăng nhập.";
    if (/rate limit|too many|429/i.test(m) || code === 429) return "Gửi quá nhiều yêu cầu. Đợi vài phút rồi thử lại.";
    if (/Password should be|weak/i.test(m)) return "Mật khẩu quá yếu. Dùng ít nhất 6 ký tự, nên có cả chữ và số.";
    if (/valid email|invalid.*email|email.*invalid/i.test(m)) return "Email không hợp lệ.";
    if (/same as|different from the old/i.test(m)) return "Mật khẩu mới phải khác mật khẩu cũ.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Không có mạng. Kiểm tra kết nối rồi thử lại.";
    return "Có lỗi: " + m;
  }
  $("authForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!sb) { authMsg("App chưa được cấu hình máy chủ.", true); return; }
    const email = t($("email").value).toLowerCase(), pw = $("pw").value, pw2 = $("pw2").value;
    if (authMode !== "reset" && !/^\S+@\S+\.\S+$/.test(email)) { authMsg("Nhập email hợp lệ.", true); return; }
    if ((authMode === "login" || authMode === "signup" || authMode === "reset") && pw.length < 6) { authMsg("Mật khẩu cần ít nhất 6 ký tự.", true); return; }
    if ((authMode === "signup" || authMode === "reset") && pw !== pw2) { authMsg("Hai lần nhập mật khẩu chưa khớp.", true); return; }
    $("authBtn").disabled = true; authMsg("Đang xử lý…");
    try {
      if (authMode === "login") {
        const {error} = await sb.auth.signInWithPassword({email, password: pw});
        if (error) throw error;
        authMsg("");
      } else if (authMode === "signup") {
        const {data, error} = await sb.auth.signUp({email, password: pw, options:{emailRedirectTo: appUrl()}});
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { authMsg("Email này đã có tài khoản. Hãy đăng nhập.", true); return; }
        if (!data.session) {
          setAuthMode("login"); $("email").value = email; $("pw").value = "";
          authMsg("Đã gửi email xác nhận tới " + email + ". Mở email (xem cả mục Spam), bấm link xác nhận, rồi quay lại đây đăng nhập.");
          $("resendBtn").hidden = false;
        }
      } else if (authMode === "forgot") {
        const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: appUrl()});
        if (error) throw error;
        authMsg("Nếu email này có tài khoản, link đặt lại mật khẩu đã được gửi. Mở link đó trên máy này.");
      } else if (authMode === "reset") {
        const {error} = await sb.auth.updateUser({password: pw});
        if (error) throw error;
        $("pw").value = $("pw2").value = "";
        toast("Đã đổi mật khẩu."); recovering = false; hideAuth();
        const {data} = await sb.auth.getSession();
        await enter(data.session && data.session.user);
      }
    } catch(err) { authMsg(viErr(err), true); }
    finally { $("authBtn").disabled = false; }
  });
  $("resendBtn").onclick = async () => {
    const email = t($("email").value).toLowerCase(); if (!email) { authMsg("Nhập email trước.", true); return; }
    const {error} = await sb.auth.resend({type:"signup", email, options:{emailRedirectTo: appUrl()}});
    authMsg(error ? viErr(error) : "Đã gửi lại email xác nhận tới " + email + ".", !!error);
  };
  $("changePw").onclick = () => { showAuth("reset"); };
  $("logout").onclick = async () => {
    if (saveTimer) saveNow();
    if (dirty.size && navigator.onLine) await sync();
    if (dirty.size && !confirm("Còn " + dirty.size + " ngày chưa gửi lên tài khoản. Đăng xuất bây giờ sẽ mất các thay đổi đó. Vẫn đăng xuất?")) return;
    const key = user ? userKey() : null;
    try { await sb.auth.signOut({scope:"local"}); } catch(e){}
    if (key) drop(key);
    drop(LAST); leave(); setAuthMode("login");
  };

  function showAuth(mode){
    document.body.classList.add("need-auth");
    $("view-auth").hidden = false;
    setAuthMode(mode || "login");
    if (mode === "reset") { $("toSignup").hidden = false; $("toSignup").textContent = "Để sau"; $("toSignup").onclick = () => { $("toSignup").onclick = () => setAuthMode(authMode === "login" ? "signup" : "login"); recovering = false; if (user) hideAuth(); else setAuthMode("login"); }; }
  }
  function hideAuth(){ document.body.classList.remove("need-auth"); $("view-auth").hidden = true; }
  function leave(){ user = null; online = false; entries = {}; dirty = new Set(); lastSync = null; setSyncLine(); showAuth("login"); }

  async function enter(u, offline){
    if (!u) return;
    if (user && user.id === u.id) { online = !offline; if (!recovering) hideAuth(); scheduleSync(100); return; }
    user = {id:u.id, email:u.email}; online = !offline;
    store(LAST, user);
    const saved = load(userKey(), null) || {};
    entries = saved.entries || {}; dirty = new Set(saved.dirty || []); lastSync = saved.lastSync || null;
    // Nhật ký cũ viết trên máy trước khi có tài khoản: đưa vào tài khoản ở lần đăng nhập đầu
    const legacy = load(LEGACY, null);
    if (legacy && typeof legacy === "object" && Object.keys(legacy).length) {
      const [a, u2] = mergeIn(legacy); migrating = (a + u2) || -1; persist();
    }
    hideAuth();
    openDate(todayStr());
    if (recovering) showAuth("reset");
    const h = location.hash.slice(1); showTab(TABS.includes(h) ? h : "viet");
    setSyncLine(); scheduleNotif();
    if (online) sync();
  }
  async function checkSession(){
    const {data} = await sb.auth.getSession();
    if (!data.session && navigator.onLine) { toast("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."); const keep = user; leave(); if (keep) $("email").value = keep.email || ""; }
  }

  // ---------- Cài app ----------
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferred = e; $("installBtn").hidden = false;
    if (!standalone && !load("nk-hide-tip", false)) showTip("Cài app này lên màn hình chính để mở nhanh mỗi tối.", true);
  });
  $("installBtn").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("installBtn").hidden = true; $("installTip").hidden = true; };
  function showTip(text, withBtn){
    const tip = $("installTip"); tip.replaceChildren(document.createTextNode(text));
    const row = el("div","row");
    if (withBtn) { const b = el("button","btn","Cài app"); b.type = "button"; b.onclick = () => $("installBtn").click(); row.appendChild(b); }
    const x = el("button","btn ghost","Để sau"); x.type = "button"; x.onclick = () => { tip.hidden = true; store("nk-hide-tip", true); }; row.appendChild(x);
    tip.appendChild(row); tip.hidden = false;
  }
  if (!standalone && isIOS && !load("nk-hide-tip", false)) showTip("Để cài thành app: bấm nút Chia sẻ của Safari, chọn “Thêm vào MH chính”.", false);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  // ---------- Bắt đầu ----------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (saveTimer) saveNow(); return; }
    if (!user) return;
    if ($("date").max !== todayStr()) { if (!$("view-viet").hidden && !live(cur)) openDate(todayStr()); else $("date").max = todayStr(); scheduleNotif(); }
    sync();
  });

  (async function start(){
    if (!sb) {
      showAuth("login"); $("authBtn").disabled = true;
      authMsg("App đang được nâng cấp để đăng nhập và đồng bộ. Vui lòng quay lại sau ít phút.", true);
      return;
    }
    sb.auth.onAuthStateChange((ev, session) => {
      setTimeout(() => {
        if (ev === "PASSWORD_RECOVERY") { recovering = true; if (session) enter(session.user).then(() => showAuth("reset")); return; }
        if (ev === "SIGNED_IN" && session) { enter(session.user); if (/type=signup/.test(initHash) && !enter.welcomed) { enter.welcomed = true; toast("Email đã được xác nhận. Chào mừng bạn!"); } }
        if (ev === "SIGNED_OUT" && user) leave();
      }, 0);
    });
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch(e){}
    if (session) { await enter(session.user); return; }
    const last = load(LAST, null);
    if (last && !navigator.onLine) { await enter(last, true); toast("Đang ngoại tuyến. Bạn vẫn viết được, có mạng app sẽ đồng bộ."); return; }
    showAuth("login");
    if (last) $("email").value = last.email || "";
  })();
})();
