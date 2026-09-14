import ExecutionTable from '../components/ExecutionTable'
import { useI18n } from '../i18n'
export default function History({ jobs, executions }) {
  const { t } = useI18n()
  return (
    <>
      <div className="page-intro">
        <p>{t('history.copy')}</p>
      </div>
      <ExecutionTable jobs={jobs} executions={executions} empty={t('history.empty')} />
    </>
  )
}
