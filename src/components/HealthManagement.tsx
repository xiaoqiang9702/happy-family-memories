import { useNavigate } from 'react-router-dom'
import { useAppData, type FamilyMember } from '../hooks/useAppData'

function calcAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear
}

function getMemberGroup(m: FamilyMember): 'elder' | 'adult' | 'child' {
  const age = calcAge(m.birthYear)
  if (age >= 60) return 'elder'
  if (age >= 18) return 'adult'
  return 'child'
}

export default function HealthManagement() {
  const navigate = useNavigate()
  const { health } = useAppData()
  const members = health.members

  const elders = members.filter((m) => getMemberGroup(m) === 'elder')
  const adults = members.filter((m) => getMemberGroup(m) === 'adult')
  const children = members.filter((m) => getMemberGroup(m) === 'child')

  // compute today's reminders per member
  const todayReminders = (memberId: string) => {
    const today = new Date()
    const dow = today.getDay()
    return health.reminders.filter((r) => {
      if (!r.enabled || r.memberId !== memberId) return false
      if (r.frequency === 'daily') return true
      if (r.frequency === 'weekly' && r.daysOfWeek?.includes(dow)) return true
      if (r.frequency === 'once' && r.date === today.toISOString().split('T')[0]) return true
      return false
    })
  }

  const renderCard = (m: FamilyMember) => {
    const age = calcAge(m.birthYear)
    const reminders = todayReminders(m.id)
    const hasCondition = m.conditions.filter(Boolean).length > 0
    return (
      <button
        key={m.id}
        onClick={() => navigate(`/health/${m.id}`)}
        className="w-full bg-white rounded-3xl p-5 shadow-soft active:scale-[0.98] transition-all text-left border-0 cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className="text-5xl shrink-0">{m.avatar}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="text-xl font-bold text-warm-800">{m.name}</h3>
              <span className="text-base text-warm-500">{m.relation} · {age}岁</span>
            </div>
            {hasCondition ? (
              <p className="text-base text-warm-600 line-clamp-1">
                💊 {m.conditions.filter(Boolean).join('、')}
              </p>
            ) : (
              <p className="text-base text-warm-400">暂无健康信息</p>
            )}
            {reminders.length > 0 && (
              <div className="mt-2 text-sm text-amber-600 flex items-center gap-1">
                <span>⏰</span>
                <span>今日 {reminders.length} 项提醒</span>
              </div>
            )}
          </div>
          <div className="text-warm-400 text-2xl shrink-0">→</div>
        </div>
      </button>
    )
  }

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
          <h1 className="text-xl font-bold text-warm-800 flex-1">💗 健康管理</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* intro card */}
        <div className="bg-gradient-to-br from-accent-pink/30 via-white to-warm-100 rounded-3xl p-5 shadow-soft">
          <h2 className="text-lg font-bold text-warm-800 mb-2">👨‍⚕️ 家庭健康助手</h2>
          <p className="text-base text-warm-700 leading-relaxed">
            点击家人头像进入健康档案<br />
            可以描述身体状况，AI 医生会根据档案给出建议
          </p>
        </div>

        {/* elders */}
        {elders.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-warm-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-warm-500 rounded-full"></span>
              长辈（重点关注）
            </h2>
            <div className="space-y-3">
              {elders.map(renderCard)}
            </div>
          </section>
        )}

        {/* adults */}
        {adults.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-warm-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-warm-400 rounded-full"></span>
              成年人
            </h2>
            <div className="space-y-3">
              {adults.map(renderCard)}
            </div>
          </section>
        )}

        {/* children */}
        {children.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-warm-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-warm-300 rounded-full"></span>
              孩子
            </h2>
            <div className="space-y-3">
              {children.map(renderCard)}
            </div>
          </section>
        )}

        {members.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl shadow-soft">
            <div className="text-5xl mb-3">👨‍👩‍👧‍👦</div>
            <p className="text-lg text-warm-600 mb-2">还没有家庭成员</p>
            <p className="text-sm text-warm-400">去管理后台添加家人档案</p>
          </div>
        )}

        <div className="text-center text-xs text-warm-400 px-4 pt-4">
          ⚠️ AI 建议仅供参考，具体诊疗请咨询医生
        </div>
      </div>
    </div>
  )
}
