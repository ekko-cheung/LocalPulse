import { prettyTime, shortId } from '../api'
import { useI18n } from '../i18n'
export function Status({ enabled, status }) {
  const { t } = useI18n()
  return (
    <span className={`status ${status === 'success' || enabled ? 'success' : 'muted-status'}`}>
      <i />
      {status || (enabled ? t('common.enabled') : t('common.disabled'))}
    </span>
  )
}
export default function ExecutionTable({
  jobs,
  executions,
  empty = '还没有执行记录，运行一个任务试试。',
}) {
  const { locale, t } = useI18n()
  if (!executions.length)
    return (
      <div className="empty card">
        <div className="empty-icon">◷</div>
        <h3>{t('executions.emptyTitle')}</h3>
        <p>{empty}</p>
      </div>
    )
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('executions.task')}</th>
            <th>{t('executions.status')}</th>
            <th>{t('executions.started')}</th>
            <th>{t('executions.duration')}</th>
            <th>{t('executions.exitCode')}</th>
          </tr>
        </thead>
        <tbody>
          {executions.map(item => (
            <tr key={item.id}>
              <td>
                <strong>
                  {jobs.find(job => job.id === item.job_id)?.name || shortId(item.job_id)}
                </strong>
                <small className="cell-sub">
                  {t('executions.execution', { id: shortId(item.id) })}
                </small>
              </td>
              <td>
                <Status status={item.status} />
              </td>
              <td>{prettyTime(item.started_at, locale)}</td>
              <td>
                {item.finished_at
                  ? `${Math.max(0, (new Date(item.finished_at) - new Date(item.started_at)) / 1000).toFixed(1)}s`
                  : t('executions.running')}
              </td>
              <td>{item.exit_code ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
