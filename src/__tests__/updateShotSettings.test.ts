import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../store/useStore';
import { shotSettingChanges, selectedShotState } from '../utils/shotSettings';
import { presetExportJobs, presetExportKey } from '../utils/exportBatch';
import type { Shot, VenueCamera } from '../types';

const camera = (): VenueCamera => ({
  id: 'camera-1', label: 'CAM 1', cameraId: 'birddog-p200', lensId: 'ptz-sony-srg-x120',
  x: 10, y: 11, z: 3.5, pan: 10, tilt: -5, focalLength: 20, aperture: 4,
  focusDistance: 8, trackOffset: 0, color: '#123456', extenderActive: 1,
  presets: [{ number: 2, name: 'Stage', pan: 10, tilt: -5, focalLength: 20,
    focusDistance: 8, aperture: 1.8, trackOffset: 0,
    savedAt: '2026-01-01T00:00:00Z', savedAtPosition: { x: 10, y: 11, z: 2.5 } }],
});
const shot = (): Shot => ({
  id: 'shot-1', name: 'Stage', cameraId: 'camera-1', ptzPresetNumber: 2,
  transition: 'fast', note: 'Cue 17', thumbnail: 'data:image/jpeg;base64,old',
  state: { x: 10, y: 11, z: 2.5, pan: 10, tilt: -5, focalLength: 20,
    aperture: 1.8, focusDistance: 8, trackOffset: 0 },
});
beforeEach(() => useStore.setState({
  cameras: [camera()], shotlists: [{ id: 'list-1', name: 'Show', shots: [shot()] }],
  activeShotlistId: 'list-1', currentShotId: 'shot-1',
}));
describe('selective update of an existing shot', () => {
  it('detects only changed camera fields', () => {
    expect(shotSettingChanges(shot().state, camera())).toEqual(['z', 'aperture']);
  });
  it('copies only requested fields', () => {
    const next = selectedShotState(shot().state, camera(), ['aperture']);
    expect(next).toMatchObject({ z: 2.5, aperture: 4, pan: 10, focalLength: 20 });
  });
  it('updates aperture only in shot and PTZ coverage export, preserving elevation', () => {
    expect(useStore.getState().updateShotFromCamera('list-1', 'shot-1', ['aperture'])).toBe(true);
    const s = useStore.getState();
    const after = s.shotlists[0].shots[0];
    expect(after).toMatchObject({ id: 'shot-1', note: 'Cue 17', state: { aperture: 4, z: 2.5 } });
    expect(after.thumbnail).toBeUndefined();
    expect(s.cameras[0].presets?.[0]).toMatchObject({ aperture: 4, savedAtPosition: { z: 2.5 } });
    expect(presetExportJobs(s.cameras, new Set([presetExportKey('camera-1', 2)]))[0].cameraOverride)
      .toMatchObject({ aperture: 4, z: 2.5 });
  });
  it('updates lens elevation only, without resetting aperture', () => {
    useStore.getState().updateShotFromCamera('list-1', 'shot-1', ['z']);
    const s = useStore.getState();
    expect(s.shotlists[0].shots[0].state).toMatchObject({ z: 3.5, aperture: 1.8 });
    expect(s.cameras[0].presets?.[0]).toMatchObject({ aperture: 1.8, savedAtPosition: { z: 3.5 } });
  });
  it('does not create a new shot or modify an unchanged project', () => {
    const before = useStore.getState().projectVersion;
    expect(useStore.getState().updateShotFromCamera('list-1', 'shot-1', ['pan'])).toBe(false);
    expect(useStore.getState().projectVersion).toBe(before);
    expect(useStore.getState().shotlists[0].shots).toHaveLength(1);
  });
  it('refuses to overwrite a shot when its numbered preset has been deleted', () => {
    useStore.setState(s => ({ cameras: s.cameras.map(c => ({ ...c, presets: [] })) }));
    expect(useStore.getState().updateShotFromCamera('list-1', 'shot-1', ['aperture'])).toBe(false);
    expect(useStore.getState().shotlists[0].shots[0].state.aperture).toBe(1.8);
  });
});
