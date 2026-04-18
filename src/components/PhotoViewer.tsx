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
  const [zoomed, setZoomed] = useState(false)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const thumbStripRef = useRef<HTMLDivElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const photo = photos[currentIndex]

  const goPrev = useCallback(() => {
    setLoaded(false)
    setZoomed(false)
    setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1))
  }, [photos.length])

  const goNext = useCallback(() => {
    setLoaded(false)
    setZoomed(false)
    setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0))
  }, [photos.length])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, goPrev, goNext])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (thumbStripRef.current) {
      const activeThumb = thumbStripRef.current.children[currentIndex] as HTMLElement
      activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [currentIndex])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (zoomed) return
    touchEndX.current = e.changedTouches[0].clientX
    const diffX = touchStartX.current - touchEndX.current
    const diffY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(diffX) > 50 && diffY < 80) {
      if (diffX > 0) goNext()
      else goPrev()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <button
          onClick={onClose}
          className="text-lg px-4 py-2 rounded-xl bg-white/15 active:bg-white/25 min-h-[48px] backdrop-blur-sm"
        >
          ← 返回
        </button>
        <span className="text-lg font-medium">
          {currentIndex + 1} / {photos.length}
        </span>
        <button
          onClick={() => setZoomed(!zoomed)}
          className="text-lg px-4 py-2 rounded-xl bg-white/15 active:bg-white/25 min-h-[48px] backdrop-blur-sm"
        >
          {zoomed ? '缩小' : '放大'}
        </button>
      </div>

      {/* photo container - truly centered via absolute positioning */}
      <div
        ref={imageContainerRef}
        className={`flex-1 relative ${zoomed ? 'overflow-auto' : 'overflow-hidden'}`}
        style={{ minHeight: 0 }}
        onClick={() => setZoomed(!zoomed)}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {zoomed ? (
          <img
            src={photo.src}
            alt={photo.caption}
            className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} select-none cursor-zoom-out`}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        ) : (
          <img
            src={photo.src}
            alt={photo.caption}
            className={`absolute inset-0 m-auto select-none transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} cursor-zoom-in`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
            }}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = ''
              target.alt = '图片加载失败'
              setLoaded(true)
              target.parentElement!.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-white text-xl text-center">📷<br/>图片加载失败</div>`
            }}
          />
        )}
      </div>

      {/* caption */}
      {photo.caption && (
        <div className="text-center text-white text-base py-2 px-4 bg-black/60 shrink-0">
          {photo.caption}
        </div>
      )}

      {/* thumbnail strip */}
      {photos.length > 1 && (
        <div
          ref={thumbStripRef}
          className="flex gap-2 px-4 py-2 overflow-x-auto hide-scrollbar shrink-0 justify-center"
        >
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setLoaded(false); setZoomed(false); setCurrentIndex(i) }}
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

      {/* desktop nav */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev() }}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-3xl"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext() }}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-3xl"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
