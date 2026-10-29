import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../store/useStore';
import { presetExportJobs, presetExportKey } from '../utils/exportBatch';
import type { Shot, VenueCamera } from '../types';

const camera = (): VenueCamera => ({
  id: 'cam-a', label: 'CAM A', cameraId: 'birddog-p200', lensId: 'ptz-sony-srg-x120',
  x: 1, y: 2, z: 3, pan: 10, tilt: -5, focalLength: 30, aperture: 2.8,
  focusDistance: 8, color: '#112233', extenderActive: 1, trackOffset: 0,
  presets: [{ number: 1, name: 'Wide', pan: 10, tilt: -5, focalLength: 30,
    focusDistance: 8, savedAt: '2026-01-01T00:00:00Z', savedAtPosition: { x: 1, y: 2, z: 3 } }],
});
const shot = (): Shot => ({
  id: 'shot-a', cameraId: 'cam-a', name: 'Wide', ptzPresetNumber: 1,
  state: { x: 1, y: 2, z: 3, pan: 10, tilt: -5, focalLength: 30,
    aperture: 2.8, focusDistance: 8, trackOffset: 0 },
  thumbnail: 'data:image/jpeg;base64,abcd', transition: 'fast',
});

beforeEach(() => useStore.setState({
  cameras: [camera()], shotlists: [{ id: 'list-a', name: 'A', shots: [shot()] }],
  activeShotlistId: 'list-a',
}));

describe('linked PTZ presets', () => {
  it('updates linked shot snapshot, thumbnail and reference when preset is edited', () => {
    useStore.getState().updatePreset('cam-a', 1, {
      number: 4, name: 'Tight', pan: 33, focalLength: 95,
      savedAtPosition: { x: 5, y: 6, z: 7 },
    });
    const state = useStore.getState();
    expect(state.cameras[0].presets?.[0]).toMatchObject({ number: 4, name: 'Tight', pan: 33 });
    expect(state.shotlists[0].shots[0]).toMatchObject({
      ptzPresetNumber: 4, name: 'Tight',
      state: { x: 5, y: 6, z: 7, pan: 33, focalLength: 95 },
    });
    expect(state.shotlists[0].shots[0].thumbnail).toBeUndefined();
    expect(presetExportJobs(state.cameras, new Set([presetExportKey('cam-a', 4)]))).toHaveLength(1);
  });

  it('preserves custom shot names and framegrabs for metadata-only edits', () => {
    useStore.getState().updateShot('list-a', 'shot-a', { name: 'Director cue' });
    useStore.getState().updatePreset('cam-a', 1, { name: 'Renamed', segment: 'Opening' });
    const linked = useStore.getState().shotlists[0].shots[0];
    expect(linked.name).toBe('Director cue');
    expect(linked.thumbnail).toContain('data:image/jpeg');
  });

  it('rejects invalid and duplicate device preset numbers', () => {
    useStore.getState().updatePreset('cam-a', 1, { number: 0 });
    expect(useStore.getState().cameras[0].presets?.[0].number).toBe(1);
    useStore.setState(s => ({
      cameras: s.cameras.map(c => ({ ...c, presets: [...(c.presets ?? []),
        { ...(c.presets ?? [])[0], number: 2 }] })),
    }));
    useStore.getState().updatePreset('cam-a', 1, { number: 2 });
    expect(useStore.getState().cameras[0].presets?.map(p => p.number)).toEqual([1, 2]);
  });
});
