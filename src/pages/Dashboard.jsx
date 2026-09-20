import JobTable from '../components/JobTable'
import { useI18n } from '../i18n'
export default function Dashboard({ jobs, executions, onNew, onRefresh, onViewJob }) {
  const { t } = useI18n()
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('dashboard.greeting')}</p>
          <h2>{t('dashboard.taskList')}</h2>
          <p>{t('dashboard.taskListCopy')}</p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary" onClick={onRefresh}>
            {t('tasks.refresh')}
          </button>
          <button className="primary add-task" onClick={onNew}>
            <span>＋</span> {t('dashboard.addTask')}
          </button>
        </div>
      </div>
      <JobTable jobs={jobs} onRefresh={onRefresh} onViewJob={onViewJob} />
      <div className="dashboard-summary">
        <span>
          {t('dashboard.allJobs')}: <strong>{jobs.length}</strong>
        </span>
        <span>
          {t('dashboard.activeJobs')}: <strong>{jobs.filter(job => job.enabled).length}</strong>
        </span>
        <span>
          {t('dashboard.executions')}: <strong>{executions.length}</strong>
        </span>
      </div>
    </>
  )
}
