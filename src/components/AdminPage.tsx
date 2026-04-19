import { useState, useRef, useEffect } from 'react'
import { useAppData, type FamilyMember, type HealthData, type HealthRecord } from '../hooks/useAppData'

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

type View = 'list' | 'edit-trip' | 'news' | 'edit-news' | 'health' | 'edit-member' | 'member-records' | 'edit-record'

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

  const [healthData, setHealthData] = useState<HealthData>(appData.health)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [isNewMember, setIsNewMember] = useState(false)
  const [recordMemberId, setRecordMemberId] = useState<string>('')
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null)
  const [isNewRecord, setIsNewRecord] = useState(false)

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
    setHealthData(appData.health)
  }, [appData.trips, appData.news, appData.health])

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

  const saveAll = async (
    updatedTrips: Trip[],
    updatedNews: NewsItem[],
    updatedHealth?: HealthData
  ) => {
    try {
      setMessage('正在保存...')
      const body: any = { trips: updatedTrips, news: updatedNews }
      if (updatedHealth !== undefined) body.health = updatedHealth
      const resp = await fetch('/api/trips', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminToken,
        },
        body: JSON.stringify(body),
      })
      if (resp.ok) {
        const data = await resp.json()
        setMessage(data.message || '保存成功！')
        appData.refresh()
      } else {
        const err = await resp.json()
        setMessage(`保存失败: ${err.error}`)
      }
    } catch (err: any) {
      setMessage(`保存失败: ${err.message}`)
    }
  }

  // === HEALTH MEMBER MANAGEMENT ===

  const startNewMember = () => {
    setEditingMember({
      id: `m-${Date.now()}`,
      name: '',
      relation: '',
      avatar: '👤',
      birthYear: 1960,
      gender: 'male',
      conditions: [],
      medications: [],
      allergies: [],
      notes: '',
    })
    setIsNewMember(true)
    setView('edit-member')
    setMessage('')
  }

  const startEditMember = (m: FamilyMember) => {
    setEditingMember({
      ...m,
      conditions: [...m.conditions],
      medications: [...m.medications],
      allergies: [...m.allergies],
    })
    setIsNewMember(false)
    setView('edit-member')
    setMessage('')
  }

  const deleteMember = async (memberId: string) => {
    if (!confirm('确定要删除这位家人的档案吗？相关健康记录和提醒也会删除。')) return
    const updated: HealthData = {
      members: healthData.members.filter((m) => m.id !== memberId),
      records: healthData.records.filter((r) => r.memberId !== memberId),
      reminders: healthData.reminders.filter((r) => r.memberId !== memberId),
    }
    setHealthData(updated)
    await saveAll(trips, news, updated)
  }

  const saveMember = async () => {
    if (!editingMember || !editingMember.name) {
      setMessage('请填写姓名')
      return
    }
    setSaving(true)
    // clean up empty strings in arrays
    const cleaned: FamilyMember = {
      ...editingMember,
      conditions: editingMember.conditions.filter((c) => c.trim()),
      medications: editingMember.medications.filter((c) => c.trim()),
      allergies: editingMember.allergies.filter((c) => c.trim()),
    }
    const members = isNewMember
      ? [...healthData.members, cleaned]
      : healthData.members.map((m) => (m.id === cleaned.id ? cleaned : m))
    const updated: HealthData = { ...healthData, members }
    setHealthData(updated)
    await saveAll(trips, news, updated)
    setSaving(false)
    setView('health')
  }

  // === MEDICAL RECORDS MANAGEMENT ===

  const openMemberRecords = (memberId: string) => {
    setRecordMemberId(memberId)
    setView('member-records')
    setMessage('')
  }

  const startNewRecord = (category: '就医' | '体检') => {
    setEditingRecord({
      id: `rec-${Date.now()}`,
      memberId: recordMemberId,
      date: new Date().toISOString().split('T')[0],
      category,
      value: '',
      notes: '',
      hospital: '',
      doctor: '',
      department: '',
      diagnosis: '',
      treatment: '',
      source: 'admin',
    })
    setIsNewRecord(true)
    setView('edit-record')
    setMessage('')
  }

  const startEditRecord = (rec: HealthRecord) => {
    setEditingRecord({ ...rec })
    setIsNewRecord(false)
    setView('edit-record')
    setMessage('')
  }

  const deleteAdminRecord = async (recId: string) => {
    if (!confirm('确定删除这条记录？')) return
    const updated: HealthData = {
      ...healthData,
      records: healthData.records.filter((r) => r.id !== recId),
    }
    setHealthData(updated)
    await saveAll(trips, news, updated)
  }

  const saveAdminRecord = async () => {
    if (!editingRecord || !editingRecord.date) {
      setMessage('请填写日期')
      return
    }
    setSaving(true)
    const records = isNewRecord
      ? [...healthData.records, editingRecord]
      : healthData.records.map((r) => (r.id === editingRecord.id ? editingRecord : r))
    const updated: HealthData = { ...healthData, records }
    setHealthData(updated)
    await saveAll(trips, news, updated)
    setSaving(false)
    setView('member-records')
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

  // EDIT MEMBER VIEW
  if (view === 'edit-member' && editingMember) {
    const updateArr = (key: 'conditions' | 'medications' | 'allergies', idx: number, val: string) => {
      const arr = [...editingMember[key]]
      arr[idx] = val
      setEditingMember({ ...editingMember, [key]: arr })
    }
    const addToArr = (key: 'conditions' | 'medications' | 'allergies') => {
      setEditingMember({ ...editingMember, [key]: [...editingMember[key], ''] })
    }
    const removeFromArr = (key: 'conditions' | 'medications' | 'allergies', idx: number) => {
      setEditingMember({ ...editingMember, [key]: editingMember[key].filter((_, i) => i !== idx) })
    }

    return (
      <div className="min-h-screen bg-warm-50 pb-8">
        <header
          className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setView('health')}
              className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-warm-800">
              {isNewMember ? '添加家人' : '编辑档案'}
            </h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-lg font-bold text-warm-700 mb-2">姓名 *</label>
              <input
                type="text"
                value={editingMember.name}
                onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                placeholder="爷爷"
                className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
              />
            </div>
            <div>
              <label className="block text-lg font-bold text-warm-700 mb-2">称呼</label>
              <input
                type="text"
                value={editingMember.relation}
                onChange={(e) => setEditingMember({ ...editingMember, relation: e.target.value })}
                placeholder="爷爷"
                className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-lg font-bold text-warm-700 mb-2">出生年</label>
              <input
                type="number"
                value={editingMember.birthYear}
                onChange={(e) => setEditingMember({ ...editingMember, birthYear: parseInt(e.target.value) || 0 })}
                className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
              />
            </div>
            <div>
              <label className="block text-lg font-bold text-warm-700 mb-2">性别</label>
              <select
                value={editingMember.gender}
                onChange={(e) => setEditingMember({ ...editingMember, gender: e.target.value as 'male' | 'female' })}
                className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
              >
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">头像 emoji</label>
            <div className="grid grid-cols-7 gap-2">
              {['👴', '👵', '🧓', '🧕', '👨', '👩', '👦', '👧', '👶', '🧑', '👨‍🦳', '👩‍🦳', '👨‍🦱', '👩‍🦱'].map((e) => (
                <button
                  key={e}
                  onClick={() => setEditingMember({ ...editingMember, avatar: e })}
                  className={`text-3xl p-2 rounded-xl ${
                    editingMember.avatar === e ? 'bg-warm-200 scale-110' : 'bg-warm-50 active:bg-warm-100'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* dynamic lists */}
          {(['conditions', 'medications', 'allergies'] as const).map((key) => {
            const labels = { conditions: '疾病史', medications: '正在服药', allergies: '过敏' }
            const placeholders = { conditions: '如：高血压', medications: '如：氨氯地平 5mg 每天早晚', allergies: '如：青霉素' }
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-lg font-bold text-warm-700">{labels[key]}</label>
                  <button
                    onClick={() => addToArr(key)}
                    className="text-sm px-3 py-1 bg-warm-100 text-warm-700 rounded-lg min-h-[32px]"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {editingMember[key].length === 0 && (
                    <p className="text-sm text-warm-400">暂无</p>
                  )}
                  {editingMember[key].map((val, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => updateArr(key, i, e.target.value)}
                        placeholder={placeholders[key]}
                        className="flex-1 text-base px-3 py-2 rounded-xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
                      />
                      <button
                        onClick={() => removeFromArr(key, i)}
                        className="text-red-400 text-xl px-3 min-h-[44px]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">其他健康备注</label>
            <textarea
              value={editingMember.notes}
              onChange={(e) => setEditingMember({ ...editingMember, notes: e.target.value })}
              rows={3}
              placeholder="例如：最近体检情况、家族病史..."
              className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500 resize-none"
            />
          </div>

          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700">{message}</div>
          )}

          <button
            onClick={saveMember}
            disabled={saving}
            className="w-full py-4 bg-warm-500 disabled:bg-gray-300 text-white text-xl font-bold rounded-2xl"
          >
            {saving ? '保存中...' : '保存档案'}
          </button>
        </div>
      </div>
    )
  }

  // EDIT RECORD VIEW (medical visit / checkup)
  if (view === 'edit-record' && editingRecord) {
    const isVisit = editingRecord.category === '就医' || editingRecord.category === '体检'
    return (
      <div className="min-h-screen bg-warm-50 pb-8">
        <header
          className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setView('member-records')}
              className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-warm-800">
              {isNewRecord ? `添加${editingRecord.category}记录` : '编辑记录'}
            </h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">日期 *</label>
            <input
              type="date"
              value={editingRecord.date}
              onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
              className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
            />
          </div>

          {isVisit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-warm-700 mb-1">医院</label>
                  <input
                    type="text"
                    value={editingRecord.hospital || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, hospital: e.target.value })}
                    placeholder="如 市一医院"
                    className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-warm-700 mb-1">科室</label>
                  <input
                    type="text"
                    value={editingRecord.department || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, department: e.target.value })}
                    placeholder="如 心内科"
                    className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-warm-700 mb-1">医生</label>
                <input
                  type="text"
                  value={editingRecord.doctor || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, doctor: e.target.value })}
                  placeholder="如 李主任"
                  className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-warm-700 mb-1">主诉症状</label>
                <textarea
                  value={editingRecord.value}
                  onChange={(e) => setEditingRecord({ ...editingRecord, value: e.target.value })}
                  placeholder="描述就医原因、症状等"
                  rows={2}
                  className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-warm-700 mb-1">诊断结论</label>
                <textarea
                  value={editingRecord.diagnosis || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, diagnosis: e.target.value })}
                  placeholder="医生的诊断结果"
                  rows={2}
                  className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-warm-700 mb-1">处理/开药</label>
                <textarea
                  value={editingRecord.treatment || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, treatment: e.target.value })}
                  placeholder="治疗方案、开的药物、注意事项等"
                  rows={2}
                  className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500 resize-none"
                />
              </div>
            </>
          )}

          {!isVisit && (
            <div>
              <label className="block text-sm font-bold text-warm-700 mb-1">内容</label>
              <textarea
                value={editingRecord.value}
                onChange={(e) => setEditingRecord({ ...editingRecord, value: e.target.value })}
                rows={3}
                className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500 resize-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-warm-700 mb-1">备注</label>
            <textarea
              value={editingRecord.notes}
              onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
              placeholder="其他要补充的信息"
              rows={2}
              className="w-full text-base px-4 py-2.5 rounded-2xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500 resize-none"
            />
          </div>

          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700">{message}</div>
          )}

          <button
            onClick={saveAdminRecord}
            disabled={saving}
            className="w-full py-4 bg-warm-500 disabled:bg-gray-300 text-white text-xl font-bold rounded-2xl"
          >
            {saving ? '保存中...' : '保存记录'}
          </button>
        </div>
      </div>
    )
  }

  // MEMBER RECORDS VIEW
  if (view === 'member-records') {
    const member = healthData.members.find((m) => m.id === recordMemberId)
    const memberRecords = healthData.records
      .filter((r) => r.memberId === recordMemberId)
      .sort((a, b) => b.date.localeCompare(a.date))
    return (
      <div className="min-h-screen bg-warm-50 pb-8">
        <header
          className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setView('health')}
              className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-warm-800">
              {member?.avatar} {member?.name}的医疗记录
            </h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => startNewRecord('就医')}
              className="py-4 bg-warm-500 text-white text-lg font-bold rounded-2xl active:bg-warm-600"
            >
              🏥 添加就医
            </button>
            <button
              onClick={() => startNewRecord('体检')}
              className="py-4 bg-purple-400 text-white text-lg font-bold rounded-2xl active:bg-purple-500"
            >
              🔬 添加体检
            </button>
          </div>

          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700">{message}</div>
          )}

          <h2 className="text-lg font-bold text-warm-700">全部记录 ({memberRecords.length}条)</h2>

          {memberRecords.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-warm-500">
              还没有记录<br />
              <span className="text-sm text-warm-400 mt-2 block">点上方按钮添加第一条</span>
            </div>
          ) : (
            <div className="space-y-3">
              {memberRecords.map((r) => {
                const isVisit = r.category === '就医' || r.category === '体检'
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-4 shadow-soft">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm text-warm-500">{r.date}</span>
                      <span className="text-sm font-bold text-warm-700">{r.category}</span>
                      {r.source === 'ai-chat' && <span className="text-xs text-warm-400">· AI记录</span>}
                    </div>
                    {isVisit ? (
                      <div className="space-y-0.5 text-sm">
                        {r.hospital && <div className="text-warm-700">🏥 {r.hospital}{r.department ? ` · ${r.department}` : ''}{r.doctor ? ` · ${r.doctor}` : ''}</div>}
                        {r.value && <div className="text-warm-800">症状：{r.value}</div>}
                        {r.diagnosis && <div className="text-warm-800">诊断：{r.diagnosis}</div>}
                        {r.treatment && <div className="text-warm-800">处理：{r.treatment}</div>}
                      </div>
                    ) : (
                      <div className="text-sm text-warm-800 whitespace-pre-wrap line-clamp-3">{r.value}</div>
                    )}
                    {r.notes && <div className="text-xs text-warm-500 mt-1">备注：{r.notes}</div>}
                    <div className="flex gap-2 mt-3">
                      {(isVisit || r.source === 'admin') && (
                        <button
                          onClick={() => startEditRecord(r)}
                          className="flex-1 px-3 py-2 bg-warm-100 text-warm-700 rounded-xl text-sm min-h-[40px]"
                        >
                          编辑
                        </button>
                      )}
                      <button
                        onClick={() => deleteAdminRecord(r.id)}
                        className="flex-1 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm min-h-[40px]"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // HEALTH LIST VIEW
  if (view === 'health') {
    return (
      <div className="min-h-screen bg-warm-50 pb-8">
        <header
          className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setView('list')}
              className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
            >
              ← 返回
            </button>
            <h1 className="text-xl font-bold text-warm-800">💗 健康档案管理</h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-6">
          <button
            onClick={startNewMember}
            className="w-full py-4 bg-warm-500 text-white text-xl font-bold rounded-2xl active:bg-warm-600 mb-4"
          >
            ＋ 添加家人
          </button>
          <p className="text-sm text-warm-500 mb-4 px-2">
            详细录入家人的疾病史、用药、过敏等，AI 医生咨询时会据此给建议
          </p>
          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700 mb-4">{message}</div>
          )}
          <div className="space-y-3">
            {healthData.members.map((m) => {
              const age = new Date().getFullYear() - m.birthYear
              const hasInfo = m.conditions.filter(Boolean).length > 0 || m.medications.filter(Boolean).length > 0
              return (
                <div key={m.id} className="bg-white rounded-2xl p-4 shadow-soft">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-4xl">{m.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-warm-800">{m.name} <span className="text-sm text-warm-500 font-normal">({m.relation} · {age}岁)</span></h3>
                      <p className="text-sm text-warm-500">
                        {hasInfo ? `${m.conditions.filter(Boolean).length}项疾病 · ${m.medications.filter(Boolean).length}种药` : '未录入健康信息'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => startEditMember(m)}
                      className="flex-1 px-3 py-2 bg-warm-100 text-warm-700 rounded-xl text-sm min-h-[48px] font-medium"
                    >
                      编辑档案
                    </button>
                    <button
                      onClick={() => openMemberRecords(m.id)}
                      className="flex-1 px-3 py-2 bg-accent-blue/40 text-warm-800 rounded-xl text-sm min-h-[48px] font-medium"
                    >
                      📋 医疗记录 {(() => {
                        const c = healthData.records.filter((r) => r.memberId === m.id).length
                        return c > 0 ? `(${c})` : ''
                      })()}
                    </button>
                    <button
                      onClick={() => deleteMember(m.id)}
                      className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm min-h-[48px]"
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
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

        <button
          onClick={() => setView('health')}
          className="w-full py-4 bg-gradient-to-r from-accent-pink/50 to-accent-pink/30 text-warm-800 text-lg font-bold rounded-2xl active:from-accent-pink/70"
        >
          💗 家人健康档案管理
        </button>

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
