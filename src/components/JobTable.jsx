import { request, shortId } from '../api'
import { Status } from './ExecutionTable'
import { useState } from 'react'
import { useI18n } from '../i18n'
export default function JobTable({ jobs, onRefresh }) {
  const { t } = useI18n()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  if (!jobs.length)
    return (
      <div className="empty card">
        <div className="empty-icon">✦</div>
        <h3>{t('jobs.emptyTitle')}</h3>
        <p>{t('jobs.emptyCopy')}</p>
      </div>
    )
  const remove = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await request(`/jobs/${pendingDelete.id}`, { method: 'DELETE' })
      setPendingDelete(null)
      onRefresh()
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('jobs.task')}</th>
              <th>{t('jobs.trigger')}</th>
              <th>{t('jobs.action')}</th>
              <th>{t('jobs.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id}>
                <td>
                  <div className="job-name">
                    <span className="job-symbol">
                      {job.action.type === 'http'
                        ? '↗'
                        : job.action.type === 'command'
                          ? '>_'
                          : '♢'}
                    </span>
                    <div>
                      <strong>{job.name}</strong>
                      <small>{shortId(job.id)}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="trigger">
                    <i />
                    {job.trigger.type === 'interval'
                      ? t('jobs.interval', { seconds: job.trigger.seconds })
                      : job.trigger.type === 'cron'
                        ? t('jobs.cron', { expression: job.trigger.expression })
                        : job.trigger.type === 'manual'
                          ? t('jobs.manual')
                          : job.trigger.type}
                  </span>
                </td>
                <td>
                  <span className="action-type">{job.action.type.toUpperCase()}</span>
                </td>
                <td>
                  <Status enabled={job.enabled} />
                </td>
                <td className="row-actions">
                  <button
                    className="row-action"
                    onClick={async () => {
                      try {
                        await request(`/jobs/${job.id}/run`, { method: 'POST' })
                        setTimeout(onRefresh, 400)
                      } catch (error) {
                        alert(error.message)
                      }
                    }}
                  >
                    {t('jobs.run')}
                  </button>
                  <button className="row-delete" onClick={() => setPendingDelete(job)}>
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pendingDelete && (
        <div className="confirm-backdrop">
          <div className="confirm-card">
            <div className="confirm-icon">!</div>
            <h3>{t('jobs.deleteQuestion')}</h3>
            <p>{t('jobs.deleteCopy', { name: pendingDelete.name })}</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setPendingDelete(null)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button className="danger-button" onClick={remove} disabled={busy}>
                {busy ? t('common.deleting') : t('common.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
