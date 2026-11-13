/* CẤU HÌNH TRANG WEB — chỉ sửa file này khi đổi số Zalo, nối Google Sheet, thêm video. */
window.QSV = {
  /* Địa chỉ nhận dữ liệu (Google Apps Script). Để trống = bản xem thử, chưa lưu gì. */
  diaChiNhanDuLieu: "https://script.google.com/macros/s/AKfycbx0BtyRuc2OldCNfyCr0PPg1uJRK-zC4bObyb-YARucNMkbZOv9fxh43T0UgrBScuKf/exec",

  /* Số Zalo / điện thoại hiển thị trên trang */
  zalo: "0915468176",

  /* Bot Zalo xác nhận người đăng ký và gửi link nhóm (link nhóm KHÔNG để ở đây, bot giữ).
     botZalo: đường dẫn mở chat với bot. Để trống = chỉ hướng dẫn tìm tên bot trên Zalo. */
  tenBot: "Bot AI-Đại QSV",
  botZalo: "https://zalo.me/3059457514407082227",

  /* Danh sách video.
     youtube: mã video YouTube (phần sau "v=" trong link). Để trống = hiện "Đang quay".
     mo: true = ai cũng xem được; false = phải đăng ký VÀ xác nhận qua bot Zalo mới xem.
     Video khóa đã có: để youtube trống, ghi ma + daCo: true; mã YouTube thật lưu ở thuộc tính
     VIDEO_KHOA của bảng tính (dạng {"ma": "mã YouTube"}), chỉ trả về cho người đã xác nhận. */
  video: [
    { tieuDe: "Giới thiệu nhanh: một công ty hồ sơ chạy cùng trợ lý AI",
      moTa: "Toàn cảnh hệ thống trong vài phút: thư mục, phòng ban, bảng điều hành, ba lần duyệt.",
      youtube: "YcK50g8pk40", mo: true },
    { tieuDe: "Tổ chức hoạt động của doanh nghiệp AI",
      moTa: "Cách một doanh nghiệp vận hành cùng đội trợ lý AI: ai làm việc gì, phối hợp ra sao.",
      youtube: "p4GKPvEnFL0", mo: true },
    { tieuDe: "Hệ thống AI: 9 phòng ban, 1 người duyệt",
      moTa: "Chín phòng ban là trợ lý AI chia nhau làm hồ sơ, Giám đốc giữ quyền duyệt.",
      ma: "9-phong-ban", daCo: true, mo: false },
    { tieuDe: "Giải mã bản đồ tổng thể",
      moTa: "Đọc bản đồ tổng thể của hệ thống: từng phần nằm ở đâu và nối với nhau thế nào.",
      ma: "ban-do", daCo: true, mo: false },
    { tieuDe: "Từ hợp đồng đến danh mục hồ sơ phải trình",
      moTa: "Cách đọc hợp đồng, rút ra yêu cầu và lập danh mục để không sót hồ sơ.",
      youtube: "", mo: false },
    { tieuDe: "Sáu công tác pháp lý chạy song song",
      moTa: "Biện pháp – tiến độ, phòng thí nghiệm, nhân sự, máy móc, mỏ vật liệu, nhà cung cấp.",
      youtube: "", mo: false },
    { tieuDe: "Một đợt thanh toán từ tiếp nhận đến bàn giao",
      moTa: "Ba phòng soạn cùng lúc, kiểm soát nội bộ đối chiếu chéo, Giám đốc duyệt một bảng.",
      youtube: "", mo: false },
    { tieuDe: "Tự dựng bảng điều hành cho công ty mình",
      moTa: "Dành cho người muốn làm lại hệ thống này: bắt đầu từ đâu, cần chuẩn bị gì.",
      youtube: "", mo: false }
  ]
};
