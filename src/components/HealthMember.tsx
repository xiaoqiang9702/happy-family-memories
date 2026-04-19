import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../hooks/useAppData'
import { getFamilyPassword } from '../hooks/useAuth'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
}

function getSpeechRecognition(): any {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function calcAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear
}

type Section = null | 'report' | 'record' | 'reminder'

const RECORD_CATEGORIES = [
  { value: '血压', unit: '例：140/90 mmHg', placeholder: '如 140/90' },
  { value: '血糖', unit: '例：6.2 mmol/L', placeholder: '如 6.2' },
  { value: '体重', unit: '例：62 kg', placeholder: '如 62' },
  { value: '体温', unit: '例：36.8 ℃', placeholder: '如 36.8' },
  { value: '心率', unit: '例：72 次/分', placeholder: '如 72' },
  { value: '日志', unit: '用一句话描述', placeholder: '如 今天散步1小时' },
  { value: '其他', unit: '', placeholder: '' },
]

export default function HealthMember() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { health, refresh } = useAppData()
  const member = health.members.find((m) => m.id === id)

  const [input, setInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [activeSection, setActiveSection] = useState<Section>(null)

  // report upload state
  const [reportFile, setReportFile] = useState<File | null>(null)
  const [reportPreview, setReportPreview] = useState<string>('')
  const [reportAnalysis, setReportAnalysis] = useState<string>('')
  const [reportExtracted, setReportExtracted] = useState<string>('')
  const [reportBusy, setReportBusy] = useState(false)
  const reportFileRef = useRef<HTMLInputElement>(null)

  // record state
  const [recCategory, setRecCategory] = useState(RECORD_CATEGORIES[0].value)
  const [recValue, setRecValue] = useState('')
  const [recNotes, setRecNotes] = useState('')
  const [recSaving, setRecSaving] = useState(false)

  // reminder state
  const [remTitle, setRemTitle] = useState('')
  const [remTime, setRemTime] = useState('08:00')
  const [remFreq, setRemFreq] = useState<'daily' | 'weekly' | 'once'>('daily')
  const [remType, setRemType] = useState<'medication' | 'measurement' | 'exercise' | 'checkup' | 'custom'>('medication')
  const [remSaving, setRemSaving] = useState(false)

  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!id) return
    const stored = localStorage.getItem(`health-chat-${id}`)
    if (stored) {
      try { setChatHistory(JSON.parse(stored)) } catch {}
    }
  }, [id])

  useEffect(() => {
    if (id && chatHistory.length > 0) {
      localStorage.setItem(`health-chat-${id}`, JSON.stringify(chatHistory.slice(-20)))
    }
  }, [id, chatHistory])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, asking])

  if (!member) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-warm-50 px-6">
        <div className="text-6xl mb-4">😕</div>
        <p className="text-xl text-warm-700 mb-6">没找到这位家人</p>
        <button
          onClick={() => navigate('/health')}
          className="px-8 py-4 bg-warm-500 text-white text-xl rounded-2xl font-bold"
        >
          返回
        </button>
      </div>
    )
  }

  const age = calcAge(member.birthYear)
  const familyPass = getFamilyPassword()

  const todayReminders = (() => {
    const today = new Date()
    const dow = today.getDay()
    return health.reminders.filter((r) => {
      if (!r.enabled || r.memberId !== member.id) return false
      if (r.frequency === 'daily') return true
      if (r.frequency === 'weekly' && r.daysOfWeek?.includes(dow)) return true
      if (r.frequency === 'once' && r.date === today.toISOString().split('T')[0]) return true
      return false
    })
  })()

  const memberReminders = health.reminders.filter((r) => r.memberId === member.id)
  const recentRecords = health.records
    .filter((r) => r.memberId === member.id)
    .sort((a, b) => (b.date + (b.id || '')).localeCompare(a.date + (a.id || '')))
    .slice(0, 5)

  // === Voice input ===

  const startVoiceInput = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      alert('当前浏览器不支持语音。请打字，或用 Safari/Chrome。')
      return
    }
    const recognition = new Recognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart = () => setRecording(true)
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      setInput((prev) => prev ? `${prev} ${text}` : text)
    }
    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
  }

  const stopVoiceInput = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  // === AI Chat ===

  const askDoctor = async () => {
    const message = input.trim()
    if (!message || asking) return
    const now = new Date().toISOString()
    const newUserMsg: ChatMessage = { role: 'user', content: message, time: now }
    const newHistory = [...chatHistory, newUserMsg]
    setChatHistory(newHistory)
    setInput('')
    setAsking(true)

    try {
      const resp = await fetch('/api/health-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
        body: JSON.stringify({
          member,
          message,
          history: chatHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'AI 无响应')
      setChatHistory([...newHistory, { role: 'assistant', content: data.reply || '抱歉，无法回答', time: new Date().toISOString() }])
    } catch (err: any) {
      setChatHistory([...newHistory, { role: 'assistant', content: `抱歉出错了：${err.message}`, time: new Date().toISOString() }])
    } finally {
      setAsking(false)
    }
  }

  const clearChat = () => {
    if (confirm('确定清空对话记录吗？')) {
      setChatHistory([])
      localStorage.removeItem(`health-chat-${id}`)
    }
  }

  // === Report upload + AI analyze ===

  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<string> =>
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
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
        }
        img.src = e.target!.result as string
      }
      reader.readAsDataURL(file)
    })

  const handleReportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReportFile(file)
    setReportPreview(URL.createObjectURL(file))
    setReportAnalysis('')
    setReportExtracted('')
    e.target.value = ''
  }

  const analyzeReport = async () => {
    if (!reportFile) return
    setReportBusy(true)
    setReportAnalysis('')
    setReportExtracted('')
    try {
      const base64 = await compressImage(reportFile, 1024, 0.85)
      const resp = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
        body: JSON.stringify({ image: base64, member }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || '分析失败')
      setReportExtracted(data.extracted || '')
      setReportAnalysis(data.analysis || '')
    } catch (err: any) {
      setReportAnalysis(`❌ ${err.message}`)
    } finally {
      setReportBusy(false)
    }
  }

  const saveReportAsRecord = async () => {
    if (!reportAnalysis) return
    setReportBusy(true)
    try {
      const resp = await fetch('/api/health-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
        body: JSON.stringify({
          action: 'addRecord',
          data: {
            memberId: member.id,
            category: '检查报告',
            value: reportExtracted.slice(0, 200) || '检查报告已上传',
            notes: '',
            aiAnalysis: reportAnalysis,
          },
        }),
      })
      if (!resp.ok) throw new Error('保存失败')
      setMessage('✓ 已保存到健康记录')
      refresh()
      // reset
      setReportFile(null)
      setReportPreview('')
      setReportAnalysis('')
      setReportExtracted('')
      setTimeout(() => setActiveSection(null), 800)
    } catch (err: any) {
      setMessage(`失败: ${err.message}`)
    } finally {
      setReportBusy(false)
    }
  }

  // === Record ===

  const saveRecord = async () => {
    if (!recValue.trim()) {
      setMessage('请输入数值')
      return
    }
    setRecSaving(true)
    try {
      const resp = await fetch('/api/health-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
        body: JSON.stringify({
          action: 'addRecord',
          data: { memberId: member.id, category: recCategory, value: recValue.trim(), notes: recNotes.trim() },
        }),
      })
      if (!resp.ok) throw new Error('保存失败')
      setMessage('✓ 已记录')
      refresh()
      setRecValue('')
      setRecNotes('')
      setTimeout(() => setActiveSection(null), 800)
    } catch (err: any) {
      setMessage(`失败: ${err.message}`)
    } finally {
      setRecSaving(false)
    }
  }

  // === Reminder ===

  const saveReminder = async () => {
    if (!remTitle.trim()) {
      setMessage('请填写提醒内容')
      return
    }
    setRemSaving(true)
    try {
      const resp = await fetch('/api/health-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
        body: JSON.stringify({
          action: 'addReminder',
          data: {
            memberId: member.id,
            type: remType,
            title: remTitle.trim(),
            time: remTime,
            frequency: remFreq,
          },
        }),
      })
      if (!resp.ok) throw new Error('保存失败')
      setMessage('✓ 提醒已添加')
      refresh()
      setRemTitle('')
      setTimeout(() => setActiveSection(null), 800)
    } catch (err: any) {
      setMessage(`失败: ${err.message}`)
    } finally {
      setRemSaving(false)
    }
  }

  const toggleReminder = async (remId: string, enabled: boolean) => {
    await fetch('/api/health-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
      body: JSON.stringify({ action: 'updateReminder', data: { id: remId, enabled } }),
    })
    refresh()
  }

  const deleteReminder = async (remId: string) => {
    if (!confirm('确定删除这个提醒？')) return
    await fetch('/api/health-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
      body: JSON.stringify({ action: 'deleteReminder', data: { id: remId } }),
    })
    refresh()
  }

  const deleteRecord = async (recId: string) => {
    if (!confirm('确定删除这条记录？')) return
    await fetch('/api/health-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-family-password': familyPass },
      body: JSON.stringify({ action: 'deleteRecord', data: { id: recId } }),
    })
    refresh()
  }

  const quickQuestions = ['我最近睡眠不好', '今天有点头晕', '血压多少算正常', '最近胃口不好']

  return (
    <div className="min-h-screen bg-warm-50 pb-nav">
      <header
        className="sticky top-0 z-10 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200 px-4 py-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/health')}
            className="text-lg px-4 py-2 rounded-xl bg-warm-100 text-warm-700 font-medium min-h-[48px]"
          >
            ← 返回
          </button>
          <h1 className="text-xl font-bold text-warm-800 flex-1 truncate">
            {member.avatar} {member.name}的健康
          </h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* profile */}
        <div className="bg-white rounded-3xl p-5 shadow-soft">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-6xl">{member.avatar}</div>
            <div>
              <h2 className="text-2xl font-bold text-warm-800">{member.name}</h2>
              <p className="text-base text-warm-500">{member.relation} · {age}岁 · {member.gender === 'female' ? '女' : '男'}</p>
            </div>
          </div>
          <div className="space-y-2 text-base">
            {member.conditions.filter(Boolean).length > 0 && (
              <div><span className="text-warm-500">疾病史：</span><span className="text-warm-800">{member.conditions.filter(Boolean).join('、')}</span></div>
            )}
            {member.medications.filter(Boolean).length > 0 && (
              <div><span className="text-warm-500">常用药：</span><span className="text-warm-800">{member.medications.filter(Boolean).join('、')}</span></div>
            )}
            {member.allergies.filter(Boolean).length > 0 && (
              <div><span className="text-warm-500">过敏：</span><span className="text-red-600">{member.allergies.filter(Boolean).join('、')}</span></div>
            )}
            {!member.conditions.filter(Boolean).length && !member.medications.filter(Boolean).length && (
              <p className="text-warm-400 text-sm">暂无健康档案，请管理员在后台录入</p>
            )}
          </div>
        </div>

        {/* today's reminders */}
        {todayReminders.length > 0 && (
          <div className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-3xl p-5 shadow-soft border border-amber-200">
            <h3 className="text-lg font-bold text-amber-800 mb-3">⏰ 今日提醒</h3>
            <div className="space-y-2">
              {todayReminders.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl p-3 flex items-center gap-3">
                  <span className="text-xl font-bold text-amber-600 shrink-0">{r.time}</span>
                  <span className="text-base text-warm-800 flex-1">{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveSection(activeSection === 'report' ? null : 'report')}
            className={`py-3 rounded-2xl text-base font-bold transition-colors ${
              activeSection === 'report' ? 'bg-warm-500 text-white' : 'bg-white text-warm-700 border-2 border-warm-200 active:bg-warm-100'
            }`}
          >
            📷<br />上传报告
          </button>
          <button
            onClick={() => setActiveSection(activeSection === 'record' ? null : 'record')}
            className={`py-3 rounded-2xl text-base font-bold transition-colors ${
              activeSection === 'record' ? 'bg-warm-500 text-white' : 'bg-white text-warm-700 border-2 border-warm-200 active:bg-warm-100'
            }`}
          >
            📊<br />记录数据
          </button>
          <button
            onClick={() => setActiveSection(activeSection === 'reminder' ? null : 'reminder')}
            className={`py-3 rounded-2xl text-base font-bold transition-colors ${
              activeSection === 'reminder' ? 'bg-warm-500 text-white' : 'bg-white text-warm-700 border-2 border-warm-200 active:bg-warm-100'
            }`}
          >
            ⏰<br />加提醒
          </button>
        </div>

        {/* Report upload section */}
        {activeSection === 'report' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft space-y-3">
            <h3 className="text-lg font-bold text-warm-800">📷 上传检查报告</h3>
            <p className="text-sm text-warm-500">拍照或上传检查报告，AI 医生帮您解读</p>
            <input
              ref={reportFileRef}
              type="file"
              accept="image/*"
              onChange={handleReportSelect}
              className="hidden"
            />
            {!reportPreview ? (
              <button
                onClick={() => reportFileRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-warm-300 rounded-2xl text-warm-600 text-lg font-medium bg-warm-50 active:bg-warm-100"
              >
                📸 拍照或选择报告
              </button>
            ) : (
              <>
                <img src={reportPreview} alt="" className="w-full rounded-2xl max-h-80 object-contain bg-warm-50" />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setReportFile(null); setReportPreview(''); setReportAnalysis('') }}
                    className="flex-1 py-3 bg-warm-100 text-warm-700 rounded-2xl font-bold"
                  >
                    重选
                  </button>
                  <button
                    onClick={analyzeReport}
                    disabled={reportBusy}
                    className="flex-1 py-3 bg-warm-500 disabled:bg-warm-300 text-white rounded-2xl font-bold"
                  >
                    {reportBusy ? 'AI 分析中...' : '🪄 AI 分析'}
                  </button>
                </div>
              </>
            )}
            {reportAnalysis && (
              <div className="bg-warm-50 rounded-2xl p-4 space-y-2">
                <div className="text-sm font-bold text-warm-600">👨‍⚕️ AI 医生解读</div>
                <p className="text-base text-warm-900 leading-relaxed whitespace-pre-wrap">{reportAnalysis}</p>
                {reportExtracted && (
                  <details className="text-sm">
                    <summary className="text-warm-500 cursor-pointer">查看识别的原文</summary>
                    <p className="mt-2 text-warm-600 whitespace-pre-wrap">{reportExtracted}</p>
                  </details>
                )}
                <button
                  onClick={saveReportAsRecord}
                  disabled={reportBusy}
                  className="w-full mt-2 py-3 bg-warm-500 text-white rounded-2xl font-bold"
                >
                  保存到健康记录
                </button>
              </div>
            )}
          </div>
        )}

        {/* Record section */}
        {activeSection === 'record' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft space-y-3">
            <h3 className="text-lg font-bold text-warm-800">📊 记录健康数据</h3>
            <div>
              <label className="block text-sm font-bold text-warm-600 mb-1">类别</label>
              <div className="grid grid-cols-4 gap-1.5">
                {RECORD_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setRecCategory(c.value)}
                    className={`py-2 text-sm rounded-xl transition-colors ${
                      recCategory === c.value ? 'bg-warm-500 text-white' : 'bg-warm-50 text-warm-700 active:bg-warm-100'
                    }`}
                  >
                    {c.value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-warm-600 mb-1">
                数值 {RECORD_CATEGORIES.find((c) => c.value === recCategory)?.unit && <span className="text-warm-400 font-normal">（{RECORD_CATEGORIES.find((c) => c.value === recCategory)?.unit}）</span>}
              </label>
              <input
                type="text"
                value={recValue}
                onChange={(e) => setRecValue(e.target.value)}
                placeholder={RECORD_CATEGORIES.find((c) => c.value === recCategory)?.placeholder}
                className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-warm-600 mb-1">备注（可选）</label>
              <input
                type="text"
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
                placeholder="如 饭后/运动后"
                className="w-full text-base px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
              />
            </div>
            <button
              onClick={saveRecord}
              disabled={recSaving}
              className="w-full py-3 bg-warm-500 disabled:bg-warm-300 text-white text-lg font-bold rounded-2xl"
            >
              {recSaving ? '保存中...' : '记录'}
            </button>
          </div>
        )}

        {/* Reminder section */}
        {activeSection === 'reminder' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft space-y-3">
            <h3 className="text-lg font-bold text-warm-800">⏰ 添加提醒</h3>
            <div>
              <label className="block text-sm font-bold text-warm-600 mb-1">类型</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { v: 'medication', label: '💊药' },
                  { v: 'measurement', label: '📏测' },
                  { v: 'exercise', label: '🚶运动' },
                  { v: 'checkup', label: '🏥体检' },
                  { v: 'custom', label: '其他' },
                ].map((t) => (
                  <button
                    key={t.v}
                    onClick={() => setRemType(t.v as any)}
                    className={`py-2 text-xs rounded-xl transition-colors ${
                      remType === t.v ? 'bg-warm-500 text-white' : 'bg-warm-50 text-warm-700 active:bg-warm-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-warm-600 mb-1">提醒内容</label>
              <input
                type="text"
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                placeholder="如 吃降压药"
                className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-warm-600 mb-1">时间</label>
                <input
                  type="time"
                  value={remTime}
                  onChange={(e) => setRemTime(e.target.value)}
                  className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-warm-600 mb-1">频率</label>
                <select
                  value={remFreq}
                  onChange={(e) => setRemFreq(e.target.value as any)}
                  className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-white focus:border-warm-500 outline-none"
                >
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="once">仅一次</option>
                </select>
              </div>
            </div>
            <button
              onClick={saveReminder}
              disabled={remSaving}
              className="w-full py-3 bg-warm-500 disabled:bg-warm-300 text-white text-lg font-bold rounded-2xl"
            >
              {remSaving ? '保存中...' : '添加提醒'}
            </button>
          </div>
        )}

        {message && (
          <div className="bg-warm-100 rounded-2xl p-3 text-center text-warm-700">{message}</div>
        )}

        {/* AI family doctor chat */}
        <div className="bg-white rounded-3xl p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-warm-800">👨‍⚕️ AI 家庭医生</h3>
            {chatHistory.length > 0 && (
              <button
                onClick={clearChat}
                className="text-sm text-warm-400 px-2 py-1"
              >
                清空
              </button>
            )}
          </div>

          {chatHistory.length === 0 && (
            <div className="text-center py-4 px-3">
              <p className="text-base text-warm-500 mb-3">
                告诉 AI 医生哪里不舒服
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-sm bg-warm-100 text-warm-700 px-3 py-2 rounded-xl active:bg-warm-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatHistory.length > 0 && (
            <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
              {chatHistory.map((m, i) => (
                <div key={i} className={`${m.role === 'user' ? 'ml-6' : 'mr-6'}`}>
                  <div className={`rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-warm-500 text-white ml-auto max-w-[85%]' : 'bg-warm-50 text-warm-900 max-w-[90%]'}`}>
                    {m.role === 'assistant' && <div className="text-xs text-warm-400 mb-1">👨‍⚕️ AI 医生</div>}
                    <p className="text-base leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              {asking && (
                <div className="mr-6">
                  <div className="bg-warm-50 rounded-2xl px-4 py-3 max-w-[90%]">
                    <div className="text-xs text-warm-400 mb-1">👨‍⚕️ AI 医生</div>
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-warm-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                      <span className="w-2 h-2 bg-warm-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-2 h-2 bg-warm-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          <div className="space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="告诉医生您哪里不舒服..."
              rows={3}
              className="w-full text-lg px-4 py-3 rounded-2xl border-2 border-warm-200 bg-warm-50 focus:border-warm-500 outline-none resize-none"
            />
            <div className="flex gap-2">
              {getSpeechRecognition() && (
                <button
                  onClick={recording ? stopVoiceInput : startVoiceInput}
                  disabled={asking}
                  className={`flex-1 py-3 text-lg font-bold rounded-2xl transition-colors ${
                    recording ? 'bg-red-500 text-white animate-pulse' : 'bg-warm-100 text-warm-700 active:bg-warm-200'
                  }`}
                >
                  {recording ? '🔴 停止' : '🎤 语音'}
                </button>
              )}
              <button
                onClick={askDoctor}
                disabled={asking || !input.trim()}
                className="flex-1 py-3 bg-warm-500 active:bg-warm-600 disabled:bg-warm-300 text-white text-lg font-bold rounded-2xl"
              >
                {asking ? '咨询中...' : '问医生'}
              </button>
            </div>
          </div>
        </div>

        {/* existing reminders */}
        {memberReminders.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-soft">
            <h3 className="text-lg font-bold text-warm-800 mb-3">⏰ 所有提醒 ({memberReminders.length})</h3>
            <div className="space-y-2">
              {memberReminders.map((r) => (
                <div key={r.id} className={`rounded-2xl p-3 flex items-center gap-3 ${r.enabled ? 'bg-warm-50' : 'bg-gray-100 opacity-60'}`}>
                  <span className="text-xl font-bold text-warm-600 shrink-0 w-16">{r.time}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-warm-800 truncate">{r.title}</div>
                    <div className="text-xs text-warm-400">{r.frequency === 'daily' ? '每天' : r.frequency === 'weekly' ? '每周' : '一次'}</div>
                  </div>
                  <button
                    onClick={() => toggleReminder(r.id, !r.enabled)}
                    className={`text-sm px-3 py-1.5 rounded-lg font-medium ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                  >
                    {r.enabled ? '启用' : '关闭'}
                  </button>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    className="text-red-400 text-xl px-2"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* recent records */}
        {recentRecords.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-soft">
            <h3 className="text-lg font-bold text-warm-800 mb-3">📋 最近记录</h3>
            <div className="space-y-3">
              {recentRecords.map((r) => (
                <div key={r.id} className="border-l-4 border-warm-300 pl-3 py-1 relative">
                  <div className="text-sm text-warm-400">
                    {new Date(r.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} · {r.category}
                  </div>
                  <div className="text-base text-warm-800 break-words">{r.value}</div>
                  {r.notes && <div className="text-sm text-warm-600 mt-0.5">{r.notes}</div>}
                  {r.aiAnalysis && (
                    <details className="mt-1 text-sm">
                      <summary className="text-warm-500 cursor-pointer">💡 AI 解读</summary>
                      <p className="mt-1 text-warm-700 whitespace-pre-wrap">{r.aiAnalysis}</p>
                    </details>
                  )}
                  <button
                    onClick={() => deleteRecord(r.id)}
                    className="absolute right-0 top-0 text-red-300 text-sm px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-warm-400 px-4 pt-2">
          ⚠️ AI 建议仅供参考，严重症状请立即就医
        </div>
      </div>
    </div>
  )
}
