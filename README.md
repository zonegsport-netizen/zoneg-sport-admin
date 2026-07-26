# ZoneG Sport ERP v1.0 — Sprint 1

## Nội dung
- React + Vite
- Supabase Auth
- Supabase PostgreSQL
- Netlify
- Dashboard
- Sản phẩm
- Kho
- Đơn hàng
- Khách hàng
- Nhà cung cấp
- Khung Hóa đơn và Báo cáo

## Cài đặt Supabase
1. Mở SQL Editor.
2. Chạy `supabase/schema.sql`.
3. Vào Authentication → Providers → Email và bật Email.
4. Authentication → URL Configuration:
   - Site URL: URL Netlify.
   - Redirect URLs: thêm `https://TEN-SITE.netlify.app/**`.

## Chạy trên máy
```bash
npm install
copy .env.example .env
npm run dev
```

Điền Project URL và Publishable Key vào `.env`.

## Đưa lên GitHub
Copy toàn bộ file trong thư mục dự án vào thư mục repository đã clone bằng GitHub Desktop.
Sau đó:
1. Summary: `Initial ZoneG Sport ERP v1.0`
2. Commit to main
3. Push origin

## Deploy Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Lưu ý
Nếu chưa chạy schema SQL, giao diện vẫn hiển thị dữ liệu mẫu để kiểm tra bố cục.


## v1.1
- Nút Thêm sản phẩm ghi trực tiếp vào `public.products`.
- Kiểm tra SKU trùng trước khi lưu.
- Hiển thị lỗi Supabase trong form.
- Tải lại dữ liệu từ cloud.
- Đồng bộ Realtime cho products, orders, customers, suppliers.
- Sửa đúng thứ tự SKU / tên sản phẩm.
