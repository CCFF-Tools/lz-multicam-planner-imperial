import { describe, expect, it, vi } from 'vitest';
import { renderPreset3D, setExportRenderer3D, setzeRenderer3D, render3D } from '../components/Render3D/kameraBild3d';
import type { Camera, Lens, Venue, VenueCamera } from '../types';
import { bottomLeftCameraPosition, presetSheetData } from '../utils/presetExportSheet';
import { collectPresetArtifacts, presetExportJobs, presetExportKey } from '../utils/exportBatch';
import { computeDof } from '../utils/fov';
import { effectiveCameraPos } from '../utils/camera';
import { formatLengthWithUnit } from '../utils/units';
import { completePlanExportBounds } from '../utils/planExportBounds';
import { sheetTextLines } from '../utils/drawPresetSheet';

const camera: VenueCamera = {
  id: 'c', label: 'Rear', cameraId: 'report-camera', lensId: 'report-lens', x: 12, y: 18, z: 2.2,
  pan: -115, tilt: -3, focalLength: 45.4, aperture: 4, focusDistance: 16.74,
  color: '#22c55e', extenderActive: 1, mountType: 'fixed',
};
const venue: Venue = { name: 'Room', widthM: 13.4, heightM: 19.2, stages: [], ceilingHeightM: 4 };
const sensor = { name: '4:3', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.65 };
const catalog = {
  customCameras: [{ id: 'report-camera', manufacturer: 'Actual', model: 'Camera', sensor, type: 'ptz', mount: 'integrated', resolutions: ['HD'] } as Camera],
  customLenses: [{ id: 'report-lens', manufacturer: 'Actual', model: 'Lens', mount: 'integrated', type: 'integrated', focalLengthMin: 6, focalLengthMax: 120, maxApertureWide: 1.8 } as Lens],
};
const rowMap = (cam = camera, units: 'metric' | 'imperial' = 'imperial') => Object.fromEntries(presetSheetData(cam, venue, catalog, units).sections.flatMap(s => s.rows));

describe('preset coverage report data', () => {
  it('uses the actual room bottom-left datum, including effective track movement', () => {
    expect(bottomLeftCameraPosition({ ...camera, x: 0, y: 19.2 }, 19.2)).toEqual({ x: 0, y: 0 });
    const tracked = { ...camera, mountType: 'dolly' as const, trackLength: 8, trackOffset: 2, rigRotation: 90 };
    const pos = effectiveCameraPos(tracked);
    expect(bottomLeftCameraPosition(tracked, 19.2)).toEqual({ x: pos.x, y: 19.2 - pos.y });
    expect(bottomLeftCameraPosition({ ...camera, y: 20 }, 19.2).y).toBeCloseTo(-.8);
  });
  it('lists exactly the requested sections and uses real lens metadata and 16:9 framing', () => {
    const data = presetSheetData(camera, venue, catalog, 'imperial');
    expect(data.sections.map(s => s.title)).toEqual(['Camera & Optics', 'Camera Position', 'Field of View', 'Depth of Field']);
    const rows = rowMap();
    expect(rows['Camera model']).toBe('Actual Camera');
    expect(rows['Lens model']).toBe('Actual Lens');
    expect(rows['Horizontal field of view']).toBe('9.37°');
    expect(rows['Vertical field of view']).toBe('5.28°');
    expect(rows['Image height at focal plane']).toBe(formatLengthWithUnit(16.74 * 7.44 / 45.4 * 9 / 16, 'imperial'));
    expect(rows['Near focus']).toBe(formatLengthWithUnit(computeDof(sensor, 45.4, 4, 16.74).nearLimit, 'imperial'));
    expect(rows['Camera position (X/Y)']).toBe(`${formatLengthWithUnit(12, 'imperial')} / ${formatLengthWithUnit(1.2, 'imperial')}`);
    expect(rowMap(camera, 'metric')['Lens elevation']).toBe(formatLengthWithUnit(2.2, 'metric'));
  });
  it('resolves explicit/automatic fixed mounts exactly as the physical renderer does', () => {
    expect(rowMap()['Mount']).toBe('Fixed · Wall');
    expect(rowMap({ ...camera, fixedMountLocation: 'ceiling' })['Mount']).toBe('Fixed · Ceiling');
    expect(rowMap({ ...camera, z: 3.5, fixedMountLocation: 'wall' })['Mount']).toBe('Fixed · Wall');
    expect(rowMap({ ...camera, z: 3.5 })['Mount']).toBe('Fixed · Ceiling');
    expect(rowMap({ ...camera, mountType: 'tripod' })['Mount']).toBe('Tripod');
  });
  it('handles infinity and fails explicitly when optics metadata is missing', () => {
    expect(rowMap({ ...camera, focusDistance: 1000 })['Far focus']).toBe('∞');
    expect(() => rowMap({ ...camera, lensId: 'missing' })).toThrow('Missing camera or lens');
  });
  it('preserves physical geometry and plan labels outside the nominal room footprint', () => {
    const bounds = completePlanExportBounds(400, 600, { x: -80, y: -30, width: 620, height: 800 });
    expect(bounds).toEqual({ width: 652, height: 832, stageX: 96, stageY: 46 });
    const room = completePlanExportBounds(400, 600, { x: 0, y: 0, width: 400, height: 600 });
    expect(room).toEqual({ width: 432, height: 632, stageX: 16, stageY: 16 });
  });
  it('wraps exceptionally long names to fit bounded columns', () => {
    const ctx = { measureText: (s: string) => ({ width: s.length * 10 }) as TextMetrics };
    const lines = sheetTextLines(ctx, 'An exceptionally-long-unbroken-camera-model-name with several words', 200);
    expect(lines.every(l => ctx.measureText(l).width <= 200)).toBe(true);
    expect(lines.join('').replace(/\s/g, '')).toBe('An exceptionally-long-unbroken-camera-model-name with several words'.replace(/\s/g, ''));
  });
});

describe('isolated preset batch', () => {
  it('renders an explicit preset through a separate registration from the working preview', () => {
    const live = vi.fn(() => true), detached = vi.fn(() => true);
    const canvas = {} as HTMLCanvasElement;
    setzeRenderer3D({ render: live });
    setExportRenderer3D({ render: detached });
    try {
      expect(renderPreset3D(camera, canvas)).toBe(true);
      expect(detached).toHaveBeenCalledWith(camera.id, canvas, 1280, 1, 'gross', camera);
      expect(live).not.toHaveBeenCalled();
      setExportRenderer3D(null);
      expect(renderPreset3D(camera, canvas)).toBe(false);
      expect(render3D('working-camera', canvas, 640, 1, 'gross')).toBe(true);
      expect(live).toHaveBeenCalledWith('working-camera', canvas, 640, 1, 'gross');
    } finally { setExportRenderer3D(null); setzeRenderer3D(null); }
  });
  it('passes distinct recalled values to each render, retains failures, and never mutates source cameras', async () => {
    const cameras = [{ ...camera, presets: [
      { number: 1, name: 'A', pan: 12, tilt: -10, focalLength: 20, focusDistance: 8, savedAtPosition: { x: 1, y: 2, z: 3 } },
      { number: 2, name: 'B', pan: 30, tilt: 2, focalLength: 80, focusDistance: 15 },
    ] }] as VenueCamera[];
    const original = JSON.stringify(cameras);
    const jobs = presetExportJobs(cameras, new Set([presetExportKey('c', 1), presetExportKey('c', 2)]));
    const seen: VenueCamera[] = [];
    const result = await collectPresetArtifacts(jobs, async (_job, cam) => {
      seen.push(cam);
      if (cam.focalLength === 80) throw new Error('Capture failed');
      return rowMap(cam);
    }, () => {});
    expect(seen[0]).toMatchObject({ x: 1, y: 2, z: 3, pan: 12, focalLength: 20 });
    expect(seen[1]).toMatchObject({ x: 12, y: 18, pan: 30, focalLength: 80 });
    expect(result.artifacts).toHaveLength(1);
    expect(result.failures[0]).toContain('Preset #2');
    expect(JSON.stringify(cameras)).toBe(original);
  });
});
