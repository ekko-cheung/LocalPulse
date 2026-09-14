import { useState } from 'react'
import { useI18n } from '../i18n'
export default function TokenModal({ onSaved }) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="modal-backdrop">
      <div className="modal-card token-card">
        <div className="modal-icon">⌁</div>
        <h2>{t('token.title')}</h2>
        <p>{t('token.copy')}</p>
        <label className="form-label">{t('common.apiToken')}</label>
        <input
          autoFocus
          className="text-input"
          type="password"
          placeholder={t('token.placeholder')}
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        {error && <div className="form-error">{error}</div>}
        <button
          className="primary wide"
          onClick={() => {
            if (!value.trim()) setError(t('token.empty'))
            else {
              localStorage.setItem('localpulse-token', value.trim())
              onSaved()
            }
          }}
        >
          {t('token.saveStart')}
        </button>
      </div>
    </div>
  )
}
