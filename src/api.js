export const API = 'http://127.0.0.1:7788/api/v1'
export const invoke = (name, args) => window.__TAURI__?.core?.invoke(name, args)
export const shortId = id => id?.slice(0, 8) || '—'
export const prettyTime = value =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
export async function request(path, options = {}) {
  const rawToken = localStorage.getItem('localpulse-token') || ''
  const token = rawToken.trim().replace(/[\u0000-\u001f\u007f]/g, '')
  const url = `${API}${path}`
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    const payload = await response.json()
    if (!payload.success) throw new Error(payload.error || '请求失败')
    return payload.data
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(`无法访问 Agent API：${url}。请确认 Agent 已启动。`)
    throw error
  }
}
