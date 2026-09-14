import { NavLink } from 'react-router-dom'
import { navItems } from '../constants'
import { useI18n } from '../i18n'
export default function Layout({ agent, failedCount, children, onStart, onStop }) {
  const { t } = useI18n()
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo">
          <img className="logo-image" src="/icon.png" alt="LocalPulse" />
          <span>
            Local<span>Pulse</span>
          </span>
        </div>
        <nav className="top-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {t(item.labelKey)}
              {item.path === '/history' && failedCount > 0 && (
                <b className="nav-badge">{failedCount}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="header-status">
          <div className={`connection ${agent}`}>
            <span className="pulse-dot" />
            {agent === 'running' ? t('common.running') : t('common.stopped')}
          </div>
          <button
            className={`agent-toggle ${agent}`}
            onClick={agent === 'running' ? onStop : onStart}
            aria-label={agent === 'running' ? t('settings.stop') : t('settings.start')}
          >
            {agent === 'running' ? 'Ⅱ' : '▶'}
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}
