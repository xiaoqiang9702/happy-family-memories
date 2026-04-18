import { useState } from 'react'
import type { Comment } from '../hooks/useAppData'
import { useAppData } from '../hooks/useAppData'

const AUTHOR_KEY = 'comment-author'

interface Props {
  newsId: string
  comments: Comment[]
}

export default function NewsComments({ newsId, comments }: Props) {
  const { refresh } = useAppData()
  const [author, setAuthor] = useState(() => localStorage.getItem(AUTHOR_KEY) || '')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const submit = async () => {
    const a = author.trim()
    const c = content.trim()
    if (!a) { setError('请输入你的名字'); return }
    if (!c) { setError('请输入评论内容'); return }

    setSubmitting(true)
    setError('')
    try {
      const resp = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId, author: a, content: c }),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || '评论失败')
      }
      localStorage.setItem(AUTHOR_KEY, a)
      setContent('')
      refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}小时前`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay}天前`
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  }

  const displayedComments = expanded ? comments : comments.slice(-2)

  return (
    <div className="mt-4 pt-4 border-t border-warm-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold text-warm-700">
          💬 评论 {comments.length > 0 && `(${comments.length})`}
        </span>
        {comments.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-warm-500 min-h-[32px]"
          >
            {expanded ? '收起' : `查看全部 ${comments.length} 条`}
          </button>
        )}
      </div>

      {/* existing comments */}
      {comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {displayedComments.map((c) => (
            <div key={c.id} className="bg-warm-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-warm-700">{c.author}</span>
                <span className="text-xs text-warm-400">{formatTime(c.date)}</span>
              </div>
              <p className="text-base text-warm-800 leading-relaxed whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* comment input */}
      <div className="space-y-2">
        <input
          type="text"
          value={author}
          onChange={(e) => { setAuthor(e.target.value); setError('') }}
          placeholder="你的名字（如：爸爸、妈妈）"
          maxLength={20}
          className="w-full text-base px-4 py-2 rounded-xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500"
        />
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setError('') }}
          placeholder="写点什么..."
          rows={2}
          maxLength={500}
          className="w-full text-base px-4 py-2 rounded-xl border-2 border-warm-200 bg-white outline-none focus:border-warm-500 resize-none"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-2.5 bg-warm-500 active:bg-warm-600 disabled:bg-warm-300 text-white text-base font-bold rounded-xl"
        >
          {submitting ? '发送中...' : '发送评论'}
        </button>
      </div>
    </div>
  )
}
