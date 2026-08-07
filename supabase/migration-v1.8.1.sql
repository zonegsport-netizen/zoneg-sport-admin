-- ZoneG Sport ERP v1.8.1
-- Chạy sau migration-v1.8.sql và migration-v1.7-invoices.sql.

create table if not exists public.colors(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.sizes(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 sort_order integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.customer_groups(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
insert into public.colors(name) values ('Đen'),('Trắng'),('Đỏ'),('Xanh dương'),('Xanh lá'),('Vàng'),('Cam'),('Hồng'),('Tím'),('Xám') on conflict(name) do nothing;
insert into public.sizes(name,sort_order) values ('XS',10),('S',20),('M',30),('L',40),('XL',50),('2XL',60),('3XL',70),('Free size',80) on conflict(name) do nothing;
insert into public.customer_groups(name) values ('Khách lẻ'),('Khách sỉ'),('Cộng tác viên'),('Khách VIP'),('Đội bóng / CLB'),('Trường học') on conflict(name) do nothing;

alter table public.colors enable row level security;
alter table public.sizes enable row level security;
alter table public.customer_groups enable row level security;
do $$ declare t text; begin
 foreach t in array array['colors','sizes','customer_groups'] loop
  execute format('drop policy if exists app_select on public.%I',t);
  execute format('create policy app_select on public.%I for select to authenticated using(public.is_active_user())',t);
  execute format('drop policy if exists app_insert_manager on public.%I',t);
  execute format('create policy app_insert_manager on public.%I for insert to authenticated with check(public.current_app_role() in (''owner'',''manager''))',t);
  execute format('drop policy if exists app_update_manager on public.%I',t);
  execute format('create policy app_update_manager on public.%I for update to authenticated using(public.current_app_role() in (''owner'',''manager'')) with check(public.current_app_role() in (''owner'',''manager''))',t);
  execute format('drop policy if exists app_delete_owner on public.%I',t);
  execute format('create policy app_delete_owner on public.%I for delete to authenticated using(public.current_app_role()=''owner'')',t);
 end loop;
end $$;

create sequence if not exists public.zoneg_product_code_seq start 1001;
create sequence if not exists public.zoneg_variant_code_seq start 1001;
create sequence if not exists public.zoneg_customer_code_seq start 1001;

select setval('public.zoneg_product_code_seq', greatest(1000,coalesce((select max(substring(sku from '[0-9]+$')::bigint) from public.products where sku ~ '^SP[0-9]+$'),1000)), true);
select setval('public.zoneg_variant_code_seq', greatest(1000,coalesce((select max(substring(sku from '[0-9]+$')::bigint) from public.product_variants where sku ~ '^BT[0-9]+$'),1000)), true);
select setval('public.zoneg_customer_code_seq', greatest(1000,coalesce((select max(substring(code from '[0-9]+$')::bigint) from public.customers where code ~ '^KH[0-9]+$'),1000)), true);

create or replace function public.zoneg_auto_product_code() returns trigger language plpgsql as $$ begin
 if new.sku is null or btrim(new.sku)='' then new.sku:='SP'||lpad(nextval('public.zoneg_product_code_seq')::text,6,'0'); end if; return new; end $$;
drop trigger if exists trg_zoneg_auto_product_code on public.products;
create trigger trg_zoneg_auto_product_code before insert on public.products for each row execute function public.zoneg_auto_product_code();

create or replace function public.zoneg_auto_variant_code() returns trigger language plpgsql as $$ begin
 if new.sku is null or btrim(new.sku)='' then new.sku:='BT'||lpad(nextval('public.zoneg_variant_code_seq')::text,6,'0'); end if; return new; end $$;
drop trigger if exists trg_zoneg_auto_variant_code on public.product_variants;
create trigger trg_zoneg_auto_variant_code before insert on public.product_variants for each row execute function public.zoneg_auto_variant_code();

create or replace function public.zoneg_auto_customer_code() returns trigger language plpgsql as $$ begin
 if new.code is null or btrim(new.code)='' then new.code:='KH'||lpad(nextval('public.zoneg_customer_code_seq')::text,6,'0'); end if; return new; end $$;
drop trigger if exists trg_zoneg_auto_customer_code on public.customers;
create trigger trg_zoneg_auto_customer_code before insert on public.customers for each row execute function public.zoneg_auto_customer_code();

alter table public.order_items add column if not exists color text;
alter table public.order_items add column if not exists size text;
alter table public.sales_invoice_items add column if not exists color text;
alter table public.sales_invoice_items add column if not exists size text;

create or replace function public.create_and_confirm_order(
 p_customer_id uuid,p_customer_name text,p_discount numeric,p_shipping_fee numeric,p_items jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid();v_code text:='DH-'||to_char(now(),'YYYYMMDD-HH24MISS');v_sub numeric:=0;v_total numeric;it jsonb;v product_variants;prod products;
begin
 if public.current_app_role() not in('owner','manager','sales') then raise exception 'Không có quyền tạo đơn';end if;
 insert into orders(id,code,customer_id,customer_name,status,created_by) values(v_id,v_code,p_customer_id,p_customer_name,'confirmed',auth.uid());
 for it in select * from jsonb_array_elements(p_items) loop
  select * into v from product_variants where id=(it->>'variant_id')::uuid for update;
  if v.stock < (it->>'quantity')::int then raise exception 'Không đủ tồn cho SKU %',v.sku;end if;
  select * into prod from products where id=v.product_id;
  update product_variants set stock=stock-(it->>'quantity')::int where id=v.id;
  insert into order_items(order_id,product_id,variant_id,sku,product_name,color,size,quantity,unit_price,cost,line_total)
  values(v_id,prod.id,v.id,v.sku,prod.name,v.color,v.size,(it->>'quantity')::int,coalesce(v.price,prod.price),coalesce(v.cost,prod.cost),(it->>'quantity')::int*coalesce(v.price,prod.price));
  insert into stock_transactions(product_id,variant_id,type,quantity,balance_after,reference_code,created_by)
  values(prod.id,v.id,'out',-(it->>'quantity')::int,v.stock-(it->>'quantity')::int,v_code,auth.uid());
  update products set stock=coalesce((select sum(stock)::int from product_variants where product_id=prod.id and status='active'),0),updated_at=now() where id=prod.id;
  v_sub:=v_sub+(it->>'quantity')::int*coalesce(v.price,prod.price);
 end loop;
 v_total:=v_sub-coalesce(p_discount,0)+coalesce(p_shipping_fee,0);
 update orders set subtotal=v_sub,discount=coalesce(p_discount,0),shipping_fee=coalesce(p_shipping_fee,0),total=v_total,balance_due=v_total,confirmed_at=now() where id=v_id;
 if p_customer_id is not null then update customers set debt=coalesce(debt,0)+v_total where id=p_customer_id; end if;
 return v_id;
end$$;
grant execute on function public.create_and_confirm_order(uuid,text,numeric,numeric,jsonb) to authenticated;

create or replace function public.create_sales_invoice_from_order(p_order_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_invoice_id uuid:=gen_random_uuid();v_invoice_number text;v_order public.orders;v_customer public.customers;
begin
 if public.current_app_role() not in ('owner','manager','sales') then raise exception 'Bạn không có quyền lập hóa đơn';end if;
 if exists(select 1 from public.sales_invoices where order_id=p_order_id) then raise exception 'Đơn hàng này đã có hóa đơn';end if;
 select * into v_order from public.orders where id=p_order_id;if not found then raise exception 'Không tìm thấy đơn hàng';end if;
 if v_order.customer_id is not null then select * into v_customer from public.customers where id=v_order.customer_id; end if;
 v_invoice_number:='HD-'||to_char(now(),'YYYYMMDD-HH24MISS');
 insert into public.sales_invoices(id,invoice_number,order_id,customer_name,customer_phone,customer_address,subtotal,discount,shipping_fee,total,paid_amount,balance_due,note,created_by)
 values(v_invoice_id,v_invoice_number,p_order_id,v_order.customer_name,v_customer.phone,v_customer.address,coalesce(v_order.subtotal,0),coalesce(v_order.discount,0),coalesce(v_order.shipping_fee,0),coalesce(v_order.total,0),coalesce(v_order.paid_amount,0),coalesce(v_order.balance_due,0),nullif(trim(p_note),''),auth.uid());
 insert into public.sales_invoice_items(invoice_id,product_id,variant_id,sku,product_name,color,size,quantity,unit_price,line_total)
 select v_invoice_id,oi.product_id,oi.variant_id,oi.sku,oi.product_name,oi.color,oi.size,oi.quantity,oi.unit_price,oi.line_total from public.order_items oi where oi.order_id=p_order_id;
 return v_invoice_id;
end$$;
grant execute on function public.create_sales_invoice_from_order(uuid,text) to authenticated;


create or replace function public.record_order_payment(p_order_id uuid,p_amount numeric,p_method text,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 if public.current_app_role() not in('owner','manager','sales') then raise exception 'Không có quyền';end if;
 select * into o from orders where id=p_order_id for update;
 if not found then raise exception 'Không tìm thấy đơn hàng'; end if;
 if p_amount<=0 or p_amount>o.balance_due then raise exception 'Số tiền không hợp lệ';end if;
 insert into payments(order_id,amount,method,note,created_by) values(p_order_id,p_amount,p_method,p_note,auth.uid());
 update orders set paid_amount=paid_amount+p_amount,balance_due=balance_due-p_amount,status=case when balance_due-p_amount=0 then 'completed' else status end where id=p_order_id;
 if o.customer_id is not null then update customers set debt=greatest(0,coalesce(debt,0)-p_amount) where id=o.customer_id; end if;
end$$;
grant execute on function public.record_order_payment(uuid,numeric,text,text) to authenticated;
