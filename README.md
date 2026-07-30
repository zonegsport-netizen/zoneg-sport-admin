# ZoneG Sport ERP v1.2.1 — Nhân viên & phân quyền

## Nâng cấp chính

- Vai trò: Chủ cửa hàng, Quản lý, Bán hàng, Nhân viên kho.
- Trang Nhân viên dành riêng cho chủ cửa hàng.
- Chủ có thể đổi vai trò và khóa/mở tài khoản.
- Tự động tạo profile khi tạo user trong Supabase Auth.
- Menu, giá nhập, lợi nhuận và nút thao tác thay đổi theo vai trò.
- RLS chặn quyền tại cơ sở dữ liệu.
- Chỉ owner/manager sửa sản phẩm.
- Chỉ owner xóa sản phẩm, biến thể, danh mục và thương hiệu.
- Owner/manager/warehouse được điều chỉnh kho.
- Owner/manager/sales truy cập đơn hàng, khách hàng, hóa đơn.
- Warehouse không truy cập doanh thu, khách hàng hoặc đơn hàng.

## Bước 1 — Chạy SQL

Supabase → SQL Editor → New query.

Chạy toàn bộ file:

`supabase/migration-v1.2.1-permissions.sql`

Tài khoản Auth được tạo đầu tiên sẽ được gán vai trò `owner`.
Các tài khoản khác mặc định là `sales`.

## Bước 2 — Cập nhật GitHub

Copy toàn bộ dự án vào repository, sau đó:

- Summary: `Upgrade employee roles v1.2.1`
- Commit to main
- Push origin

Chờ Netlify Published rồi nhấn Ctrl+F5.

## Cách tạo tài khoản nhân viên

1. Supabase → Authentication → Users.
2. Add user → Create new user hoặc Send invitation.
3. Khi user được tạo, trigger sẽ tự tạo dòng trong bảng `profiles`.
4. Đăng nhập bằng tài khoản chủ.
5. Mở menu Nhân viên.
6. Chọn vai trò và trạng thái tài khoản.

Không đưa Secret Key hoặc service_role key vào React.
