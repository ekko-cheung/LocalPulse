export default function PageHeader({ error, onClearError }) {
  if (!error) return null
  return (
    <div className="alert">
      ⚠ {error}
      <button onClick={onClearError}>×</button>
    </div>
  )
}
