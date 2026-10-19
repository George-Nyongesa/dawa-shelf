import { useState } from 'react'
import { sellable, useBatches, useProducts } from '../features/stock/hooks'
import { daysLeft, fmtDate, lifeClass } from '../lib/format'

export default function ShelfPage() {
  const products = useProducts()
  const batches = useBatches()
  const [q, setQ] = useState('')

  if (products.isLoading || batches.isLoading) return <p className="mu">Loading...</p>
  if (products.error || batches.error) return <div className="note bad">Could not load stock.</div>

  const bs = batches.data ?? []
  const list = (products.data ?? []).filter(p => p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <h1>Shelf</h1>
      <p className="mu">Open a product to see each batch and its remaining shelf life.</p>
      <input type="search" placeholder="Search products" aria-label="Search products"
             value={q} onChange={e => setQ(e.target.value)} />

      {list.length === 0 && <div className="empty">No product matches.</div>}
      {list.map(p => {
        const s = sellable(bs, p.id)
        const mine = bs.filter(b => b.product_id === p.id)
        return (
          <details className="card" key={p.id}>
            <summary>
              <span><b>{p.name}</b><span className="mu"> Reorder at {p.reorder_level}</span></span>
              <span className={`pill ${s <= p.reorder_level ? 'r' : 'g'}`}>{s} {p.base_unit}s</span>
            </summary>
            {mine.length === 0 && <p className="mu">No stock. Receive a delivery to add batches.</p>}
            {mine.map(b => {
              const d = daysLeft(b.expiry_date)
              const pct = d < 0 ? 100 : Math.max(5, Math.min(100, (d / 365) * 100))
              return (
                <div className="batch" key={b.id}>
                  <div><b>{b.batch_no}</b><div className="mu">{d < 0 ? 'Expired' : 'Expires'} {fmtDate(b.expiry_date)}</div></div>
                  <b>{b.qty_on_hand}</b>
                  <div className="bar"><i className={d < 0 ? 'r' : lifeClass(d)} style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </details>
        )
      })}
    </>
  )
}
