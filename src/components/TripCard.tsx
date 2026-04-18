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
      className="group block bg-white rounded-3xl shadow-soft hover:shadow-warm overflow-hidden active:scale-[0.98] transition-all duration-300 no-underline"
    >
      <div className="relative aspect-[16/10] bg-warm-100 overflow-hidden">
        <img
          src={trip.cover}
          alt={trip.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            target.parentElement!.classList.add('img-placeholder')
            target.parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-4xl">📷</div>`
          }}
        />
        {/* gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
        {/* photo/video count badge */}
        <div className="absolute top-3 right-3 flex gap-2">
          {trip.photos.length > 0 && (
            <span className="bg-black/40 text-white text-sm px-2.5 py-1 rounded-full backdrop-blur-md font-medium">
              📷 {trip.photos.length}
            </span>
          )}
          {trip.videos.length > 0 && (
            <span className="bg-black/40 text-white text-sm px-2.5 py-1 rounded-full backdrop-blur-md font-medium">
              🎬 {trip.videos.length}
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-bold text-warm-800 mb-1 group-hover:text-warm-600 transition-colors">
          {trip.title}
        </h3>
        <p className="text-sm text-warm-500 mb-3 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-warm-400"></span>
          {dateStr}
        </p>
        <p className="text-base text-gray-600 line-clamp-2 leading-relaxed">{trip.description}</p>
        <div className="mt-4 text-warm-500 text-base font-medium flex items-center gap-1 pt-3 border-t border-warm-100">
          <span>查看详情</span>
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  )
}
