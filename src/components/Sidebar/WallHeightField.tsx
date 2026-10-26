import { useState } from 'react';
import { useUnits } from '../../store/units';
import { formatLength, parseLength } from '../../utils/units';

/**
 * Height input in metres that may stay empty (#198). Empty means "use the
 * standard"; the placeholder shows which value that is. The text is kept
 * locally so a half-typed number ("2.") is not thrown away on every keystroke.
 */
export function WallHeightField({ value, placeholder, onChange, label, allowEmpty = true, className = '' }: {
  value: number | undefined;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
  label: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const units = useUnits((s) => s.units);
  const shown = value === undefined ? '' : formatLength(value, units);
  const source = `${units}:${value ?? ''}`;
  const [draft, setDraft] = useState({ source, text: shown });
  if (draft.source !== source) setDraft({ source, text: shown });
  const text = draft.text;
  const setText = (next: string) => setDraft({ source, text: next });
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') { if (allowEmpty) onChange(undefined); return; }
    const n = parseLength(trimmed, units);
    if (n !== undefined && Number.isFinite(n) && n > 0) onChange(Math.min(200, Math.max(0.1, n)));
  };
  return (
    <input
      type="text"
      aria-label={label}
      title={label}
      placeholder={placeholder}
      className={`bg-bc-panel border border-bc-border px-1 py-0.5 text-bc-text-bright text-[11px] tabular-nums ${className}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        commit(text);
        if (!allowEmpty && text.trim() === '' && value !== undefined) setText(shown);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setText(shown); }}
    />
  );
}
