import { useState } from 'react'
import { invoke, request } from '../api'
import { useI18n } from '../i18n'
export default function JobModal({ onClose, onCreated }) {
  const { t } = useI18n()
  const [form, setForm] = useState({
    name: '',
    trigger: 'manual',
    triggerValue: '3600',
    action: 'http',
    config: '{"method":"POST","url":"http://127.0.0.1:8080/","body":{}}',
  })
  const [error, setError] = useState('')
  const update = (key, value) => {
    if (key === 'action') {
      const configs = {
        http: '{"method":"POST","url":"http://127.0.0.1:8080/","body":{}}',
        command: '{"program":"python","args":[],"timeout_seconds":60}',
        notification: '{"title":"LocalPulse","body":"任务已执行","channels":["native"]}',
      }
      setForm({ ...form, action: value, config: configs[value] })
    } else setForm({ ...form, [key]: value })
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
    try {
      const trigger =
        form.trigger === 'manual'
          ? { type: 'manual' }
          : form.trigger === 'cron'
            ? { type: 'cron', expression: form.triggerValue.trim() }
            : { type: 'interval', seconds: Number(form.triggerValue) }
      if (form.trigger === 'cron') await validateCron(trigger.expression)
      if (
        form.trigger === 'interval' &&
        (!Number.isInteger(trigger.seconds) || trigger.seconds < 1)
      )
        throw new Error(t('modal.intervalInvalid'))
      const actionConfig = JSON.parse(form.config)
      if (
        form.action === 'command' &&
        (!actionConfig.program || typeof actionConfig.program !== 'string')
      )
        throw new Error(t('modal.commandInvalid'))
      await request('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          trigger,
          action: { type: form.action, ...actionConfig },
        }),
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <div className="modal-backdrop">
      <form className="modal-card job-card" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t('modal.newAutomation')}</p>
            <h2>{t('modal.createTitle')}</h2>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="form-grid">
          <div className="full">
            <label className="form-label">{t('modal.name')}</label>
            <input
              autoFocus
              className="text-input"
              required
              placeholder={t('modal.namePlaceholder')}
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">{t('modal.trigger')}</label>
            <select
              className="text-input"
              value={form.trigger}
              onChange={e => update('trigger', e.target.value)}
            >
              <option value="manual">{t('modal.manualTrigger')}</option>
              <option value="interval">{t('modal.interval')}</option>
              <option value="cron">{t('modal.cron')}</option>
            </select>
          </div>
          <div>
            <label className="form-label">
              {form.trigger === 'cron' ? t('modal.cronExpression') : t('modal.intervalSeconds')}
            </label>
            <input
              className="text-input"
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
            <label className="form-label">{t('modal.actionType')}</label>
            <select
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
            <label className="form-label">
              {t('modal.actionConfig')} <span>JSON</span>
            </label>
            <textarea
              className="text-input code"
              rows="5"
              value={form.config}
              onChange={e => update('config', e.target.value)}
            />
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="primary">{t('modal.create')}</button>
        </div>
      </form>
    </div>
  )
}
