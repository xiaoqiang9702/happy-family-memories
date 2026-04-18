import { useState, useRef, useEffect } from 'react'
import { useAppData } from '../hooks/useAppData'

interface Photo {
  src: string
  caption: string
}

interface Video {
  src: string
  title: string
}

interface Trip {
  id: string
  title: string
  date: string
  year: number
  cover: string
  description: string
  photos: Photo[]
  videos: Video[]
}

interface NewsItem {
  id: string
  date: string
  title: string
  content: string
}

interface PendingUpload {
  file: File
  preview: string
  caption: string
  uploading: boolean
  done: boolean
  error?: string
}

const ADMIN_STORAGE_KEY = 'admin-auth'

type View = 'list' | 'edit-trip' | 'news' | 'edit-news'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_STORAGE_KEY) || '')
  const [isAuthed, setIsAuthed] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [view, setView] = useState<View>('list')

  const appData = useAppData()
  const [trips, setTrips] = useState<Trip[]>(appData.trips as Trip[])
  const [news, setNews] = useState<NewsItem[]>(appData.news as NewsItem[])

  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [isNewTrip, setIsNewTrip] = useState(false)
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])

  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const [isNewNews, setIsNewNews] = useState(false)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const resp = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (resp.ok) {
        setAdminToken(password)
        localStorage.setItem(ADMIN_STORAGE_KEY, password)
        setIsAuthed(true)
        setLoginError('')
        loadData(password)
      } else {
        setLoginError('密码错误')
      }
    } catch {
      setLoginError('管理API未连接，请先部署到服务器')
    }
  }

  const loadData = async (token: string) => {
    try {
      const resp = await fetch('/api/trips', {
        headers: { 'x-admin-password': token },
      })
      if (resp.ok) {
        const data = await resp.json()
        setTrips(data.trips || [])
        setNews(data.news || [])
      }
    } catch {}
  }

  useEffect(() => {
    if (!adminToken) return
    ;(async () => {
      try {
        const resp = await fetch('/api/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: adminToken }),
        })
        if (resp.ok) {
          setIsAuthed(true)
          loadData(adminToken)
        } else {
          localStorage.removeItem(ADMIN_STORAGE_KEY)
          setAdminToken('')
        }
      } catch {}
    })()
  }, [])

  // sync with shared app data when it changes
  useEffect(() => {
    if (appData.trips.length > 0) setTrips(appData.trips as Trip[])
    setNews(appData.news as NewsItem[])
  }, [appData.trips, appData.news])

  const logout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminToken('')
    setIsAuthed(false)
  }

  // auto-generate caption from filename + index
  const autoCaption = (file: File, index: number): string => {
    const name = file.name.replace(/\.[^.]+$/, '')
    // if filename is just IMG_xxxx or similar, use "照片 N"
    if (/^(IMG|DSC|photo|img|_\w+\d+|\w{8}-\w{4})/i.test(name) || name.length > 30) {
      return `照片 ${index + 1}`
    }
    return name
  }

  // === TRIP MANAGEMENT ===

  const startNewTrip = () => {
    const now = new Date()
    setEditingTrip({
      id: '',
      title: '',
      date: now.toISOString().split('T')[0],
      year: now.getFullYear(),
      cover: '',
      description: '',
      photos: [],
      videos: [],
    })
    setIsNewTrip(true)
    setPendingUploads([])
    setView('edit-trip')
    setMessage('')
  }

  const startEditTrip = (trip: Trip) => {
    setEditingTrip({ ...trip, photos: [...trip.photos], videos: [...trip.videos] })
    setIsNewTrip(false)
    setPendingUploads([])
    setView('edit-trip')
    setMessage('')
  }

  const deleteTrip = async (tripId: string) => {
    if (!confirm('确定要删除这次旅行吗？这不会删除照片文件。')) return
    const updated = trips.filter((t) => t.id !== tripId)
    setTrips(updated)
    await saveAll(updated, news)
  }

  const deleteExistingPhoto = (photoIndex: number) => {
    if (!editingTrip) return
    const newPhotos = editingTrip.photos.filter((_, i) => i !== photoIndex)
    let newCover = editingTrip.cover
    // if removed photo was the cover, use first remaining photo
    if (editingTrip.photos[photoIndex]?.src === editingTrip.cover) {
      newCover = newPhotos[0]?.src || ''
    }
    setEditingTrip({ ...editingTrip, photos: newPhotos, cover: newCover })
  }

  const updatePhotoCaption = (photoIndex: number, caption: string) => {
    if (!editingTrip) return
    const newPhotos = editingTrip.photos.map((p, i) =>
      i === photoIndex ? { ...p, caption } : p
    )
    setEditingTrip({ ...editingTrip, photos: newPhotos })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const existingCount = pendingUploads.length + (editingTrip?.photos.length || 0)
    const newUploads = files.map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: autoCaption(file, existingCount + i),
      uploading: false,
      done: false,
    }))
    setPendingUploads((prev) => [...prev, ...newUploads])
    e.target.value = ''
  }

  const removePendingUpload = (index: number) => {
    setPendingUploads((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const updatePendingCaption = (index: number, caption: string) => {
    setPendingUploads((prev) =>
      prev.map((u, i) => (i === index ? { ...u, caption } : u))
    )
  }

  // AI-generate caption for a single image (base64)
  const aiCaption = async (imageBase64: string): Promise<string | null> => {
    try {
      const resp = await fetch('/api/ai-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminToken,
        },
        body: JSON.stringify({ image: imageBase64 }),
      })
      if (!resp.ok) return null
      const data = await resp.json()
      return data.caption || null
    } catch {
      return null
    }
  }

  // AI generate trip summary
  const generateSummary = async () => {
    if (!editingTrip) return
    setSaving(true)
    setMessage('AI 正在生成简介...')
    try {
      const captions = [
        ...editingTrip.photos.map((p) => p.caption),
        ...pendingUploads.map((u) => u.caption),
      ].filter(Boolean)

      const resp = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminToken,
        },
        body: JSON.stringify({
          title: editingTrip.title,
          date: editingTrip.date,
          captions,
          existing: editingTrip.description,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'AI 生成失败')
      }
      const data = await resp.json()
      setEditingTrip({ ...editingTrip, description: data.summary })
      setMessage('简介已生成，可以继续修改')
    } catch (err: any) {
      setMessage(`失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // AI-caption all pending photos
  const aiCaptionAll = async () => {
    if (pendingUploads.length === 0) return
    setSaving(true)
    for (let i = 0; i < pendingUploads.length; i++) {
      const upload = pendingUploads[i]
      if (upload.done) continue
      setMessage(`AI 识别照片 ${i + 1}/${pendingUploads.length}...`)
      try {
        const base64 = await compressImage(upload.file, 512, 0.7)
        const caption = await aiCaption(base64)
        if (caption) {
          setPendingUploads((prev) =>
            prev.map((u, idx) => (idx === i ? { ...u, caption } : u))
          )
        }
      } catch {}
    }
    setMessage('AI 识别完成')
    setSaving(false)
  }

  // Fetch existing image from URL and convert to compressed base64
  const urlToCompressedBase64 = async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(url)
      if (!resp.ok) return null
      const blob = await resp.blob()
      // Convert blob to dataURL via FileReader, then compress via canvas
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const maxW = 512
            let { width, height } = img
            if (width > maxW) {
              height = (height * maxW) / width
              width = maxW
            }
            canvas.width = width
            canvas.height = height
            canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1])
          }
          img.onerror = () => resolve(null)
          img.src = e.target!.result as string
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  // AI-caption a single existing photo
  const aiCaptionExisting = async (photoIndex: number) => {
    if (!editingTrip) return
    const photo = editingTrip.photos[photoIndex]
    setSaving(true)
    setMessage('AI 识别中...')
    try {
      const base64 = await urlToCompressedBase64(photo.src)
      if (!base64) throw new Error('无法读取图片')
      const caption = await aiCaption(base64)
      if (!caption) throw new Error('AI 无返回')
      const newPhotos = editingTrip.photos.map((p, i) =>
        i === photoIndex ? { ...p, caption } : p
      )
      setEditingTrip({ ...editingTrip, photos: newPhotos })
      setMessage('识别完成')
    } catch (err: any) {
      setMessage(`失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // AI-caption ALL existing photos
  const aiCaptionAllExisting = async () => {
    if (!editingTrip || editingTrip.photos.length === 0) return
    setSaving(true)
    const newPhotos = [...editingTrip.photos]
    for (let i = 0; i < newPhotos.length; i++) {
      setMessage(`AI 识别已有照片 ${i + 1}/${newPhotos.length}...`)
      try {
        const base64 = await urlToCompressedBase64(newPhotos[i].src)
        if (!base64) continue
        const caption = await aiCaption(base64)
        if (caption) {
          newPhotos[i] = { ...newPhotos[i], caption }
          setEditingTrip({ ...editingTrip, photos: newPhotos })
        }
      } catch {}
    }
    setMessage('全部识别完成')
    setSaving(false)
  }

  const compressImage = (file: File, maxWidth = 1600, quality = 0.8): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(dataUrl.split(',')[1])
        }
        img.src = e.target!.result as string
      }
      reader.readAsDataURL(file)
    })

  const saveTrip = async () => {
    if (!editingTrip || !editingTrip.title || !editingTrip.date) {
      setMessage('请填写旅行名称和日期')
      return
    }
    setSaving(true)
    setMessage('正在保存...')

    const trip = { ...editingTrip }
    const tripFolder = `${trip.date.slice(0, 7).replace('-', '')}-${trip.title}`

    if (!trip.id) {
      trip.id = `${trip.year}-${trip.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')}`
    }
    trip.year = parseInt(trip.date.split('-')[0])

    const uploadedPhotos: Photo[] = [...trip.photos]

    for (let i = 0; i < pendingUploads.length; i++) {
      const upload = pendingUploads[i]
      if (upload.done) continue

      setPendingUploads((prev) =>
        prev.map((u, idx) => (idx === i ? { ...u, uploading: true } : u))
      )

      try {
        const base64 = await compressImage(upload.file)

        // AI auto-caption if user didn't customize (still auto-generated default)
        let finalCaption = upload.caption
        const isAutoCaption = /^照片\s*\d+$/.test(finalCaption.trim())
        if (isAutoCaption) {
          setMessage(`🪄 AI 识别照片 ${i + 1}/${pendingUploads.length}...`)
          try {
            const smallBase64 = await compressImage(upload.file, 512, 0.7)
            const aiResult = await aiCaption(smallBase64)
            if (aiResult) finalCaption = aiResult
          } catch {}
        }

        setMessage(`正在上传照片 ${i + 1}/${pendingUploads.length}...`)
        const filename = `photo_${Date.now()}_${i}.jpg`
        const resp = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminToken,
          },
          body: JSON.stringify({ filename, content: base64, tripFolder }),
        })
        if (!resp.ok) throw new Error('上传失败')
        const data = await resp.json()
        uploadedPhotos.push({ src: data.url, caption: finalCaption })
        setPendingUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, uploading: false, done: true, caption: finalCaption } : u))
        )
      } catch (err: any) {
        setPendingUploads((prev) =>
          prev.map((u, idx) =>
            idx === i ? { ...u, uploading: false, error: err.message } : u
          )
        )
      }
    }

    trip.photos = uploadedPhotos
    if (!trip.cover && uploadedPhotos.length > 0) {
      trip.cover = uploadedPhotos[0].src
    }

    // Auto-generate trip description for new trips without one
    if (isNewTrip && !trip.description.trim() && uploadedPhotos.length > 0) {
      setMessage('🪄 AI 正在为这次旅行生成简介...')
      try {
        const captions = uploadedPhotos.map((p) => p.caption).filter(Boolean)
        const resp = await fetch('/api/ai-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminToken,
          },
          body: JSON.stringify({
            title: trip.title,
            date: trip.date,
            captions,
            existing: '',
          }),
        })
        if (resp.ok) {
          const data = await resp.json()
          if (data.summary) trip.description = data.summary
        }
      } catch {}
    }

    let updated: Trip[]
    if (isNewTrip) {
      updated = [trip, ...trips]
    } else {
      updated = trips.map((t) => (t.id === trip.id ? trip : t))
    }

    await saveAll(updated, news)
    setTrips(updated)
    setPendingUploads([])
    setSaving(false)
    setView('list')
  }

  const saveAll = async (updatedTrips: Trip[], updatedNews: NewsItem[]) => {
    try {
      setMessage('正在保存...')
      const resp = await fetch('/api/trips', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminToken,
        },
        body: JSON.stringify({ trips: updatedTrips, news: updatedNews }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setMessage(data.message || '保存成功！')
        // refresh global context so frontend sees new data immediately
        appData.refresh()
      } else {
        const err = await resp.json()
        setMessage(`保存失败: ${err.error}`)
      }
    } catch (err: any) {
      setMessage(`保存失败: ${err.message}`)
    }
  }

  // === NEWS MANAGEMENT ===

  const startNewNews = () => {
    setEditingNews({
      id: `news-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      title: '',
      content: '',
    })
    setIsNewNews(true)
    setView('edit-news')
    setMessage('')
  }

  const startEditNews = (item: NewsItem) => {
    setEditingNews({ ...item })
    setIsNewNews(false)
    setView('edit-news')
    setMessage('')
  }

  const deleteNews = async (id: string) => {
    if (!confirm('确定要删除这条新闻吗？')) return
    const updated = news.filter((n) => n.id !== id)
    setNews(updated)
    await saveAll(trips, updated)
  }

  const saveNews = async () => {
    if (!editingNews || !editingNews.title.trim()) {
      setMessage('请填写标题')
      return
    }
    setSaving(true)
    const updated = isNewNews
      ? [editingNews, ...news]
      : news.map((n) => (n.id === editingNews.id ? editingNews : n))
    setNews(updated)
    await saveAll(trips, updated)
    setSaving(false)
    setView('news')
  }

  // === RENDER ===

  if (!isAuthed) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-warm-100 via-warm-50 to-white px-6">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🔧</div>
          <h1 className="text-2xl font-bold text-warm-800">管理后台</h1>
          <p className="text-base text-warm-500 mt-1">管理旅行回忆和家庭新闻</p>
        </div>
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
            placeholder="请输入管理密码"
            className="w-full text-xl px-6 py-4 rounded-2xl border-2 border-warm-200 bg-warm-50 focus:border-warm-500 outline-none text-center"
            autoFocus
          />
          {loginError && <p className="text-red-500 text-center mt-3">{loginError}</p>}
          <button
            type="submit"
            className="w-full mt-5 py-4 bg-warm-500 hover:bg-warm-600 active:bg-warm-700 text-white text-xl font-bold rounded-2xl"
          >
            进入管理
          </button>
          <a href="/#/" className="block text-center text-warm-500 mt-4 text-base">← 返回首页</a>
        </form>
      </div>
    )
  }

  // EDIT TRIP VIEW
  if (view === 'edit-trip' && editingTrip) {
    return (
      <div className="min-h-screen bg-warm-50 pb-8" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <header
          className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => { setView('list'); setPendingUploads([]) }}
              className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-warm-800">
              {isNewTrip ? '添加旅行' : '编辑旅行'}
            </h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">旅行名称 *</label>
            <input
              type="text"
              value={editingTrip.title}
              onChange={(e) => setEditingTrip({ ...editingTrip, title: e.target.value })}
              placeholder="如：三亚之旅"
              className="w-full text-lg px-5 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">日期 *</label>
            <input
              type="date"
              value={editingTrip.date}
              onChange={(e) => setEditingTrip({ ...editingTrip, date: e.target.value })}
              className="w-full text-lg px-5 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-lg font-bold text-warm-700">描述</label>
              <button
                onClick={generateSummary}
                disabled={saving || !editingTrip.title}
                className="text-sm px-3 py-1.5 bg-accent-blue/40 text-warm-800 rounded-lg active:bg-accent-blue/60 disabled:opacity-50 min-h-[36px] font-medium"
              >
                🪄 AI 生成简介
              </button>
            </div>
            <textarea
              value={editingTrip.description}
              onChange={(e) => setEditingTrip({ ...editingTrip, description: e.target.value })}
              placeholder="记录这次旅行的美好回忆..."
              rows={4}
              className="w-full text-lg px-5 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none resize-none"
            />
          </div>

          {/* existing photos */}
          {editingTrip.photos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-lg font-bold text-warm-700">
                  已有照片 ({editingTrip.photos.length})
                </label>
                <button
                  onClick={aiCaptionAllExisting}
                  disabled={saving}
                  className="text-sm px-3 py-1.5 bg-accent-blue/40 text-warm-800 rounded-lg active:bg-accent-blue/60 disabled:opacity-50 min-h-[36px] font-medium"
                >
                  🪄 AI 识别全部
                </button>
              </div>
              <div className="space-y-3">
                {editingTrip.photos.map((photo, i) => (
                  <div key={i} className="flex gap-3 items-center bg-white rounded-2xl p-3 shadow-soft">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-warm-100 shrink-0 relative">
                      <img src={photo.src} alt={photo.caption} className="w-full h-full object-cover" />
                      {photo.src === editingTrip.cover && (
                        <div className="absolute top-1 left-1 bg-warm-500 text-white text-xs px-1.5 py-0.5 rounded-md">封面</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => updatePhotoCaption(i, e.target.value)}
                        className="w-full text-base px-3 py-2 rounded-xl border border-warm-200 outline-none"
                      />
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button
                          onClick={() => setEditingTrip({ ...editingTrip, cover: photo.src })}
                          disabled={photo.src === editingTrip.cover || saving}
                          className="text-sm px-3 py-1 bg-warm-100 text-warm-700 rounded-lg disabled:opacity-50"
                        >
                          设为封面
                        </button>
                        <button
                          onClick={() => aiCaptionExisting(i)}
                          disabled={saving}
                          className="text-sm px-3 py-1 bg-accent-blue/40 text-warm-800 rounded-lg disabled:opacity-50"
                        >
                          🪄 AI 识别
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteExistingPhoto(i)}
                      className="text-red-400 text-2xl px-2 min-h-[48px] shrink-0"
                      title="删除照片"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* upload new photos */}
          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">上传新照片（可多选）</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 border-2 border-dashed border-warm-300 rounded-2xl text-warm-600 text-lg font-medium bg-warm-50 active:bg-warm-100"
            >
              📷 点击选择照片（支持多选）
            </button>
            <p className="text-sm text-warm-400 mt-2 text-center">🪄 保存时会自动用 AI 识别内容生成描述，也可手动修改</p>
          </div>

          {/* pending uploads */}
          {pendingUploads.length > 0 && (
            <>
              <button
                onClick={aiCaptionAll}
                disabled={saving}
                className="w-full py-3 bg-accent-blue/40 text-warm-800 text-base font-bold rounded-2xl active:bg-accent-blue/60 disabled:opacity-50"
              >
                🪄 AI 识别全部照片（生成描述）
              </button>
            <div className="space-y-3">
              {pendingUploads.map((upload, i) => (
                <div key={i} className="flex gap-3 items-center bg-white rounded-2xl p-3 shadow-soft">
                  <img
                    src={upload.preview}
                    alt=""
                    className="w-20 h-20 object-cover rounded-xl shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={upload.caption}
                      onChange={(e) => updatePendingCaption(i, e.target.value)}
                      placeholder="照片描述"
                      className="w-full text-base px-3 py-2 rounded-xl border border-warm-200 outline-none"
                    />
                    {upload.uploading && <p className="text-warm-500 text-sm mt-1">上传中...</p>}
                    {upload.done && <p className="text-green-500 text-sm mt-1">已上传</p>}
                    {upload.error && <p className="text-red-500 text-sm mt-1">{upload.error}</p>}
                  </div>
                  {!upload.done && (
                    <button
                      onClick={() => removePendingUpload(i)}
                      className="text-red-400 text-2xl px-2 min-h-[48px]"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            </>
          )}

          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700">{message}</div>
          )}

          <button
            onClick={saveTrip}
            disabled={saving}
            className="w-full py-4 bg-warm-500 hover:bg-warm-600 active:bg-warm-700 disabled:bg-gray-300 text-white text-xl font-bold rounded-2xl"
          >
            {saving ? '保存中...' : '保存旅行'}
          </button>
        </div>
      </div>
    )
  }

  // EDIT NEWS VIEW
  if (view === 'edit-news' && editingNews) {
    return (
      <div className="min-h-screen bg-warm-50 pb-8">
        <header
          className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setView('news')}
              className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-warm-800">
              {isNewNews ? '添加新闻' : '编辑新闻'}
            </h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">日期 *</label>
            <input
              type="date"
              value={editingNews.date}
              onChange={(e) => setEditingNews({ ...editingNews, date: e.target.value })}
              className="w-full text-lg px-5 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">标题 *</label>
            <input
              type="text"
              value={editingNews.title}
              onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
              placeholder="如：爷爷生日"
              className="w-full text-lg px-5 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">内容</label>
            <textarea
              value={editingNews.content}
              onChange={(e) => setEditingNews({ ...editingNews, content: e.target.value })}
              placeholder="记录家庭新闻..."
              rows={6}
              className="w-full text-lg px-5 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none resize-none"
            />
          </div>
          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700">{message}</div>
          )}
          <button
            onClick={saveNews}
            disabled={saving}
            className="w-full py-4 bg-warm-500 disabled:bg-gray-300 text-white text-xl font-bold rounded-2xl"
          >
            {saving ? '保存中...' : '保存新闻'}
          </button>
        </div>
      </div>
    )
  }

  // NEWS LIST VIEW
  if (view === 'news') {
    return (
      <div className="min-h-screen bg-warm-50 pb-8">
        <header
          className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('list')}
                className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
              >
                ← 返回
              </button>
              <h1 className="text-xl font-bold text-warm-800">📰 家庭新闻</h1>
            </div>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-6">
          <button
            onClick={startNewNews}
            className="w-full py-4 bg-warm-500 text-white text-xl font-bold rounded-2xl active:bg-warm-600 mb-6"
          >
            ＋ 添加新闻
          </button>
          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700 mb-4">{message}</div>
          )}
          <h2 className="text-lg font-bold text-warm-700 mb-3">已有新闻 ({news.length})</h2>
          <div className="space-y-3">
            {news.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-4 shadow-soft">
                <div className="flex items-start gap-3 mb-2">
                  <h3 className="text-lg font-bold text-warm-800 flex-1">{item.title}</h3>
                  <span className="text-sm text-warm-400 shrink-0">{item.date}</span>
                </div>
                <p className="text-base text-warm-600 line-clamp-2 mb-3">{item.content}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditNews(item)}
                    className="flex-1 px-4 py-2 bg-warm-100 text-warm-700 rounded-xl text-base min-h-[48px]"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => deleteNews(item.id)}
                    className="flex-1 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-base min-h-[48px]"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // MAIN LIST VIEW
  return (
    <div className="min-h-screen bg-warm-50 pb-8">
      <header
        className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-warm-800">🔧 管理后台</h1>
          <button onClick={logout} className="text-base px-4 py-2 rounded-xl bg-warm-100 text-warm-600 min-h-[48px]">
            退出
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startNewTrip}
            className="py-4 bg-warm-500 text-white text-lg font-bold rounded-2xl active:bg-warm-600"
          >
            ＋ 新旅行
          </button>
          <button
            onClick={() => setView('news')}
            className="py-4 bg-white text-warm-700 text-lg font-bold rounded-2xl border-2 border-warm-200 active:bg-warm-100"
          >
            📰 新闻管理
          </button>
        </div>

        <div className="flex gap-2">
          <a
            href="/#/"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-warm-100 text-warm-700 text-base rounded-2xl no-underline"
          >
            🏠 查看网站
          </a>
        </div>

        {message && (
          <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700">{message}</div>
        )}

        <div>
          <h2 className="text-lg font-bold text-warm-700 mb-3">已有旅行 ({trips.length})</h2>
          <div className="space-y-3">
            {trips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-2xl p-4 shadow-soft flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-warm-100 shrink-0">
                  {trip.cover ? (
                    <img src={trip.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">📷</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-warm-800 truncate">{trip.title}</h3>
                  <p className="text-sm text-warm-500">
                    {trip.date} · {trip.photos.length}张
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEditTrip(trip)}
                    className="px-3 py-2 bg-warm-100 text-warm-700 rounded-xl text-base min-h-[48px]"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => deleteTrip(trip.id)}
                    className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-base min-h-[48px]"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
