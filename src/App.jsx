import { useEffect, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { invoke, request } from './api'
import { getApiBase, getMode, getRemoteUrl, getToken, setMode } from './connection'
import Layout from './components/Layout'
import PageHeader from './components/PageHeader'
import TokenModal from './components/TokenModal'
import JobModal from './components/JobModal'
import JobDetailsModal from './components/JobDetailsModal'
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
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [showToken, setShowToken] = useState(getMode() === 'local' && !getToken())
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
  const connectRemote = async () => {
    if (!getToken() || getApiBase().startsWith('http:///')) {
      setAgent('stopped')
      setError(t('settings.remoteIncomplete'))
      return
    }
    try {
      const response = await fetch(`${getApiBase()}/health`)
      if (!response.ok) throw new Error(String(response.status))
      setAgent('running')
      await refresh()
    } catch (_) {
      setAgent('stopped')
      setJobs([])
      setExecutions([])
      setLoading(false)
      setError(t('errors.apiUnavailable', { url: getApiBase() }))
    }
  }
  const startAgent = async () => {
    if (getMode() === 'remote') return connectRemote()
    const token = getToken()
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
          const response = await fetch(`${getApiBase()}/health`)
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
  const switchMode = async mode => {
    if (mode === getMode()) return
    if (getMode() === 'local') await invoke('stop_agent').catch(() => {})
    setMode(mode)
    setAgent('stopped')
    setError('')
    setJobs([])
    setExecutions([])
    if (mode === 'local' && !getToken()) setShowToken(true)
    else if (mode === 'local' || getRemoteUrl()) await startAgent()
  }
  const stopAgent = async () => {
    if (getMode() === 'local') await invoke('stop_agent')
    setAgent('stopped')
    setError('')
  }
  useEffect(() => {
    const boot = async () => {
      if (getMode() === 'remote' || getToken()) await startAgent()
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
        <PageHeader error={error} onClearError={() => setError('')} />
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
                  onViewJob={setSelectedJobId}
                />
              }
            />
            <Route
              path="/tasks"
              element={
                <Tasks
                  jobs={jobs}
                  onNew={() => setShowJob(true)}
                  onRefresh={refresh}
                  onViewJob={setSelectedJobId}
                />
              }
            />
            <Route path="/history" element={<History jobs={jobs} executions={executions} />} />
            <Route
              path="/settings"
              element={
                <Settings
                  agent={agent}
                  onStart={startAgent}
                  onStop={stopAgent}
                  onSwitchMode={switchMode}
                />
              }
            />
            <Route
              path="*"
              element={
                <Dashboard
                  jobs={jobs}
                  executions={executions}
                  onNew={() => setShowJob(true)}
                  onRefresh={refresh}
                  onViewJob={setSelectedJobId}
                />
              }
            />
          </Routes>
        )}
      </main>
      {showJob && (
        <JobModal
          onClose={() => setShowJob(false)}
          onSaved={() => {
            setShowJob(false)
            refresh()
          }}
        />
      )}
      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onUpdated={() => {
            setSelectedJobId(null)
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
