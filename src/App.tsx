import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import PasswordGate from './components/PasswordGate'
import TripTimeline from './components/TripTimeline'
import TripDetail from './components/TripDetail'
import AllPhotos from './components/AllPhotos'
import AllVideos from './components/AllVideos'
import HealthManagement from './components/HealthManagement'
import HealthMember from './components/HealthMember'
import NewsWeather from './components/NewsWeather'
import AdminPage from './components/AdminPage'
import BottomNav from './components/BottomNav'
import PageTransition from './components/PageTransition'

export default function App() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()
  const isAdmin = location.pathname === '/admin'

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
          <Route path="/photos" element={<AllPhotos />} />
          <Route path="/videos" element={<AllVideos />} />
          <Route path="/health" element={<HealthManagement />} />
          <Route path="/health/:id" element={<HealthMember />} />
          <Route path="/news" element={<NewsWeather />} />
        </Routes>
      </PageTransition>
      <BottomNav />
    </>
  )
}
