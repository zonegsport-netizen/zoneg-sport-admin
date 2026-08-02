# ZoneG Sport ERP v1.7 - Hóa đơn và tiếng Việt

- Toàn bộ nhãn hiển thị, trạng thái và tiêu đề bảng được chuyển sang tiếng Việt.
- Lập hóa đơn từ đơn hàng.
- Chọn khổ A4 hoặc A5.
- In trực tiếp hoặc xuất PDF giữ đúng dấu tiếng Việt.

## Cài đặt
1. Chạy `supabase/migration-v1.7-invoices.sql`.
2. Copy dự án lên GitHub, commit và push.
3. Chờ Netlify Published rồi nhấn Ctrl+F5.


## Bắt buộc triển khai Edge Function tạo nhân viên

Trong mã nguồn đã có:

- `supabase/functions/create-employee/index.ts`
- `supabase/functions/reset-employee-password/index.ts`

Triển khai bằng Supabase CLI:

```bash
supabase login
supabase link --project-ref zwjdvvtqydmlmmwhnqvo
supabase functions deploy create-employee
supabase functions deploy reset-employee-password
```

Thiết lập secrets phía Supabase:

```bash
supabase secrets set SUPABASE_URL=https://zwjdvvtqydmlmmwhnqvo.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào Netlify hoặc mã React.
