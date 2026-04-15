const GITHUB_API = 'https://api.github.com'

function getHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'happy-family-memories',
  }
}

function getRepoPath(env) {
  return `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`
}

async function getTripsFile(env) {
  const resp = await fetch(
    `${GITHUB_API}/repos/${getRepoPath(env)}/contents/src/data/trips.json`,
    { headers: getHeaders(env) }
  )
  if (!resp.ok) throw new Error('Failed to read trips.json from GitHub')
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
    `${GITHUB_API}/repos/${getRepoPath(env)}/contents/src/data/trips.json`,
    {
      method: 'PUT',
      headers: getHeaders(env),
      body: JSON.stringify({
        message: `Update trips: ${new Date().toLocaleString('zh-CN')}`,
        content: encoded,
        sha,
      }),
    }
  )
  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.message || 'Failed to update trips.json')
  }
  return resp.json()
}

export async function onRequestGet(context) {
  const { env, request } = context
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) {
    return Response.json({ error: '未授权' }, { status: 401 })
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return Response.json({ error: 'GitHub 环境变量未配置' }, { status: 500 })
  }
  try {
    const { content } = await getTripsFile(env)
    return Response.json(content)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function onRequestPut(context) {
  const { env, request } = context
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) {
    return Response.json({ error: '未授权' }, { status: 401 })
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return Response.json({ error: 'GitHub 环境变量未配置' }, { status: 500 })
  }
  try {
    const { trips } = await request.json()
    const { content, sha } = await getTripsFile(env)
    content.trips = trips
    await updateTripsFile(env, content, sha)
    return Response.json({ success: true, message: '保存成功，网站将在约1分钟后自动更新' })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
