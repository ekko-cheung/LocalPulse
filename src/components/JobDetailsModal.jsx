import { useEffect, useState } from 'react'
import { prettyTime, request } from '../api'
import { useI18n } from '../i18n'
import { Status } from './ExecutionTable'
import JobModal from './JobModal'

export default function JobDetailsModal({ jobId, onClose, onUpdated }) {
  const { locale, t } = useI18n()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    request(`/jobs/${jobId}`)
      .then(result => {
        if (active) setJob(result)
      })
      .catch(err => {
        if (active) setError(err.message || String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [jobId])

  if (editing && job) {
    return <JobModal job={job} onClose={() => setEditing(false)} onSaved={onUpdated} />
  }

  const trigger = job?.trigger || {}
  const triggerDescription =
    trigger.type === 'interval'
      ? t('jobs.interval', { seconds: trigger.seconds })
      : trigger.type === 'cron'
        ? t('jobs.cron', { expression: trigger.expression })
        : trigger.type === 'once'
          ? t('jobs.once', {
              time: new Date(trigger.run_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                hour12: false,
              }),
            })
          : trigger.type === 'manual'
            ? t('jobs.manual')
            : trigger.type || '—'

  return (
    <div className="modal-backdrop">
      <section
        className="modal-card job-card job-detail-card"
        aria-labelledby="job-detail-title"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t('modal.detailsEyebrow')}</p>
            <h2 id="job-detail-title">{job?.name || t('modal.taskDetails')}</h2>
          </div>
          <button type="button" className="close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="loading job-detail-loading">{t('loading')}</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : (
          <>
            <div className="job-detail-grid">
              <div className="job-detail-item">
                <span>{t('modal.status')}</span>
                <Status enabled={job.enabled} />
              </div>
              <div className="job-detail-item">
                <span>{t('modal.trigger')}</span>
                <strong>{triggerDescription}</strong>
              </div>
              <div className="job-detail-item">
                <span>{t('modal.actionType')}</span>
                <strong>{t(`modal.${job.action?.type}`)}</strong>
              </div>
              <div className="job-detail-item">
                <span>{t('modal.maxAttempts')}</span>
                <strong>{job.retry_config?.max_attempts ?? 0}</strong>
              </div>
              <div className="job-detail-item">
                <span>{t('modal.backoffSeconds')}</span>
                <strong>{job.retry_config?.backoff_seconds ?? 5}</strong>
              </div>
              <div className="job-detail-item">
                <span>{t('modal.createdAt')}</span>
                <strong>{prettyTime(job.created_at, locale)}</strong>
              </div>
              <div className="job-detail-item">
                <span>{t('modal.updatedAt')}</span>
                <strong>{prettyTime(job.updated_at, locale)}</strong>
              </div>
              <div className="job-detail-item job-detail-full">
                <span>{t('modal.taskId')}</span>
                <code>{job.id}</code>
              </div>
              <div className="job-detail-item job-detail-full">
                <span>{t('modal.actionConfig')}</span>
                <pre className="job-detail-code">{JSON.stringify(job.action, null, 2)}</pre>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={onClose}>
                {t('common.close')}
              </button>
              <button type="button" className="primary" onClick={() => setEditing(true)}>
                {t('modal.edit')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
