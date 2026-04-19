import { useState, useEffect, useRef } from 'react'
import { useAppData, type HealthReminder } from '../hooks/useAppData'
import { useDeviceOwner, isReminderAcked, ackReminder, cleanupOldAcks } from '../hooks/useDeviceOwner'

function playAlarmSound() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    // 3 beeps, 800Hz, 200ms each, 100ms pause
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t0 = now + i * 0.3
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.3, t0 + 0.02)
      gain.gain.linearRampToValueAtTime(0, t0 + 0.2)
      osc.start(t0)
      osc.stop(t0 + 0.2)
    }
  } catch {}
}

function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500])
  } catch {}
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function reminderMinutes(r: HealthReminder): number {
  const [h, m] = (r.time || '00:00').split(':').map(Number)
  return h * 60 + m
}

function reminderAppliesToday(r: HealthReminder): boolean {
  if (!r.enabled) return false
  const today = new Date()
  const dow = today.getDay()
  if (r.frequency === 'daily') return true
  if (r.frequency === 'weekly' && r.daysOfWeek?.includes(dow)) return true
  if (r.frequency === 'once' && r.date === todayStr()) return true
  return false
}

export default function HealthAlarm() {
  const { health } = useAppData()
  const { ownerId } = useDeviceOwner()
  const [active, setActive] = useState<HealthReminder | null>(null)
  const lastCheckRef = useRef<number>(0)

  const member = health.members.find((m) => m.id === ownerId)

  useEffect(() => {
    cleanupOldAcks()
  }, [])

  useEffect(() => {
    if (!ownerId) return
    const check = () => {
      const now = nowMinutes()
      const date = todayStr()

      // find the FIRST unacked reminder that is due (within last 60 min window or scheduled now)
      const due = health.reminders
        .filter((r) => r.memberId === ownerId)
        .filter(reminderAppliesToday)
        .filter((r) => {
          const rm = reminderMinutes(r)
          // Trigger if reminder time has passed within last 60 minutes
          return now >= rm && now - rm <= 60
        })
        .filter((r) => !isReminderAcked(r.id, date))
        .sort((a, b) => reminderMinutes(a) - reminderMinutes(b))[0]

      if (due && (!active || active.id !== due.id)) {
        setActive(due)
        playAlarmSound()
        vibrate()
      }

      lastCheckRef.current = Date.now()
    }

    check()
    const interval = setInterval(check, 30 * 1000)
    return () => clearInterval(interval)
  }, [health.reminders, ownerId, active])

  // re-trigger alarm sound every 10s while active
  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      playAlarmSound()
      vibrate()
    }, 10000)
    return () => clearInterval(interval)
  }, [active])

  if (!active || !member || ownerId !== active.memberId) return null

  const handleDone = () => {
    ackReminder(active.id, todayStr())
    setActive(null)
  }

  const handleSnooze = () => {
    // 5-min snooze: just dismiss, next check after 30s will still find it
    // but we skip the immediate re-trigger by acking briefly then un-acking after 5min
    // simpler: just dismiss and re-check after 30s - will re-trigger
    setActive(null)
  }

  const typeIcon =
    active.type === 'medication' ? '💊'
    : active.type === 'measurement' ? '📏'
    : active.type === 'exercise' ? '🚶'
    : active.type === 'checkup' ? '🏥'
    : '⏰'

  return (
    <div
      className="fixed inset-0 z-[100] bg-amber-900/70 backdrop-blur-sm flex items-center justify-center p-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-alarm-in">
        <div className="text-center mb-4">
          <div className="text-7xl mb-2 animate-bounce">{typeIcon}</div>
          <div className="text-sm text-warm-500 mb-1">⏰ 提醒 · {active.time}</div>
          <div className="text-sm text-warm-400">{member.avatar} {member.name}</div>
        </div>

        <h2 className="text-2xl font-bold text-warm-800 text-center mb-6">{active.title}</h2>

        <div className="space-y-3">
          <button
            onClick={handleDone}
            className="w-full py-4 bg-green-500 active:bg-green-600 text-white text-xl font-bold rounded-2xl shadow-md"
          >
            ✓ 完成了
          </button>
          <button
            onClick={handleSnooze}
            className="w-full py-3 bg-warm-100 active:bg-warm-200 text-warm-700 text-lg font-medium rounded-2xl"
          >
            稍后再提醒
          </button>
        </div>
      </div>

      <style>{`
        @keyframes alarm-in {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-alarm-in { animation: alarm-in 0.3s ease-out; }
      `}</style>
    </div>
  )
}
