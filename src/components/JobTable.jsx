import { request, shortId } from '../api'
import { Status } from './ExecutionTable'
import { useState } from 'react'
export default function JobTable({ jobs, onRefresh }) {
  const [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  if (!jobs.length)
    return (
      <div className="empty card">
        <div className="empty-icon">✦</div>
        <h3>还没有任务</h3>
        <p>创建第一个任务，让 LocalPulse 帮你自动执行。</p>
      </div>
    )
  const remove = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await request(`/jobs/${pendingDelete.id}`, { method: 'DELETE' })
      setPendingDelete(null)
      onRefresh()
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>任务</th>
              <th>触发方式</th>
              <th>动作</th>
              <th>状态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id}>
                <td>
                  <div className="job-name">
                    <span className="job-symbol">
                      {job.action.type === 'http'
                        ? '↗'
                        : job.action.type === 'command'
                          ? '>_'
                          : '♢'}
                    </span>
                    <div>
                      <strong>{job.name}</strong>
                      <small>{shortId(job.id)}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="trigger">
                    <i />
                    {job.trigger.type === 'interval'
                      ? `每 ${job.trigger.seconds}s`
                      : job.trigger.type === 'manual'
                        ? '手动触发'
                        : job.trigger.type}
                  </span>
                </td>
                <td>
                  <span className="action-type">{job.action.type.toUpperCase()}</span>
                </td>
                <td>
                  <Status enabled={job.enabled} />
                </td>
                <td className="row-actions">
                  <button
                    className="row-action"
                    onClick={async () => {
                      try {
                        await request(`/jobs/${job.id}/run`, { method: 'POST' })
                        setTimeout(onRefresh, 400)
                      } catch (error) {
                        alert(error.message)
                      }
                    }}
                  >
                    运行 →
                  </button>
                  <button className="row-delete" onClick={() => setPendingDelete(job)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pendingDelete && (
        <div className="confirm-backdrop">
          <div className="confirm-card">
            <div className="confirm-icon">!</div>
            <h3>删除这个任务？</h3>
            <p>“{pendingDelete.name}”以及相关配置将被删除，此操作无法撤销。</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setPendingDelete(null)} disabled={busy}>
                取消
              </button>
              <button className="danger-button" onClick={remove} disabled={busy}>
                {busy ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
