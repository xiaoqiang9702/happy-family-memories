import { useState } from 'react'

interface Props {
  onLogin: (password: string) => boolean
}

export default function PasswordGate({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const success = onLogin(password)
    if (!success) {
      setError(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-warm-100 via-warm-50 to-white px-6">
      {/* decorative top */}
      <div className="text-center mb-6 animate-fade-in">
        <div className="text-7xl mb-3" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }}>🏠</div>
        <h1 className="text-3xl font-bold text-warm-800 tracking-wide">快乐一家人</h1>
        <p className="text-base text-warm-500 mt-1">记录每一段温暖的旅程</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 animate-slide-up ${shaking ? 'animate-shake' : ''}`}
      >
        <p className="text-lg text-warm-700 text-center mb-6">输入家庭密码，查看旅行回忆</p>

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(false)
          }}
          placeholder="请输入密码"
          className={`w-full text-xl px-6 py-4 rounded-2xl border-2 text-center outline-none transition-colors ${
            error
              ? 'border-red-400 bg-red-50'
              : 'border-warm-200 bg-warm-50 focus:border-warm-500'
          }`}
          autoFocus
        />

        {error && (
          <p className="text-red-500 text-base mt-3 text-center">密码不对哦，再试试吧</p>
        )}

        <button
          type="submit"
          className="w-full mt-6 py-4 bg-warm-500 hover:bg-warm-600 active:bg-warm-700 text-white text-xl font-bold rounded-2xl transition-colors shadow-md active:shadow-sm"
        >
          进入相册
        </button>
      </form>

      <p className="text-sm text-warm-300 mt-8">家人专属，温暖常在</p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.6s ease-out; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.5s ease-out 0.2s both; }
      `}</style>
    </div>
  )
}
