-- =====================================================================
-- Dawa Shelf: core schema
-- Run in Supabase: SQL Editor > New query > paste > Run
-- =====================================================================

-- ---------- 1. Enumerated types ---------------------------------------
-- An enum limits a column to a fixed set of values, so typos like
-- 'dispenced' are rejected by the database itself.
create type user_role as enum ('owner', 'pharmacist', 'attendant');

create type movement_type as enum (
  'received',    -- stock arrives from a supplier
  'dispensed',   -- stock leaves through a sale or dispense
  'adjusted',    -- manual correction after a stock count
  'expired',     -- written off because it passed its expiry date
  'returned'     -- returned to the supplier or by a customer
);

-- ---------- 2. Pharmacies (the tenant) ---------------------------------
-- Every other table points here, so one database can serve many pharmacies.
create table pharmacies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- 3. Profiles (extends Supabase's built-in auth.users) -------
-- Supabase stores logins in auth.users. We keep our own data beside it.
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  pharmacy_id  uuid not null references pharmacies (id),
  full_name    text not null,
  role         user_role not null default 'attendant',
  created_at   timestamptz not null default now()
);
create index profiles_pharmacy_idx on profiles (pharmacy_id);

-- ---------- 4. Products -------------------------------------------------
-- Quantities are always counted in the smallest unit (e.g. tablets).
-- pack_size lets the UI convert, e.g. 1 box = 100 tablets.
create table products (
  id             uuid primary key default gen_random_uuid(),
  pharmacy_id    uuid not null references pharmacies (id),
  name           text not null,
  base_unit      text not null default 'tablet',
  pack_size      integer not null default 1 check (pack_size > 0),
  reorder_level  integer not null default 0 check (reorder_level >= 0),
  barcode        text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (pharmacy_id, name)
);
-- A barcode must be unique inside one pharmacy, but many products may have none.
create unique index products_barcode_uq
  on products (pharmacy_id, barcode) where barcode is not null;

-- ---------- 5. Batches --------------------------------------------------
-- The same drug arrives in several batches with different expiry dates.
-- qty_on_hand is a fast-to-read balance. The ledger below is the proof.
create table batches (
  id            uuid primary key default gen_random_uuid(),
  pharmacy_id   uuid not null references pharmacies (id),
  product_id    uuid not null references products (id),
  batch_no      text not null,
  expiry_date   date not null,
  qty_on_hand   integer not null default 0 check (qty_on_hand >= 0),
  created_at    timestamptz not null default now(),
  unique (product_id, batch_no)
);
-- Partial index: only batches that still have stock, ordered for FEFO.
-- This is exactly the lookup the dispense function will run most often.
create index batches_fefo_idx
  on batches (product_id, expiry_date) where qty_on_hand > 0;

-- ---------- 6. Stock movements (the append-only ledger) ----------------
-- Every change to stock is a new row. Positive qty_change adds stock,
-- negative removes it. Rows are never edited or deleted.
create table stock_movements (
  id               uuid primary key default gen_random_uuid(),
  pharmacy_id      uuid not null references pharmacies (id),
  product_id       uuid not null references products (id),
  batch_id         uuid not null references batches (id),
  type             movement_type not null,
  qty_change       integer not null check (qty_change <> 0),
  reason           text,
  idempotency_key  text,
  created_by       uuid references auth.users (id),
  created_at       timestamptz not null default now(),
  -- sign must match the type: receiving adds, dispensing and expiring remove
  check (
    (type = 'received'  and qty_change > 0) or
    (type in ('dispensed', 'expired') and qty_change < 0) or
    (type in ('adjusted', 'returned'))
  )
);
-- If the same request is sent twice (bad network), the second insert fails
-- instead of recording a double sale.
-- Unique per batch, because one dispense can touch several batches and
-- therefore creates several ledger rows that share one key.
create unique index movements_idem_uq
  on stock_movements (pharmacy_id, idempotency_key, batch_id) where idempotency_key is not null;
create index movements_batch_idx   on stock_movements (batch_id);
create index movements_product_idx on stock_movements (product_id, created_at desc);

-- Enforce "append-only" in the database, not just in app code.
create function forbid_ledger_changes() returns trigger
language plpgsql as $$
begin
  raise exception 'stock_movements is append-only: record a new movement instead';
end;
$$;

create trigger stock_movements_no_update_delete
  before update or delete on stock_movements
  for each row execute function forbid_ledger_changes();

-- ---------- 7. Reconciliation view -------------------------------------
-- Lists any batch whose stored balance disagrees with its ledger.
-- A healthy system returns zero rows.
create view batch_ledger_check with (security_invoker = true) as
select b.id as batch_id,
       b.batch_no,
       b.qty_on_hand,
       coalesce(sum(m.qty_change), 0)::integer as ledger_qty
from batches b
left join stock_movements m on m.batch_id = b.id
group by b.id, b.batch_no, b.qty_on_hand
having b.qty_on_hand <> coalesce(sum(m.qty_change), 0);

-- ---------- 8. Row Level Security: locked by default -------------------
-- With RLS on and no policies, nobody can read or write through the API.
-- The next lesson adds policies that allow users to see only their own pharmacy.
alter table pharmacies       enable row level security;
alter table profiles         enable row level security;
alter table products         enable row level security;
alter table batches          enable row level security;
alter table stock_movements  enable row level security;
