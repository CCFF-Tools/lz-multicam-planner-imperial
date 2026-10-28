import { FiPlus, FiTrash2 } from 'react-icons/fi';
import type { VenueWallOpening } from '../../avplan/floorplan';
import { useTranslation, format } from '../../i18n';
import { useUnits } from '../../store/units';
import type { Wall } from '../../types';
import { lengthUnit } from '../../utils/units';
import { wallHeight } from '../../utils/wallHeight';
import { wallPathLength } from '../../utils/wallPath';
import LengthInput from '../ui/LengthInput';

interface Props {
  wall: Wall;
  defaultHeightM: number;
  onChange: (openings: VenueWallOpening[]) => void;
}

const openingId = () => `opening-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function WallOpeningsEditor({ wall, defaultHeightM, onChange }: Props) {
  const { t } = useTranslation();
  const units = useUnits((state) => state.units);
  const openings = wall.openings ?? [];
  const pathLength = wallPathLength(wall);
  const height = wallHeight(wall, defaultHeightM);

  const replace = (index: number, patch: Partial<VenueWallOpening>) => {
    onChange(openings.map((opening, candidate) => candidate === index ? { ...opening, ...patch } : opening));
  };
  const remove = (index: number) => onChange(openings.filter((_, candidate) => candidate !== index));
  const add = (kind: 'door' | 'window') => {
    const width = Math.min(kind === 'door' ? 0.9 : 1.2, Math.max(0.1, pathLength));
    const bottom = kind === 'door' ? 0 : Math.max(0, Math.min(0.9, height - 0.4));
    const top = Math.max(bottom + 0.1, Math.min(kind === 'door' ? 2.1 : 2.1, height));
    onChange([...openings, {
      id: openingId(),
      label: kind === 'door' ? t('sidebar.openingDoor', 'Door') : t('sidebar.openingWindow', 'Window'),
      kind,
      offset: Math.max(0, (pathLength - width) / 2),
      width,
      bottom,
      top,
      material: kind === 'window' ? 'glass' : 'solid',
      color: kind === 'door' ? '#6b4f3a' : undefined,
      doorSwing: kind === 'door' ? 'left-in' : undefined,
    }]);
  };

  return (
    <div className="space-y-1.5 border-t border-bc-border/70 pt-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-bc-muted">{t('sidebar.openings', 'Doors & windows')}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => add('door')} disabled={pathLength < 0.1} className="flex items-center gap-1 border border-bc-border px-1.5 py-0.5 text-[10px] text-bc-text hover:border-bc-accent hover:text-bc-accent disabled:opacity-40">
            <FiPlus size={9} /> {t('sidebar.openingDoor', 'Door')}
          </button>
          <button type="button" onClick={() => add('window')} disabled={pathLength < 0.1} className="flex items-center gap-1 border border-bc-border px-1.5 py-0.5 text-[10px] text-bc-text hover:border-bc-accent hover:text-bc-accent disabled:opacity-40">
            <FiPlus size={9} /> {t('sidebar.openingWindow', 'Window')}
          </button>
        </div>
      </div>
      {openings.map((opening, index) => {
        const kind = opening.kind === 'window' ? 'window' : 'door';
        const openingHeight = Math.max(0.05, opening.top - opening.bottom);
        return (
          <div key={opening.id ?? index} className="space-y-1 border border-bc-border bg-bc-panel p-1.5">
            <div className="flex items-center gap-1">
              <select
                aria-label={t('sidebar.openingType', 'Opening type')}
                className="min-w-0 flex-1 border border-bc-border bg-bc-dark px-1 py-0.5 text-[10px] text-bc-text-bright"
                value={kind}
                onChange={(event) => {
                  const next = event.target.value as 'door' | 'window';
                  replace(index, { kind: next, material: next === 'window' ? 'glass' : opening.material, label: next === 'door' ? 'Door' : 'Window' });
                }}
              >
                <option value="door">{t('sidebar.openingDoor', 'Door')}</option>
                <option value="window">{t('sidebar.openingWindowFixed', 'Fixed window')}</option>
              </select>
              {kind === 'door' && (
                <select aria-label={t('sidebar.openingFinish', 'Door finish')} className="min-w-0 flex-1 border border-bc-border bg-bc-dark px-1 py-0.5 text-[10px] text-bc-text-bright" value={opening.material ?? 'solid'} onChange={(event) => replace(index, { material: event.target.value as VenueWallOpening['material'] })}>
                  <option value="solid">{t('sidebar.openingSolid', 'Solid colour')}</option>
                  <option value="wood">{t('sidebar.openingWood', 'Wood')}</option>
                  <option value="metal">{t('sidebar.openingMetal', 'Metal')}</option>
                  <option value="glass">{t('sidebar.openingGlass', 'Glass')}</option>
                </select>
              )}
              {kind === 'door' && opening.material !== 'glass' && <input type="color" aria-label={t('sidebar.openingColour', 'Door colour')} className="h-5 w-6 border border-bc-border bg-transparent" value={opening.color ?? '#6b4f3a'} onChange={(event) => replace(index, { color: event.target.value })} />}
              <button type="button" aria-label={t('sidebar.openingRemove', 'Remove opening')} onClick={() => remove(index)} className="p-0.5 text-bc-muted hover:text-bc-red-text"><FiTrash2 size={11} /></button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {kind === 'door' && (
                <label className="text-[10px] text-bc-muted">
                  {t('sidebar.openingSwing', 'Swing')}
                  <select aria-label={t('sidebar.openingSwing', 'Swing')} className="w-full border border-bc-border bg-bc-dark px-1 py-0.5 text-bc-text-bright" value={opening.doorSwing ?? 'left-in'} onChange={(event) => replace(index, { doorSwing: event.target.value as VenueWallOpening['doorSwing'] })}>
                    <option value="left-in">{t('sidebar.openingSwingLeftIn', 'Left hinge · inward')}</option>
                    <option value="right-in">{t('sidebar.openingSwingRightIn', 'Right hinge · inward')}</option>
                    <option value="left-out">{t('sidebar.openingSwingLeftOut', 'Left hinge · outward')}</option>
                    <option value="right-out">{t('sidebar.openingSwingRightOut', 'Right hinge · outward')}</option>
                  </select>
                </label>
              )}
              {kind === 'door' && (
                <label className="text-[10px] text-bc-muted">
                  {t('sidebar.openingHardware', 'Hardware')}
                  <select aria-label={t('sidebar.openingHardware', 'Hardware')} className="w-full border border-bc-border bg-bc-dark px-1 py-0.5 text-bc-text-bright" value={opening.doorHardware ?? 'auto'} onChange={(event) => replace(index, { doorHardware: event.target.value === 'auto' ? undefined : event.target.value as VenueWallOpening['doorHardware'] })}>
                    <option value="auto">{t('sidebar.openingHardwareAuto', 'Automatic')}</option>
                    <option value="lever">{t('sidebar.openingHardwareLever', 'Lever handle')}</option>
                    <option value="pull">{t('sidebar.openingHardwarePull', 'Pull bars')}</option>
                    <option value="panic">{t('sidebar.openingHardwarePanic', 'Panic bar')}</option>
                    <option value="none">{t('sidebar.openingHardwareNone', 'None')}</option>
                  </select>
                </label>
              )}
              <label className="text-[10px] text-bc-muted">
                {format(t('sidebar.openingPosition', 'Position ({unit})'), { unit: lengthUnit(units) })}
                <LengthInput aria-label={`${kind} position`} className="w-full border border-bc-border bg-bc-dark px-1 py-0.5 text-bc-text-bright" value={opening.offset} min={0} max={Math.max(0, pathLength - 0.05)} onChange={(offset) => replace(index, { offset })} />
              </label>
              <label className="text-[10px] text-bc-muted">
                {format(t('sidebar.openingWidth', 'Width ({unit})'), { unit: lengthUnit(units) })}
                <LengthInput aria-label={`${kind} width`} className="w-full border border-bc-border bg-bc-dark px-1 py-0.5 text-bc-text-bright" value={opening.width} min={0.05} max={Math.max(0.05, pathLength - opening.offset)} onChange={(width) => replace(index, { width })} />
              </label>
              <label className="text-[10px] text-bc-muted">
                {format(t(kind === 'window' ? 'sidebar.openingSill' : 'sidebar.openingBottom', kind === 'window' ? 'Sill ({unit})' : 'Bottom ({unit})'), { unit: lengthUnit(units) })}
                <LengthInput aria-label={`${kind} bottom`} className="w-full border border-bc-border bg-bc-dark px-1 py-0.5 text-bc-text-bright" value={opening.bottom} min={0} max={Math.max(0, height - 0.05)} onChange={(bottom) => replace(index, { bottom, top: Math.min(height, bottom + openingHeight) })} />
              </label>
              <label className="text-[10px] text-bc-muted">
                {format(t('sidebar.openingHeight', 'Height ({unit})'), { unit: lengthUnit(units) })}
                <LengthInput aria-label={`${kind} height`} className="w-full border border-bc-border bg-bc-dark px-1 py-0.5 text-bc-text-bright" value={openingHeight} min={0.05} max={Math.max(0.05, height - opening.bottom)} onChange={(nextHeight) => replace(index, { top: opening.bottom + nextHeight })} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
