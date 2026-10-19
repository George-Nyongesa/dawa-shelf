import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'

export default function TodayPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session!.user.id

  const me = useQuery({
    queryKey: ['me', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('full_name, role').eq('id', userId).single()
      if (error) throw error
      return data
    },
  })

  const pharmacy = useQuery({
    queryKey: ['pharmacy'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pharmacies').select('name').single()
      if (error) throw error
      return data
    },
  })

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products').select('id, name, base_unit, reorder_level').order('name')
      if (error) throw error
      return data
    },
  })

  async function signOut() {
    await supabase.auth.signOut()
    queryClient.clear() // forget the previous user's data
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>{pharmacy.data?.name ?? 'Dawa Shelf'}</h1>
      <p>
        {me.data ? `${me.data.full_name}, ${me.data.role}` : 'Loading profile...'}{' '}
        <button onClick={signOut}>Sign out</button>
      </p>

      <h2>Products</h2>
      {products.isLoading && <p>Loading...</p>}
      {products.error && <p style={{ color: 'crimson' }}>{products.error.message}</p>}
      <ul>
        {products.data?.map(p => (
          <li key={p.id}>{p.name} ({p.base_unit}), reorder at {p.reorder_level}</li>
        ))}
      </ul>
    </main>
  )
}