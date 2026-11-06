
-- =====================================
-- DUDSHOP777 DATABASE
-- =====================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text not null default 'member'
    check (role in ('member','admin')),
  points integer not null default 0
    check (points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  price_points integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.key_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  duration text not null default 'ถาวร',
  key_value text not null unique,
  used boolean not null default false,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  product_id uuid references public.products(id),
  product_name text not null,
  duration text not null,
  key_value text not null,
  price_points integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount integer not null,
  transaction_type text not null
    check (transaction_type in ('topup','purchase','adjustment')),
  status text not null default 'approved'
    check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- Create profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username',
             split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin checker
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.key_inventory enable row level security;
alter table public.generated_keys enable row level security;
alter table public.credit_transactions enable row level security;

-- Profiles
drop policy if exists "profiles read own or admin"
on public.profiles;

create policy "profiles read own or admin"
on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

-- Products
drop policy if exists "products read active"
on public.products;

create policy "products read active"
on public.products
for select to authenticated
using (active or public.is_admin());

drop policy if exists "products admin manage"
on public.products;

create policy "products admin manage"
on public.products
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Inventory
drop policy if exists "inventory admin manage"
on public.key_inventory;

create policy "inventory admin manage"
on public.key_inventory
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Generated keys
drop policy if exists "generated keys read own or admin"
on public.generated_keys;

create policy "generated keys read own or admin"
on public.generated_keys
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Transactions
drop policy if exists "transactions read own or admin"
on public.credit_transactions;

create policy "transactions read own or admin"
on public.credit_transactions
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Generate product keys
create or replace function public.generate_product_keys(
  p_product_id uuid,
  p_quantity integer,
  p_duration text
)
returns setof public.generated_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_total integer;
  v_available integer;
begin
  if v_user is null then
    raise exception 'กรุณาเข้าสู่ระบบ';
  end if;

  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'จำนวนต้องอยู่ระหว่าง 1 ถึง 20';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and active = true;

  if not found then
    raise exception 'ไม่พบสินค้า';
  end if;

  v_total := v_product.price_points * p_quantity;

  perform 1 from public.profiles
  where id = v_user for update;

  if (select points from public.profiles where id = v_user) < v_total then
    raise exception 'เครดิตไม่เพียงพอ';
  end if;

  select count(*) into v_available
  from public.key_inventory
  where product_id = p_product_id
    and duration = p_duration
    and used = false;

  if v_available < p_quantity then
    raise exception 'สต็อกไม่เพียงพอ';
  end if;

  update public.profiles
  set points = points - v_total
  where id = v_user;

  return query
  with picked as (
    select id, key_value
    from public.key_inventory
    where product_id = p_product_id
      and duration = p_duration
      and used = false
    order by created_at
    limit p_quantity
    for update skip locked
  ),
  marked as (
    update public.key_inventory k
    set used = true,
        used_by = v_user,
        used_at = now()
    from picked p
    where k.id = p.id
    returning k.key_value
  ),
  inserted as (
    insert into public.generated_keys (
      user_id, product_id, product_name,
      duration, key_value, price_points
    )
    select
      v_user, p_product_id, v_product.name,
      p_duration, m.key_value, v_product.price_points
    from marked m
    returning *
  )
  select * from inserted;

  insert into public.credit_transactions(
    user_id, amount, transaction_type, status
  )
  values (v_user, -v_total, 'purchase', 'approved');
end;
$$;

revoke all on function
public.generate_product_keys(uuid, integer, text)
from public;

grant execute on function
public.generate_product_keys(uuid, integer, text)
to authenticated;
