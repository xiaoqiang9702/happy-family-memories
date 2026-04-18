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

export interface AppData {
  trips: Trip[]
  news: NewsItem[]
  loading: boolean
  refresh: () => void
}

const AppDataContext = createContext<AppData>({
  trips: staticData.trips as Trip[],
  news: ((staticData as any).news || []) as NewsItem[],
  loading: false,
  refresh: () => {},
})

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>(staticData.trips as Trip[])
  const [news, setNews] = useState<NewsItem[]>(((staticData as any).news || []) as NewsItem[])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/public-data', { cache: 'no-cache' })
      if (resp.ok) {
        const data = await resp.json()
        if (data.trips) setTrips(data.trips)
        if (data.news) setNews(data.news)
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
    { value: { trips, news, loading, refresh } },
    children
  )
}

export function useAppData() {
  return useContext(AppDataContext)
}
