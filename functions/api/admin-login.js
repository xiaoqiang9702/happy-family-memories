export async function onRequestPost(context) {
  const { request, env } = context
  const { password } = await request.json()

  if (!env.ADMIN_PASSWORD) {
    return Response.json({ error: '管理密码未配置' }, { status: 500 })
  }

  if (password === env.ADMIN_PASSWORD) {
    return Response.json({ success: true })
  }

  return Response.json({ error: '密码错误' }, { status: 401 })
}
