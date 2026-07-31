# ZoneG Sport ERP v1.6.1 — Dữ liệu lớn

## Nâng cấp

- Phân trang phía Supabase: 50 sản phẩm mỗi trang.
- Tìm kiếm phía server theo mã, tên, danh mục và thương hiệu.
- Không tải toàn bộ sản phẩm, đơn hàng hoặc giao dịch khi mở trang.
- Nhập sản phẩm và biến thể từ Excel.
- Kiểm tra mã trùng trong file trước khi nhập.
- Nhập/upsert dữ liệu bằng một RPC transaction.
- Tạo tồn đầu kỳ và lịch sử kho từ file Excel.
- Xuất sản phẩm và biến thể ra Excel.
- Sao lưu toàn bộ dữ liệu nghiệp vụ ra JSON theo từng lô 1.000 bản ghi.
- Bổ sung index cho SKU, tên, ngày tạo và khóa liên kết.

## Cài đặt

1. Chạy file `supabase/migration-v1.6.1-big-data.sql`.
2. Copy toàn bộ mã nguồn lên GitHub.
3. Commit: `Upgrade ZoneG ERP v1.6.1 big data`
4. Push và chờ Netlify Published.
5. Nhấn Ctrl+F5.

## Nhập Excel

Dùng file `ZoneG-Template-Nhap-San-Pham-v1.6.1.xlsx`.

- Sheet `SAN_PHAM`: sản phẩm chính.
- Sheet `BIEN_THE`: màu, size, giá và tồn đầu kỳ.
- Có thể cập nhật sản phẩm đã tồn tại bằng cùng mã SKU.
- Tồn đầu kỳ chỉ tự tạo khi biến thể hiện có tồn bằng 0, tránh cộng lặp tồn khi nhập lại.

## Sao lưu

Nút `Sao lưu` xuất một file JSON chứa:
- sản phẩm, biến thể;
- danh mục, thương hiệu;
- lịch sử kho;
- khách hàng, đơn hàng, chi tiết;
- thanh toán;
- nhà cung cấp và phiếu nhập.

Nên sao lưu mỗi tuần và lưu thêm một bản trên Google Drive.
