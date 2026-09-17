import { useEffect, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { API, invoke, request } from './api'
import Layout from './components/Layout'
import PageHeader from './components/PageHeader'
import TokenModal from './components/TokenModal'
import JobModal from './components/JobModal'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import History from './pages/History'
import Settings from './pages/Settings'
import { useI18n } from './i18n'
import { ALLOWED_PROGRAMS_STORAGE_KEY } from './constants'

export default function App() {
  const { t } = useI18n()
  const [jobs, setJobs] = useState([])
  const [executions, setExecutions] = useState([])
  const [agent, setAgent] = useState('stopped')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showJob, setShowJob] = useState(false)
  const [showToken, setShowToken] = useState(!localStorage.getItem('localpulse-token'))
  const navigate = useNavigate()
  const refresh = async () => {
    try {
      setError('')
      const list = await request('/jobs')
      const history = (
        await Promise.all(list.map(job => request(`/jobs/${job.id}/executions`)))
      ).flat()
      setJobs(list)
      setExecutions(history)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  const startAgent = async () => {
    const token = localStorage.getItem('localpulse-token') || ''
    if (!token) {
      setShowToken(true)
      return
    }
    try {
      const allowedPrograms = localStorage.getItem(ALLOWED_PROGRAMS_STORAGE_KEY)
      if (allowedPrograms !== null) {
        await invoke('set_allowed_programs', { value: allowedPrograms })
      }
      await invoke('start_agent', { token })
      let ready = false
      for (let i = 0; i < 20; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
        try {
          const response = await fetch(`${API}/health`)
          if (response.ok) {
            ready = true
            setAgent('running')
            break
          }
        } catch (_) {}
      }
      if (!ready) {
        setAgent('stopped')
        let detail = 'Agent 未能在 6 秒内启动'
        try {
          await invoke('agent_status')
        } catch (err) {
          detail = err.message || detail
        }
        setError(detail)
        return
      }
      refresh()
    } catch (err) {
      setAgent('stopped')
      setError(err.message || 'Agent 启动失败')
    }
  }
  const stopAgent = async () => {
    await invoke('stop_agent')
    setAgent('stopped')
    setError('')
  }
  useEffect(() => {
    const boot = async () => {
      const token = localStorage.getItem('localpulse-token') || ''
      if (token) await startAgent()
      else refresh()
    }
    boot()
  }, [])
  const failedCount = executions.filter(
    item => item.status === 'failed' || item.status === 'timeout',
  ).length
  return (
    <Layout agent={agent} failedCount={failedCount} onStart={startAgent} onStop={stopAgent}>
      <main className="content">
        <PageHeader agent={agent} error={error} onClearError={() => setError('')} />
        {loading ? (
          <div className="loading">{t('loading')}</div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  jobs={jobs}
                  executions={executions}
                  onNew={() => setShowJob(true)}
                  onRefresh={refresh}
                />
              }
            />
            <Route
              path="/tasks"
              element={<Tasks jobs={jobs} onNew={() => setShowJob(true)} onRefresh={refresh} />}
            />
            <Route path="/history" element={<History jobs={jobs} executions={executions} />} />
            <Route
              path="/settings"
              element={<Settings agent={agent} onStart={startAgent} onStop={stopAgent} />}
            />
            <Route
              path="*"
              element={
                <Dashboard
                  jobs={jobs}
                  executions={executions}
                  onNew={() => setShowJob(true)}
                  onRefresh={refresh}
                />
              }
            />
          </Routes>
        )}
      </main>
      {showJob && (
        <JobModal
          onClose={() => setShowJob(false)}
          onCreated={() => {
            setShowJob(false)
            refresh()
          }}
        />
      )}
      {showToken && (
        <TokenModal
          onSaved={() => {
            setShowToken(false)
            startAgent()
            navigate('/')
          }}
        />
      )}
    </Layout>
  )
}
