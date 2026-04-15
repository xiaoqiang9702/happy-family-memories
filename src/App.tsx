import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import PasswordGate from './components/PasswordGate'
import TripTimeline from './components/TripTimeline'
import TripDetail from './components/TripDetail'
import AdminPage from './components/AdminPage'
import BottomNav from './components/BottomNav'
import PageTransition from './components/PageTransition'

export default function App() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()
  const isAdmin = location.pathname === '/admin'

  // admin page has its own auth
  if (isAdmin) {
    return <AdminPage />
  }

  if (!isAuthenticated) {
    return <PasswordGate onLogin={login} />
  }

  return (
    <>
      <PageTransition>
        <Routes>
          <Route path="/" element={<TripTimeline />} />
          <Route path="/trip/:id" element={<TripDetail />} />
        </Routes>
      </PageTransition>
      <BottomNav />
    </>
  )
}
