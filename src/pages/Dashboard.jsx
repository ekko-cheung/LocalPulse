import { useMemo } from 'react'
import ExecutionTable from '../components/ExecutionTable'
function Metric({ label, value, detail, icon, color }) {
  return (
    <div className="metric card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  )
}
export default function Dashboard({ jobs, executions, onNew }) {
  const recent = useMemo(
    () =>
      [...executions].sort((a, b) => b.started_at?.localeCompare(a.started_at) || 0).slice(0, 6),
    [executions],
  )
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">GOOD MORNING, EKKO</p>
          <h2>
            让重复工作，<em>自动发生。</em>
          </h2>
          <p className="hero-copy">在一个安静的地方，管理你的本机任务、通知与自动化流程。</p>
        </div>
        <button className="primary" onClick={onNew}>
          ＋ 创建新任务
        </button>
      </section>
      <div className="metrics">
        <Metric label="全部任务" value={jobs.length} detail="已保存到本机" icon="▦" color="blue" />
        <Metric
          label="正在运行"
          value={jobs.filter(job => job.enabled).length}
          detail="已启用任务"
          icon="◉"
          color="green"
        />
        <Metric
          label="执行记录"
          value={executions.length}
          detail="最近 100 条"
          icon="◷"
          color="purple"
        />
      </div>
      <div className="section-heading">
        <div>
          <h3>最近执行</h3>
          <p>查看任务的最新运行状态</p>
        </div>
        <span className="link">查看全部 →</span>
      </div>
      <ExecutionTable jobs={jobs} executions={recent} />
    </>
  )
}
