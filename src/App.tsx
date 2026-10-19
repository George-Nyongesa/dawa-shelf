import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import TodayPage from './pages/TodayPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<TodayPage />} />
      </Route>
    </Routes>
  )
}