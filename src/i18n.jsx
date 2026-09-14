import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const messages = {
  zh: {
    nav: { overview: '总览', tasks: '任务中心', history: '执行历史', settings: '设置' },
    common: {
      agent: 'Agent',
      agentConnected: 'Agent 已连接',
      agentStopped: 'Agent 已停止',
      running: '运行中',
      stopped: '已停止',
      enabled: '已启用',
      disabled: '已停用',
      cancel: '取消',
      save: '保存',
      delete: '删除',
      deleting: '删除中…',
      confirmDelete: '确认删除',
      close: '关闭',
      language: '语言',
      chinese: '中文',
      english: 'English',
      apiToken: 'API Token',
    },
    layout: { workspace: '本机 Agent', agentStatus: 'Agent 状态' },
    header: { workspace: '工作台' },
    loading: '正在加载工作台…',
    dashboard: {
      greeting: 'GOOD MORNING, EKKO',
      title: '让重复工作，自动发生。',
      copy: '在一个安静的地方，管理你的本机任务、通知与自动化流程。',
      create: '＋ 创建新任务',
      allJobs: '全部任务',
      savedLocally: '已保存到本机',
      activeJobs: '正在运行',
      enabledJobs: '已启用任务',
      executions: '执行记录',
      recent: '最近执行',
      recentCopy: '查看任务的最新运行状态',
      viewAll: '查看全部 →',
      recentLimit: '最近 100 条',
    },
    tasks: {
      copy: '管理所有自动化任务与触发规则',
      refresh: '↻ 刷新',
      create: '＋ 新建任务',
      all: '全部',
      enabled: '已启用',
      manual: '手动任务',
    },
    history: { copy: '所有任务的运行轨迹、输出与错误信息', empty: '暂无执行历史。' },
    settings: {
      connection: 'Agent 连接',
      connectionCopy: '管理本机 Agent 服务进程',
      address: '服务地址',
      addressCopy: 'Agent 默认仅监听本机回环地址',
      process: '进程控制',
      processCopy: 'GUI 启动时会自动拉起 Agent',
      stop: '停止 Agent',
      start: '启动 Agent',
      security: '安全设置',
      securityCopy: 'API Token 用于保护本机接口',
      tokenLocal: 'Token 只保存在当前用户的本地应用存储中。',
    },
    jobs: {
      emptyTitle: '还没有任务',
      emptyCopy: '创建第一个任务，让 LocalPulse 帮你自动执行。',
      task: '任务',
      trigger: '触发方式',
      action: '动作',
      status: '状态',
      run: '运行 →',
      deleteQuestion: '删除这个任务？',
      deleteCopy: '“{name}”以及相关配置将被删除，此操作无法撤销。',
      interval: '每 {seconds}s',
      cron: 'Cron：{expression}',
      manual: '手动触发',
    },
    executions: {
      emptyTitle: '暂无执行记录',
      emptyCopy: '还没有执行记录，运行一个任务试试。',
      task: '任务',
      status: '状态',
      started: '开始时间',
      duration: '耗时',
      exitCode: '退出码',
      execution: '执行 {id}',
      running: '运行中',
    },
    modal: {
      newAutomation: 'NEW AUTOMATION',
      createTitle: '创建新任务',
      name: '任务名称',
      namePlaceholder: '例如：每日同步报告',
      trigger: '触发方式',
      manualTrigger: '手动触发',
      interval: '固定间隔',
      cron: 'Cron',
      cronExpression: 'Cron 表达式',
      intervalSeconds: '间隔秒数',
      cronPlaceholder: '例如：0 0/5 * * * * *',
      intervalPlaceholder: '例如：3600',
      actionType: '动作类型',
      http: 'HTTP 请求',
      command: '本地程序',
      notification: '系统通知',
      actionConfig: '动作配置',
      create: '创建任务',
      cronRequired: '请输入 Cron 表达式',
      intervalInvalid: '间隔秒数必须是大于 0 的整数',
      commandInvalid: '本地程序配置必须包含 program 字段',
    },
    token: {
      title: '先连接你的 Agent',
      copy: 'LocalPulse 需要 API Token 才能安全启动本机 Agent。你可以在后端启动日志中找到它。',
      placeholder: '输入 API Token',
      empty: 'Token 不能为空',
      saveStart: '保存并启动 Agent',
    },
    errors: {
      requestFailed: '请求失败',
      apiUnavailable: '无法访问 Agent API：{url}。请确认 Agent 已启动。',
    },
  },
  en: {
    nav: { overview: 'Overview', tasks: 'Tasks', history: 'History', settings: 'Settings' },
    common: {
      agent: 'Agent',
      agentConnected: 'Agent connected',
      agentStopped: 'Agent stopped',
      running: 'Running',
      stopped: 'Stopped',
      enabled: 'Enabled',
      disabled: 'Disabled',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      deleting: 'Deleting…',
      confirmDelete: 'Confirm delete',
      close: 'Close',
      language: 'Language',
      chinese: '中文',
      english: 'English',
      apiToken: 'API Token',
    },
    layout: { workspace: 'Local Agent', agentStatus: 'Agent status' },
    header: { workspace: 'Workspace' },
    loading: 'Loading workspace…',
    dashboard: {
      greeting: 'GOOD MORNING, EKKO',
      title: 'Make repetitive work happen automatically.',
      copy: 'Manage local tasks, notifications, and automations in one quiet place.',
      create: '＋ Create task',
      allJobs: 'All tasks',
      savedLocally: 'Saved locally',
      activeJobs: 'Active tasks',
      enabledJobs: 'Enabled tasks',
      executions: 'Executions',
      recent: 'Recent executions',
      recentCopy: 'View the latest task run status',
      viewAll: 'View all →',
      recentLimit: 'Latest 100',
    },
    tasks: {
      copy: 'Manage all automations and trigger rules',
      refresh: '↻ Refresh',
      create: '＋ New task',
      all: 'All',
      enabled: 'Enabled',
      manual: 'Manual tasks',
    },
    history: {
      copy: 'Run history, output, and error details for every task',
      empty: 'No execution history.',
    },
    settings: {
      connection: 'Agent connection',
      connectionCopy: 'Manage the local Agent service',
      address: 'Service address',
      addressCopy: 'The Agent listens on the local loopback address by default',
      process: 'Process control',
      processCopy: 'The GUI starts the Agent automatically',
      stop: 'Stop Agent',
      start: 'Start Agent',
      security: 'Security',
      securityCopy: 'The API Token protects the local interface',
      tokenLocal: 'The token is stored only in this user’s local app storage.',
    },
    jobs: {
      emptyTitle: 'No tasks yet',
      emptyCopy: 'Create your first task and let LocalPulse run it automatically.',
      task: 'Task',
      trigger: 'Trigger',
      action: 'Action',
      status: 'Status',
      run: 'Run →',
      deleteQuestion: 'Delete this task?',
      deleteCopy: '“{name}” and its configuration will be deleted. This cannot be undone.',
      interval: 'Every {seconds}s',
      cron: 'Cron: {expression}',
      manual: 'Manual',
    },
    executions: {
      emptyTitle: 'No executions yet',
      emptyCopy: 'There are no execution records. Run a task to get started.',
      task: 'Task',
      status: 'Status',
      started: 'Started',
      duration: 'Duration',
      exitCode: 'Exit code',
      execution: 'Execution {id}',
      running: 'Running',
    },
    modal: {
      newAutomation: 'NEW AUTOMATION',
      createTitle: 'Create a task',
      name: 'Task name',
      namePlaceholder: 'For example: Daily report sync',
      trigger: 'Trigger',
      manualTrigger: 'Manual',
      interval: 'Interval',
      cron: 'Cron',
      cronExpression: 'Cron expression',
      intervalSeconds: 'Interval seconds',
      cronPlaceholder: 'For example: 0 0/5 * * * * *',
      intervalPlaceholder: 'For example: 3600',
      actionType: 'Action type',
      http: 'HTTP request',
      command: 'Local program',
      notification: 'System notification',
      actionConfig: 'Action config',
      create: 'Create task',
      cronRequired: 'Enter a Cron expression',
      intervalInvalid: 'Interval seconds must be an integer greater than 0',
      commandInvalid: 'Local program config must include a program field',
    },
    token: {
      title: 'Connect your Agent',
      copy: 'LocalPulse needs an API Token to safely start the local Agent. Find it in the backend startup logs.',
      placeholder: 'Enter API Token',
      empty: 'Token cannot be empty',
      saveStart: 'Save and start Agent',
    },
    errors: {
      requestFailed: 'Request failed',
      apiUnavailable: 'Cannot reach the Agent API at {url}. Make sure the Agent is running.',
    },
  },
}

const I18nContext = createContext(null)

const getInitialLocale = () => {
  const stored = localStorage.getItem('localpulse-locale')
  if (stored === 'zh' || stored === 'en') return stored
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(getInitialLocale)
  useEffect(() => {
    localStorage.setItem('localpulse-locale', locale)
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])
  const value = useMemo(() => {
    const translate = (key, variables = {}) => {
      const value = key.split('.').reduce((result, part) => result?.[part], messages[locale]) ?? key
      return String(value).replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? `{${name}}`)
    }
    return { locale, setLocale, t: translate }
  }, [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
