const GITHUB_API = 'https://api.github.com'

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'happy-family-memories',
  }
}

function repoPath(env) {
  return `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`
}

async function getTripsFile(env) {
  const resp = await fetch(
    `${GITHUB_API}/repos/${repoPath(env)}/contents/src/data/trips.json`,
    { headers: ghHeaders(env) }
  )
  if (!resp.ok) throw new Error('读取 trips.json 失败')
  const data = await resp.json()
  const decoded = atob(data.content.replace(/\n/g, ''))
  const content = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(decoded, c => c.charCodeAt(0))
  ))
  return { content, sha: data.sha }
}

async function updateTripsFile(env, content, sha) {
  const jsonStr = JSON.stringify(content, null, 2) + '\n'
  const encoded = btoa(unescape(encodeURIComponent(jsonStr)))
  const resp = await fetch(
    `${GITHUB_API}/repos/${repoPath(env)}/contents/src/data/trips.json`,
    {
      method: 'PUT',
      headers: ghHeaders(env),
      body: JSON.stringify({
        message: `Update trips: ${new Date().toLocaleString('zh-CN')}`,
        content: encoded,
        sha,
      }),
    }
  )
  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.message || '更新失败')
  }
  return resp.json()
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleAdminLogin(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const { password } = await request.json()
  if (!env.ADMIN_PASSWORD) return json({ error: '管理密码未配置' }, 500)
  if (password === env.ADMIN_PASSWORD) return json({ success: true })
  return json({ error: '密码错误' }, 401)
}

async function handleTrips(request, env) {
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) return json({ error: '未授权' }, 401)
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return json({ error: 'GitHub 环境变量未配置' }, 500)
  }
  try {
    if (request.method === 'GET') {
      const { content } = await getTripsFile(env)
      return json(content)
    }
    if (request.method === 'PUT') {
      const body = await request.json()
      const { content, sha } = await getTripsFile(env)
      if (body.trips !== undefined) content.trips = body.trips
      if (body.news !== undefined) content.news = body.news
      if (body.health !== undefined) content.health = body.health
      await updateTripsFile(env, content, sha)
      return json({ success: true, message: '保存成功，网站将在约1分钟后自动更新' })
    }
    return json({ error: 'Method not allowed' }, 405)
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

async function handleUpload(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) return json({ error: '未授权' }, 401)
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return json({ error: 'GitHub 环境变量未配置' }, 500)
  }

  const { filename, content, tripFolder } = await request.json()
  if (!filename || !content || !tripFolder) return json({ error: '缺少参数' }, 400)

  const rp = repoPath(env)
  const filePath = `public/trips/${tripFolder}/${filename}`

  try {
    let sha
    try {
      const existing = await fetch(
        `${GITHUB_API}/repos/${rp}/contents/${filePath}`,
        { headers: ghHeaders(env) }
      )
      if (existing.ok) {
        const data = await existing.json()
        sha = data.sha
      }
    } catch {}

    const body = {
      message: `Upload photo: ${tripFolder}/${filename}`,
      content,
    }
    if (sha) body.sha = sha

    const resp = await fetch(
      `${GITHUB_API}/repos/${rp}/contents/${filePath}`,
      { method: 'PUT', headers: ghHeaders(env), body: JSON.stringify(body) }
    )
    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.message || '上传失败')
    }
    return json({ success: true, url: `/trips/${tripFolder}/${filename}` })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

async function handlePublicData(_request, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return json({ error: 'GitHub 环境变量未配置' }, 500)
  }
  try {
    const { content } = await getTripsFile(env)
    // strip password, never return it publicly
    const { password: _p, ...safe } = content
    return new Response(JSON.stringify(safe), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

async function handleVerifyPassword(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { password } = await request.json()
    const { content } = await getTripsFile(env)
    if (password === content.password) return json({ success: true })
    return json({ error: '密码错误' }, 401)
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

// Generate a caption for a single photo using Workers AI
async function handleAiCaption(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) return json({ error: '未授权' }, 401)
  if (!env.AI) return json({ error: 'AI 服务未配置' }, 500)

  try {
    const { image } = await request.json()
    if (!image) return json({ error: '缺少图片数据' }, 400)

    // decode base64 to bytes
    const binary = atob(image)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: Array.from(bytes),
      prompt: 'Describe what you see in this photo in one short Chinese sentence, focused on the main subject, scene, or emotion. Reply ONLY in Chinese, 10-20 Chinese characters.',
      max_tokens: 80,
    })

    let caption = (result?.description || result?.response || '').trim()
    // clean up: remove quotes, english artifacts
    caption = caption.replace(/^["'""]|["'""]$/g, '').trim()
    if (!caption) caption = '美好瞬间'

    return json({ caption })
  } catch (err) {
    return json({ error: err.message || 'AI 识别失败' }, 500)
  }
}

// Generate a trip summary from photo captions + existing description
async function handleAiSummary(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) return json({ error: '未授权' }, 401)
  if (!env.AI) return json({ error: 'AI 服务未配置' }, 500)

  try {
    const { title, date, captions, existing } = await request.json()
    if (!title) return json({ error: '缺少标题' }, 400)

    const captionList = (captions || []).filter(Boolean).join('、')
    const prompt = `你是一个温暖的家庭相册文案助手。请根据以下信息，写一段50-100字的旅行简介，语气温馨自然，适合家人阅读：

旅行标题：${title}
日期：${date || '未知'}
已有简介：${existing || '无'}
照片关键词：${captionList || '无'}

请直接写简介文字，不要加任何前缀或引号。`

    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    })

    let summary = (result?.response || '').trim()
    summary = summary.replace(/^["'""]|["'""]$/g, '').trim()
    if (!summary) summary = `${title}，和家人一起度过的美好时光。`

    return json({ summary })
  } catch (err) {
    return json({ error: err.message || 'AI 生成失败' }, 500)
  }
}

// AI family doctor consultation
async function handleHealthChat(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!env.AI) return json({ error: 'AI 服务未配置' }, 500)

  try {
    const { member, message, history } = await request.json()
    if (!member || !message) return json({ error: '缺少参数' }, 400)

    const age = new Date().getFullYear() - (member.birthYear || 1980)
    const genderStr = member.gender === 'female' ? '女' : '男'
    const conditions = (member.conditions || []).filter(Boolean).join('、') || '无明显疾病记录'
    const medications = (member.medications || []).filter(Boolean).join('、') || '无'
    const allergies = (member.allergies || []).filter(Boolean).join('、') || '无'

    const systemPrompt = `你是一位温暖耐心的家庭医生助手，服务对象是我的家人。请用温馨亲切的口语化中文回答（避免专业术语），120-200字。

你的患者信息：
- 姓名：${member.name}（${member.relation}）
- 年龄：${age}岁
- 性别：${genderStr}
- 健康状况：${conditions}
- 正在服药：${medications}
- 过敏史：${allergies}
${member.notes ? `- 其他：${member.notes}` : ''}

回答要点：
1. 先用一句话共情关心
2. 简要分析可能原因（结合其健康状况）
3. 给出具体可操作的建议（饮食/休息/是否需要就医）
4. 如果症状严重或紧急，明确提醒立即就医
5. 不要给出具体药物剂量，用药调整请咨询医生`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...((history || []).slice(-6)),
      { role: 'user', content: message },
    ]

    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages,
      max_tokens: 500,
    })

    const reply = (result?.response || '').trim() || '抱歉，我现在无法回答，请稍后再试。'
    return json({ reply })
  } catch (err) {
    return json({ error: err.message || 'AI 咨询失败' }, 500)
  }
}

// Add a health record (no admin required - family can log)
async function handleHealthRecord(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!env.GITHUB_TOKEN) return json({ error: 'GitHub 未配置' }, 500)
  try {
    const { record } = await request.json()
    if (!record || !record.memberId) return json({ error: '缺少参数' }, 400)

    const { content, sha } = await getTripsFile(env)
    if (!content.health) content.health = { members: [], records: [], reminders: [] }
    if (!content.health.records) content.health.records = []
    const newRecord = {
      id: `rec-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      ...record,
    }
    content.health.records.push(newRecord)
    await updateTripsFile(env, content, sha)
    return json({ success: true, record: newRecord })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

// Add a comment to a news item (no auth, just site password baseline)
async function handleComment(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return json({ error: 'GitHub 环境变量未配置' }, 500)
  }
  try {
    const { newsId, author, content: text } = await request.json()
    if (!newsId || !author || !text) return json({ error: '缺少参数' }, 400)
    if (author.length > 20 || text.length > 500) return json({ error: '内容过长' }, 400)

    const { content, sha } = await getTripsFile(env)
    if (!content.news) content.news = []
    const news = content.news.find((n) => n.id === newsId)
    if (!news) return json({ error: '新闻不存在' }, 404)
    if (!news.comments) news.comments = []
    news.comments.push({
      id: `c-${Date.now()}`,
      author: author.trim(),
      date: new Date().toISOString(),
      content: text.trim(),
    })
    await updateTripsFile(env, content, sha)
    return json({ success: true, comments: news.comments })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/admin-login') return handleAdminLogin(request, env)
    if (url.pathname === '/api/trips') return handleTrips(request, env)
    if (url.pathname === '/api/upload') return handleUpload(request, env)
    if (url.pathname === '/api/public-data') return handlePublicData(request, env)
    if (url.pathname === '/api/verify-password') return handleVerifyPassword(request, env)
    if (url.pathname === '/api/ai-caption') return handleAiCaption(request, env)
    if (url.pathname === '/api/ai-summary') return handleAiSummary(request, env)
    if (url.pathname === '/api/comment') return handleComment(request, env)
    if (url.pathname === '/api/health-chat') return handleHealthChat(request, env)
    if (url.pathname === '/api/health-record') return handleHealthRecord(request, env)

    return env.ASSETS.fetch(request)
  },
}
