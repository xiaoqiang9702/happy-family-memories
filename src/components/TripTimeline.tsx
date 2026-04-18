import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TripCard from './TripCard'
import tripsData from '../data/trips.json'

export default function TripTimeline() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const allTrips = tripsData.trips

  const trips = useMemo(() => {
    if (!search.trim()) return allTrips
    const q = search.trim().toLowerCase()
    return allTrips.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.date.includes(q) ||
        String(t.year).includes(q)
    )
  }, [search, allTrips])

  const tripsByYear = trips.reduce<Record<number, typeof trips>>((acc, trip) => {
    if (!acc[trip.year]) acc[trip.year] = []
    acc[trip.year].push(trip)
    return acc
  }, {})

  const years = Object.keys(tripsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  const totalPhotos = allTrips.reduce((sum, t) => sum + t.photos.length, 0)
  const totalVideos = allTrips.reduce((sum, t) => sum + t.videos.length, 0)

  return (
    <div className="min-h-screen bg-warm-50 pb-nav">
      {/* header */}
      <header className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-5 py-4">
        <h1 className="text-2xl font-bold text-warm-800 text-center">
          🏠 快乐一家人
        </h1>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* stats summary */}
        <div className="bg-gradient-to-br from-warm-100 via-warm-50 to-white rounded-3xl p-6 mb-5 border border-warm-200 shadow-soft">
          <p className="text-center text-lg text-warm-700 mb-4">
            每一次旅行，都是一段美好的回忆 ✨
          </p>
          <div className="flex justify-center gap-2">
            <div className="flex-1 text-center py-2">
              <div className="text-3xl font-bold text-warm-600">{allTrips.length}</div>
              <div className="text-sm text-warm-500 mt-1">次旅行</div>
            </div>
            <button
              onClick={() => navigate('/photos')}
              className="flex-1 text-center py-2 rounded-2xl active:bg-warm-100 transition-colors min-h-[72px]"
            >
              <div className="text-3xl font-bold text-warm-600">{totalPhotos}</div>
              <div className="text-sm text-warm-500 mt-1">张照片 →</div>
            </button>
            <button
              onClick={() => navigate('/videos')}
              className="flex-1 text-center py-2 rounded-2xl active:bg-warm-100 transition-colors min-h-[72px]"
            >
              <div className="text-3xl font-bold text-warm-600">{totalVideos}</div>
              <div className="text-sm text-warm-500 mt-1">个视频 →</div>
            </button>
          </div>
        </div>

        {/* search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 搜索旅行（如：三亚、2024）"
            className="w-full text-lg px-5 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none transition-colors"
          />
        </div>

        {years.map((year) => (
          <div key={year} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-warm-200" />
              <span className="text-xl font-bold text-warm-500">{year}年</span>
              <div className="h-px flex-1 bg-warm-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {tripsByYear[year]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((trip, index) => (
                  <div
                    key={trip.id}
                    className="animate-card-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <TripCard trip={trip} />
                  </div>
                ))}
            </div>
          </div>
        ))}

        {trips.length === 0 && search && (
          <div className="text-center py-16 text-warm-500 text-xl">
            没有找到「{search}」相关的旅行 😅
            <br />
            <button
              onClick={() => setSearch('')}
              className="text-warm-600 text-lg mt-3 underline"
            >
              清除搜索
            </button>
          </div>
        )}

        {allTrips.length === 0 && (
          <div className="text-center py-20 text-warm-500 text-xl">
            还没有旅行记录哦 📷
            <br />
            <span className="text-base mt-2 block">快去添加第一次旅行吧！</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-card-in { animation: cardIn 0.4s ease-out both; }
      `}</style>
    </div>
  )
}
