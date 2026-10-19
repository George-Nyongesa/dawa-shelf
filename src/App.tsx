import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './features/auth/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TodayPage from './pages/TodayPage'
import ShelfPage from './pages/ShelfPage'
import DispensePage from './pages/DispensePage'
import ReceivePage from './pages/ReceivePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<TodayPage />} />
          <Route path="/shelf" element={<ShelfPage />} />
          <Route path="/dispense" element={<DispensePage />} />
          <Route path="/receive" element={<ReceivePage />} />
        </Route>
      </Route>
    </Routes>
  )
}
