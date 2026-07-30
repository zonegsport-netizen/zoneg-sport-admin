-- ZoneG Sport ERP v1.2.1 — Nhân viên & phân quyền
-- Chạy một lần trong Supabase SQL Editor sau migration-v1.2.sql.

alter table public.profiles
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

-- Chuẩn hóa vai trò cũ.
update public.profiles set role = 'sales' where role not in ('owner','manager','sales','warehouse');

-- Tạo hồ sơ cho các tài khoản Auth đã có.
insert into public.profiles(id, email, full_name, role, active)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  case
    when u.id = (select id from auth.users order by created_at asc limit 1) then 'owner'
    else 'sales'
  end,
  true
from auth.users u
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

-- Tự động tạo/cập nhật profile khi có tài khoản Auth mới.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email, full_name, role, active)
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'sales',
    true
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_zoneg on auth.users;
create trigger on_auth_user_created_zoneg
after insert or update of email on auth.users
for each row execute function public.handle_new_auth_user();

-- Các hàm quyền dùng trong RLS.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and active = true
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and active = true
  )
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- Xóa policy rộng cũ.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','brands','suppliers','products','product_variants',
    'customers','orders','order_items','stock_transactions','invoices','payments'
  ]
  loop
    execute format('drop policy if exists authenticated_all on public.%I', t);
  end loop;
end $$;

-- PROFILES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.current_app_role() in ('owner','manager')
);

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
for update to authenticated
using (public.current_app_role() = 'owner')
with check (
  public.current_app_role() = 'owner'
  and role in ('owner','manager','sales','warehouse')
);

-- PRODUCTS / CATEGORY / BRAND: mọi user active được xem, owner/manager được sửa.
do $$
declare t text;
begin
  foreach t in array array['products','product_variants','categories','brands']
  loop
    execute format('drop policy if exists app_select on public.%I', t);
    execute format(
      'create policy app_select on public.%I for select to authenticated using (public.is_active_user())',
      t
    );
    execute format('drop policy if exists app_insert_manager on public.%I', t);
    execute format(
      'create policy app_insert_manager on public.%I for insert to authenticated with check (public.current_app_role() in (''owner'',''manager''))',
      t
    );
    execute format('drop policy if exists app_update_manager on public.%I', t);
    execute format(
      'create policy app_update_manager on public.%I for update to authenticated using (public.current_app_role() in (''owner'',''manager'')) with check (public.current_app_role() in (''owner'',''manager''))',
      t
    );
    execute format('drop policy if exists app_delete_owner on public.%I', t);
    execute format(
      'create policy app_delete_owner on public.%I for delete to authenticated using (public.current_app_role() = ''owner'')',
      t
    );
  end loop;
end $$;

-- SUPPLIERS: owner/manager/warehouse xem; owner/manager sửa.
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
for select to authenticated
using (public.current_app_role() in ('owner','manager','warehouse'));

drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers
for all to authenticated
using (public.current_app_role() in ('owner','manager'))
with check (public.current_app_role() in ('owner','manager'));

-- CUSTOMERS / ORDERS / ITEMS / INVOICES / PAYMENTS: owner, manager, sales.
do $$
declare t text;
begin
  foreach t in array array['customers','orders','order_items','invoices','payments']
  loop
    execute format('drop policy if exists commerce_access on public.%I', t);
    execute format(
      'create policy commerce_access on public.%I for all to authenticated using (public.current_app_role() in (''owner'',''manager'',''sales'')) with check (public.current_app_role() in (''owner'',''manager'',''sales''))',
      t
    );
  end loop;
end $$;

-- STOCK TRANSACTIONS: owner/manager/warehouse được xem.
drop policy if exists stock_select on public.stock_transactions;
create policy stock_select on public.stock_transactions
for select to authenticated
using (public.current_app_role() in ('owner','manager','warehouse'));

-- Không cho insert/update/delete trực tiếp từ client; chỉ qua RPC adjust_variant_stock.
drop policy if exists stock_direct_insert on public.stock_transactions;
drop policy if exists stock_direct_update on public.stock_transactions;
drop policy if exists stock_direct_delete on public.stock_transactions;

-- Thay RPC điều chỉnh kho bằng phiên bản kiểm tra vai trò.
create or replace function public.adjust_variant_stock(
  p_variant_id uuid,
  p_type text,
  p_quantity integer,
  p_reference_code text default null,
  p_note text default null
)
returns public.product_variants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant public.product_variants;
  v_delta integer;
  v_new_stock integer;
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid() and active = true;

  if v_role not in ('owner','manager','warehouse') then
    raise exception 'Bạn không có quyền điều chỉnh kho';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Số lượng phải lớn hơn 0';
  end if;

  if p_type not in ('in','out','adjust_in','adjust_out','return_in','return_supplier') then
    raise exception 'Loại giao dịch kho không hợp lệ';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id
  for update;

  if not found then raise exception 'Không tìm thấy biến thể'; end if;

  v_delta := case
    when p_type in ('in','adjust_in','return_in') then p_quantity
    else -p_quantity
  end;

  v_new_stock := v_variant.stock + v_delta;
  if v_new_stock < 0 then
    raise exception 'Tồn kho không đủ. Hiện có %', v_variant.stock;
  end if;

  update public.product_variants
  set stock = v_new_stock, updated_at = now()
  where id = p_variant_id
  returning * into v_variant;

  insert into public.stock_transactions(
    product_id, variant_id, type, quantity, balance_after,
    reference_code, note, created_by
  ) values (
    v_variant.product_id, p_variant_id, p_type, v_delta, v_new_stock,
    nullif(trim(p_reference_code), ''), nullif(trim(p_note), ''), auth.uid()
  );

  update public.products p
  set stock = coalesce((
      select sum(v.stock)::integer
      from public.product_variants v
      where v.product_id = p.id and v.status = 'active'
    ), 0),
    updated_at = now()
  where p.id = v_variant.product_id;

  return v_variant;
end;
$$;

revoke all on function public.adjust_variant_stock(uuid,text,integer,text,text) from public;
grant execute on function public.adjust_variant_stock(uuid,text,integer,text,text) to authenticated;
