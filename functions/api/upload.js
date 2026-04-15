const GITHUB_API = 'https://api.github.com'

function getHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'happy-family-memories',
  }
}

export async function onRequestPost(context) {
  const { env, request } = context
  const password = request.headers.get('x-admin-password')
  if (password !== env.ADMIN_PASSWORD) {
    return Response.json({ error: '未授权' }, { status: 401 })
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return Response.json({ error: 'GitHub 环境变量未配置' }, { status: 500 })
  }

  const { filename, content, tripFolder } = await request.json()
  if (!filename || !content || !tripFolder) {
    return Response.json({ error: '缺少参数' }, { status: 400 })
  }

  const repoPath = `${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}`
  const filePath = `public/trips/${tripFolder}/${filename}`

  try {
    // check if file exists
    let sha
    try {
      const existing = await fetch(
        `${GITHUB_API}/repos/${repoPath}/contents/${filePath}`,
        { headers: getHeaders(env) }
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
      `${GITHUB_API}/repos/${repoPath}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: getHeaders(env),
        body: JSON.stringify(body),
      }
    )

    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.message || 'Upload failed')
    }

    return Response.json({
      success: true,
      url: `/trips/${tripFolder}/${filename}`,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
