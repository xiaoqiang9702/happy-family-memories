import { useNavigate, useLocation } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  const isActive = (p: string) => path === p

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-lg border-t border-warm-200 shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-3xl mx-auto flex">
        <button
          onClick={() => navigate('/')}
          className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[60px] transition-colors ${
            isActive('/') ? 'text-warm-500' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">🏠</span>
          <span className="text-sm mt-0.5">首页</span>
        </button>

        <button
          onClick={() => navigate('/health')}
          className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[60px] transition-colors ${
            isActive('/health') ? 'text-warm-500' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">💗</span>
          <span className="text-sm mt-0.5">健康管理</span>
        </button>

        <button
          onClick={() => navigate('/news')}
          className={`flex-1 flex flex-col items-center justify-center py-3 min-h-[60px] transition-colors ${
            isActive('/news') ? 'text-warm-500' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl">📰</span>
          <span className="text-sm mt-0.5">新闻天气</span>
        </button>
      </div>
    </nav>
  )
}
