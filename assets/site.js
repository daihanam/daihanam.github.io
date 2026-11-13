/* Đếm lượt xem theo kênh, phiếu đăng ký, khóa/mở video. */
(function () {
  var C = window.QSV || {};
  var DICH = C.diaChiNhanDuLieu || "";

  function lay(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function dat(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function layPhien(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function datPhien(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  /* ---------- Người xem đến từ kênh nào ---------- */
  var BANG = { fb: "Facebook", facebook: "Facebook", zalo: "Zalo", zl: "Zalo",
               yt: "YouTube", youtube: "YouTube", tt: "TikTok", tiktok: "TikTok" };
  function gon(s, n) { return String(s || "").replace(/[^0-9A-Za-zÀ-ỹ _\-.]/g, "").slice(0, n); }

  function kenhHienTai() {
    var p; try { p = new URLSearchParams(location.search); } catch (e) { return ""; }
    var k = (p.get("k") || p.get("utm_source") || "").toLowerCase().trim();
    if (BANG[k]) return BANG[k];
    if (k) return gon(k, 30);
    if (p.get("fbclid")) return "Facebook";
    if (p.get("ttclid")) return "TikTok";
    var r = document.referrer || "";
    if (/facebook\.com|fb\.com|messenger\.com/i.test(r)) return "Facebook";
    if (/youtube\.com|youtu\.be/i.test(r)) return "YouTube";
    if (/tiktok\.com/i.test(r)) return "TikTok";
    if (/zalo\.me|zalo\.vn|zaloapp\.com|zadn\.vn/i.test(r)) return "Zalo";
    if (/google\./i.test(r)) return "Google";
    return "";
  }
  function baiDang() {
    try { return gon(new URLSearchParams(location.search).get("b"), 40); } catch (e) { return ""; }
  }

  var moi = kenhHienTai();
  if (moi) dat("qsv_kenh", moi);
  var KENH = moi || lay("qsv_kenh") || "Trực tiếp";
  /* Đến bằng link kênh mới thì tên bài đăng cũ không còn đúng nữa */
  var BAI = moi ? baiDang() : (lay("qsv_bai") || "");
  if (moi) dat("qsv_bai", BAI);

  /* Xem trên máy mình (mở file hoặc xem thử) thì không tính là lượt xem */
  var MAY_NHA = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  var MA = lay("qsv_ma");
  if (!MA) { MA = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); dat("qsv_ma", MA); }

  var TRANG = location.pathname.split("/").filter(Boolean).slice(-2).join("/") || "trang-chu";

  function gui(duLieu, giuKetNoi) {
    if (!DICH) return Promise.resolve({ ok: true, xemThu: true });
    return fetch(DICH, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(duLieu),
      keepalive: !!giuKetNoi
    }).then(function (r) { return r.json(); });
  }

  /* Ghi một lượt xem cho mỗi trang trong một lần ghé */
  function ghiLuotXem(trang) {
    if (MAY_NHA) return;
    gui({ loai: "xem", kenh: KENH, bai_dang: BAI, trang: trang, ma_khach: MA }, true).catch(function () {});
  }
  if (!layPhien("qsv_xem_" + TRANG)) {
    datPhien("qsv_xem_" + TRANG, "1");
    ghiLuotXem(TRANG);
  }

  /* ---------- Số Zalo, nhóm Zalo ---------- */
  var so = C.zalo || "";
  var soDep = so.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
  document.querySelectorAll("[data-zalo]").forEach(function (a) { a.href = "https://zalo.me/" + so; });
  document.querySelectorAll("[data-goi]").forEach(function (a) { a.href = "tel:" + so; });
  document.querySelectorAll("[data-so]").forEach(function (e) { e.textContent = soDep; });
  document.querySelectorAll("[data-ten-bot]").forEach(function (e) { if (C.tenBot) e.textContent = C.tenBot; });
  document.querySelectorAll("[data-bot]").forEach(function (a) {
    if (C.botZalo) { a.href = C.botZalo; a.hidden = false; } else { a.hidden = true; }
  });
  var goiY = document.getElementById("goi-y-tim"); if (goiY && C.botZalo) goiY.hidden = true;
  document.querySelectorAll("[data-nam]").forEach(function (e) { e.textContent = new Date().getFullYear(); });

  /* ---------- Video ---------- */
  var daDangKy = lay("qsv_da_dang_ky") === "1";
  var PLAY = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="2"/><path d="M26 20l20 12-20 12z" fill="#fff"/></svg>';
  var KHOA = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="16" y="28" width="32" height="24" rx="5" fill="#fff"/><path d="M22 28v-6a10 10 0 0120 0v6" fill="none" stroke="#fff" stroke-width="4"/><circle cx="32" cy="40" r="3.5" fill="#2A2119"/></svg>';

  function veVideo() {
    var khung = document.getElementById("ds-video");
    if (!khung) return;
    khung.innerHTML = "";
    (C.video || []).forEach(function (v) {
      var biKhoa = !v.mo && !daDangKy;
      var the = document.createElement("article");
      the.className = "vid" + (biKhoa ? " khoa" : "");

      var nut = document.createElement("button");
      nut.type = "button"; nut.className = "thumb";
      var nhan = document.createElement("span");
      nhan.className = "badge" + (v.mo ? " free" : "");
      nhan.textContent = !v.youtube ? "Đang quay" : (v.mo ? "Xem tự do" : (biKhoa ? "Đăng ký để xem" : "Đã mở"));
      nut.innerHTML = biKhoa ? KHOA : PLAY;
      nut.appendChild(nhan);
      nut.setAttribute("aria-label", (biKhoa ? "Đăng ký để xem: " : "Xem video: ") + v.tieuDe);
      nut.addEventListener("click", function () {
        if (biKhoa) { denPhieu(); return; }
        if (!v.youtube) { return; }
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v.youtube) + "?autoplay=1&rel=0";
        f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
        f.title = v.tieuDe;
        nut.appendChild(f);
        ghiLuotXem("video: " + v.tieuDe);
      });

      var tt = document.createElement("div"); tt.className = "info";
      var h = document.createElement("h3"); h.textContent = v.tieuDe;
      var p = document.createElement("p"); p.textContent = v.moTa || "";
      tt.appendChild(h); tt.appendChild(p);
      the.appendChild(nut); the.appendChild(tt);
      khung.appendChild(the);
    });
  }
  function denPhieu() {
    var f = document.getElementById("dang-ky");
    if (f) { f.scrollIntoView({ behavior: "smooth" }); var o = document.getElementById("ho-ten"); if (o) setTimeout(function () { o.focus({ preventScroll: true }); }, 500); }
    else { location.href = "../index.html#dang-ky"; }
  }
  veVideo();

  /* ---------- Phiếu đăng ký ---------- */
  var form = document.getElementById("phieu");
  if (!form) return;
  var oTen = document.getElementById("ho-ten"), oSo = document.getElementById("dien-thoai");
  var nutGui = document.getElementById("nut-gui"), hopLoi = document.getElementById("gui-loi");

  function chuanSo(s) {
    s = String(s || "").replace(/[\s.\-()]/g, "");
    if (s.indexOf("+84") === 0) s = "0" + s.slice(3);
    else if (s.indexOf("84") === 0 && s.length === 11) s = "0" + s.slice(2);
    return s;
  }
  function danhDau(o, sai) { o.closest(".field").classList.toggle("bad", sai); o.setAttribute("aria-invalid", sai ? "true" : "false"); }
  function xong(xemThu, ma) {
    form.classList.add("xong");
    document.getElementById("ghi-chu-xem-thu").hidden = !xemThu;
    ma = ma || (xemThu ? "QSV00000" : "");
    if (ma) { dat("qsv_ma_xn", ma); } else { ma = lay("qsv_ma_xn") || "—"; }
    document.getElementById("ma-xac-nhan").textContent = ma;
    dat("qsv_da_dang_ky", "1"); daDangKy = true; veVideo();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hopLoi.style.display = "none";
    var ten = oTen.value.trim(), soDT = chuanSo(oSo.value);
    var saiTen = ten.length < 2, saiSo = !/^0\d{9}$/.test(soDT);
    danhDau(oTen, saiTen); danhDau(oSo, saiSo);
    if (saiTen) { oTen.focus(); return; }
    if (saiSo) { oSo.focus(); return; }
    if (form.querySelector("[name=website]").value) { xong(false); return; } /* bẫy máy tự điền */

    var vt = form.querySelector("[name=vai_tro]:checked");
    var qt = Array.prototype.map.call(form.querySelectorAll("[name=quan_tam]:checked"), function (x) { return x.value; });
    var duLieu = {
      loai: "dang-ky", ho_ten: ten, dien_thoai: soDT,
      vai_tro: vt ? vt.value : "", quan_tam: qt.join(", "),
      cong_ty: form.querySelector("[name=cong_ty]").value.trim(),
      tinh: form.querySelector("[name=tinh]").value.trim(),
      kenh: KENH, bai_dang: BAI, trang: TRANG, ma_khach: MA
    };
    nutGui.disabled = true; var chu = nutGui.textContent; nutGui.textContent = "Đang gửi…";
    gui(duLieu).then(function (kq) {
      if (kq && kq.ok) { xong(!!kq.xemThu, kq.ma); }
      else { throw new Error("loi"); }
    }).catch(function () {
      hopLoi.style.display = "block";
    }).then(function () { nutGui.disabled = false; nutGui.textContent = chu; });
  });
  var nutChep = document.getElementById("chep-ma");
  nutChep.addEventListener("click", function () {
    var ma = document.getElementById("ma-xac-nhan").textContent;
    function daChep() { nutChep.textContent = "Đã chép"; setTimeout(function () { nutChep.textContent = "Chép mã"; }, 1500); }
    try { navigator.clipboard.writeText(ma).then(daChep, function () {}); } catch (e) {}
  });
  [oTen, oSo].forEach(function (o) { o.addEventListener("input", function () { danhDau(o, false); }); });
})();
