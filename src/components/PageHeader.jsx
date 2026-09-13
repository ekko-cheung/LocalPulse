import { useLocation } from 'react-router-dom'
import { navItems } from '../constants'
export default function PageHeader({ agent, error, onClearError }) {
  const current = navItems.find(item => item.path === useLocation().pathname) || navItems[0]
  return (
    <>
      <header className="topbar">
        <div className="title-block">
          <div className="breadcrumb">
            工作台 <span>/</span> {current.label}
          </div>
          <h1>{current.label}</h1>
        </div>
        <div className="top-actions">
          <div className={`connection ${agent}`}>
            <span className="pulse-dot" /> {agent === 'running' ? 'Agent 已连接' : 'Agent 已停止'}
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
