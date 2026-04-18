import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAppData } from '../hooks/useAppData'
import PhotoViewer from './PhotoViewer'

export default function AllPhotos() {
  const navigate = useNavigate()
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const { trips } = useAppData()

  const allPhotos = trips.flatMap((trip) =>
    trip.photos.map((p) => ({
      src: p.src,
      caption: `${trip.title} · ${p.caption}`,
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
            📸 所有照片 <span className="text-base font-normal text-warm-500">({allPhotos.length})</span>
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        {allPhotos.length === 0 ? (
          <div className="text-center py-20 text-warm-500 text-xl">
            还没有照片 📷
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {allPhotos.map((photo, index) => (
              <button
                key={index}
                onClick={() => setViewerIndex(index)}
                className="relative aspect-square rounded-xl overflow-hidden bg-warm-100 active:scale-[0.97] transition-transform border-0 p-0"
              >
                <img
                  src={photo.src}
                  alt={photo.caption}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={allPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}
