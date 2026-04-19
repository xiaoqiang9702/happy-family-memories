import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createElement } from 'react'
import staticData from '../data/trips.json'

export interface Photo { src: string; caption: string }
export interface Video { src: string; title: string }
export interface Trip {
  id: string
  title: string
  date: string
  year: number
  cover: string
  description: string
  photos: Photo[]
  videos: Video[]
}
export interface Comment {
  id: string
  author: string
  date: string
  content: string
}

export interface NewsItem {
  id: string
  date: string
  title: string
  content: string
  comments?: Comment[]
}

export interface FamilyMember {
  id: string
  name: string
  relation: string    // 爷爷、奶奶、外公、外婆、爸爸、妈妈、女儿...
  avatar: string      // emoji
  birthYear: number
  gender: 'male' | 'female'
  conditions: string[]    // 高血压、糖尿病...
  medications: string[]   // 氨氯地平 5mg 早晚...
  allergies: string[]
  notes: string           // 其他重要健康信息
}

export interface HealthRecord {
  id: string
  memberId: string
  date: string            // YYYY-MM-DD
  category: string        // 就医 | 体检 | 检查报告 | 自述症状 | 血压 | 血糖 | 体重 | ...
  value: string           // 数值或描述
  notes: string
  aiAnalysis?: string     // AI 分析结果
  imageUrl?: string       // 上传的检查报告/处方照片
  // Fields for medical visits / check-ups:
  hospital?: string       // 医院
  doctor?: string         // 医生
  department?: string     // 科室
  diagnosis?: string      // 诊断结论
  treatment?: string      // 处理/开药
  source?: 'admin' | 'self' | 'ai-chat'  // 录入来源
}

export interface HealthReminder {
  id: string
  memberId: string
  type: 'medication' | 'measurement' | 'exercise' | 'checkup' | 'custom'
  title: string
  time: string            // HH:MM
  frequency: 'daily' | 'weekly' | 'once'
  daysOfWeek?: number[]   // 0-6 for weekly
  date?: string           // for once
  enabled: boolean
  notes?: string
}

export interface HealthData {
  members: FamilyMember[]
  records: HealthRecord[]
  reminders: HealthReminder[]
}

export interface AppData {
  trips: Trip[]
  news: NewsItem[]
  health: HealthData
  loading: boolean
  refresh: () => void
}

const emptyHealth: HealthData = { members: [], records: [], reminders: [] }

const AppDataContext = createContext<AppData>({
  trips: staticData.trips as Trip[],
  news: ((staticData as any).news || []) as NewsItem[],
  health: ((staticData as any).health || emptyHealth) as HealthData,
  loading: false,
  refresh: () => {},
})

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>(staticData.trips as Trip[])
  const [news, setNews] = useState<NewsItem[]>(((staticData as any).news || []) as NewsItem[])
  const [health, setHealth] = useState<HealthData>(((staticData as any).health || emptyHealth) as HealthData)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/public-data', { cache: 'no-cache' })
      if (resp.ok) {
        const data = await resp.json()
        if (data.trips) setTrips(data.trips)
        if (data.news) setNews(data.news)
        if (data.health) setHealth({ ...emptyHealth, ...data.health })
      }
    } catch {
      // keep static fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return createElement(
    AppDataContext.Provider,
    { value: { trips, news, health, loading, refresh } },
    children
  )
}

export function useAppData() {
  return useContext(AppDataContext)
}
