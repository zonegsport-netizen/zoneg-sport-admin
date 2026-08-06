-- ZoneG Sport ERP v1.8 - xác thực nhân viên và nhật ký hoạt động

alter table public.profiles add column if not exists last_login timestamptz;
alter table public.profiles add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.activity_logs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 actor_name text,
 action text not null,
 entity_type text,
 entity_id uuid,
 description text,
 created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_actor_idx on public.activity_logs(actor_id);
alter table public.activity_logs enable row level security;
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select to authenticated using (public.current_app_role() in ('owner','manager'));
drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs for insert to authenticated with check (actor_id=auth.uid());

-- Đồng bộ email nội bộ từ auth.users sang profiles để chủ cửa hàng dễ kiểm tra.
update public.profiles p set email=u.email from auth.users u where p.id=u.id and p.email is distinct from u.email;
