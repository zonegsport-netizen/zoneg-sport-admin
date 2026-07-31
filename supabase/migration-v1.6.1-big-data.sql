-- ZoneG Sport ERP v1.6.1 — tối ưu dữ liệu lớn
-- Chạy sau migration-v1.6.sql.

create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists products_sku_lower_idx on public.products(lower(sku));
create index if not exists products_name_lower_idx on public.products(lower(name));
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_brand_idx on public.products(brand_id);
create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists product_variants_sku_lower_idx on public.product_variants(lower(sku));
create index if not exists stock_transactions_created_idx on public.stock_transactions(created_at desc);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists purchase_receipts_created_idx on public.purchase_receipts(created_at desc);

-- Nhập hàng loạt sản phẩm và biến thể trong một transaction.
create or replace function public.bulk_import_catalog(
  p_products jsonb,
  p_variants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_product_id uuid;
  v_product_count integer := 0;
  v_variant_count integer := 0;
  v_initial_stock integer;
  v_variant public.product_variants;
begin
  if public.current_app_role() not in ('owner','manager') then
    raise exception 'Bạn không có quyền nhập dữ liệu hàng loạt';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_products, '[]'::jsonb))
  loop
    insert into public.products(
      sku, name, category, brand, price, cost, stock, min_stock, status, updated_at
    )
    values(
      trim(item->>'sku'),
      trim(item->>'name'),
      nullif(trim(item->>'category'),''),
      nullif(trim(item->>'brand'),''),
      coalesce((item->>'price')::numeric,0),
      coalesce((item->>'cost')::numeric,0),
      0,
      coalesce((item->>'min_stock')::integer,0),
      coalesce(nullif(item->>'status',''),'active'),
      now()
    )
    on conflict (sku) do update set
      name = excluded.name,
      category = excluded.category,
      brand = excluded.brand,
      price = excluded.price,
      cost = excluded.cost,
      min_stock = excluded.min_stock,
      status = excluded.status,
      updated_at = now();

    v_product_count := v_product_count + 1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb))
  loop
    select id into v_product_id
    from public.products
    where sku = trim(item->>'product_sku');

    if v_product_id is null then
      raise exception 'Không tìm thấy sản phẩm cha: %', item->>'product_sku';
    end if;

    v_initial_stock := coalesce((item->>'initial_stock')::integer,0);

    insert into public.product_variants(
      product_id, sku, color, size, barcode, price, cost,
      stock, min_stock, status, updated_at
    )
    values(
      v_product_id,
      trim(item->>'sku'),
      nullif(trim(item->>'color'),''),
      nullif(trim(item->>'size'),''),
      nullif(trim(item->>'barcode'),''),
      nullif(item->>'price','')::numeric,
      nullif(item->>'cost','')::numeric,
      0,
      coalesce((item->>'min_stock')::integer,0),
      coalesce(nullif(item->>'status',''),'active'),
      now()
    )
    on conflict (sku) do update set
      product_id = excluded.product_id,
      color = excluded.color,
      size = excluded.size,
      barcode = excluded.barcode,
      price = excluded.price,
      cost = excluded.cost,
      min_stock = excluded.min_stock,
      status = excluded.status,
      updated_at = now()
    returning * into v_variant;

    if v_initial_stock > 0 and v_variant.stock = 0 then
      update public.product_variants
      set stock = v_initial_stock
      where id = v_variant.id
      returning * into v_variant;

      insert into public.stock_transactions(
        product_id, variant_id, type, quantity, balance_after,
        reference_code, note, created_by
      )
      values(
        v_product_id, v_variant.id, 'in', v_initial_stock, v_initial_stock,
        'IMPORT-' || to_char(now(),'YYYYMMDD-HH24MISS'),
        'Nhập tồn đầu kỳ từ Excel',
        auth.uid()
      );
    end if;

    v_variant_count := v_variant_count + 1;
  end loop;

  update public.products p
  set stock = coalesce((
    select sum(v.stock)::integer
    from public.product_variants v
    where v.product_id = p.id and v.status = 'active'
  ),0),
  updated_at = now();

  return jsonb_build_object(
    'products_processed', v_product_count,
    'variants_processed', v_variant_count
  );
end;
$$;

grant execute on function public.bulk_import_catalog(jsonb,jsonb) to authenticated;
