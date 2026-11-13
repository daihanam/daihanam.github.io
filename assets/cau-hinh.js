/* CẤU HÌNH TRANG WEB — chỉ sửa file này khi đổi số Zalo, nối Google Sheet, thêm video. */
window.QSV = {
  /* Địa chỉ nhận dữ liệu (Google Apps Script). Để trống = bản xem thử, chưa lưu gì. */
  diaChiNhanDuLieu: "https://script.google.com/macros/s/AKfycbx0BtyRuc2OldCNfyCr0PPg1uJRK-zC4bObyb-YARucNMkbZOv9fxh43T0UgrBScuKf/exec",

  /* Số Zalo / điện thoại hiển thị trên trang */
  zalo: "0915468176",

  /* Bot Zalo xác nhận người đăng ký và gửi link nhóm (link nhóm KHÔNG để ở đây, bot giữ).
     botZalo: đường dẫn mở chat với bot. Để trống = chỉ hướng dẫn tìm tên bot trên Zalo. */
  tenBot: "Bot AI-Đại QSV",
  botZalo: "",

  /* Danh sách video.
     youtube: mã video YouTube (phần sau "v=" trong link). Để trống = hiện "Đang quay".
     mo: true = ai cũng xem được; false = phải để lại thông tin mới xem. */
  video: [
    { tieuDe: "Giới thiệu nhanh: một công ty hồ sơ chạy cùng trợ lý AI",
      moTa: "Toàn cảnh hệ thống trong vài phút: thư mục, phòng ban, bảng điều hành, ba lần duyệt.",
      youtube: "", mo: true },
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
