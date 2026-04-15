import { useState, useCallback, useRef } from 'react'
import tripsData from '../data/trips.json'

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

interface PendingUpload {
  file: File
  preview: string
  caption: string
  uploading: boolean
  done: boolean
  error?: string
}

const ADMIN_STORAGE_KEY = 'admin-auth'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_STORAGE_KEY) || '')
  const [isAuthed, setIsAuthed] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [trips, setTrips] = useState<Trip[]>(tripsData.trips as Trip[])
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [isNewTrip, setIsNewTrip] = useState(false)
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // admin login
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
        // load latest trips from API
        loadTrips(password)
      } else {
        setLoginError('密码错误')
      }
    } catch {
      // API not available (local dev), check hardcoded
      setLoginError('管理API未连接，请先部署到Vercel')
    }
  }

  const loadTrips = async (token: string) => {
    try {
      const resp = await fetch('/api/trips', {
        headers: { 'x-admin-password': token },
      })
      if (resp.ok) {
        const data = await resp.json()
        setTrips(data.trips)
      }
    } catch {
      // use static data as fallback
    }
  }

  // auto-login with stored token
  const tryAutoLogin = useCallback(async () => {
    if (!adminToken) return
    try {
      const resp = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminToken }),
      })
      if (resp.ok) {
        setIsAuthed(true)
        loadTrips(adminToken)
      } else {
        localStorage.removeItem(ADMIN_STORAGE_KEY)
        setAdminToken('')
      }
    } catch {
      // API not available
    }
  }, [adminToken])

  useState(() => { tryAutoLogin() })

  const logout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminToken('')
    setIsAuthed(false)
  }

  // trip management
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
  }

  const startEditTrip = (trip: Trip) => {
    setEditingTrip({ ...trip })
    setIsNewTrip(false)
    setPendingUploads([])
  }

  const deleteTrip = (tripId: string) => {
    if (!confirm('确定要删除这次旅行吗？')) return
    const updated = trips.filter((t) => t.id !== tripId)
    setTrips(updated)
    saveTripsToGitHub(updated)
  }

  // file handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newUploads = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: file.name.replace(/\.[^.]+$/, ''),
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

  const updateCaption = (index: number, caption: string) => {
    setPendingUploads((prev) =>
      prev.map((u, i) => (i === index ? { ...u, caption } : u))
    )
  }

  // compress image client-side
  const compressImage = (file: File, maxWidth = 1600, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
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
          // return base64 without data:image/jpeg;base64, prefix
          resolve(dataUrl.split(',')[1])
        }
        img.src = e.target!.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  // upload photos and save trip
  const saveTrip = async () => {
    if (!editingTrip || !editingTrip.title || !editingTrip.date) {
      setMessage('请填写旅行名称和日期')
      return
    }

    setSaving(true)
    setMessage('正在保存...')

    const trip = { ...editingTrip }
    const tripFolder = `${trip.date.slice(0, 7).replace('-', '')}-${trip.title}`

    // generate ID
    if (!trip.id) {
      trip.id = `${trip.year}-${trip.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')}`
    }
    trip.year = parseInt(trip.date.split('-')[0])

    // upload pending photos
    const uploadedPhotos: Photo[] = [...trip.photos]
    for (let i = 0; i < pendingUploads.length; i++) {
      const upload = pendingUploads[i]
      if (upload.done) continue

      setPendingUploads((prev) =>
        prev.map((u, idx) => (idx === i ? { ...u, uploading: true } : u))
      )
      setMessage(`正在上传照片 ${i + 1}/${pendingUploads.length}...`)

      try {
        const base64 = await compressImage(upload.file)
        const filename = `photo_${Date.now()}_${i}.jpg`

        const resp = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminToken,
          },
          body: JSON.stringify({
            filename,
            content: base64,
            tripFolder,
          }),
        })

        if (!resp.ok) throw new Error('上传失败')
        const data = await resp.json()

        uploadedPhotos.push({ src: data.url, caption: upload.caption })
        setPendingUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, uploading: false, done: true } : u))
        )

        // set cover to first uploaded photo if no cover
        if (!trip.cover && uploadedPhotos.length > 0) {
          trip.cover = data.url
        }
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

    // update trips list
    let updated: Trip[]
    if (isNewTrip) {
      updated = [trip, ...trips]
    } else {
      updated = trips.map((t) => (t.id === trip.id ? trip : t))
    }

    // save to GitHub
    await saveTripsToGitHub(updated)
    setTrips(updated)
    setEditingTrip(null)
    setPendingUploads([])
    setSaving(false)
  }

  const saveTripsToGitHub = async (updatedTrips: Trip[]) => {
    try {
      setMessage('正在保存旅行数据...')
      const resp = await fetch('/api/trips', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminToken,
        },
        body: JSON.stringify({ trips: updatedTrips }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setMessage(data.message || '保存成功！')
      } else {
        const err = await resp.json()
        setMessage(`保存失败: ${err.error}`)
      }
    } catch (err: any) {
      setMessage(`保存失败: ${err.message}`)
    }
  }

  // --- RENDER ---

  // login screen
  if (!isAuthed) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-warm-100 via-warm-50 to-white px-6">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🔧</div>
          <h1 className="text-2xl font-bold text-warm-800">管理后台</h1>
          <p className="text-base text-warm-500 mt-1">管理旅行回忆</p>
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

  // edit trip form
  if (editingTrip) {
    return (
      <div className="min-h-screen bg-warm-50 pb-8">
        <header className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => { setEditingTrip(null); setPendingUploads([]) }}
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
            <label className="block text-lg font-bold text-warm-700 mb-2">描述</label>
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
              <label className="block text-lg font-bold text-warm-700 mb-2">
                已有照片 ({editingTrip.photos.length})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {editingTrip.photos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-warm-100">
                    <img src={photo.src} alt={photo.caption} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                      <span className="text-white text-xs truncate block">{photo.caption}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* upload new photos */}
          <div>
            <label className="block text-lg font-bold text-warm-700 mb-2">上传照片</label>
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
              📷 点击选择照片
            </button>
          </div>

          {/* pending uploads */}
          {pendingUploads.length > 0 && (
            <div className="space-y-3">
              {pendingUploads.map((upload, i) => (
                <div key={i} className="flex gap-3 items-center bg-white rounded-2xl p-3 shadow-sm">
                  <img
                    src={upload.preview}
                    alt=""
                    className="w-20 h-20 object-cover rounded-xl shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={upload.caption}
                      onChange={(e) => updateCaption(i, e.target.value)}
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
          )}

          {/* message */}
          {message && (
            <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700">{message}</div>
          )}

          {/* save button */}
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

  // trip list (main admin page)
  return (
    <div className="min-h-screen bg-warm-50 pb-8">
      <header className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-warm-800">🔧 管理后台</h1>
          <button onClick={logout} className="text-base px-4 py-2 rounded-xl bg-warm-100 text-warm-600 min-h-[48px]">
            退出
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex gap-3 mb-6">
          <button
            onClick={startNewTrip}
            className="flex-1 py-4 bg-warm-500 text-white text-xl font-bold rounded-2xl active:bg-warm-600"
          >
            ＋ 添加新旅行
          </button>
          <a
            href="/#/"
            className="flex items-center justify-center px-6 py-4 bg-warm-100 text-warm-700 text-lg font-medium rounded-2xl no-underline"
          >
            🏠
          </a>
        </div>

        {message && (
          <div className="bg-warm-100 rounded-2xl p-4 text-center text-warm-700 mb-4">{message}</div>
        )}

        <h2 className="text-lg font-bold text-warm-700 mb-3">已有旅行 ({trips.length})</h2>
        <div className="space-y-3">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4"
            >
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
                  {trip.date} · {trip.photos.length}张照片
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEditTrip(trip)}
                  className="px-4 py-2 bg-warm-100 text-warm-700 rounded-xl text-base min-h-[48px]"
                >
                  编辑
                </button>
                <button
                  onClick={() => deleteTrip(trip.id)}
                  className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-base min-h-[48px]"
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
