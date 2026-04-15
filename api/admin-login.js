export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { password } = req.body
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return res.status(500).json({ error: '管理密码未配置' })
  }

  if (password === adminPassword) {
    return res.json({ success: true })
  }

  return res.status(401).json({ error: '密码错误' })
}
