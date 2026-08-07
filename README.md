# ZoneG Sport ERP V1.8

Phiên bản này **không có POS bán tại quầy** và **không có hộp thư hợp nhất**.

## Nội dung nâng cấp
- Đăng nhập nhân viên bằng số điện thoại và mật khẩu, không cần SMS/Twilio.
- Hệ thống tự chuyển số điện thoại thành email nội bộ `sodienthoai@staff.zoneg.io.vn`.
- Tạo, khóa/mở, đổi vai trò, đặt lại mật khẩu và xóa nhân viên trên web.
- Kiểm tra số điện thoại 10 chữ số trước khi tạo.
- Hiển thị lần đăng nhập gần nhất.
- Nhật ký hoạt động cho đăng nhập và quản lý nhân viên.
- Giữ toàn bộ chức năng V1.7: sản phẩm, Excel, kho, đơn hàng, thanh toán, nhập hàng, hóa đơn A4/A5 và PDF.

## Triển khai
1. Chạy `supabase/migration-v1.8.sql`.
2. Ghi đè mã nguồn và push GitHub.
3. Deploy lại ba Edge Functions bằng Supabase Dashboard: `create-employee`, `reset-employee-password`, `delete-employee`.
4. Netlify: Clear cache and deploy site.
5. Xóa các tài khoản nhân viên cũ được tạo theo Phone Auth rồi tạo lại trong V1.8.

## Đăng nhập
Nhân viên nhập số điện thoại dạng `0901234567`; ứng dụng tự xử lý email nội bộ. Phone Provider có thể để tắt.


## v1.8.1 — Luồng bán hàng hoàn chỉnh
- Mã sản phẩm, biến thể, khách hàng, đơn hàng và hóa đơn tự động.
- Dropdown Danh mục, Thương hiệu, Màu sắc, Kích thước.
- Quản lý Nhóm khách hàng.
- Tạo hồ sơ khách hàng.
- Lập đơn hàng có chọn biến thể và kiểm tra tồn.
- Hóa đơn bắt buộc xem trước trước khi phát hành.
- Sau phát hành có thể in A4/A5 hoặc xuất PDF.

Chạy `supabase/migration-v1.8.1.sql` sau các migration trước.
