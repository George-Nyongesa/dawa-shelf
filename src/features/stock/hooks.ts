import { useQuery } from '@tanstack/react-query'
import { fetchBatches, fetchProducts, type Batch } from './api'
import { daysLeft } from '../../lib/format'

export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: fetchProducts })
export const useBatches = () => useQuery({ queryKey: ['batches'], queryFn: fetchBatches })

/** Units that can legally be sold: not expired. */
export function sellable(batches: Batch[], productId: string): number {
  return batches
    .filter(b => b.product_id === productId && daysLeft(b.expiry_date) >= 0)
    .reduce((sum, b) => sum + b.qty_on_hand, 0)
}

/** Client-side FEFO preview. The database does the real allocation. */
export function previewFefo(batches: Batch[], productId: string, qty: number) {
  let remaining = qty
  const take: { batch_no: string; qty: number }[] = []
  const valid = batches
    .filter(b => b.product_id === productId && daysLeft(b.expiry_date) >= 0)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
  for (const b of valid) {
    if (remaining <= 0) break
    const t = Math.min(b.qty_on_hand, remaining)
    take.push({ batch_no: b.batch_no, qty: t })
    remaining -= t
  }
  return { take, short: remaining }
}
