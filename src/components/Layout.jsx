import { NavLink } from 'react-router-dom'
import { navItems } from '../constants'
import { useI18n } from '../i18n'
export default function Layout({ agent, failedCount, children, onStart, onStop }) {
  const { t } = useI18n()
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <img className="logo-image" src="/icon.png" alt="LocalPulse" />
          <span>
            Local<span>Pulse</span>
          </span>
        </div>
        <div className="workspace">
          <span className="workspace-dot" /> {t('layout.workspace')}{' '}
          <span className="chevron">⌄</span>
        </div>
        <nav>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <span className="nav-icon">{item.icon}</span>
              {t(item.labelKey)}
              {item.path === '/history' && failedCount > 0 && (
                <b className="nav-badge">{failedCount}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`agent-mini ${agent}`}>
            <span className="pulse-dot" />
            <div>
              <small>{t('layout.agentStatus')}</small>
              <strong>{agent === 'running' ? t('common.running') : t('common.stopped')}</strong>
            </div>
            <button onClick={agent === 'running' ? onStop : onStart}>
              {agent === 'running' ? 'Ⅱ' : '▶'}
            </button>
          </div>
          <div className="version">LocalPulse v0.1.0</div>
        </div>
      </aside>
      {children}
    </div>
  )
}
