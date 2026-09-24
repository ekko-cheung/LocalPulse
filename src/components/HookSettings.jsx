import { useEffect, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '../api'
import { useI18n } from '../i18n'

const initialEvents = { permission: true, stop: true, tool: false }

export default function HookSettings() {
  const { t } = useI18n()
  const [overview, setOverview] = useState(null)
  const [agent, setAgent] = useState('claude')
  const [scope, setScope] = useState('global')
  const [project, setProject] = useState('')
  const [events, setEvents] = useState(initialEvents)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    invoke('list_hook_integrations')
      .then(result => {
        if (active) setOverview(result)
      })
      .catch(err => {
        if (active) setError(err.message || String(err))
      })
    return () => {
      active = false
    }
  }, [])

  const chooseProject = async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (selected) setProject(selected)
    } catch (err) {
      setError(err.message || String(err))
    }
  }

  const install = async () => {
    setBusy(true)
    setError('')
    try {
      setOverview(
        await invoke('add_hook_rule', {
          agent,
          scope,
          project: scope === 'project' ? project : null,
          ...events,
        }),
      )
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async id => {
    setBusy(true)
    setError('')
    try {
      setOverview(await invoke('remove_hook_rule', { id }))
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card settings-card hook-settings">
      <div className="card-title">
        <div>
          <h3>{t('hooks.title')}</h3>
          <p>{t('hooks.copy')}</p>
        </div>
      </div>
      <div className="hook-status">
        <span>
          Claude Code: {overview?.claude_installed ? t('hooks.installed') : t('hooks.empty')}
        </span>
        <span>Codex: {overview?.codex_installed ? t('hooks.installed') : t('hooks.empty')}</span>
      </div>
      <div className="hook-fields">
        <label>
          {t('hooks.agent')}
          <select className="text-input" value={agent} onChange={e => setAgent(e.target.value)}>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </label>
        <label>
          {t('hooks.scope')}
          <select className="text-input" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="global">{t('hooks.global')}</option>
            <option value="project">{t('hooks.project')}</option>
          </select>
        </label>
      </div>
      {scope === 'project' && (
        <div className="hook-project">
          <input
            className="text-input"
            value={project}
            onChange={e => setProject(e.target.value)}
            placeholder={t('hooks.projectPath')}
          />
          <button type="button" className="secondary" onClick={chooseProject}>
            {t('hooks.browse')}
          </button>
        </div>
      )}
      <div className="hook-events">
        {['permission', 'stop', 'tool'].map(event => (
          <label key={event}>
            <input
              type="checkbox"
              checked={events[event]}
              onChange={e => setEvents(current => ({ ...current, [event]: e.target.checked }))}
            />
            {t(`hooks.${event}`)}
          </label>
        ))}
      </div>
      <button type="button" className="primary save" onClick={install} disabled={busy}>
        {t('hooks.install')}
      </button>
      {error && <div className="form-error">{error}</div>}
      <p className="hint">{t('hooks.hint')}</p>
      {overview?.rules?.length > 0 && (
        <div className="hook-rules">
          {overview.rules.map(rule => (
            <div className="setting-row" key={rule.id}>
              <div>
                <strong>{rule.agent === 'claude' ? 'Claude Code' : 'Codex'}</strong>
                <small>{rule.scope === 'global' ? t('hooks.global') : rule.project}</small>
                <small>
                  {['permission', 'stop', 'tool']
                    .filter(event => rule[event])
                    .map(event => t(`hooks.${event}`))
                    .join(' · ')}
                </small>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => remove(rule.id)}
                disabled={busy}
              >
                {t('hooks.remove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
