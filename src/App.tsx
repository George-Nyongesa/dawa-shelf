import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [status, setStatus] = useState('Checking connection...')

  useEffect(() => {
    supabase
      .from('products')
      .select('id')
      .limit(1)
      .then(({ data, error, status }) => {
        console.log({ data, error, status })
        if (error) {
          setStatus(
            `Error (HTTP ${status}) | code: ${error.code} | message: ${error.message} | hint: ${error.hint}`
          )
        } else {
          setStatus(`Connected. Rows visible to me: ${data.length}`)
        }
      })
  }, [])

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Dawa Shelf</h1>
      <p>{status}</p>
    </main>
  )
}