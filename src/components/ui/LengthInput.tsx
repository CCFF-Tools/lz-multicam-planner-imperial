import { useState } from 'react';
import { useUnits } from '../../store/units';
import { formatLength, parseLength, type Units } from '../../utils/units';
export function UnitsPreference() {
  const { units, setUnits } = useUnits();
  return <label>Units <select aria-label="Units" value={units} onChange={e => setUnits(e.target.value as Units)}><option value="metric">Metric</option><option value="imperial">Imperial</option></select></label>;
}
export default function LengthInput({ value, onChange, min = 0, max = Infinity, ...props }: { value: number; onChange: (meters: number) => void; min?: number; max?: number; className?: string; 'aria-label'?: string }) {
  const units = useUnits(s => s.units);
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? value : parseLength(draft, units);
  const commit = () => { if (parsed !== undefined && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed); setDraft(null); };
  return <input {...props} type="text" title={units === 'metric' ? 'Meters' : 'Feet and inches, e.g. 5\' 6.1" (bare numbers: feet)'} value={draft ?? formatLength(value, units)} aria-invalid={parsed === undefined || parsed < min || parsed > max} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }} />;
}
