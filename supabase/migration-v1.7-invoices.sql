-- ZoneG Sport ERP v1.7 - Hóa đơn bán hàng
-- Chạy sau migration-v1.6.1-big-data.sql.

create table if not exists public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  customer_name text,
  customer_phone text,
  customer_address text,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  shipping_fee numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  note text,
  status text not null default 'issued',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.sales_invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  sku text,
  product_name text,
  quantity integer not null,
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0
);

create index if not exists sales_invoices_created_idx on public.sales_invoices(created_at desc);
create index if not exists sales_invoice_items_invoice_idx on public.sales_invoice_items(invoice_id);

alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_items enable row level security;

drop policy if exists sales_invoices_access on public.sales_invoices;
create policy sales_invoices_access on public.sales_invoices for all to authenticated
using (public.current_app_role() in ('owner','manager','sales'))
with check (public.current_app_role() in ('owner','manager','sales'));

drop policy if exists sales_invoice_items_access on public.sales_invoice_items;
create policy sales_invoice_items_access on public.sales_invoice_items for all to authenticated
using (public.current_app_role() in ('owner','manager','sales'))
with check (public.current_app_role() in ('owner','manager','sales'));

create or replace function public.create_sales_invoice_from_order(p_order_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid();v_no text;v_order public.orders;
begin
 if public.current_app_role() not in('owner','manager','sales') then raise exception 'Bạn không có quyền lập hóa đơn';end if;
 if exists(select 1 from public.sales_invoices where order_id=p_order_id) then raise exception 'Đơn hàng này đã có hóa đơn';end if;
 select * into v_order from public.orders where id=p_order_id;
 if not found then raise exception 'Không tìm thấy đơn hàng';end if;
 v_no:='HD-'||to_char(now(),'YYYYMMDD-HH24MISS');
 insert into public.sales_invoices(id,invoice_number,order_id,customer_name,subtotal,discount,shipping_fee,total,paid_amount,balance_due,note,created_by)
 values(v_id,v_no,p_order_id,v_order.customer_name,coalesce(v_order.subtotal,0),coalesce(v_order.discount,0),coalesce(v_order.shipping_fee,0),coalesce(v_order.total,0),coalesce(v_order.paid_amount,0),coalesce(v_order.balance_due,0),nullif(trim(p_note),''),auth.uid());
 insert into public.sales_invoice_items(invoice_id,product_id,variant_id,sku,product_name,quantity,unit_price,line_total)
 select v_id,product_id,variant_id,sku,product_name,quantity,unit_price,line_total from public.order_items where order_id=p_order_id;
 return v_id;
end$$;
grant execute on function public.create_sales_invoice_from_order(uuid,text) to authenticated;
