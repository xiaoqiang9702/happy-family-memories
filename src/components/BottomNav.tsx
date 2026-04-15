import { useNavigate, useLocation } from 'react-router-dom'
import RandomMemory from './RandomMemory'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-warm-200 shadow-lg">
      <div className="max-w-3xl mx-auto flex">
        <button
          onClick={() => {
            if (isHome) scrollToTop()
            else navigate('/')
          }}
          className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[60px] ${
            isHome ? 'text-warm-500' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">🏠</span>
          <span className="text-sm mt-0.5">首页</span>
        </button>

        <RandomMemory />

        <button
          onClick={scrollToTop}
          className="flex-1 flex flex-col items-center justify-center py-3 min-h-[60px] text-gray-400"
        >
          <span className="text-2xl">⬆️</span>
          <span className="text-sm mt-0.5">回到顶部</span>
        </button>
      </div>
    </nav>
  )
}
