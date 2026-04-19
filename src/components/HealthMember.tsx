import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../hooks/useAppData'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
}

// browser speech recognition detection
function getSpeechRecognition(): any {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function calcAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear
}

export default function HealthMember() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { health } = useAppData()
  const member = health.members.find((m) => m.id === id)

  const [input, setInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // load chat history from localStorage
  useEffect(() => {
    if (!id) return
    const stored = localStorage.getItem(`health-chat-${id}`)
    if (stored) {
      try { setChatHistory(JSON.parse(stored)) } catch {}
    }
  }, [id])

  // save chat history
  useEffect(() => {
    if (id && chatHistory.length > 0) {
      localStorage.setItem(`health-chat-${id}`, JSON.stringify(chatHistory.slice(-20)))
    }
  }, [id, chatHistory])

  // scroll to latest
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

  // today's reminders
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

  const recentRecords = health.records
    .filter((r) => r.memberId === member.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  const startVoiceInput = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      alert('你的浏览器不支持语音输入。请用输入框打字，或用 Safari/Chrome 浏览器。')
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member,
          message,
          history: chatHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'AI 无响应')

      const reply: ChatMessage = {
        role: 'assistant',
        content: data.reply || '抱歉，我现在无法回答',
        time: new Date().toISOString(),
      }
      setChatHistory([...newHistory, reply])
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `抱歉出错了：${err.message}`,
        time: new Date().toISOString(),
      }
      setChatHistory([...newHistory, errorMsg])
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

  const quickQuestions = [
    '我最近睡眠不好',
    '今天有点头晕',
    '血压多少算正常',
    '最近胃口不好',
  ]

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
        {/* profile card */}
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
              <div>
                <span className="text-warm-500">疾病史：</span>
                <span className="text-warm-800">{member.conditions.filter(Boolean).join('、')}</span>
              </div>
            )}
            {member.medications.filter(Boolean).length > 0 && (
              <div>
                <span className="text-warm-500">常用药：</span>
                <span className="text-warm-800">{member.medications.filter(Boolean).join('、')}</span>
              </div>
            )}
            {member.allergies.filter(Boolean).length > 0 && (
              <div>
                <span className="text-warm-500">过敏：</span>
                <span className="text-red-600">{member.allergies.filter(Boolean).join('、')}</span>
              </div>
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

          {/* chat messages */}
          {chatHistory.length === 0 && (
            <div className="text-center py-6 px-3">
              <p className="text-base text-warm-500 mb-3">
                告诉 AI 医生哪里不舒服，会根据档案给出建议
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
                <div
                  key={i}
                  className={`${m.role === 'user' ? 'ml-6' : 'mr-6'}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      m.role === 'user'
                        ? 'bg-warm-500 text-white ml-auto max-w-[85%]'
                        : 'bg-warm-50 text-warm-900 max-w-[90%]'
                    }`}
                  >
                    {m.role === 'assistant' && (
                      <div className="text-xs text-warm-400 mb-1">👨‍⚕️ AI 医生</div>
                    )}
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

          {/* input area */}
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
                    recording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-warm-100 text-warm-700 active:bg-warm-200'
                  }`}
                >
                  {recording ? '🔴 停止录音' : '🎤 语音输入'}
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

        {/* recent records */}
        {recentRecords.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-soft">
            <h3 className="text-lg font-bold text-warm-800 mb-3">📋 最近记录</h3>
            <div className="space-y-3">
              {recentRecords.map((r) => (
                <div key={r.id} className="border-l-4 border-warm-300 pl-3 py-1">
                  <div className="text-sm text-warm-400">
                    {new Date(r.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} · {r.category}
                  </div>
                  <div className="text-base text-warm-800">{r.value}</div>
                  {r.notes && <div className="text-sm text-warm-600 mt-0.5">{r.notes}</div>}
                  {r.aiAnalysis && (
                    <div className="mt-1 text-sm text-warm-600 italic">💡 {r.aiAnalysis}</div>
                  )}
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
