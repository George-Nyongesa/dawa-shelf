-- =====================================================================
-- Dawa Shelf: security (privileges + Row Level Security)
-- Run in Supabase: SQL Editor > New query > paste > Run
-- =====================================================================

-- ---------- 1. Undo the temporary test grant from earlier --------------
-- Logged-out visitors (role "anon") should have no access to pharmacy data.
revoke select on public.products from anon;

-- ---------- 2. Helper functions in a PRIVATE schema --------------------
-- Policies need to ask "which pharmacy does this user belong to?".
-- That answer lives in the profiles table, which is itself protected by RLS.
-- SECURITY DEFINER lets the function read it without triggering a loop.
-- The private schema keeps these functions off the public API.
create schema if not exists private;

create or replace function private.current_pharmacy_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select pharmacy_id from public.profiles where id = (select auth.uid());
$$;

create or replace function private.my_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- Postgres lets everyone execute new functions by default. Lock that down.
revoke all on function private.current_pharmacy_id() from public, anon;
revoke all on function private.my_role()             from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_pharmacy_id() to authenticated;
grant execute on function private.my_role()             to authenticated;

-- ---------- 3. Privileges for logged-in users (layer 1) ----------------
-- Read access everywhere. Direct writes only on products.
-- Batches and stock_movements get NO direct writes: stock changes will go
-- through receive_stock() and dispense_stock() in Lesson 3.
grant select on public.pharmacies, public.profiles, public.products,
               public.batches, public.stock_movements, public.batch_ledger_check
      to authenticated;
grant insert, update on public.products to authenticated;

-- ---------- 4. Row Level Security policies (layer 2) -------------------
-- "(select ...)" wrapping makes Postgres evaluate the function once per
-- query instead of once per row, which is much faster.

create policy "members read own pharmacy" on public.pharmacies
  for select to authenticated
  using (id = (select private.current_pharmacy_id()));

create policy "members read colleagues" on public.profiles
  for select to authenticated
  using (pharmacy_id = (select private.current_pharmacy_id()));

create policy "members read products" on public.products
  for select to authenticated
  using (pharmacy_id = (select private.current_pharmacy_id()));

create policy "managers add products" on public.products
  for insert to authenticated
  with check (
    pharmacy_id = (select private.current_pharmacy_id())
    and (select private.my_role()) in ('owner', 'pharmacist')
  );

create policy "managers edit products" on public.products
  for update to authenticated
  using (
    pharmacy_id = (select private.current_pharmacy_id())
    and (select private.my_role()) in ('owner', 'pharmacist')
  )
  with check (pharmacy_id = (select private.current_pharmacy_id()));

create policy "members read batches" on public.batches
  for select to authenticated
  using (pharmacy_id = (select private.current_pharmacy_id()));

create policy "members read movements" on public.stock_movements
  for select to authenticated
  using (pharmacy_id = (select private.current_pharmacy_id()));
