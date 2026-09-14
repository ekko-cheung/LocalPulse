import { useMemo } from 'react'
import ExecutionTable from '../components/ExecutionTable'
import { useI18n } from '../i18n'
function Metric({ label, value, detail, icon, color }) {
  return (
    <div className="metric card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  )
}
export default function Dashboard({ jobs, executions, onNew }) {
  const { t } = useI18n()
  const recent = useMemo(
    () =>
      [...executions].sort((a, b) => b.started_at?.localeCompare(a.started_at) || 0).slice(0, 6),
    [executions],
  )
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">{t('dashboard.greeting')}</p>
          <h2>{t('dashboard.title')}</h2>
          <p className="hero-copy">{t('dashboard.copy')}</p>
        </div>
        <button className="primary" onClick={onNew}>
          {t('dashboard.create')}
        </button>
      </section>
      <div className="metrics">
        <Metric
          label={t('dashboard.allJobs')}
          value={jobs.length}
          detail={t('dashboard.savedLocally')}
          icon="▦"
          color="blue"
        />
        <Metric
          label={t('dashboard.activeJobs')}
          value={jobs.filter(job => job.enabled).length}
          detail={t('dashboard.enabledJobs')}
          icon="◉"
          color="green"
        />
        <Metric
          label={t('dashboard.executions')}
          value={executions.length}
          detail={t('dashboard.recentLimit')}
          icon="◷"
          color="purple"
        />
      </div>
      <div className="section-heading">
        <div>
          <h3>{t('dashboard.recent')}</h3>
          <p>{t('dashboard.recentCopy')}</p>
        </div>
        <span className="link">{t('dashboard.viewAll')}</span>
      </div>
      <ExecutionTable jobs={jobs} executions={recent} />
    </>
  )
}
