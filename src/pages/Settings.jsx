import { useEffect, useState } from 'react'
import { invoke } from '../api'
import { ALLOWED_PROGRAMS_STORAGE_KEY } from '../constants'
import { useI18n } from '../i18n'
export default function Settings({ agent, onStart, onStop }) {
  const { locale, setLocale, t } = useI18n()
  const [value, setValue] = useState(localStorage.getItem('localpulse-token') || '')
  const [allowedPrograms, setAllowedPrograms] = useState(
    localStorage.getItem(ALLOWED_PROGRAMS_STORAGE_KEY) || '',
  )
  const [allowlistError, setAllowlistError] = useState('')
  const [allowlistSaved, setAllowlistSaved] = useState(false)
  const [savingAllowlist, setSavingAllowlist] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(ALLOWED_PROGRAMS_STORAGE_KEY) !== null) return undefined
    let active = true
    const loadAllowedPrograms = async () => {
      try {
        const configured = await invoke('get_allowed_programs')
        if (active && typeof configured === 'string') setAllowedPrograms(configured)
      } catch (_) {}
    }
    loadAllowedPrograms()
    return () => {
      active = false
    }
  }, [])

  const saveAllowedPrograms = async () => {
    const normalized = allowedPrograms.trim()
    setSavingAllowlist(true)
    setAllowlistError('')
    setAllowlistSaved(false)
    try {
      await invoke('set_allowed_programs', { value: normalized })
      localStorage.setItem(ALLOWED_PROGRAMS_STORAGE_KEY, normalized)
      setAllowedPrograms(normalized)
      setAllowlistSaved(true)
      if (agent !== 'running') onStart()
    } catch (err) {
      setAllowlistError(err.message || t('settings.allowedProgramsSaveFailed'))
    } finally {
      setSavingAllowlist(false)
    }
  }

  return (
    <div className="settings-grid">
      <section className="card settings-card">
        <div className="card-title">
          <div>
            <h3>{t('settings.connection')}</h3>
            <p>{t('settings.connectionCopy')}</p>
          </div>
          <span className={`large-status ${agent}`}>
            <i />
            {agent === 'running' ? t('common.running') : t('common.stopped')}
          </span>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t('settings.address')}</strong>
            <small>{t('settings.addressCopy')}</small>
          </div>
          <code>127.0.0.1:7788</code>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t('settings.process')}</strong>
            <small>{t('settings.processCopy')}</small>
          </div>
          <div>
            {agent === 'running' ? (
              <button className="danger-button" onClick={onStop}>
                {t('settings.stop')}
              </button>
            ) : (
              <button className="primary" onClick={onStart}>
                {t('settings.start')}
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="card settings-card">
        <div className="card-title">
          <div>
            <h3>{t('settings.security')}</h3>
            <p>{t('settings.securityCopy')}</p>
          </div>
          <span className="lock">⌑</span>
        </div>
        <label className="form-label">{t('common.apiToken')}</label>
        <input
          className="text-input"
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <button
          className="secondary save"
          onClick={() => {
            localStorage.setItem('localpulse-token', value.trim())
            onStart()
          }}
        >
          {t('common.save')} Token
        </button>
        <p className="hint">{t('settings.tokenLocal')}</p>
        <div className="settings-divider" />
        <label className="form-label">
          {t('settings.allowedPrograms')}
          <span>LOCALPULSE_ALLOWED_PROGRAMS</span>
        </label>
        <textarea
          className="text-input code"
          rows="3"
          placeholder={t('settings.allowedProgramsPlaceholder')}
          value={allowedPrograms}
          onChange={e => {
            setAllowedPrograms(e.target.value)
            setAllowlistSaved(false)
            setAllowlistError('')
          }}
        />
        <button
          type="button"
          className="secondary save"
          onClick={saveAllowedPrograms}
          disabled={savingAllowlist}
        >
          {savingAllowlist
            ? t('settings.savingAllowedPrograms')
            : t('settings.saveAllowedPrograms')}
        </button>
        {allowlistSaved && <p className="save-status">{t('settings.allowedProgramsSaved')}</p>}
        {allowlistError && <div className="form-error">{allowlistError}</div>}
        <p className="hint">{t('settings.allowedProgramsHint')}</p>
        <div className="setting-row language-row">
          <div>
            <strong>{t('common.language')}</strong>
          </div>
          <select
            className="text-input language-select"
            value={locale}
            onChange={e => setLocale(e.target.value)}
          >
            <option value="zh">{t('common.chinese')}</option>
            <option value="en">{t('common.english')}</option>
          </select>
        </div>
      </section>
    </div>
  )
}
