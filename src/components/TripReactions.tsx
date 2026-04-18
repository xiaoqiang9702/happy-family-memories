import { useState, useEffect } from 'react'

const REACTIONS = [
  { id: 'bang', emoji: '🔥', label: '夯' },
  { id: 'ding', emoji: '👍', label: '顶' },
  { id: 'top', emoji: '👑', label: '人上人' },
  { id: 'npc', emoji: '🤖', label: 'npc' },
  { id: 'la', emoji: '💩', label: '拉' },
] as const

type ReactionId = typeof REACTIONS[number]['id']

interface Props {
  tripId: string
}

function getStorageKey(tripId: string) {
  return `reactions-${tripId}`
}

export default function TripReactions({ tripId }: Props) {
  const [counts, setCounts] = useState<Record<ReactionId, number>>(() => ({
    bang: 0, ding: 0, top: 0, npc: 0, la: 0,
  }))
  const [myPicks, setMyPicks] = useState<Set<ReactionId>>(new Set())
  const [animating, setAnimating] = useState<ReactionId | null>(null)

  // load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(tripId))
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.counts) setCounts(data.counts)
        if (data.myPicks) setMyPicks(new Set(data.myPicks))
      } catch {}
    }
  }, [tripId])

  const save = (nextCounts: Record<ReactionId, number>, nextPicks: Set<ReactionId>) => {
    localStorage.setItem(
      getStorageKey(tripId),
      JSON.stringify({
        counts: nextCounts,
        myPicks: Array.from(nextPicks),
      })
    )
  }

  const toggle = (id: ReactionId) => {
    const newPicks = new Set(myPicks)
    const newCounts = { ...counts }

    if (newPicks.has(id)) {
      newPicks.delete(id)
      newCounts[id] = Math.max(0, newCounts[id] - 1)
    } else {
      newPicks.add(id)
      newCounts[id] = newCounts[id] + 1
      setAnimating(id)
      setTimeout(() => setAnimating(null), 400)
    }

    setMyPicks(newPicks)
    setCounts(newCounts)
    save(newCounts, newPicks)
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-soft">
      <h3 className="text-base text-warm-600 mb-3 text-center">给这次旅行点个评价</h3>
      <div className="flex justify-around gap-2">
        {REACTIONS.map((r) => {
          const active = myPicks.has(r.id)
          const isAnimating = animating === r.id
          return (
            <button
              key={r.id}
              onClick={() => toggle(r.id)}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-2xl transition-all min-h-[72px] flex-1 ${
                active
                  ? 'bg-warm-100 scale-105'
                  : 'bg-warm-50 active:bg-warm-100'
              } ${isAnimating ? 'animate-bounce' : ''}`}
            >
              <span className="text-2xl">{r.emoji}</span>
              <span className={`text-xs ${active ? 'font-bold text-warm-700' : 'text-warm-500'}`}>
                {r.label}
              </span>
              {counts[r.id] > 0 && (
                <span className={`text-xs ${active ? 'text-warm-600 font-bold' : 'text-warm-400'}`}>
                  {counts[r.id]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
