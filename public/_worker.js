// Cloudflare Worker (also works as Pages Advanced Mode)
// Handles /api/* routes and serves static assets

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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function getTripsFile(env) {
  const resp = await fetch(
    `${GITHUB_API}/repos/${repoPath(env)}/contents/src/data/trips.json`,
    { headers: ghHeaders(env) }
  )
  if (!resp.ok) throw new Error('读取 trips.json 失败')
  const data = await resp.json()
  const decoded = atob(data.content.replace(/\n/g, ''))
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0))
  const content = JSON.parse(new TextDecoder().decode(bytes))
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
    throw new Error(err.message || '更新 trips.json 失败')
  }
  return resp.json()
}

async function handleAdminLogin(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  const { password } = await request.json()
  if (!env.ADMIN_PASSWORD) {
    return jsonResponse({ error: '管理密码未配置' }, 500)
  }
  if (password === env.ADMIN_PASSWORD) {
    return jsonResponse({ success: true })
  }
  return jsonResponse({ error: '密码错误' }, 401)
}

async function handleTrips(request, env) {
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: '未授权' }, 401)
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return jsonResponse({ error: 'GitHub 环境变量未配置' }, 500)
  }
  try {
    if (request.method === 'GET') {
      const { content } = await getTripsFile(env)
      return jsonResponse(content)
    }
    if (request.method === 'PUT') {
      const { trips } = await request.json()
      const { content, sha } = await getTripsFile(env)
      content.trips = trips
      await updateTripsFile(env, content, sha)
      return jsonResponse({ success: true, message: '保存成功，网站将在约1分钟后自动更新' })
    }
    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

async function handleUpload(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: '未授权' }, 401)
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return jsonResponse({ error: 'GitHub 环境变量未配置' }, 500)
  }

  const { filename, content, tripFolder } = await request.json()
  if (!filename || !content || !tripFolder) {
    return jsonResponse({ error: '缺少参数' }, 400)
  }

  const path = `${repoPath(env)}/contents/public/trips/${tripFolder}/${filename}`

  try {
    let sha
    try {
      const existing = await fetch(`${GITHUB_API}/repos/${path}`, {
        headers: ghHeaders(env),
      })
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

    const resp = await fetch(`${GITHUB_API}/repos/${path}`, {
      method: 'PUT',
      headers: ghHeaders(env),
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.message || '上传失败')
    }

    return jsonResponse({
      success: true,
      url: `/trips/${tripFolder}/${filename}`,
    })
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // API routes
    if (url.pathname === '/api/admin-login') {
      return handleAdminLogin(request, env)
    }
    if (url.pathname === '/api/trips') {
      return handleTrips(request, env)
    }
    if (url.pathname === '/api/upload') {
      return handleUpload(request, env)
    }

    // Static assets fallback
    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('Not found', { status: 404 })
  },
}
