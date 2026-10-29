import type { PtzPreset, ShotState, VenueCamera } from '../types';

/** Fields the operator can selectively write back from the current camera into a saved shot. */
export const SHOT_SETTING_FIELDS = [
  'x', 'y', 'z', 'pan', 'tilt', 'focalLength', 'aperture', 'focusDistance', 'trackOffset',
] as const satisfies readonly (keyof ShotState)[];

export type ShotSettingField = (typeof SHOT_SETTING_FIELDS)[number];

export function shotSettingChanges(saved: ShotState, camera: VenueCamera): ShotSettingField[] {
  return SHOT_SETTING_FIELDS.filter(key =>
    Math.abs(saved[key] - (key === 'trackOffset' ? (camera.trackOffset ?? 0) : camera[key])) > 1e-6,
  );
}

/** Copy only explicit fields. The remaining saved shot parameters stay untouched. */
export function selectedShotState(saved: ShotState, camera: VenueCamera, fields: readonly ShotSettingField[]): ShotState {
  const next = { ...saved };
  for (const key of fields) next[key] = key === 'trackOffset' ? (camera.trackOffset ?? 0) : camera[key];
  return next;
}

/** All shared fields are reflected in the numbered PTZ preset used by coverage exports. */
export function selectedPresetState(
  preset: PtzPreset, state: ShotState, fields: readonly ShotSettingField[], savedAt: string,
): PtzPreset {
  if (!fields.length) return preset;
  const selected = new Set<ShotSettingField>(fields);
  const next = { ...preset, savedAt };
  for (const field of ['pan', 'tilt', 'focalLength', 'focusDistance', 'aperture', 'trackOffset'] as const) {
    if (selected.has(field)) next[field] = state[field];
  }
  if (selected.has('x') || selected.has('y') || selected.has('z')) {
    next.savedAtPosition = {
      x: selected.has('x') ? state.x : preset.savedAtPosition.x,
      y: selected.has('y') ? state.y : preset.savedAtPosition.y,
      z: selected.has('z') ? state.z : preset.savedAtPosition.z,
    };
  }
  return next;
}
