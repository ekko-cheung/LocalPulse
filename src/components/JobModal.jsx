import { useState } from 'react'
import { invoke, request } from '../api'
import { useI18n } from '../i18n'

const defaultConfigs = {
  http: '{\n  "method": "POST",\n  "url": "http://127.0.0.1:8080/",\n  "body": {}\n}',
  command: '{\n  "program": "python",\n  "args": [],\n  "timeout_seconds": 60\n}',
  notification: '{\n  "title": "LocalPulse",\n  "body": "任务已执行",\n  "channels": ["native"]\n}',
}

const toLocalDateTime = value => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
}

const getInitialForm = job => {
  const action = job?.action || {
    type: 'http',
    method: 'POST',
    url: 'http://127.0.0.1:8080/',
    body: {},
  }
  const { type = 'http', ...actionConfig } = action
  const trigger = job?.trigger || { type: 'manual' }

  return {
    name: job?.name || '',
    enabled: job?.enabled ?? true,
    trigger: trigger.type || 'manual',
    triggerValue:
      trigger.type === 'cron'
        ? trigger.expression
        : trigger.type === 'interval'
          ? String(trigger.seconds)
          : trigger.type === 'once'
            ? toLocalDateTime(trigger.run_at)
            : '3600',
    action: type,
    config: JSON.stringify(actionConfig, null, 2),
    maxAttempts: String(job?.retry_config?.max_attempts ?? 0),
    backoffSeconds: String(job?.retry_config?.backoff_seconds ?? 5),
  }
}

export default function JobModal({ job, onClose, onSaved }) {
  const { t } = useI18n()
  const [form, setForm] = useState(() => getInitialForm(job))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(job)

  const update = (key, value) => {
    if (key === 'action') {
      setForm(current => ({ ...current, action: value, config: defaultConfigs[value] }))
    } else {
      setForm(current => ({ ...current, [key]: value }))
    }
  }

  const validateCron = async expression => {
    if (!expression) throw new Error(t('modal.cronRequired'))
    try {
      const validation = invoke('validate_cron', { expression })
      if (validation) await validation
    } catch (err) {
      throw new Error(`${t('modal.cronInvalid')}: ${err.message || err}`)
    }
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (!form.name.trim()) throw new Error(t('modal.nameRequired'))

      let trigger
      if (form.trigger === 'manual') {
        trigger = { type: 'manual' }
      } else if (form.trigger === 'cron') {
        trigger = { type: 'cron', expression: form.triggerValue.trim() }
        await validateCron(trigger.expression)
      } else if (form.trigger === 'interval') {
        const seconds = Number(form.triggerValue)
        if (!Number.isInteger(seconds) || seconds < 1) throw new Error(t('modal.intervalInvalid'))
        trigger = { type: 'interval', seconds }
      } else {
        const runAt = new Date(form.triggerValue)
        if (Number.isNaN(runAt.getTime())) throw new Error(t('modal.runAtInvalid'))
        trigger = { type: 'once', run_at: runAt.toISOString() }
      }

      const actionConfig = JSON.parse(form.config)
      if (!actionConfig || Array.isArray(actionConfig) || typeof actionConfig !== 'object')
        throw new Error(t('modal.configInvalid'))
      if (
        form.action === 'command' &&
        (!actionConfig.program || typeof actionConfig.program !== 'string')
      )
        throw new Error(t('modal.commandInvalid'))

      const maxAttempts = Number(form.maxAttempts)
      const backoffSeconds = Number(form.backoffSeconds)
      if (
        !Number.isInteger(maxAttempts) ||
        maxAttempts < 0 ||
        maxAttempts > 4294967295 ||
        !Number.isSafeInteger(backoffSeconds) ||
        backoffSeconds < 0
      )
        throw new Error(t('modal.retryInvalid'))

      await request(isEditing ? `/jobs/${job.id}` : '/jobs', {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          enabled: form.enabled,
          trigger,
          action: { ...actionConfig, type: form.action },
          retry_config: { max_attempts: maxAttempts, backoff_seconds: backoffSeconds },
        }),
      })
      onSaved()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal-card job-card" onSubmit={submit} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">
              {isEditing ? t('modal.editAutomation') : t('modal.newAutomation')}
            </p>
            <h2>{isEditing ? t('modal.editTitle') : t('modal.createTitle')}</h2>
          </div>
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label={t('common.close')}
            disabled={saving}
          >
            ×
          </button>
        </div>
        <div className="form-grid">
          <div className="full">
            <label className="form-label" htmlFor="job-name">
              {t('modal.name')}
            </label>
            <input
              autoFocus
              id="job-name"
              className="text-input"
              required
              placeholder={t('modal.namePlaceholder')}
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>
          <div className="full job-enabled-field">
            <label>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => update('enabled', e.target.checked)}
              />
              <span>{t('modal.enabled')}</span>
            </label>
          </div>
          <div>
            <label className="form-label" htmlFor="job-trigger">
              {t('modal.trigger')}
            </label>
            <select
              id="job-trigger"
              className="text-input"
              value={form.trigger}
              onChange={e => update('trigger', e.target.value)}
            >
              <option value="manual">{t('modal.manualTrigger')}</option>
              <option value="interval">{t('modal.interval')}</option>
              <option value="cron">{t('modal.cron')}</option>
              <option value="once">{t('modal.once')}</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="job-trigger-value">
              {form.trigger === 'cron'
                ? t('modal.cronExpression')
                : form.trigger === 'once'
                  ? t('modal.runAt')
                  : t('modal.intervalSeconds')}
            </label>
            <input
              id="job-trigger-value"
              className="text-input"
              type={form.trigger === 'once' ? 'datetime-local' : 'text'}
              step={form.trigger === 'once' ? '1' : undefined}
              placeholder={
                form.trigger === 'cron'
                  ? t('modal.cronPlaceholder')
                  : t('modal.intervalPlaceholder')
              }
              required={form.trigger !== 'manual'}
              value={form.triggerValue}
              onChange={e => update('triggerValue', e.target.value)}
              onBlur={e => {
                if (form.trigger !== 'cron' || !e.target.value.trim()) return
                validateCron(e.target.value.trim())
                  .then(() => setError(''))
                  .catch(err => setError(err.message))
              }}
              disabled={form.trigger === 'manual'}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="job-action">
              {t('modal.actionType')}
            </label>
            <select
              id="job-action"
              className="text-input"
              value={form.action}
              onChange={e => update('action', e.target.value)}
            >
              <option value="http">{t('modal.http')}</option>
              <option value="command">{t('modal.command')}</option>
              <option value="notification">{t('modal.notification')}</option>
            </select>
          </div>
          <div className="full">
            <label className="form-label" htmlFor="job-action-config">
              {t('modal.actionConfig')} <span>JSON</span>
            </label>
            <textarea
              id="job-action-config"
              className="text-input code"
              rows="5"
              value={form.config}
              onChange={e => update('config', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="job-max-attempts">
              {t('modal.maxAttempts')}
            </label>
            <input
              id="job-max-attempts"
              className="text-input"
              type="number"
              min="0"
              step="1"
              required
              value={form.maxAttempts}
              onChange={e => update('maxAttempts', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="job-backoff-seconds">
              {t('modal.backoffSeconds')}
            </label>
            <input
              id="job-backoff-seconds"
              className="text-input"
              type="number"
              min="0"
              step="1"
              required
              value={form.backoffSeconds}
              onChange={e => update('backoffSeconds', e.target.value)}
            />
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button className="primary" disabled={saving}>
            {saving ? t('modal.saving') : isEditing ? t('common.save') : t('modal.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
