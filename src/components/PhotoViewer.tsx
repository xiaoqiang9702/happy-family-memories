import { useState, useRef, useEffect, useCallback } from 'react'

interface Photo {
  src: string
  caption: string
}

interface Props {
  photos: Photo[]
  initialIndex: number
  onClose: () => void
}

export default function PhotoViewer({ photos, initialIndex, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [loaded, setLoaded] = useState(false)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const thumbStripRef = useRef<HTMLDivElement>(null)

  const photo = photos[currentIndex]

  const goPrev = useCallback(() => {
    setLoaded(false)
    setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1))
  }, [photos.length])

  const goNext = useCallback(() => {
    setLoaded(false)
    setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0))
  }, [photos.length])

  // keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, goPrev, goNext])

  // prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // scroll thumbnail into view
  useEffect(() => {
    if (thumbStripRef.current) {
      const activeThumb = thumbStripRef.current.children[currentIndex] as HTMLElement
      activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [currentIndex])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <button
          onClick={onClose}
          className="text-xl px-4 py-2 rounded-xl bg-white/10 active:bg-white/20 min-h-[48px]"
        >
          ← 返回
        </button>
        <span className="text-lg">
          {currentIndex + 1} / {photos.length}
        </span>
      </div>

      {/* photo */}
      <div className="flex-1 flex items-center justify-center px-2 overflow-hidden relative">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <img
          src={photo.src}
          alt={photo.caption}
          className={`max-w-full max-h-full object-contain select-none transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = ''
            target.alt = '图片加载失败'
            setLoaded(true)
            target.parentElement!.innerHTML = `<div class="text-white text-xl text-center">📷<br/>图片加载失败</div>`
          }}
        />
      </div>

      {/* caption */}
      {photo.caption && (
        <div className="text-center text-white text-lg py-3 px-4 bg-black/50 shrink-0">
          {photo.caption}
        </div>
      )}

      {/* thumbnail strip */}
      {photos.length > 1 && (
        <div
          ref={thumbStripRef}
          className="flex gap-2 px-4 py-3 overflow-x-auto hide-scrollbar shrink-0 justify-center"
        >
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => { setLoaded(false); setCurrentIndex(i) }}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all p-0 ${
                i === currentIndex
                  ? 'border-white scale-110'
                  : 'border-white/30 opacity-60'
              }`}
            >
              <img src={p.src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* nav buttons (desktop) */}
      {photos.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-2xl"
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-2xl"
          >
            ›
          </button>
        </>
      )}

      {/* swipe hint for mobile */}
      <div className="md:hidden text-center text-white/50 text-sm pb-3 shrink-0">
        ← 左右滑动切换照片 →
      </div>
    </div>
  )
}
