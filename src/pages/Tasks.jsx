import JobTable from '../components/JobTable'
export default function Tasks({ jobs, onNew, onRefresh }) {
  return (
    <>
      <div className="page-intro">
        <p>管理所有自动化任务与触发规则</p>
        <div className="intro-actions">
          <button className="secondary" onClick={onRefresh}>
            ↻ 刷新
          </button>
          <button className="primary" onClick={onNew}>
            ＋ 新建任务
          </button>
        </div>
      </div>
      <div className="filter-row">
        <span className="filter active">
          全部 <b>{jobs.length}</b>
        </span>
        <span className="filter">
          已启用 <b>{jobs.filter(x => x.enabled).length}</b>
        </span>
        <span className="filter">手动任务</span>
      </div>
      <JobTable jobs={jobs} onRefresh={onRefresh} />
    </>
  )
}
