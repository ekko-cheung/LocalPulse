import { useState } from 'react'
import { request } from '../api'
export default function JobModal({ onClose, onCreated }) {
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
  const submit = async e => {
    e.preventDefault()
    try {
      const trigger =
        form.trigger === 'manual'
          ? { type: 'manual' }
          : form.trigger === 'cron'
            ? { type: 'cron', expression: form.triggerValue.trim() }
            : { type: 'interval', seconds: Number(form.triggerValue) }
      if (form.trigger === 'cron' && !trigger.expression) throw new Error('请输入 Cron 表达式')
      if (
        form.trigger === 'interval' &&
        (!Number.isInteger(trigger.seconds) || trigger.seconds < 1)
      )
        throw new Error('间隔秒数必须是大于 0 的整数')
      const actionConfig = JSON.parse(form.config)
      if (
        form.action === 'command' &&
        (!actionConfig.program || typeof actionConfig.program !== 'string')
      )
        throw new Error('本地程序配置必须包含 program 字段')
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
            <p className="eyebrow">NEW AUTOMATION</p>
            <h2>创建新任务</h2>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="form-grid">
          <div className="full">
            <label className="form-label">任务名称</label>
            <input
              autoFocus
              className="text-input"
              required
              placeholder="例如：每日同步报告"
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">触发方式</label>
            <select
              className="text-input"
              value={form.trigger}
              onChange={e => update('trigger', e.target.value)}
            >
              <option value="manual">手动触发</option>
              <option value="interval">固定间隔</option>
              <option value="cron">Cron</option>
            </select>
          </div>
          <div>
            <label className="form-label">
              {form.trigger === 'cron' ? 'Cron 表达式' : '间隔秒数'}
            </label>
            <input
              className="text-input"
              placeholder={form.trigger === 'cron' ? '例如：0 0/5 * * * * *' : '例如：3600'}
              required={form.trigger !== 'manual'}
              value={form.triggerValue}
              onChange={e => update('triggerValue', e.target.value)}
              disabled={form.trigger === 'manual'}
            />
          </div>
          <div>
            <label className="form-label">动作类型</label>
            <select
              className="text-input"
              value={form.action}
              onChange={e => update('action', e.target.value)}
            >
              <option value="http">HTTP 请求</option>
              <option value="command">本地程序</option>
              <option value="notification">系统通知</option>
            </select>
          </div>
          <div className="full">
            <label className="form-label">
              动作配置 <span>JSON</span>
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
            取消
          </button>
          <button className="primary">创建任务</button>
        </div>
      </form>
    </div>
  )
}
