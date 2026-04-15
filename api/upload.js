const GITHUB_API = 'https://api.github.com'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const password = req.headers['x-admin-password']
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: '未授权' })
  }

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO_OWNER || !process.env.GITHUB_REPO_NAME) {
    return res.status(500).json({ error: 'GitHub 环境变量未配置' })
  }

  const { filename, content, tripFolder } = req.body

  if (!filename || !content || !tripFolder) {
    return res.status(400).json({ error: '缺少参数' })
  }

  const repoPath = `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
  const filePath = `public/trips/${tripFolder}/${filename}`

  try {
    // check if file already exists (to get SHA for update)
    let sha
    try {
      const existing = await fetch(
        `${GITHUB_API}/repos/${repoPath}/contents/${filePath}`,
        { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
      )
      if (existing.ok) {
        const data = await existing.json()
        sha = data.sha
      }
    } catch {}

    const body = {
      message: `Upload photo: ${tripFolder}/${filename}`,
      content, // already base64 encoded from client
    }
    if (sha) body.sha = sha

    const resp = await fetch(
      `${GITHUB_API}/repos/${repoPath}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.message || 'Upload failed')
    }

    return res.json({
      success: true,
      url: `/trips/${tripFolder}/${filename}`,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
