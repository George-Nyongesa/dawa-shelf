import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dispenseStock, type Allocation } from '../features/stock/api'
import { previewFefo, sellable, useBatches, useProducts } from '../features/stock/hooks'
import { errMsg, newKey } from '../lib/format'

export default function DispensePage() {
  const queryClient = useQueryClient()
  const products = useProducts()
  const batches = useBatches()

  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [key, setKey] = useState(newKey)
  const [done, setDone] = useState<Allocation[] | null>(null)

  const pid = productId || products.data?.[0]?.id || ''
  const n = Number(qty)
  const valid = pid !== '' && Number.isInteger(n) && n > 0
  const bs = batches.data ?? []
  const available = sellable(bs, pid)
  const preview = valid ? previewFefo(bs, pid, n) : null

  const mutation = useMutation({
    mutationFn: () => dispenseStock({ productId: pid, qty: n, key }),
    onSuccess: rows => {
      setDone(rows)
      setKey(newKey()) // the next sale is a new intention, so it gets a new key
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
  })

  // Changing the form means a new intention: new key, clear old messages.
  function edit(change: () => void) {
    change()
    setKey(newKey())
    setDone(null)
    mutation.reset()
  }

  return (
    <>
      <h1>Dispense</h1>
      <p className="mu">Stock is taken from the batch that expires first. Expired batches are skipped.</p>

      <form className="panel" onSubmit={e => { e.preventDefault(); if (valid) mutation.mutate() }}>
        <label htmlFor="product">Product</label>
        <select id="product" value={pid} onChange={e => edit(() => setProductId(e.target.value))}>
          {products.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label htmlFor="qty">Quantity</label>
        <input id="qty" type="number" inputMode="numeric" min={1} value={qty}
               onChange={e => edit(() => setQty(e.target.value))} />

        <p className="mu">
          {available} units available.{' '}
          {preview && preview.short === 0 && `Will take ${preview.take.map(t => `${t.qty} from ${t.batch_no}`).join(', ')}.`}
          {preview && preview.short > 0 && 'Not enough valid stock for this quantity.'}
        </p>

        <button className="btn" disabled={!valid || mutation.isPending}>
          {mutation.isPending ? 'Dispensing...' : 'Confirm dispense'}
        </button>

        {mutation.error && <div className="note bad">{errMsg(mutation.error)}</div>}
        {done && <div className="note">Dispensed {done.map(r => `${r.out_qty} from batch ${r.out_batch_no}`).join(' and ')}.</div>}
      </form>
    </>
  )
}
