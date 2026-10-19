import { supabase } from '../../lib/supabase'

export type Product = { id: string; name: string; base_unit: string; reorder_level: number }
export type Batch = { id: string; product_id: string; batch_no: string; expiry_date: string; qty_on_hand: number }
export type Allocation = { out_batch_id: string; out_batch_no: string; out_qty: number }

// Reads go straight to the tables. Row Level Security filters them to our pharmacy.
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, base_unit, reorder_level')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function fetchBatches(): Promise<Batch[]> {
  const { data, error } = await supabase
    .from('batches')
    .select('id, product_id, batch_no, expiry_date, qty_on_hand')
    .gt('qty_on_hand', 0)
    .order('expiry_date')
  if (error) throw error
  return data
}

// Writes NEVER touch the tables. They call the database functions from Lesson 3.
export async function receiveStock(a: {
  productId: string; batchNo: string; expiryDate: string; qty: number; key: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('receive_stock', {
    p_product_id: a.productId,
    p_batch_no: a.batchNo,
    p_expiry_date: a.expiryDate,
    p_qty: a.qty,
    p_idempotency_key: a.key,
  })
  if (error) throw error
  return data as string
}

export async function dispenseStock(a: {
  productId: string; qty: number; key: string
}): Promise<Allocation[]> {
  const { data, error } = await supabase.rpc('dispense_stock', {
    p_product_id: a.productId,
    p_qty: a.qty,
    p_idempotency_key: a.key,
  })
  if (error) throw error
  return (data ?? []) as Allocation[]
}
