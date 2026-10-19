import { NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const links = [
  ['/', 'Today'],
  ['/shelf', 'Shelf'],
  ['/dispense', 'Dispense'],
  ['/receive', 'Receive'],
] as const

export default function Layout() {
  const queryClient = useQueryClient()

  async function signOut() {
    await supabase.auth.signOut()
    queryClient.clear() // forget this user's cached data
  }

  return (
    <>
      <nav className="nav">
        <div className="brand">Dawa Shelf</div>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
            {label}
          </NavLink>
        ))}
        <button className="link" onClick={signOut}>Sign out</button>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  )
}
