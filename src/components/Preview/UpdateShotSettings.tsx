import { useState } from 'react';
import { FiCheck, FiEdit2 } from 'react-icons/fi';
import { useStore } from '../../store/useStore';
import { useUnits } from '../../store/units';
import { formatLength } from '../../utils/units';
import { shotSettingChanges, type ShotSettingField } from '../../utils/shotSettings';
import { useTranslation } from '../../i18n';

const LABELS: Record<ShotSettingField, string> = {
  x: 'Camera X', y: 'Camera Y', z: 'Lens elevation', pan: 'Pan', tilt: 'Tilt',
  focalLength: 'Focal length', aperture: 'Aperture', focusDistance: 'Focus distance',
  trackOffset: 'Track offset',
};

/** Update the recalled, existing shot, never capture a new numbered preset. */
export default function UpdateShotSettings({ cameraId }: { cameraId: string }) {
  const { t } = useTranslation();
  const units = useUnits(s => s.units);
  const { cameras, shotlists, activeShotlistId, currentShotId, updateShotFromCamera } = useStore();
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<Set<ShotSettingField>>(() => new Set());
  const list = shotlists.find(l => l.id === activeShotlistId);
  const shot = list?.shots.find(s => s.id === currentShotId && s.cameraId === cameraId);
  const camera = cameras.find(c => c.id === cameraId);
  if (!shot || !camera || !list) return null;
  const changes = shotSettingChanges(shot.state, camera);
  const orphan = shot.ptzPresetNumber !== undefined && !camera.presets?.some(p => p.number === shot.ptzPresetNumber);
  const selected = changes.filter(k => !excluded.has(k));
  const describe = (key: ShotSettingField, value: number) => {
    if (['x', 'y', 'z', 'focusDistance', 'trackOffset'].includes(key)) return formatLength(value, units);
    if (key === 'aperture') return `f/${value.toFixed(1)}`;
    if (key === 'focalLength') return `${value.toFixed(1)} mm`;
    return `${value.toFixed(1)}°`;
  };
  return (
    <div className="relative">
      <button type="button" className="bc-btn-soft text-xs flex items-center gap-1"
        aria-expanded={open}
        title={t('preview.updateShotHint', 'Update an existing shot with selected current camera settings')}
        onClick={() => { setExcluded(new Set()); setOpen(v => !v); }}>
        <FiEdit2 size={14} /> {t('preview.updateShot', 'Update shot settings')}{changes.length ? ` (${changes.length})` : ''}
      </button>
      {open && <div className="absolute right-0 bottom-full mb-2 z-50 w-[min(360px,85vw)] max-h-[60vh] overflow-y-auto rounded-bc-m border border-bc-border bg-bc-panel p-3 shadow-bc-1 text-bc-text-bright">
        <div className="text-sm font-semibold">{shot.name}</div>
        <p className="mt-1 text-xs text-bc-muted">{t('preview.updateShotDesc', 'Select settings to write back to this saved shot. Unselected values stay unchanged.')}</p>
        {orphan && <p className="mt-2 text-xs text-bc-red-text">{t('preview.updateShotOrphan', 'Linked PTZ preset is missing. Restore it before updating.')}</p>}
        {!changes.length && <p className="my-3 text-xs text-bc-muted">{t('preview.updateShotNoChanges', 'This camera already matches the saved shot.')}</p>}
        <div className="my-2 space-y-1">
          {changes.map(key => <label key={key} className="flex items-center gap-2 px-1 py-1 text-xs hover:bg-bc-hover">
            <input type="checkbox" checked={!excluded.has(key)} onChange={e => setExcluded(prev => {
              const next = new Set(prev); if (e.target.checked) next.delete(key); else next.add(key); return next;
            })} />
            <span className="min-w-0 flex-1">{t(`preview.shotField.${key}`, LABELS[key])}</span>
            <span className="text-bc-muted tabular-nums">{describe(key, shot.state[key])}</span>
            <span className="text-bc-muted">→</span>
            <span className="tabular-nums">{describe(key, key === 'trackOffset' ? (camera.trackOffset ?? 0) : camera[key])}</span>
          </label>)}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="bc-btn-soft text-xs" onClick={() => setOpen(false)}>{t('preview.updateShotCancel', 'Cancel')}</button>
          <button type="button" className="bc-btn-primary text-xs" disabled={orphan || selected.length === 0} onClick={() => {
            if (updateShotFromCamera(list.id, shot.id, selected)) { setOpen(false); setExcluded(new Set()); }
          }}><FiCheck size={13} /> {t('preview.updateShotSave', 'Update selected')}</button>
        </div>
      </div>}
    </div>
  );
}
