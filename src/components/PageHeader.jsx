import { useLocation } from 'react-router-dom'
import { navItems } from '../constants'
import { useI18n } from '../i18n'
export default function PageHeader({ agent, error, onClearError }) {
  const { t } = useI18n()
  const current = navItems.find(item => item.path === useLocation().pathname) || navItems[0]
  return (
    <>
      <header className="topbar">
        <div className="title-block">
          <div className="breadcrumb">
            {t('header.workspace')} <span>/</span> {t(current.labelKey)}
          </div>
          <h1>{t(current.labelKey)}</h1>
        </div>
        <div className="top-actions">
          <div className={`connection ${agent}`}>
            <span className="pulse-dot" />{' '}
            {agent === 'running' ? t('common.agentConnected') : t('common.agentStopped')}
          </div>
        </div>
      </header>
      {error && (
        <div className="alert">
          ⚠ {error}
          <button onClick={onClearError}>×</button>
        </div>
      )}
    </>
  )
}
