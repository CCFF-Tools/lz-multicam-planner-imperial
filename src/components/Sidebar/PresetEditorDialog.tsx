import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useUnits } from '../../store/units';
import { formatLength, parseLength } from '../../utils/units';
import { useTranslation, format } from '../../i18n';
import type { PtzPreset } from '../../types';

const EDIT_EVENT = 'multicam-edit-ptz-preset';

/** Shared entry point for camera sidebar and shotlist; the editor mounts once in App. */
export function openPtzPresetEditor(cameraId: string, presetNumber: number): void {
  window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: { cameraId, presetNumber } }));
}

type Target = { cameraId: string; presetNumber: number };
type Draft = {
  number: string;
  name: string;
  segment: string;
  pan: string;
  tilt: string;
  focalLength: string;
  focusDistance: string;
  useCurrentPosition: boolean;
};

export default function PresetEditorDialog() {
  const { t } = useTranslation();
  const units = useUnits(s => s.units);
  const cameras = useStore(s => s.cameras);
  const updatePreset = useStore(s => s.updatePreset);
  const [target, setTarget] = useState<Target | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const open = (event: Event) => {
      const { cameraId, presetNumber } = (event as CustomEvent<Target>).detail ?? {};
      const camera = useStore.getState().cameras.find(c => c.id === cameraId);
      const preset = camera?.presets?.find(p => p.number === presetNumber);
      if (!preset) return;
      setTarget({ cameraId, presetNumber });
      setDraft({
        number: String(preset.number), name: preset.name, segment: preset.segment ?? '',
        pan: String(preset.pan), tilt: String(preset.tilt),
        focalLength: String(preset.focalLength), focusDistance: formatLength(preset.focusDistance, units),
        useCurrentPosition: false,
      });
    };
    window.addEventListener(EDIT_EVENT, open);
    return () => window.removeEventListener(EDIT_EVENT, open);
  }, [units]);

  const camera = cameras.find(c => c.id === target?.cameraId);
  const preset = camera?.presets?.find(p => p.number === target?.presetNumber);
  if (!target || !draft || !camera || !preset) return null;

  const number = Number(draft.number);
  const pan = Number(draft.pan);
  const tilt = Number(draft.tilt);
  const focalLength = Number(draft.focalLength);
  const focusDistance = parseLength(draft.focusDistance, units);
  const numberValid = /^\d+$/.test(draft.number.trim()) && Number.isSafeInteger(number) && number > 0;
  const duplicate = camera.presets?.some(p => p.number === number && p !== preset) ?? false;
  const valid = numberValid && !duplicate && !!draft.name.trim()
    && [pan, tilt, focalLength].every(Number.isFinite)
    && focalLength > 0 && focusDistance !== undefined && Number.isFinite(focusDistance) && focusDistance > 0;

  const field = (label: string, key: keyof Pick<Draft, 'number' | 'name' | 'segment' | 'pan' | 'tilt' | 'focalLength' | 'focusDistance'>, suffix?: string) => (
    <label className="flex flex-col gap-1 text-xs text-bc-muted">
      <span>{label}{suffix ? ` (${suffix})` : ''}</span>
      <input
        aria-label={label}
        className="w-full rounded-bc-m border border-bc-border bg-bc-panel-raised px-2 py-1.5 text-sm text-bc-text-bright"
        value={draft[key]}
        onChange={event => setDraft(current => current ? { ...current, [key]: event.target.value } : null)}
      />
    </label>
  );

  const useCurrentCamera = () => setDraft(current => current ? {
    ...current, pan: String(camera.pan), tilt: String(camera.tilt),
    focalLength: String(camera.focalLength), focusDistance: formatLength(camera.focusDistance, units),
    useCurrentPosition: true,
  } : null);

  const save = () => {
    if (!valid || focusDistance === undefined) return;
    const poseChanged = pan !== preset.pan || tilt !== preset.tilt
      || focalLength !== preset.focalLength || focusDistance !== preset.focusDistance || draft.useCurrentPosition;
    const patch: Partial<PtzPreset> = {
      number, name: draft.name.trim(), segment: draft.segment.trim() || undefined,
      pan, tilt, focalLength, focusDistance,
      ...(draft.useCurrentPosition ? { savedAtPosition: { x: camera.x, y: camera.y, z: camera.z } } : {}),
      ...(poseChanged ? { savedAt: new Date().toISOString() } : {}),
    };
    updatePreset(camera.id, preset.number, patch);
    setTarget(null);
    setDraft(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bc-scrim p-4" onMouseDown={event => {
      if (event.target === event.currentTarget) { setTarget(null); setDraft(null); }
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ptz-preset-edit-title" className="bc-dialog w-full max-w-lg p-5 text-bc-text-bright">
        <h2 id="ptz-preset-edit-title" className="text-lg font-semibold">
          {t('sidebar.cam.editPresetTitle', 'Edit PTZ preset')} · {camera.label}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {field(t('sidebar.cam.presetNumber', 'Preset number'), 'number')}
          {field(t('sidebar.cam.presetSegment', 'Segment'), 'segment')}
          <div className="col-span-2">{field(t('sidebar.cam.presetName', 'Preset name'), 'name')}</div>
          {field(t('sidebar.cam.presetPan', 'Pan'), 'pan', '°')}
          {field(t('sidebar.cam.presetTilt', 'Tilt'), 'tilt', '°')}
          {field(t('sidebar.cam.presetFocal', 'Focal length'), 'focalLength', 'mm')}
          {field(t('sidebar.cam.presetFocus', 'Focus distance'), 'focusDistance', units === 'imperial' ? 'ft / in' : 'm')}
        </div>
        <p className="mt-3 text-xs text-bc-muted">
          {format(t('sidebar.cam.presetSavedPosition', 'Saved position: X {x}, Y {y}, Z {z}'), {
            x: formatLength(preset.savedAtPosition.x, units),
            y: formatLength(preset.savedAtPosition.y, units),
            z: formatLength(preset.savedAtPosition.z, units),
          })}
        </p>
        <button type="button" className="bc-btn-soft mt-2 text-xs" onClick={useCurrentCamera}>
          {t('sidebar.cam.presetOverwritePose', 'Use current camera position, pan, tilt, zoom and focus')}
        </button>
        <p className="mt-2 text-xs text-bc-muted">
          {t('sidebar.cam.presetEditHint', 'Changes to the preset pose also update linked shotlist states and clear outdated thumbnails. This does not program the physical PTZ camera.')}
        </p>
        {!numberValid && <p className="mt-2 text-xs text-bc-red-text">{t('sidebar.cam.presetInvalidNumber', 'Preset number must be a positive whole number.')}</p>}
        {duplicate && <p className="mt-2 text-xs text-bc-red-text">{t('sidebar.cam.presetDuplicateNumber', 'This camera already has that preset number.')}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="bc-btn-soft" onClick={() => { setTarget(null); setDraft(null); }}>{t('sidebar.cam.presetCancel', 'Cancel')}</button>
          <button type="button" className="bc-btn-primary" disabled={!valid} onClick={save}>{t('sidebar.cam.presetApply', 'Save changes')}</button>
        </div>
      </div>
    </div>
  );
}
