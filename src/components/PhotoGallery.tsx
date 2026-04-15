import { useState } from 'react'
import PhotoViewer from './PhotoViewer'

interface Photo {
  src: string
  caption: string
}

function PhotoThumb({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-2xl overflow-hidden bg-warm-100 active:scale-[0.97] transition-transform border-0 p-0 cursor-pointer"
    >
      {!loaded && <div className="absolute inset-0 img-placeholder" />}
      <img
        src={photo.src}
        alt={photo.caption}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          setLoaded(true)
          target.parentElement!.querySelector('.img-placeholder')?.remove()
          const placeholder = document.createElement('div')
          placeholder.className = 'flex items-center justify-center h-full text-3xl'
          placeholder.textContent = '📷'
          target.parentElement!.appendChild(placeholder)
        }}
      />
      {photo.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
          <span className="text-white text-sm">{photo.caption}</span>
        </div>
      )}
    </button>
  )
}

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((photo, index) => (
          <PhotoThumb
            key={index}
            photo={photo}
            onClick={() => setViewerIndex(index)}
          />
        ))}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  )
}
