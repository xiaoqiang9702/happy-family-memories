import { useNavigate } from 'react-router-dom'
import { useAppData } from '../hooks/useAppData'

export default function AllVideos() {
  const navigate = useNavigate()
  const { trips } = useAppData()

  const allVideos = trips.flatMap((trip) =>
    trip.videos.map((v) => ({
      src: v.src,
      title: `${trip.title} · ${v.title}`,
      tripId: trip.id,
    }))
  )

  return (
    <div className="min-h-screen bg-warm-50 pb-nav">
      <header
        className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
          >
            ← 返回
          </button>
          <h1 className="text-xl font-bold text-warm-800 flex-1">
            🎬 所有视频 <span className="text-base font-normal text-warm-500">({allVideos.length})</span>
          </h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {allVideos.length === 0 ? (
          <div className="text-center py-20 text-warm-500 text-xl">
            还没有视频 🎬
          </div>
        ) : (
          allVideos.map((video, index) => (
            <div key={index} className="rounded-2xl overflow-hidden bg-black shadow-soft">
              <video
                src={video.src}
                controls
                playsInline
                preload="metadata"
                className="w-full"
              />
              <div className="bg-white px-4 py-3 text-base text-warm-700 font-medium">
                🎬 {video.title}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
