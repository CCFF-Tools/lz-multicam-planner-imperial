import { forwardRef, useRef, useState, type CSSProperties, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { useUnits } from '../../store/units';
import { formatLength, imperialPartsToMeters, parseLength, splitImperialLength } from '../../utils/units';
import { useTranslation } from '../../i18n';
export function UnitsPreference() {
  const { units, setUnits } = useUnits();
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="text-sm font-semibold text-bc-text-bright">{t('settings.units', 'Units')}</h3>
      <p className="mt-1 text-xs text-bc-muted">
        {t('settings.units.desc', 'Geometry stays in metres; this changes how measurements are entered and displayed.')}
      </p>
      <div className="bc-seg mt-3" role="group" aria-label={t('settings.units', 'Units')}>
        {([['metric', t('settings.units.metric', 'Metric')], ['imperial', t('settings.units.imperial', 'Imperial')]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setUnits(id)}
            aria-pressed={units === id}
            style={{ padding: '0 16px' }}
            className="text-[13px] font-medium"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
type LengthInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number;
  onChange: (meters: number) => void;
  min?: number;
  max?: number;
};

interface ImperialLengthFieldsProps {
  value: number | undefined;
  onChange: (meters: number | undefined) => void;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  className?: string;
  inputClassName?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  placeholder?: string;
  dataReglerField?: boolean;
  onArrow?: (direction: 1 | -1, coarse: boolean) => void;
}

const decimal = (text: string): number | undefined => {
  const trimmed = text.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
};

/** Two-field architectural editor. Values outside 0–11.9 inches normalise on commit. */
export const ImperialLengthFields = forwardRef<HTMLInputElement, ImperialLengthFieldsProps>(function ImperialLengthFields({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  allowEmpty = false,
  className,
  inputClassName,
  style,
  ariaLabel = 'Length',
  title,
  disabled,
  id,
  name,
  autoFocus,
  placeholder,
  dataReglerField,
  onArrow,
}, feetRef) {
  const shown = splitImperialLength(value ?? 0);
  const [draft, setDraft] = useState<{ feet: string; inches: string } | null>(null);
  const skipBlurCommit = useRef(false);
  const feetText = draft?.feet ?? (value === undefined ? '' : String(shown.feet));
  const inchesText = draft?.inches ?? (value === undefined ? '' : String(shown.inches));
  const feet = feetText.trim() === '' ? 0 : decimal(feetText);
  const inches = inchesText.trim() === '' ? 0 : decimal(inchesText);
  const empty = feetText.trim() === '' && inchesText.trim() === '';
  const meters = feet === undefined || inches === undefined ? undefined : imperialPartsToMeters(feet, inches);
  const invalid = (!allowEmpty || !empty) && (meters === undefined || meters < min || meters > max);

  const commit = () => {
    if (allowEmpty && empty) onChange(undefined);
    else if (meters !== undefined && meters >= min && meters <= max) onChange(meters);
    setDraft(null);
  };
  const cancel = () => setDraft(null);
  const updateFeet = (feet: string) => setDraft({ feet, inches: inchesText });
  const updateInches = (inches: string) => setDraft({ feet: feetText, inches });
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && onArrow) {
      event.preventDefault();
      cancel();
      onArrow(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      skipBlurCommit.current = true;
      cancel();
      event.currentTarget.blur();
    }
  };

  const widthClasses = (className ?? '').split(/\s+/).filter((token) => /^(?:w|min-w|max-w)-/.test(token));
  const fieldClasses = (inputClassName ?? className ?? '')
    .split(/\s+/)
    .filter((token) => token && !/^(?:w|min-w|max-w)-/.test(token))
    .join(' ');
  const wrapperWidth = widthClasses.length > 0 ? widthClasses.join(' ') : 'w-32';
  const common = {
    type: 'text' as const,
    inputMode: 'decimal' as const,
    disabled,
    title: title ?? 'Enter feet and inches; inches normalise when you leave the field',
    'aria-invalid': invalid || undefined,
    'data-regler-feld': dataReglerField || undefined,
    className: `${fieldClasses || 'border border-bc-border bg-bc-panel-raised text-bc-text-bright'} min-w-0 w-full`,
    style,
    onFocus: (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
    onKeyDown: keyDown,
  };

  return (
    <span
      className={`inline-grid ${wrapperWidth} min-w-[7.5rem] grid-cols-[minmax(2.25rem,1fr)_auto_minmax(2.25rem,1fr)_auto] items-center gap-1`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          if (skipBlurCommit.current) skipBlurCommit.current = false;
          else commit();
        }
      }}
    >
      <input {...common} ref={feetRef} id={id ? `${id}-feet` : undefined} name={name ? `${name}-feet` : undefined} autoFocus={autoFocus} placeholder={placeholder} aria-label={`${ariaLabel} — feet`} value={feetText} onChange={(event) => updateFeet(event.target.value)} />
      <span className="text-[11px] text-bc-dim" aria-hidden>ft</span>
      <input {...common} id={id ? `${id}-inches` : undefined} name={name ? `${name}-inches` : undefined} aria-label={`${ariaLabel} — inches`} value={inchesText} onChange={(event) => updateInches(event.target.value)} />
      <span className="text-[11px] text-bc-dim" aria-hidden>in</span>
    </span>
  );
});

export default function LengthInput({ value, onChange, min = 0, max = Infinity, ...props }: LengthInputProps) {
  const units = useUnits(s => s.units);
  const [draft, setDraft] = useState<string | null>(null);
  if (units === 'imperial') {
    return <ImperialLengthFields value={value} min={min} max={max} onChange={(meters) => meters !== undefined && onChange(meters)} className={props.className} style={props.style} ariaLabel={props['aria-label']} title={props.title} disabled={props.disabled} id={props.id} name={props.name} autoFocus={props.autoFocus} placeholder={props.placeholder} />;
  }
  const parsed = draft === null ? value : parseLength(draft, units);
  const commit = () => { if (parsed !== undefined && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed); setDraft(null); };
  return <input {...props} type="text" title={units === 'metric' ? 'Meters' : 'Feet and inches, e.g. 5\' 6.1" (bare numbers: feet)'} value={draft ?? formatLength(value, units)} aria-invalid={parsed === undefined || parsed < min || parsed > max} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }} />;
}

type OptionalLengthInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number | undefined;
  onChange: (meters: number | undefined) => void;
  min?: number;
  max?: number;
};

export function OptionalLengthInput({ value, onChange, min = 0, max = Infinity, placeholder, ...props }: OptionalLengthInputProps) {
  const units = useUnits(s => s.units);
  const [draft, setDraft] = useState<string | null>(null);
  if (units === 'imperial') {
    return <ImperialLengthFields value={value} min={min} max={max} allowEmpty onChange={onChange} className={props.className} style={props.style} ariaLabel={props['aria-label']} title={props.title} disabled={props.disabled} id={props.id} name={props.name} autoFocus={props.autoFocus} placeholder={placeholder} />;
  }
  const displayed = value === undefined ? '' : formatLength(value, units);
  const text = draft ?? displayed;
  const parsed = text.trim() === '' ? undefined : parseLength(text, units);
  const invalid = text.trim() !== '' && (parsed === undefined || parsed < min || parsed > max);
  const commit = () => {
    if (text.trim() === '') onChange(undefined);
    else if (parsed !== undefined && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
    setDraft(null);
  };
  return <input {...props} type="text" title={units === 'metric' ? 'Meters' : 'Feet and inches, e.g. 5\' 6.1" (bare numbers: feet)'} placeholder={placeholder} value={text} aria-invalid={invalid} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }} />;
}
