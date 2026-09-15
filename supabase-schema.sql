-- Careerlyst production starting schema (review before deployment)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  starting_price numeric(10,2),
  active boolean default true,
  created_at timestamptz default now()
);
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','information_required','queued','in_progress','internal_review','client_review','revision','completed','cancelled')),
  total numeric(10,2),
  queue_position integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade,
  service_id uuid references public.services(id),
  price numeric(10,2)
);
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade,
  sender_id uuid references auth.users(id),
  body text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);
create table if not exists public.files (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  created_at timestamptz default now()
);
create table if not exists public.payments (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  provider text,
  provider_payment_id text,
  amount numeric(10,2),
  status text,
  created_at timestamptz default now()
);
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check(role in ('client','admin','expert','support','finance'))
);

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.messages enable row level security;
alter table public.files enable row level security;
alter table public.payments enable row level security;
alter table public.user_roles enable row level security;

-- Client policies should be completed alongside your final RBAC design.
-- Critical: never expose a service_role key in the browser.
