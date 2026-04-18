import { useNavigate } from 'react-router-dom'

export default function HealthManagement() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-warm-50 pb-nav">
      <header className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
          >
            ← 返回
          </button>
          <h1 className="text-xl font-bold text-warm-800 flex-1">💗 健康管理</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-20 text-center">
        <div className="text-8xl mb-6">🚧</div>
        <h2 className="text-2xl font-bold text-warm-800 mb-3">建设中</h2>
        <p className="text-lg text-warm-600 leading-relaxed">
          健康管理功能正在设计中<br />
          敬请期待
        </p>

        <div className="mt-12 bg-white rounded-3xl p-6 shadow-soft">
          <p className="text-base text-warm-500 leading-relaxed">
            未来规划：记录家人健康数据、提醒吃药、<br />
            体检记录、家庭医生联系方式等
          </p>
        </div>
      </div>
    </div>
  )
}
