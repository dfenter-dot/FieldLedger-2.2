import './toggle.css';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggleTrack" />
      {label ? <span className="toggleLabel">{label}</span> : null}
    </label>
  );
}
