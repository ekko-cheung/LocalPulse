const MODE_KEY = 'localpulse-mode'
const REMOTE_URL_KEY = 'localpulse-remote-url'
const LOCAL_TOKEN_KEY = 'localpulse-token'
const REMOTE_TOKEN_KEY = 'localpulse-remote-token'
const LOCAL_BASE = 'http://127.0.0.1:7788'

export const getMode = () => (localStorage.getItem(MODE_KEY) === 'remote' ? 'remote' : 'local')
export const setMode = mode => localStorage.setItem(MODE_KEY, mode)
export const getRemoteUrl = () => localStorage.getItem(REMOTE_URL_KEY) || ''
export const setRemoteUrl = url => localStorage.setItem(REMOTE_URL_KEY, url)
export const getToken = () =>
  localStorage.getItem(getMode() === 'remote' ? REMOTE_TOKEN_KEY : LOCAL_TOKEN_KEY) || ''
export const setToken = (value, mode = getMode()) =>
  localStorage.setItem(mode === 'remote' ? REMOTE_TOKEN_KEY : LOCAL_TOKEN_KEY, value)

// Accepts "host:port", "http://host:port" or a full URL; returns a normalized origin.
export const normalizeRemoteUrl = input => {
  const raw = input
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '')
  if (!raw) return ''
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`
}

export const getApiBase = () =>
  `${getMode() === 'remote' ? normalizeRemoteUrl(getRemoteUrl()) : LOCAL_BASE}/api/v1`
