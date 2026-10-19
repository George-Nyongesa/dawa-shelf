import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { receiveStock } from '../features/stock/api'
import { useProducts } from '../features/stock/hooks'
import { errMsg, newKey } from '../lib/format'

export default function ReceivePage() {
  const queryClient = useQueryClient()
  const products = useProducts()

  const [productId, setProductId] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [expiry, setExpiry] = useState('')
  const [qty, setQty] = useState('')
  const [key, setKey] = useState(newKey)
  const [saved, setSaved] = useState(false)

  const pid = productId || products.data?.[0]?.id || ''
  const n = Number(qty)
  const valid = pid !== '' && batchNo.trim() !== '' && expiry !== '' && Number.isInteger(n) && n > 0

  const mutation = useMutation({
    mutationFn: () => receiveStock({ productId: pid, batchNo: batchNo.trim(), expiryDate: expiry, qty: n, key }),
    onSuccess: () => {
      setSaved(true)
      setBatchNo(''); setExpiry(''); setQty('')
      setKey(newKey())
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
  })

  function edit(change: () => void) {
    change()
    setKey(newKey())
    setSaved(false)
    mutation.reset()
  }

  return (
    <>
      <h1>Receive stock</h1>
      <p className="mu">Record every delivery by batch so expiry dates are never lost.</p>

      <form className="panel" onSubmit={e => { e.preventDefault(); if (valid) mutation.mutate() }}>
        <label htmlFor="product">Product</label>
        <select id="product" value={pid} onChange={e => edit(() => setProductId(e.target.value))}>
          {products.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label htmlFor="batch">Batch number</label>
        <input id="batch" value={batchNo} placeholder="From the pack label"
               onChange={e => edit(() => setBatchNo(e.target.value))} />

        <label htmlFor="expiry">Expiry date</label>
        <input id="expiry" type="date" value={expiry} onChange={e => edit(() => setExpiry(e.target.value))} />

        <label htmlFor="qty">Quantity received</label>
        <input id="qty" type="number" inputMode="numeric" min={1} value={qty}
               onChange={e => edit(() => setQty(e.target.value))} />

        <button className="btn" disabled={!valid || mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save delivery'}
        </button>

        {mutation.error && <div className="note bad">{errMsg(mutation.error)}</div>}
        {saved && <div className="note">Delivery saved.</div>}
      </form>
    </>
  )
}
