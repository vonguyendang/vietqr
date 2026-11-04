# VietQR Payment Suite & Core

Nền tảng tạo mã VietQR theo chuẩn Napas247 & EMVCo toàn diện, tích hợp công nghệ Quicklink SVG-First, Bộ giải mã QR (Decoder) từ hình ảnh & clipboard, Bộ phân tích cú pháp chuỗi EMVCo TLV & kiểm tra CRC-16, Bank Deeplink mở trực tiếp App ngân hàng, tra cứu danh bạ 76+ Ngân hàng, xác thực số tài khoản (STK) và tra cứu thông tin doanh nghiệp qua Mã số thuế (MST).

![VietQR Payment Suite Banner](favicon_io/android-chrome-512x512.png)

---

## 🌟 Hệ Thống Đa Chức Năng (8 Tiện Ích Đỉnh Cao)

Dự án được nâng cấp toàn diện dựa trên đợt phát hành mới của **VietQR Payment Kit** và kiến trúc kỹ thuật chuẩn mở của Napas247 / EMVCo:

### 1. 🪄 Tạo QR Động (Quicklink SVG-First & vietqr-core Offline)
- **Chuẩn render SVG-First**: Chuyển đổi engine theo hướng vector SVG trên nền tảng Serverless, tăng tốc độ sinh mã gấp 5 lần (chỉ còn ~100ms), độ sắc nét tuyệt đối trên mọi độ phân giải màn hình và in ấn.
- **Hỗ trợ định dạng kép**: Tải xuống cả hai định dạng **SVG** (vector) và **PNG** độ phân giải cao.
- **Đầy đủ 7 template chuẩn VietQR**:
  - `compact`: 540x540 (Logo Napas & Bank)
  - `compact2`: 540x640 (Kèm khung chi tiết chuyển khoản)
  - `print`: 600x776 (Bản in POS / Hóa đơn thanh toán)
  - `qr_only`: 480x480 (Tối giản chỉ có QR)
  - `loax`: 2583x3719 (Chuyên dụng cho dòng Loa thanh toán & thông báo chuyển khoản thông minh)
  - `payos`: 490x490 (Chuẩn tích hợp cổng thanh toán payOS)
  - `vietqr_pro`: 540x540 (Bản Pro thương mại, viền nhận diện thương hiệu cao cấp)
- **vietqr-core Offline EMVCo**: Tích hợp thuật toán tính chuỗi payload EMVCo và CRC-16 trực tiếp phía trình duyệt với độ trễ 0ms, không phụ thuộc vào API bên ngoài (chuẩn bị sẵn sàng trước hạn ngừng hỗ trợ endpoint `/v2/generate` vào 01/01/2027).
- **Tiện ích sao chép**: 1-click sao chép ảnh QR, chuỗi mã hóa, hoặc URL Quicklink.

### 2. 🔍 Giải Mã QR (QR Decoder - 100% Client-Side)
- **Đa phương thức nạp ảnh**: Kéo thả ảnh QR, chọn file từ máy tính, **dán ảnh chụp màn hình trực tiếp từ bộ nhớ tạm (Ctrl / Cmd + V) ở bất kỳ đâu trên trang**, hoặc quét qua Camera / Webcam trực tiếp.
- **Trích xuất thông tin tự động**:
  - Ngân hàng thụ hưởng & mã BIN
  - Số tài khoản / số thẻ
  - Số tiền thanh toán (tự động format VNĐ)
  - Nội dung chuyển khoản
  - Phương thức giao dịch (Tài khoản / Thẻ)
  - Mã đơn hàng (Tag 62.01)
  - Xác thực mã kiểm tra toàn vẹn **CRC-16** (Hợp lệ / Sai lệch)
- **Liên kết 1-click**: Bấm "Tạo lại mã VietQR từ ảnh này" hoặc "Mở App thanh toán ngay" mà không cần gõ lại bất kỳ thông tin nào.

### 3. 🔬 Phân Tích EMVCo TLV (TLV Parser & Verifier)
- Dán bất kỳ chuỗi VietQR nào bắt đầu bằng `000201...` để phân tách chi tiết cấu trúc phân cấp:
  - Bóc tách theo từng Tag (Tag-Length-Value): Tag 00, 01, 38 (38.00 GUID, 38.01.00 BIN, 38.01.01 STK, 38.02 Nghiệp vụ), 53, 54, 58, 62 (01 Đơn hàng, 08 Nội dung), 63 CRC.
  - Bảng trực quan hóa danh sách Tag, tên trường, độ dài và giá trị đã giải mã.
  - Cây đối tượng JSON đầy đủ có thể copy.
  - Tự động tính toán lại và kiểm tra tính toàn vẹn của mã băm CRC-16 chống gian lận/sửa đổi.

### 4. 🔗 Bank Deeplink (Mở Trực Tiếp App Ngân Hàng)
- Tạo đường dẫn `https://dl.vietqr.io/pay?app={appId}&am={soTien}&tn={noiDung}&ba={stk}@{bank}` giúp khách hàng trên điện thoại mở thẳng ứng dụng ngân hàng với nội dung đã được điền sẵn.
- Hỗ trợ cả 2 hệ điều hành **Android** và **iOS** (hơn 35 app phổ biến: Vietcombank Digibank, VietinBank iPay, Techcombank, MB Bank, OCB OMNI, MoMo...).
- Hiển thị **Mã QR Deeplink** ngay trên màn hình máy tính để người dùng dùng camera quét và mở app trên điện thoại.
- Bảng thống kê chi tiết lượt cài đặt hàng tháng và trạng thái tự điền (Autofill).

### 5. 🏦 Tra Cứu Danh Mục Ngân Hàng (API Bank)
- Cơ sở dữ liệu **76+ ngân hàng** Việt Nam được cập nhật liên tục từ Napas & VietQR.
- Tìm kiếm tức thì (live search) theo tên thường gọi (VCB, TCB, MB, VietinBank...), mã BIN (970415, 970436...), tên pháp nhân hoặc mã SWIFT.
- Bộ lọc thông minh: Ngân hàng hỗ trợ thanh toán VietQR và hỗ trợ tra cứu STK.
- Thao tác 1-click: "Tạo QR", "Tạo Deeplink", "Sao chép BIN".

### 6. 💼 Tra Cứu Số Tài Khoản (Tra cứu STK)
- Kiểm tra tính hợp lệ của số tài khoản ngân hàng thụ hưởng và truy xuất tên chủ thẻ.
- Hỗ trợ cấu hình `x-client-id` và `x-api-key` từ `my.vietqr.io` hoặc Casso cho doanh nghiệp.
- 1-click chuyển tiếp thông tin tài khoản vừa tra cứu sang bộ tạo mã QR.
- Tích hợp ghi chú về lộ trình chuyển dịch sang bộ API Cas Pay Out tuân thủ chuẩn Open Banking.

### 7. 🏢 Tra Cứu Mã Số Thuế Doanh Nghiệp (Tra cứu MST)
- Tra cứu trực tiếp thông tin pháp nhân từ cơ sở dữ liệu quốc gia qua `https://api.vietqr.io/v2/business/{taxCode}`.
- Hiển thị: Tên đầy đủ, tên giao dịch quốc tế, tên viết tắt, MST, địa chỉ đăng ký, trạng thái người nộp thuế và thời điểm cập nhật.
- Mẫu thử nhanh (Viettel, Casso, FPT, Vingroup).
- Tiện ích sao chép nhanh chuẩn định dạng xuất hóa đơn VAT cho kế toán.
- 1-click tạo mã QR thanh toán đến doanh nghiệp.

### 8. 💻 Mã Nguồn Mẫu & SDK Đa Ngôn Ngữ
- Trình tạo mã nguồn mẫu thời gian thực (Live Code Generator) cho:
  - **cURL**
  - **JavaScript / Node.js**
  - **C# (.NET)**
  - **Python**
  - **PHP**
  - **Java**
  - **Go**
- Mã nguồn cập nhật tự động theo các tham số đang nhập trên giao diện.

---

## ⚖️ Tuân Thủ Pháp Lý & Chính Sách Bảo Mật

Website được thiết kế tuân thủ nghiêm ngặt các quy định pháp luật hiện hành của Việt Nam:

1. **Bảo vệ Dữ liệu Cá nhân (Nghị định 13/2023/NĐ-CP)**:
   - Toàn bộ quá trình tạo mã, giải mã ảnh và phân tích dữ liệu chạy **100% Client-Side** trên trình duyệt của người dùng.
   - Máy chủ **hoàn toàn không thu thập, không ghi nhật ký (log) và không lưu trữ bất kỳ thông tin số tài khoản, số tiền hay thông tin giao dịch** nào của người dùng.

2. **Quy chế Hoạt động Thanh toán (Nghị định 52/2024/NĐ-CP)**:
   - Website **KHÔNG** phải là tổ chức cung ứng dịch vụ trung gian thanh toán, không mở tài khoản, không giữ tiền và không can thiệp vào dòng tiền.
   - Website chỉ đóng vai trò là công cụ tiện ích độc lập, hỗ trợ kỹ thuật và hiển thị trực quan thông tin thụ hưởng (tương tự việc in số tài khoản lên hóa đơn). Giao dịch chuyển tiền thực tế diễn ra trực tiếp giữa khách hàng và ngân hàng thụ hưởng thông qua ứng dụng Mobile Banking được cấp phép bởi Ngân hàng Nhà nước Việt Nam.

3. **Quyền Sở hữu Trí tuệ & Nhãn hiệu (Tuyên bố Miễn trừ Đại diện)**:
   - Hệ thống được phát triển dựa trên tiêu chuẩn thanh toán quốc gia Napas247, EMVCo và tài liệu kỹ thuật từ [VietQR.io (Casso)](https://www.vietqr.io).
   - **VietQR®** và **NAPAS®** là nhãn hiệu đã đăng ký của Công ty Cổ phần Thanh toán Quốc gia Việt Nam (NAPAS). Website hoạt động hoàn toàn với tư cách công cụ tiện ích độc lập, phục vụ nghiên cứu kỹ thuật và phi thương mại; không trực thuộc, không được ủy quyền hay đại diện pháp lý cho NAPAS hoặc Casso. Website không cung ứng dịch vụ trung gian thanh toán và không can thiệp vào dòng tiền giao dịch.
   - Toàn bộ dữ liệu được xử lý trực tiếp trên trình duyệt (Client-Side). Hệ thống cam kết tuyệt đối không thu thập, không ghi nhận và không lưu trữ bất kỳ thông tin tài khoản hay giao dịch nào của người dùng.

4. **Bảo Mật Hạ Tầng**:
   - Tích hợp Cloudflare Turnstile ngăn chặn bot spam và DDoS.
   - Thiết lập cấu hình bảo mật `_headers` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Camera Permissions-Policy).

---

## 🚀 Hướng Dẫn Deploy Lên Cloudflare Pages

Dự án hoàn toàn tĩnh (HTML/CSS/JS) kết hợp sức mạnh của **Cloudflare Pages Functions** (cho KV Counter và STK Proxy).

### Deploy Tự Động Qua GitHub (Khuyên dùng)
1. Đẩy mã nguồn này lên GitHub cá nhân.
2. Vào **Cloudflare Dashboard** -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Chọn repo của bạn.
4. Build settings: Để trống *Build command* và *Build output directory*.
5. (Tùy chọn) Gắn biến môi trường KV cho bộ đếm:
   - Vào Settings của Pages -> Functions -> **KV namespace bindings** -> Thêm `VIETQR_KV`.
6. (Tùy chọn) Cấu hình API Key doanh nghiệp cho tra cứu STK:
   - Environment variables: `VIETQR_CLIENT_ID` và `VIETQR_API_KEY`.
7. Nhấn **Save and Deploy**.

---

## 🧪 Chạy Thử Nghiệm Tại Local

```bash
# Sử dụng Python 3:
python3 -m http.server 8080

# Hoặc sử dụng Node:
npx serve .
```

Sau đó mở trình duyệt tại `http://localhost:8080`.

---

## 📜 Giấy Phép (License)

Dự án được phân phối theo giấy phép mã nguồn mở **MIT License**. Xem chi tiết tại tệp [LICENSE](LICENSE).

- Thiết kế và phát triển bởi **Dang Vo**.
- Xây dựng dựa trên tiêu chuẩn VietQR Napas247 và tài liệu kỹ thuật từ [VietQR.io](https://www.vietqr.io) / [Casso](https://casso.vn).
- © 2026 VietQR Kit & Generator. All rights reserved.
