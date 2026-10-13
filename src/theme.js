import { useEffect, useState } from 'react'

const STORAGE_KEY = 'localpulse-theme'
const query = window.matchMedia('(prefers-color-scheme: dark)')

const storedTheme = () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

const applyTheme = theme => {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export const initTheme = () => applyTheme(storedTheme() || (query.matches ? 'dark' : 'light'))

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  useEffect(() => {
    const onChange = event => {
      if (!storedTheme()) setTheme(event.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  useEffect(() => applyTheme(theme), [theme])
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }
  return { theme, toggle }
}
