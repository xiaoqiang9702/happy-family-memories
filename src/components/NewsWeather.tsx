import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../hooks/useAppData'
import NewsComments from './NewsComments'

interface WeatherData {
  temp: string
  feelsLike: string
  description: string
  humidity: string
  wind: string
  icon: string
}

const ICON_MAP: Record<string, string> = {
  Sunny: '☀️', Clear: '☀️',
  'Partly cloudy': '⛅', 'Partly Cloudy': '⛅',
  Cloudy: '☁️', Overcast: '☁️',
  Mist: '🌫️', Fog: '🌫️',
  'Light rain': '🌦️', 'Patchy rain possible': '🌦️', 'Patchy light rain': '🌦️',
  'Moderate rain': '🌧️', 'Heavy rain': '🌧️', 'Rain': '🌧️',
  'Light snow': '🌨️', Snow: '❄️', 'Heavy snow': '❄️',
  Thunderstorm: '⛈️', 'Thundery outbreaks possible': '⛈️',
}

function getIcon(desc: string): string {
  for (const key in ICON_MAP) {
    if (desc.toLowerCase().includes(key.toLowerCase())) return ICON_MAP[key]
  }
  return '🌤️'
}

const CITY_KEY = 'weather-city'
const DEFAULT_CITY = '上海'

export default function NewsWeather() {
  const navigate = useNavigate()
  const [city, setCity] = useState(() => localStorage.getItem(CITY_KEY) || DEFAULT_CITY)
  const [cityInput, setCityInput] = useState(city)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { news } = useAppData()

  useEffect(() => {
    fetchWeather(city)
  }, [city])

  const fetchWeather = async (queryCity: string) => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch(`https://wttr.in/${encodeURIComponent(queryCity)}?format=j1&lang=zh`)
      if (!resp.ok) throw new Error('获取天气失败')
      const data = await resp.json()
      const current = data.current_condition[0]
      const desc = current.lang_zh?.[0]?.value || current.weatherDesc[0].value
      setWeather({
        temp: current.temp_C,
        feelsLike: current.FeelsLikeC,
        description: desc,
        humidity: current.humidity,
        wind: current.windspeedKmph,
        icon: getIcon(current.weatherDesc[0].value),
      })
    } catch (err: any) {
      setError('无法获取天气，请检查城市名或网络')
    } finally {
      setLoading(false)
    }
  }

  const updateCity = () => {
    const trimmed = cityInput.trim()
    if (trimmed && trimmed !== city) {
      setCity(trimmed)
      localStorage.setItem(CITY_KEY, trimmed)
    }
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
          <h1 className="text-xl font-bold text-warm-800 flex-1">📰 新闻天气</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* weather card */}
        <div className="bg-gradient-to-br from-accent-blue/30 via-white to-warm-100 rounded-3xl p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-warm-800 flex-1">🌤️ 今日天气</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && updateCity()}
                placeholder="城市"
                className="w-24 text-base px-3 py-2 rounded-xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
              />
              <button
                onClick={updateCity}
                className="px-4 py-2 bg-warm-500 text-white rounded-xl text-base min-h-[44px]"
              >
                查询
              </button>
            </div>
          </div>

          {loading && <p className="text-center text-warm-500 text-lg py-6">正在加载...</p>}

          {error && !loading && (
            <p className="text-center text-red-500 text-lg py-6">{error}</p>
          )}

          {weather && !loading && !error && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-4">
                <div className="text-7xl">{weather.icon}</div>
                <div className="text-center">
                  <div className="text-5xl font-bold text-warm-800">{weather.temp}°</div>
                  <div className="text-lg text-warm-600">{weather.description}</div>
                </div>
              </div>
              <div className="text-center text-base text-warm-500">
                {city} · 体感 {weather.feelsLike}°
              </div>
              <div className="flex justify-around pt-3 border-t border-warm-200/50">
                <div className="text-center">
                  <div className="text-base text-warm-500">湿度</div>
                  <div className="text-lg font-bold text-warm-700">{weather.humidity}%</div>
                </div>
                <div className="text-center">
                  <div className="text-base text-warm-500">风速</div>
                  <div className="text-lg font-bold text-warm-700">{weather.wind} km/h</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* family news */}
        <div>
          <h2 className="text-xl font-bold text-warm-800 mb-4">👨‍👩‍👧‍👦 家庭新闻</h2>
          {news.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-soft">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-lg text-warm-600">还没有家庭新闻</p>
              <p className="text-sm text-warm-400 mt-2">去管理后台添加第一条吧</p>
            </div>
          ) : (
            <div className="space-y-3">
              {news
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((item) => (
                  <article key={item.id} className="bg-white rounded-3xl p-5 shadow-soft">
                    <div className="flex items-start gap-3 mb-2">
                      <h3 className="text-lg font-bold text-warm-800 flex-1">{item.title}</h3>
                      <span className="text-sm text-warm-400 shrink-0">
                        {new Date(item.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-base text-warm-700 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                    <NewsComments newsId={item.id} comments={item.comments || []} />
                  </article>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
