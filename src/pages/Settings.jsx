import { useState } from 'react'
export default function Settings({ agent, onStart, onStop }) {
  const [value, setValue] = useState(localStorage.getItem('localpulse-token') || '')
  return (
    <div className="settings-grid">
      <section className="card settings-card">
        <div className="card-title">
          <div>
            <h3>Agent 连接</h3>
            <p>管理本机 Agent 服务进程</p>
          </div>
          <span className={`large-status ${agent}`}>
            <i />
            {agent === 'running' ? '运行中' : '已停止'}
          </span>
        </div>
        <div className="setting-row">
          <div>
            <strong>服务地址</strong>
            <small>Agent 默认仅监听本机回环地址</small>
          </div>
          <code>127.0.0.1:7788</code>
        </div>
        <div className="setting-row">
          <div>
            <strong>进程控制</strong>
            <small>GUI 启动时会自动拉起 Agent</small>
          </div>
          <div>
            {agent === 'running' ? (
              <button className="danger-button" onClick={onStop}>
                停止 Agent
              </button>
            ) : (
              <button className="primary" onClick={onStart}>
                启动 Agent
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="card settings-card">
        <div className="card-title">
          <div>
            <h3>安全设置</h3>
            <p>API Token 用于保护本机接口</p>
          </div>
          <span className="lock">⌑</span>
        </div>
        <label className="form-label">API Token</label>
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
          保存 Token
        </button>
        <p className="hint">Token 只保存在当前用户的本地应用存储中。</p>
      </section>
    </div>
  )
}
