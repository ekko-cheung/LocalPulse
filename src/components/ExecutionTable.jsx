import { prettyTime, shortId } from '../api'
export function Status({ enabled, status }) {
  return (
    <span className={`status ${status === 'success' || enabled ? 'success' : 'muted-status'}`}>
      <i />
      {status || (enabled ? '已启用' : '已停用')}
    </span>
  )
}
export default function ExecutionTable({
  jobs,
  executions,
  empty = '还没有执行记录，运行一个任务试试。',
}) {
  if (!executions.length)
    return (
      <div className="empty card">
        <div className="empty-icon">◷</div>
        <h3>暂无执行记录</h3>
        <p>{empty}</p>
      </div>
    )
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>任务</th>
            <th>状态</th>
            <th>开始时间</th>
            <th>耗时</th>
            <th>退出码</th>
          </tr>
        </thead>
        <tbody>
          {executions.map(item => (
            <tr key={item.id}>
              <td>
                <strong>
                  {jobs.find(job => job.id === item.job_id)?.name || shortId(item.job_id)}
                </strong>
                <small className="cell-sub">执行 {shortId(item.id)}</small>
              </td>
              <td>
                <Status status={item.status} />
              </td>
              <td>{prettyTime(item.started_at)}</td>
              <td>
                {item.finished_at
                  ? `${Math.max(0, (new Date(item.finished_at) - new Date(item.started_at)) / 1000).toFixed(1)}s`
                  : '运行中'}
              </td>
              <td>{item.exit_code ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
