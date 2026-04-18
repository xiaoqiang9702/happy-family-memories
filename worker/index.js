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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/admin-login') return handleAdminLogin(request, env)
    if (url.pathname === '/api/trips') return handleTrips(request, env)
    if (url.pathname === '/api/upload') return handleUpload(request, env)
    if (url.pathname === '/api/public-data') return handlePublicData(request, env)
    if (url.pathname === '/api/verify-password') return handleVerifyPassword(request, env)

    return env.ASSETS.fetch(request)
  },
}
