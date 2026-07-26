# ZoneG Sport Admin React v1

## Chạy thử trên máy
1. Cài Node.js 18 trở lên.
2. Giải nén dự án và mở Terminal tại thư mục.
3. Chạy `npm install`.
4. Sao chép `.env.example` thành `.env`.
5. Dán Publishable Key vào `VITE_SUPABASE_PUBLISHABLE_KEY`.
6. Chạy `npm run dev`.

## Deploy Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL=https://zwjdvvtqydmlmmwhnqvo.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key của anh>`

## Supabase
Dùng bảng hiện tại `public.zoneg_app_state`. Không cần chạy SQL mới ở bước này.
Bật Email Auth và đặt Site URL/Redirect URL đúng tên miền Netlify.

## Chức năng v1
Đăng nhập, Dashboard, sản phẩm, cảnh báo tồn kho, đơn hàng cơ bản, khách hàng, nhà cung cấp và đồng bộ dữ liệu nhiều máy.
