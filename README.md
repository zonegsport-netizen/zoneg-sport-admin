# ZoneG Sport ERP v1.2

## Tính năng mới

- Thêm, sửa, xóa sản phẩm có kiểm tra ràng buộc.
- Danh mục và thương hiệu độc lập.
- Mỗi sản phẩm có nhiều biến thể màu/size.
- SKU và mã vạch riêng cho từng biến thể.
- Giá bán, giá nhập và tồn tối thiểu riêng theo biến thể.
- Nhập kho, xuất kho, điều chỉnh tăng/giảm, khách trả hàng, trả nhà cung cấp.
- Mỗi thao tác kho tạo một bản ghi `stock_transactions`.
- Không cho xuất vượt tồn.
- Tồn tổng của sản phẩm tự đồng bộ từ tổng tồn các biến thể.
- Lịch sử giao dịch kho và cảnh báo tồn thấp.
- Đồng bộ Realtime giữa nhiều máy.

## Bước 1 — Chạy Migration SQL

Mở Supabase → SQL Editor → New query.

Sao chép toàn bộ file:

`supabase/migration-v1.2.sql`

Dán vào SQL Editor và nhấn Run.

Kết quả đúng thường là:

`Success. No rows returned`

## Bước 2 — Cập nhật mã nguồn GitHub

1. Giải nén ZIP.
2. Copy toàn bộ nội dung vào thư mục repository `zoneg-sport-admin`.
3. Chọn Replace khi Windows hỏi ghi đè.
4. GitHub Desktop:
   - Summary: `Upgrade ZoneG Sport ERP v1.2`
   - Commit to main
   - Push origin
5. Chờ Netlify tự deploy và báo Published.
6. Mở `https://shop.zoneg.io.vn` và nhấn Ctrl+F5.

## Quy trình sử dụng đúng

1. Tạo danh mục.
2. Tạo thương hiệu.
3. Tạo sản phẩm chính.
4. Mở sản phẩm và tạo các biến thể màu/size.
5. Sang Kho hàng và dùng Điều chỉnh kho để nhập tồn ban đầu.

Không nhập tồn ban đầu trực tiếp khi tạo biến thể, vì mọi thay đổi kho phải có lịch sử giao dịch.
