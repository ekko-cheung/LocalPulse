import JobTable from '../components/JobTable'
import { useI18n } from '../i18n'
export default function Tasks({ jobs, onNew, onRefresh, onViewJob }) {
  const { t } = useI18n()
  return (
    <>
      <div className="page-intro">
        <p>{t('tasks.copy')}</p>
        <div className="intro-actions">
          <button className="secondary" onClick={onRefresh}>
            {t('tasks.refresh')}
          </button>
          <button className="primary" onClick={onNew}>
            {t('tasks.create')}
          </button>
        </div>
      </div>
      <div className="filter-row">
        <span className="filter active">
          {t('tasks.all')} <b>{jobs.length}</b>
        </span>
        <span className="filter">
          {t('tasks.enabled')} <b>{jobs.filter(x => x.enabled).length}</b>
        </span>
        <span className="filter">{t('tasks.manual')}</span>
      </div>
      <JobTable jobs={jobs} onRefresh={onRefresh} onViewJob={onViewJob} />
    </>
  )
}
