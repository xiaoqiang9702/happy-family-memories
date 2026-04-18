import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import tripsData from '../data/trips.json'
import PhotoGallery from './PhotoGallery'
import VideoPlayer from './VideoPlayer'
import TripReactions from './TripReactions'

export default function TripDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = tripsData.trips.find((t) => t.id === id)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-warm-50 px-6">
        <div className="text-6xl mb-4">😕</div>
        <p className="text-xl text-warm-700 mb-6">没有找到这次旅行</p>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-4 bg-warm-500 text-white text-xl rounded-2xl font-bold"
        >
          返回首页
        </button>
      </div>
    )
  }

  const dateStr = new Date(trip.date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-warm-50 pb-28">
      {/* header */}
      <header className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-lg px-4 py-2 rounded-xl bg-warm-100 active:bg-warm-200 text-warm-700 font-medium min-h-[48px] transition-colors"
          >
            ← 返回
          </button>
          <h1 className="text-xl font-bold text-warm-800 truncate flex-1">
            {trip.title}
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* cover with overlay text */}
        <div className="rounded-3xl overflow-hidden mb-6 bg-warm-100 aspect-[16/10] relative animate-detail-in">
          <img
            src={trip.cover}
            alt={trip.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.parentElement!.classList.add('img-placeholder')
              target.parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-5xl">📷</div>`
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-5">
            <h2 className="text-2xl font-bold text-white mb-1 drop-shadow-md">{trip.title}</h2>
            <p className="text-base text-white/90">{dateStr}</p>
          </div>
        </div>

        {/* description */}
        <div className="mb-4 bg-white rounded-2xl p-5 shadow-sm animate-detail-in" style={{ animationDelay: '0.1s' }}>
          <p className="text-lg text-gray-700 leading-relaxed">{trip.description}</p>
        </div>

        {/* reactions */}
        <div className="mb-6 animate-detail-in" style={{ animationDelay: '0.15s' }}>
          <TripReactions tripId={trip.id} />
        </div>

        {/* photos */}
        {trip.photos.length > 0 && (
          <div className="mb-8 animate-detail-in" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-xl font-bold text-warm-700 mb-4 flex items-center gap-2">
              📸 照片 <span className="text-base text-warm-500 font-normal">({trip.photos.length}张，点击可放大)</span>
            </h3>
            <PhotoGallery photos={trip.photos} />
          </div>
        )}

        {/* videos */}
        {trip.videos.length > 0 && (
          <div className="mb-8 animate-detail-in" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-xl font-bold text-warm-700 mb-4 flex items-center gap-2">
              🎬 视频 <span className="text-base text-warm-500 font-normal">({trip.videos.length}个)</span>
            </h3>
            <VideoPlayer videos={trip.videos} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes detailIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-detail-in { animation: detailIn 0.4s ease-out both; }
      `}</style>
    </div>
  )
}
