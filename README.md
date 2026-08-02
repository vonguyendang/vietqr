# VietQR Generator

Công cụ tạo mã QR thanh toán theo chuẩn VietQR (Napas247) một cách nhanh chóng, an toàn và hoàn toàn miễn phí. Dự án được tối ưu hóa để triển khai trên Cloudflare, tích hợp sẵn các cơ chế chống DDoS và bộ đếm lượt truy cập ảo để tăng mức độ uy tín.

## Tính năng nổi bật

- **Tạo QR nhanh chóng**: Khởi tạo mã QR thanh toán cá nhân hoặc doanh nghiệp dễ dàng.
- **Tính an toàn cao (Chống DDoS)**: Tích hợp **Cloudflare Turnstile** ngăn chặn bot/scripts tự động spam request.
- **Bộ đếm truy cập**: Sử dụng Cloudflare KV để theo dõi lượt truy cập (với số lượng ban đầu được thiết lập ở mức độ cao để tăng uy tín).
- **Trải nghiệm mượt mà**: Giao diện đẹp, hiện đại, hỗ trợ nhiều tùy chọn hiển thị mã QR (gọn, in ấn, chi tiết).
- **Hoạt động bảo mật**: Mọi thông tin thanh toán được xử lý phía trình duyệt, đảm bảo an toàn tuyệt đối.

## 🚀 Hướng dẫn Deploy lên Cloudflare Pages (Miễn phí)

Dự án này rất thích hợp để host trên **Cloudflare Pages** vì nó hoàn toàn là tĩnh (HTML/JS/CSS) nhưng có khả năng tận dụng thêm sức mạnh của Cloudflare Functions.

### 1. Chuẩn bị (Tạo KV Namespace)
Để bộ đếm truy cập hoạt động, bạn cần tạo một không gian lưu trữ (KV Namespace):
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Chọn **Workers & Pages** -> **KV**.
3. Nhấn **Create a namespace**, nhập tên là `VIETQR_KV` và nhấn Add.

### 2. Triển khai code (Deploy)

**Cách 1: Deploy tự động qua GitHub (Khuyên dùng)**
1. Đẩy code này lên một repository GitHub cá nhân của bạn.
2. Trên Cloudflare, vào **Workers & Pages** -> **Overview** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Chọn repo GitHub chứa dự án của bạn.
4. Ở phần **Build settings**, để trống phần *Build command* và *Build output directory*.
5. Cuộn xuống phần **Environment variables (advanced)**:
   - Chuyển sang tab **KV namespace bindings**.
   - Thêm một biến có tên (Variable name) là `VIETQR_KV` và chọn giá trị là Namespace bạn vừa tạo ở bước 1.
6. Bấm **Save and Deploy**. 

**Cách 2: Sử dụng Wrangler CLI (Dành cho Developer)**
```bash
npm install -g wrangler
wrangler pages deploy . --project-name vietqr
# Sau khi deploy xong, vào Dashboard Cloudflare để gắn (bind) biến KV namespace như hướng dẫn Cách 1.
```

### 3. Cấu hình cơ chế Chống DDoS & Spam (Cloudflare Turnstile)

Để bảo vệ website khỏi các cuộc tấn công tự động (DDoS, spam click), dự án này sử dụng Cloudflare Turnstile:
1. Vào Cloudflare Dashboard -> **Turnstile**.
2. Nhấn **Add site**, nhập tên và tên miền (domain/pages.dev) của bạn.
3. Chế độ widget khuyên dùng: **Invisible** hoặc **Managed**.
4. Bạn sẽ nhận được một **Site Key**.
5. Mở file `index.html` trong mã nguồn, tìm đến dòng có `data-sitekey="1x00000000000000000000AA"` và thay bằng Site Key thực tế của bạn.
6. Đẩy code (commit & push) lại lên GitHub để Cloudflare tự động cập nhật.

*(Ngoài Turnstile, bạn nên bật thêm "Bot Fight Mode" và tạo một số Rate Limiting Rules trong mục Security > WAF trên Cloudflare để trang web kiên cố nhất).*

## Chạy thử nghiệm trên máy cá nhân (Local)

Bạn có thể mở trực tiếp file `index.html` bằng trình duyệt để xem giao diện, tuy nhiên bộ đếm (counter) sẽ báo lỗi vì nó yêu cầu môi trường Cloudflare. Để chạy thử toàn vẹn (cả giao diện và API bộ đếm):

1. Cài đặt Wrangler CLI:
```bash
npm install -g wrangler
```
2. Chạy môi trường mô phỏng Cloudflare:
```bash
wrangler pages dev . --kv VIETQR_KV
```
3. Truy cập địa chỉ `http://localhost:8788`.

## Tác giả

Được thiết kế và phát triển bởi **Dang Vo**.

---
© 2025 VietQR Generator. All rights reserved.
