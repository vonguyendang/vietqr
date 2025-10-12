# VietQR Generator

Công cụ tạo mã QR thanh toán theo chuẩn VietQR (Napas247) một cách nhanh chóng, an toàn và hoàn toàn miễn phí. Dự án được xây dựng bằng HTML, CSS và JavaScript, sử dụng API công khai từ [vietqr.io](https://vietqr.io/) và hoạt động hoàn toàn phía client để đảm bảo an toàn thông tin cho người dùng.

## Tính năng nổi bật

- **Tạo QR nhanh chóng**: Tạo mã QR thanh toán chỉ với vài cú nhấp chuột.
- **Danh sách ngân hàng cập nhật**: Tự động tải danh sách các ngân hàng hỗ trợ VietQR mới nhất.
- **Tùy chỉnh thông tin**: Cho phép thêm số tiền, nội dung chuyển khoản và tên người nhận.
- **Nhiều mẫu QR**: Cung cấp các mẫu QR khác nhau (gọn, in ấn, chỉ mã QR) để phù hợp với nhiều mục đích sử dụng.
- **Xem trước và Tải xuống**: Hiển thị mã QR ngay lập tức và cho phép tải về dưới dạng ảnh PNG.
- **Kiểm tra thông tin**: Phân tích và hiển thị chuỗi QR gốc cùng mã CRC hash để kiểm tra tính toàn vẹn.
- **An toàn**: Mọi thông tin được xử lý trực tiếp trên trình duyệt của bạn, không có dữ liệu nào được gửi về máy chủ.

## Hướng dẫn sử dụng

Không cần cài đặt phức tạp. Bạn chỉ cần mở file `index.html` bằng bất kỳ trình duyệt web hiện đại nào.

1.  **Chọn Ngân hàng**: Chọn ngân hàng của bạn từ danh sách thả xuống.
2.  **Nhập Số tài khoản**: Điền chính xác số tài khoản của bạn.
3.  **Tùy chọn**:
    -   **Số tiền**: Nhập số tiền bạn muốn người khác chuyển.
    -   **Nội dung**: Nhập nội dung chuyển khoản (ví dụ: `Thanh toan don hang 123`).
    -   **Tên tài khoản**: Nhập tên tài khoản của bạn (không dấu) để hiển thị trên QR (nếu cần).
4.  **Tạo mã**: Nhấn nút **"Tạo mã QR"**.
5.  **Sử dụng**:
    -   Mã QR sẽ hiện ra ở khung bên phải.
    -   Sử dụng ứng dụng ngân hàng trên điện thoại để quét mã.
    -   Nhấn nút **"Tải xuống ảnh QR"** để lưu hình ảnh về máy.

## Công nghệ sử dụng

-   **Frontend**: HTML, CSS, JavaScript
-   **Thư viện**: jQuery, Select2, jsQR
-   **API**: [vietqr.io](https://vietqr.io/) để tạo và lấy danh sách ngân hàng.

## Tác giả

Được thiết kế và phát triển bởi **Dang Vo**.

---
© 2025 VietQR Generator. All rights reserved.
