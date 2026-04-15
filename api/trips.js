const GITHUB_API = 'https://api.github.com'

function getGitHubHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

function getRepoPath() {
  return `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
}

async function getTripsFile() {
  const resp = await fetch(
    `${GITHUB_API}/repos/${getRepoPath()}/contents/src/data/trips.json`,
    { headers: getGitHubHeaders() }
  )
  if (!resp.ok) throw new Error('Failed to read trips.json from GitHub')
  const data = await resp.json()
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'))
  return { content, sha: data.sha }
}

async function updateTripsFile(content, sha) {
  const resp = await fetch(
    `${GITHUB_API}/repos/${getRepoPath()}/contents/src/data/trips.json`,
    {
      method: 'PUT',
      headers: getGitHubHeaders(),
      body: JSON.stringify({
        message: `Update trips: ${new Date().toLocaleString('zh-CN')}`,
        content: Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64'),
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

export default async function handler(req, res) {
  // verify admin password
  const password = req.headers['x-admin-password']
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: '未授权' })
  }

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO_OWNER || !process.env.GITHUB_REPO_NAME) {
    return res.status(500).json({ error: 'GitHub 环境变量未配置' })
  }

  try {
    if (req.method === 'GET') {
      const { content } = await getTripsFile()
      return res.json(content)
    }

    if (req.method === 'PUT') {
      const { trips } = req.body
      const { content, sha } = await getTripsFile()
      content.trips = trips
      await updateTripsFile(content, sha)
      return res.json({ success: true, message: '保存成功，Vercel 将在约1分钟后自动更新' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
