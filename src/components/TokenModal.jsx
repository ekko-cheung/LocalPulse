import { useState } from 'react'
export default function TokenModal({ onSaved }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="modal-backdrop">
      <div className="modal-card token-card">
        <div className="modal-icon">⌁</div>
        <h2>先连接你的 Agent</h2>
        <p>LocalPulse 需要 API Token 才能安全启动本机 Agent。你可以在后端启动日志中找到它。</p>
        <label className="form-label">API Token</label>
        <input
          autoFocus
          className="text-input"
          type="password"
          placeholder="输入 API Token"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        {error && <div className="form-error">{error}</div>}
        <button
          className="primary wide"
          onClick={() => {
            if (!value.trim()) setError('Token 不能为空')
            else {
              localStorage.setItem('localpulse-token', value.trim())
              onSaved()
            }
          }}
        >
          保存并启动 Agent
        </button>
      </div>
    </div>
  )
}
