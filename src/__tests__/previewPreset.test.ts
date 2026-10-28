import { describe, expect, it } from 'vitest';
import {
  adjacentPreset,
  assignPreset,
  copyPresetToCamera,
  groupPresets,
  hasPose,
  matchingPreset,
  previewPresetsFromShots,
  type PreviewPreset,
} from '../utils/previewPreset';
import type { Shot, VenueCamera } from '../types';

const preset = (id: string, over: Partial<PreviewPreset> = {}): PreviewPreset => ({
  id,
  name: `Preset ${id}`,
  focalLength: 35,
  aperture: 2.8,
  focusDistance: 8,
  ...over,
});

describe('groupPresets', () => {
  const own = preset('a', { cameraId: 'cam-1' });
  const foreign = preset('b', { cameraId: 'cam-2' });
  const legacy = preset('c');
  const orphan = preset('d', { cameraId: 'cam-weg' });
  const all = [own, foreign, legacy, orphan];
  const existing = ['cam-1', 'cam-2'];

  it('zeigt nur die Presets der aktiven Kamera', () => {
    // Der eigentliche Fehler: ein Preset von CAM 2 fuhr CAM 1 an dessen Position.
    const g = groupPresets(all, 'cam-1', existing);
    expect(g.own).toEqual([own]);
    expect(g.own.some((p) => p.cameraId === 'cam-2')).toBe(false);
  });

  it('wirft Altbestand ohne Zuordnung nicht weg', () => {
    expect(groupPresets(all, 'cam-1', existing).unassigned).toContain(legacy);
  });

  it('behandelt Presets gelöschter Kameras als unzugeordnet', () => {
    // Nach dem Laden eines anderen Projekts haben alle Kameras neue Ids —
    // stilles Loeschen waere Datenverlust.
    expect(groupPresets(all, 'cam-1', existing).unassigned).toContain(orphan);
  });

  it('zeigt bei jeder Kamera deren eigene Presets', () => {
    expect(groupPresets(all, 'cam-2', existing).own).toEqual([foreign]);
  });

  it('kommt ohne ausgewählte Kamera klar', () => {
    const g = groupPresets(all, null, existing);
    expect(g.own).toEqual([]);
    expect(g.unassigned).toEqual([legacy, orphan]);
  });

  it('lässt die Reihenfolge unangetastet', () => {
    const g = groupPresets([preset('x'), preset('y')], 'cam-1', existing);
    expect(g.unassigned.map((p) => p.id)).toEqual(['x', 'y']);
  });
});

describe('assignPreset', () => {
  it('ordnet genau ein Preset zu', () => {
    const next = assignPreset([preset('a'), preset('b')], 'a', 'cam-3');
    expect(next[0].cameraId).toBe('cam-3');
    expect(next[1].cameraId).toBeUndefined();
  });

  it('mutiert die Liste nicht', () => {
    const list = [preset('a')];
    assignPreset(list, 'a', 'cam-3');
    expect(list[0].cameraId).toBeUndefined();
  });

  it('ignoriert unbekannte Ids', () => {
    const list = [preset('a')];
    expect(assignPreset(list, 'gibtsnicht', 'cam-3')).toEqual(list);
  });
});

describe('copyPresetToCamera', () => {
  it('legt eine Kopie für die andere Kamera an, das Original bleibt', () => {
    const next = copyPresetToCamera([preset('a', { cameraId: 'cam-1' })], 'a', 'cam-2', 'neu', ' (CAM 2)');
    expect(next).toHaveLength(2);
    expect(next[0].cameraId).toBe('cam-1');
    expect(next[1]).toMatchObject({ id: 'neu', cameraId: 'cam-2', name: 'Preset a (CAM 2)' });
  });

  it('tut nichts bei unbekannter Id', () => {
    const list = [preset('a')];
    expect(copyPresetToCamera(list, 'x', 'cam-2', 'neu')).toEqual(list);
  });
});

describe('hasPose', () => {
  it('erkennt Presets mit Position im Raum', () => {
    expect(hasPose(preset('a', { pan: 30 }))).toBe(true);
    expect(hasPose(preset('a', { x: 4 }))).toBe(true);
    expect(hasPose(preset('a', { z: 1.5 }))).toBe(true);
  });

  it('meldet rein optische Presets als ohne Position', () => {
    expect(hasPose(preset('a'))).toBe(false);
  });
});

describe('quick preset recall', () => {
  const camera: Pick<VenueCamera, 'x' | 'y' | 'z' | 'pan' | 'tilt' | 'focalLength' | 'aperture' | 'focusDistance' | 'trackOffset'> = {
    x: 2, y: 3, z: 1.5, pan: 350, tilt: -5,
    focalLength: 35, aperture: 2.8, focusDistance: 8, trackOffset: 0,
  };
  const one = preset('one', { cameraId: 'cam-1', ...camera });
  const two = preset('two', { cameraId: 'cam-1', focalLength: 70 });

  it('identifies the current preset and tolerates equivalent wrapped angles', () => {
    expect(matchingPreset([one, two], { ...camera, pan: -10 })?.id).toBe('one');
  });

  it('shows custom after a meaningful camera adjustment', () => {
    expect(matchingPreset([one, two], { ...camera, focalLength: 36 })).toBeUndefined();
  });

  it('cycles both directions and enters the list from Custom', () => {
    expect(adjacentPreset([one, two], undefined, 1)?.id).toBe('one');
    expect(adjacentPreset([one, two], undefined, -1)?.id).toBe('two');
    expect(adjacentPreset([one, two], 'one', -1)?.id).toBe('two');
    expect(adjacentPreset([one, two], 'two', 1)?.id).toBe('one');
    expect(adjacentPreset([], undefined, 1)).toBeUndefined();
  });
});

describe('shot-list recall source', () => {
  const state = {
    x: 2, y: 3, z: 1.5, pan: 90, tilt: -5,
    focalLength: 35, aperture: 2.8, focusDistance: 8, trackOffset: 0.75,
  };
  const shot = (id: string, cameraId: string, name: string): Shot => ({
    id,
    cameraId,
    name,
    state,
    transition: 'fast',
  });

  it('filters to the open camera, preserves shot-list order, and carries the complete pose', () => {
    const presets = previewPresetsFromShots([
      shot('other', 'cam-2', 'Other'),
      shot('wide', 'cam-1', 'Wide'),
      shot('close', 'cam-1', 'Close'),
    ], 'cam-1');

    expect(presets.map((p) => p.id)).toEqual(['wide', 'close']);
    expect(presets[0]).toMatchObject({
      sourceShotId: 'wide',
      cameraId: 'cam-1',
      name: 'Wide',
      ...state,
    });
  });

  it('matches a captured view and changes to Custom after moving the camera', () => {
    const presets = previewPresetsFromShots([shot('wide', 'cam-1', 'Wide')], 'cam-1');
    expect(matchingPreset(presets, { ...state, pan: 450 })?.id).toBe('wide');
    expect(matchingPreset(presets, { ...state, x: state.x + 0.02 })).toBeUndefined();
  });
});
