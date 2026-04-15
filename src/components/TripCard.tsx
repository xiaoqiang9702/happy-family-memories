import { Link } from 'react-router-dom'

interface Trip {
  id: string
  title: string
  date: string
  cover: string
  description: string
  photos: { src: string; caption: string }[]
  videos: { src: string; title: string }[]
}

export default function TripCard({ trip }: { trip: Trip }) {
  const dateStr = new Date(trip.date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Link
      to={`/trip/${trip.id}`}
      className="block bg-white rounded-3xl shadow-md hover:shadow-lg overflow-hidden active:scale-[0.98] transition-all duration-200 no-underline"
    >
      <div className="relative aspect-[16/10] bg-warm-100 overflow-hidden">
        <img
          src={trip.cover}
          alt={trip.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            target.parentElement!.classList.add('img-placeholder')
            target.parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-4xl">📷</div>`
          }}
        />
        {/* photo/video count badge */}
        <div className="absolute top-3 right-3 flex gap-2">
          {trip.photos.length > 0 && (
            <span className="bg-black/50 text-white text-sm px-2.5 py-1 rounded-full backdrop-blur-sm">
              📷 {trip.photos.length}
            </span>
          )}
          {trip.videos.length > 0 && (
            <span className="bg-black/50 text-white text-sm px-2.5 py-1 rounded-full backdrop-blur-sm">
              🎬 {trip.videos.length}
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-bold text-warm-800 mb-1">{trip.title}</h3>
        <p className="text-base text-warm-500 mb-2">{dateStr}</p>
        <p className="text-base text-gray-600 line-clamp-2">{trip.description}</p>
        <div className="mt-3 text-warm-500 text-base font-medium flex items-center gap-1">
          点击查看详情
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  )
}
