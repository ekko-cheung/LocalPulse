import ExecutionTable from '../components/ExecutionTable'
export default function History({ jobs, executions }) {
  return (
    <>
      <div className="page-intro">
        <p>所有任务的运行轨迹、输出与错误信息</p>
      </div>
      <ExecutionTable jobs={jobs} executions={executions} empty="暂无执行历史。" />
    </>
  )
}
