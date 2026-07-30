-- ZoneG Sport ERP v1.2 migration
-- Chạy một lần trong Supabase SQL Editor.

create extension if not exists "pgcrypto";

alter table public.products
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

alter table public.product_variants
  add column if not exists price numeric(14,2),
  add column if not exists cost numeric(14,2),
  add column if not exists barcode text,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists product_variants_barcode_unique
  on public.product_variants(barcode)
  where barcode is not null and barcode <> '';

alter table public.stock_transactions
  add column if not exists balance_after integer,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create or replace function public.adjust_variant_stock(
  p_variant_id uuid,
  p_type text,
  p_quantity integer,
  p_reference_code text default null,
  p_note text default null
)
returns public.product_variants
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_variant public.product_variants;
  v_product_id uuid;
  v_delta integer;
  v_new_stock integer;
begin
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

  if not found then
    raise exception 'Không tìm thấy biến thể';
  end if;

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
  )
  values(
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

grant execute on function public.adjust_variant_stock(uuid,text,integer,text,text) to authenticated;

-- Bảo đảm RLS/policy cho các bảng dùng trong v1.2
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.product_variants enable row level security;
alter table public.stock_transactions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','brands','product_variants','stock_transactions']
  loop
    execute format('drop policy if exists authenticated_all on public.%I', t);
    execute format(
      'create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- Bật Realtime nếu bảng chưa nằm trong publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='product_variants'
  ) then
    alter publication supabase_realtime add table public.product_variants;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='stock_transactions'
  ) then
    alter publication supabase_realtime add table public.stock_transactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='categories'
  ) then
    alter publication supabase_realtime add table public.categories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='brands'
  ) then
    alter publication supabase_realtime add table public.brands;
  end if;
end $$;
