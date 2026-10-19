-- =====================================================================
-- Manual tests for receive_stock and dispense_stock
-- Before running: replace YOUR_EMAIL (everywhere) with your owner login email.
-- The product is looked up by name: 'Paracetamol 500mg tablets'.
-- Run each numbered block SEPARATELY in the Supabase SQL Editor.
-- TEST 1: receive two batches (expect two batch ids back)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'YOUR_EMAIL'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select public.receive_stock((select id from public.products where name = 'Paracetamol 500mg tablets'), 'PCM-A', current_date + 30,  100, 'test-recv-1');
select public.receive_stock((select id from public.products where name = 'Paracetamol 500mg tablets'), 'PCM-B', current_date + 200, 300, 'test-recv-2');
commit;

-- TEST 2: dispense 150 (expect 100 from PCM-A, then 50 from PCM-B)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'YOUR_EMAIL'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.dispense_stock((select id from public.products where name = 'Paracetamol 500mg tablets'), 150, 'test-sale-1');
commit;

-- TEST 3: replay the SAME request (expect identical output, stock unchanged)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'YOUR_EMAIL'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.dispense_stock((select id from public.products where name = 'Paracetamol 500mg tablets'), 150, 'test-sale-1');
commit;

-- TEST 4: try to oversell (expect error "Insufficient stock" and NO change)
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'YOUR_EMAIL'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.dispense_stock((select id from public.products where name = 'Paracetamol 500mg tablets'), 99999, 'test-sale-oversell');
rollback;

-- TEST 5: reconciliation (run with no impersonation)
-- Expect ZERO rows. Any row means a balance disagrees with the ledger.
select * from batch_ledger_check;

-- TEST 6: look at the ledger and balances
select b.batch_no, b.expiry_date, b.qty_on_hand from batches b order by b.expiry_date;
select type, qty_change, idempotency_key, created_at
  from stock_movements order by created_at;

-- TEST 7: concurrency. Needs TWO SQL Editor tabs.
-- First check how much valid stock is left (should be 250 after tests 1-3).
-- Tab 1: paste and run this, then IMMEDIATELY switch to Tab 2.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'YOUR_EMAIL'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.dispense_stock((select id from public.products where name = 'Paracetamol 500mg tablets'), 200, 'race-1');
select pg_sleep(15);   -- holds the row locks for 15 seconds
commit;

-- Tab 2: run this within those 15 seconds. It will WAIT, then fail with
-- "Insufficient stock: short by 150 units" because only 50 are left.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'YOUR_EMAIL'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.dispense_stock((select id from public.products where name = 'Paracetamol 500mg tablets'), 200, 'race-2');
rollback;
