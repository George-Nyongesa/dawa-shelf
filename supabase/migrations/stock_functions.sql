-- =====================================================================
-- Dawa Shelf: stock functions
-- receive_stock()  adds a delivery to a batch
-- dispense_stock() removes stock using FEFO (first expired, first out)
-- Run in Supabase: SQL Editor > New query > paste > Run
-- =====================================================================

-- ---------- 0. Fix found while designing: idempotency key scope --------
-- One dispense can touch several batches, so one request creates several
-- ledger rows that share the same key. The key must be unique per batch.
drop index if exists public.movements_idem_uq;
create unique index movements_idem_uq
  on public.stock_movements (pharmacy_id, idempotency_key, batch_id)
  where idempotency_key is not null;

-- ---------- 1. receive_stock -------------------------------------------
-- Who: owner or pharmacist. Returns the id of the batch that was topped up.
create or replace function public.receive_stock(
  p_product_id       uuid,
  p_batch_no         text,
  p_expiry_date      date,
  p_qty              integer,
  p_idempotency_key  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pharmacy  uuid := private.current_pharmacy_id();
  v_role      public.user_role := private.my_role();
  v_today     date := (now() at time zone 'Africa/Nairobi')::date;
  v_batch_no  text := btrim(coalesce(p_batch_no, ''));
  v_batch_id  uuid;
  v_exp       date;
begin
  -- 1. Who is calling, and are they allowed?
  if v_pharmacy is null then
    raise exception 'Not a member of any pharmacy' using errcode = '42501';
  end if;
  if v_role not in ('owner', 'pharmacist') then
    raise exception 'Only owners and pharmacists can receive stock' using errcode = '42501';
  end if;

  -- 2. Validate the input
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero' using errcode = '22023';
  end if;
  if v_batch_no = '' then
    raise exception 'Batch number is required' using errcode = '22023';
  end if;
  if p_expiry_date is null or p_expiry_date < v_today then
    raise exception 'Cannot receive stock that is already expired' using errcode = '22023';
  end if;
  perform 1 from public.products
   where id = p_product_id and pharmacy_id = v_pharmacy and is_active;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  -- 3. Idempotency: if this request was already processed, do nothing new
  if p_idempotency_key is not null then
    select m.batch_id into v_batch_id
      from public.stock_movements m
     where m.pharmacy_id = v_pharmacy and m.idempotency_key = p_idempotency_key
     limit 1;
    if found then
      return v_batch_id;
    end if;
  end if;

  -- 4. Create the batch if it is new, then lock its row
  insert into public.batches (pharmacy_id, product_id, batch_no, expiry_date)
  values (v_pharmacy, p_product_id, v_batch_no, p_expiry_date)
  on conflict (product_id, batch_no) do nothing;

  select b.id, b.expiry_date into v_batch_id, v_exp
    from public.batches b
   where b.product_id = p_product_id and b.batch_no = v_batch_no
     for update;

  if v_exp <> p_expiry_date then
    raise exception 'Batch % already exists with expiry date %', v_batch_no, v_exp
      using errcode = '22023';
  end if;

  -- 5. Update the balance AND write the ledger row, in one transaction
  update public.batches set qty_on_hand = qty_on_hand + p_qty where id = v_batch_id;

  insert into public.stock_movements
    (pharmacy_id, product_id, batch_id, type, qty_change, idempotency_key, created_by)
  values
    (v_pharmacy, p_product_id, v_batch_id, 'received', p_qty, p_idempotency_key, (select auth.uid()));

  return v_batch_id;
end;
$$;

-- ---------- 2. dispense_stock ------------------------------------------
-- Who: any member. Takes stock from the earliest-expiring valid batches.
-- Returns one row per batch used. Raises an error (and changes nothing)
-- if there is not enough unexpired stock.
drop function if exists public.dispense_stock(uuid, integer, text, text);
create or replace function public.dispense_stock(
  p_product_id       uuid,
  p_qty              integer,
  p_idempotency_key  text default null,
  p_reason           text default null
)
returns table (out_batch_id uuid, out_batch_no text, out_qty integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pharmacy   uuid := private.current_pharmacy_id();
  v_today      date := (now() at time zone 'Africa/Nairobi')::date;
  v_remaining  integer := p_qty;
  v_take       integer;
  v_b          record;
begin
  if v_pharmacy is null then
    raise exception 'Not a member of any pharmacy' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero' using errcode = '22023';
  end if;
  perform 1 from public.products where id = p_product_id and pharmacy_id = v_pharmacy;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  -- Idempotent replay: return what the first request did, change nothing
  if p_idempotency_key is not null and exists (
       select 1 from public.stock_movements m
        where m.pharmacy_id = v_pharmacy and m.idempotency_key = p_idempotency_key) then
    return query
      select m.batch_id, b.batch_no, (-m.qty_change)::integer
        from public.stock_movements m
        join public.batches b on b.id = m.batch_id
       where m.pharmacy_id = v_pharmacy and m.idempotency_key = p_idempotency_key
       order by b.expiry_date;
    return;
  end if;

  -- FEFO allocation. FOR UPDATE locks each batch row until this transaction
  -- ends, so a second simultaneous sale waits instead of overselling.
  for v_b in
    select b.id, b.batch_no, b.qty_on_hand
      from public.batches b
     where b.pharmacy_id = v_pharmacy
       and b.product_id  = p_product_id
       and b.qty_on_hand > 0
       and b.expiry_date >= v_today
     order by b.expiry_date, b.created_at
       for update
  loop
    exit when v_remaining = 0;
    v_take := least(v_b.qty_on_hand, v_remaining);

    update public.batches set qty_on_hand = qty_on_hand - v_take where id = v_b.id;

    insert into public.stock_movements
      (pharmacy_id, product_id, batch_id, type, qty_change, reason, idempotency_key, created_by)
    values
      (v_pharmacy, p_product_id, v_b.id, 'dispensed', -v_take, p_reason,
       p_idempotency_key, (select auth.uid()));

    v_remaining := v_remaining - v_take;
    out_batch_id := v_b.id;
    out_batch_no := v_b.batch_no;
    out_qty      := v_take;
    return next;
  end loop;

  -- Not enough stock: raising an error rolls back every update above.
  if v_remaining > 0 then
    raise exception 'Insufficient stock: short by % units', v_remaining using errcode = 'P0001';
  end if;
end;
$$;

-- ---------- 3. Who may call them ---------------------------------------
revoke all on function public.receive_stock(uuid, text, date, integer, text)  from public, anon;
revoke all on function public.dispense_stock(uuid, integer, text, text)       from public, anon;
grant execute on function public.receive_stock(uuid, text, date, integer, text)  to authenticated;
grant execute on function public.dispense_stock(uuid, integer, text, text)       to authenticated;
