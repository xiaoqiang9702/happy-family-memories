import { useState, useCallback } from 'react'
import tripsData from '../data/trips.json'
import PhotoViewer from './PhotoViewer'

interface MemoryPhoto {
  src: string
  caption: string
}

export default function RandomMemory() {
  const [showViewer, setShowViewer] = useState(false)
  const [randomPhotos, setRandomPhotos] = useState<MemoryPhoto[]>([])
  const [animating, setAnimating] = useState(false)

  const allPhotos = tripsData.trips.flatMap((trip) =>
    trip.photos.map((p) => ({
      src: p.src,
      caption: `${trip.title} · ${p.caption}`,
    }))
  )

  const showRandom = useCallback(() => {
    if (allPhotos.length === 0) return
    setAnimating(true)
    setTimeout(() => {
      const shuffled = [...allPhotos].sort(() => Math.random() - 0.5)
      setRandomPhotos(shuffled)
      setShowViewer(true)
      setAnimating(false)
    }, 400)
  }, [allPhotos])

  if (allPhotos.length === 0) return null

  return (
    <>
      <button
        onClick={showRandom}
        className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[60px] text-gray-400 active:text-warm-500 transition-colors ${animating ? 'animate-pulse' : ''}`}
      >
        <span className="text-2xl">🎲</span>
        <span className="text-sm mt-0.5">随机回忆</span>
      </button>

      {showViewer && randomPhotos.length > 0 && (
        <PhotoViewer
          photos={randomPhotos}
          initialIndex={0}
          onClose={() => setShowViewer(false)}
        />
      )}
    </>
  )
}
