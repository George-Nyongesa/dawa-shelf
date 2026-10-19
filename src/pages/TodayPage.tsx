import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sellable, useBatches, useProducts } from '../features/stock/hooks'
import { daysLeft, fmtDate, lifeClass } from '../lib/format'

export default function TodayPage() {
  const pharmacy = useQuery({
    queryKey: ['pharmacy'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pharmacies').select('name').single()
      if (error) throw error
      return data as { name: string }
    },
  })
  const products = useProducts()
  const batches = useBatches()

  if (products.isLoading || batches.isLoading) return <p className="mu">Loading...</p>
  if (products.error || batches.error) return <div className="note bad">Could not load stock.</div>

  const ps = products.data ?? []
  const bs = batches.data ?? []
  const nameOf = (id: string) => ps.find(p => p.id === id)?.name ?? 'Unknown product'
  const expired = bs.filter(b => daysLeft(b.expiry_date) < 0)
  const soon = bs.filter(b => { const d = daysLeft(b.expiry_date); return d >= 0 && d <= 90 })
  const low = ps.filter(p => sellable(bs, p.id) <= p.reorder_level)

  return (
    <>
      <h1>{pharmacy.data?.name ?? 'Today'}</h1>
      <p className="mu">{new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      <div className="kpis">
        <div className="card"><b>{ps.length}</b><span className="mu">Products</span></div>
        <div className="card"><b>{low.length}</b><span className="mu">To reorder</span></div>
        <div className="card"><b>{soon.length}</b><span className="mu">Expiring in 90 days</span></div>
        <div className="card"><b>{expired.length}</b><span className="mu">Expired batches</span></div>
      </div>

      <h2>Take off the shelf</h2>
      {expired.length === 0 && <div className="empty">Nothing expired.</div>}
      {expired.map(b => (
        <div className="row r" key={b.id}>
          <div><b>{nameOf(b.product_id)}</b><div className="mu">Batch {b.batch_no}, {b.qty_on_hand} units</div></div>
          <span className="pill r">Expired {fmtDate(b.expiry_date)}</span>
        </div>
      ))}

      <h2>Sell these first</h2>
      {soon.length === 0 && <div className="empty">Nothing close to expiry.</div>}
      {soon.map(b => {
        const d = daysLeft(b.expiry_date)
        return (
          <div className={`row ${lifeClass(d)}`} key={b.id}>
            <div><b>{nameOf(b.product_id)}</b><div className="mu">Batch {b.batch_no}, {b.qty_on_hand} units</div></div>
            <span className={`pill ${lifeClass(d)}`}>{d} days left</span>
          </div>
        )
      })}

      <h2>Time to reorder</h2>
      {low.length === 0 && <div className="empty">Everything is above its reorder level.</div>}
      {low.map(p => (
        <div className="row r" key={p.id}>
          <div><b>{p.name}</b><div className="mu">Reorder level {p.reorder_level}</div></div>
          <span className="pill r">{sellable(bs, p.id)} left</span>
        </div>
      ))}
    </>
  )
}
