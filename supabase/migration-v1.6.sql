-- ZoneG Sport ERP v1.6
-- Chạy sau schema.sql, migration-v1.2.sql và migration-v1.2.1-permissions.sql.

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists must_change_password boolean not null default true;
alter table public.profiles add column if not exists last_sign_in_at timestamptz;

alter table public.orders add column if not exists paid_amount numeric(14,2) not null default 0;
alter table public.orders add column if not exists balance_due numeric(14,2) not null default 0;
alter table public.orders add column if not exists created_by uuid references auth.users(id);
alter table public.orders add column if not exists confirmed_at timestamptz;
alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id);
alter table public.order_items add column if not exists cost numeric(14,2) not null default 0;

create table if not exists public.purchase_receipts(
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 supplier_id uuid references public.suppliers(id),
 supplier_name text,
 subtotal numeric(14,2) not null default 0,
 total numeric(14,2) not null default 0,
 paid_amount numeric(14,2) not null default 0,
 balance_due numeric(14,2) not null default 0,
 status text not null default 'received',
 note text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.purchase_receipt_items(
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid not null references public.purchase_receipts(id) on delete cascade,
 variant_id uuid not null references public.product_variants(id),
 sku text,
 product_name text,
 quantity integer not null,
 unit_cost numeric(14,2) not null,
 line_total numeric(14,2) not null
);
create table if not exists public.supplier_payments(
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid references public.purchase_receipts(id),
 supplier_id uuid references public.suppliers(id),
 amount numeric(14,2) not null,
 method text not null default 'transfer',
 note text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;
alter table public.supplier_payments enable row level security;

drop policy if exists purchase_access on public.purchase_receipts;
create policy purchase_access on public.purchase_receipts for select to authenticated using(public.current_app_role() in('owner','manager','warehouse'));
drop policy if exists purchase_item_access on public.purchase_receipt_items;
create policy purchase_item_access on public.purchase_receipt_items for select to authenticated using(public.current_app_role() in('owner','manager','warehouse'));
drop policy if exists supplier_payment_access on public.supplier_payments;
create policy supplier_payment_access on public.supplier_payments for select to authenticated using(public.current_app_role() in('owner','manager'));

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
  insert into order_items(order_id,product_id,variant_id,sku,product_name,quantity,unit_price,cost,line_total)
  values(v_id,prod.id,v.id,v.sku,prod.name,(it->>'quantity')::int,coalesce(v.price,prod.price),coalesce(v.cost,prod.cost),(it->>'quantity')::int*coalesce(v.price,prod.price));
  insert into stock_transactions(product_id,variant_id,type,quantity,balance_after,reference_code,created_by)
  values(prod.id,v.id,'out',-(it->>'quantity')::int,v.stock-(it->>'quantity')::int,v_code,auth.uid());
  v_sub:=v_sub+(it->>'quantity')::int*coalesce(v.price,prod.price);
 end loop;
 v_total:=v_sub-coalesce(p_discount,0)+coalesce(p_shipping_fee,0);
 update orders set subtotal=v_sub,discount=coalesce(p_discount,0),shipping_fee=coalesce(p_shipping_fee,0),total=v_total,balance_due=v_total,confirmed_at=now() where id=v_id;
 return v_id;
end$$;

create or replace function public.record_order_payment(p_order_id uuid,p_amount numeric,p_method text,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 if public.current_app_role() not in('owner','manager','sales') then raise exception 'Không có quyền';end if;
 select * into o from orders where id=p_order_id for update;
 if p_amount<=0 or p_amount>o.balance_due then raise exception 'Số tiền không hợp lệ';end if;
 insert into payments(order_id,amount,method,note,created_by) values(p_order_id,p_amount,p_method,p_note,auth.uid());
 update orders set paid_amount=paid_amount+p_amount,balance_due=balance_due-p_amount,status=case when balance_due-p_amount=0 then 'completed' else status end where id=p_order_id;
end$$;

create or replace function public.create_and_receive_purchase(p_supplier_id uuid,p_paid_amount numeric,p_items jsonb,p_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid();v_code text:='PN-'||to_char(now(),'YYYYMMDD-HH24MISS');v_total numeric:=0;it jsonb;v product_variants;prod products;s suppliers;
begin
 if public.current_app_role() not in('owner','manager','warehouse') then raise exception 'Không có quyền';end if;
 select * into s from suppliers where id=p_supplier_id;
 insert into purchase_receipts(id,code,supplier_id,supplier_name,status,note,created_by) values(v_id,v_code,p_supplier_id,s.name,'received',p_note,auth.uid());
 for it in select * from jsonb_array_elements(p_items) loop
  select * into v from product_variants where id=(it->>'variant_id')::uuid for update;
  select * into prod from products where id=v.product_id;
  update product_variants set stock=stock+(it->>'quantity')::int,cost=(it->>'unit_cost')::numeric where id=v.id;
  insert into purchase_receipt_items(receipt_id,variant_id,sku,product_name,quantity,unit_cost,line_total)
  values(v_id,v.id,v.sku,prod.name,(it->>'quantity')::int,(it->>'unit_cost')::numeric,(it->>'quantity')::int*(it->>'unit_cost')::numeric);
  insert into stock_transactions(product_id,variant_id,type,quantity,balance_after,reference_code,created_by)
  values(prod.id,v.id,'in',(it->>'quantity')::int,v.stock+(it->>'quantity')::int,v_code,auth.uid());
  v_total:=v_total+(it->>'quantity')::int*(it->>'unit_cost')::numeric;
 end loop;
 if p_paid_amount>v_total then raise exception 'Tiền trả vượt tổng phiếu';end if;
 update purchase_receipts set subtotal=v_total,total=v_total,paid_amount=p_paid_amount,balance_due=v_total-p_paid_amount where id=v_id;
 if p_paid_amount>0 then insert into supplier_payments(receipt_id,supplier_id,amount,created_by) values(v_id,p_supplier_id,p_paid_amount,auth.uid());end if;
 return v_id;
end$$;

grant execute on function public.create_and_confirm_order(uuid,text,numeric,numeric,jsonb) to authenticated;
grant execute on function public.record_order_payment(uuid,numeric,text,text) to authenticated;
grant execute on function public.create_and_receive_purchase(uuid,numeric,jsonb,text) to authenticated;
