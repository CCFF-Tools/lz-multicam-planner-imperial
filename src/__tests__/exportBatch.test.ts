import { describe, expect, it } from 'vitest';
import type { VenueCamera } from '../types';
import { cameraExportJobs, presetExportJobs, presetExportKey } from '../utils/exportBatch';
import { selectedPresetSheetLayout } from '../utils/presetExportSheet';
import { planExportBounds } from '../utils/planExportBounds';
import previewSource from '../components/Preview/Kamerablick.tsx?raw';

const camera = (id: string, lensId = id): VenueCamera => ({ id, lensId } as VenueCamera);

describe('Wide + Tele export queue', () => {
  it('includes wide and tele for every zoom camera in camera order', () => {
    const jobs = cameraExportJobs([camera('a'), camera('b')], true, (cam) => (
      cam.id === 'a' ? { focalLengthMin: 8, focalLengthMax: 80 } : { focalLengthMin: 24, focalLengthMax: 240 }
    ));
    expect(jobs.map((job) => [job.cam.id, job.focalOverride, job.variantLabel])).toEqual([
      ['a', 8, 'wide_8mm'], ['a', 80, 'tele_80mm'],
      ['b', 24, 'wide_24mm'], ['b', 240, 'tele_240mm'],
    ]);
  });

  it('exports a prime once and retains a missing lens as a reportable job', () => {
    const jobs = cameraExportJobs([camera('prime'), camera('missing')], true, (cam) => (
      cam.id === 'prime' ? { focalLengthMin: 50, focalLengthMax: 50 } : undefined
    ));
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ focalOverride: 50, variantLabel: '50mm' });
    expect(jobs[1]).toEqual({ cam: expect.objectContaining({ id: 'missing' }) });
  });

  it('emits one current-state job per camera outside Wide + Tele mode', () => {
    expect(cameraExportJobs([camera('a'), camera('b')], false, () => undefined)).toEqual([
      { cam: expect.objectContaining({ id: 'a' }) },
      { cam: expect.objectContaining({ id: 'b' }) },
    ]);
  });
});

describe('selected preset export queue', () => {
  it('exports only checked presets in camera and preset-number order', () => {
    const a = { ...camera('a'), presets: [
      { number: 8, name: 'Close', pan: 20, tilt: -5, focalLength: 120, focusDistance: 9, savedAtPosition: { x: 4, y: 5, z: 2 } },
      { number: 2, name: 'Wide', pan: 0, tilt: 0, focalLength: 20, focusDistance: 12 },
    ] } as VenueCamera;
    const b = { ...camera('b'), presets: [
      { number: 1, name: 'Lectern', pan: 45, tilt: -2, focalLength: 70, focusDistance: 6 },
    ] } as VenueCamera;
    const selected = new Set([presetExportKey('a', 8), presetExportKey('b', 1)]);
    const jobs = presetExportJobs([a, b], selected);
    expect(jobs.map((job) => [job.cam.id, job.variantLabel])).toEqual([
      ['a', 'preset_8_Close'],
      ['b', 'preset_1_Lectern'],
    ]);
    expect(jobs.map((job) => job.displayLabel)).toEqual(['Preset #8 — Close', 'Preset #1 — Lectern']);
    expect(jobs[0].cameraOverride).toMatchObject({ pan: 20, tilt: -5, focalLength: 120, focusDistance: 9, x: 4, y: 5, z: 2 });
  });
});

describe('selected preset delivery sheet', () => {
  it('uses a fixed 1920×1080 canvas with a room-aware plan column', () => {
    const layout = selectedPresetSheetLayout(12.2, 18.3);
    expect([layout.width, layout.height]).toEqual([1920, 1080]);
    expect(layout.width / layout.height).toBeCloseTo(16 / 9, 8);
    expect(layout.plan2D.height).toBeGreaterThan(900);
    expect(layout.plan2D.width / layout.plan2D.height).toBeGreaterThan(0.55);
    expect(layout.plan2D.width / layout.plan2D.height).toBeLessThan(0.7);
    expect(layout.view3D.width).toBeGreaterThanOrEqual(800);
    expect(layout.cameraView.width).toBeGreaterThanOrEqual(800);
    expect(layout.data.width).toBeGreaterThanOrEqual(400);

    for (const rect of [layout.plan2D, layout.view3D, layout.cameraView, layout.data]) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(layout.headerHeight);
      expect(rect.x + rect.width).toBeLessThanOrEqual(layout.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(layout.height);
    }
    expect(layout.plan2D.x + layout.plan2D.width).toBeLessThan(layout.view3D.x);
    expect(layout.view3D.x).toBe(layout.cameraView.x);
    expect(layout.view3D.width).toBe(layout.cameraView.width);
    expect(layout.view3D.y + layout.view3D.height).toBeLessThan(layout.cameraView.y);
    expect(layout.cameraView.x + layout.cameraView.width).toBeLessThan(layout.data.x);
    expect(layout.data.height).toBe(layout.plan2D.height);
  });

  it('gives a taller room a narrower plan column without starving the visual stack', () => {
    const tall = selectedPresetSheetLayout(8, 24);
    const wide = selectedPresetSheetLayout(24, 8);
    expect(tall.plan2D.width).toBeLessThan(wide.plan2D.width);
    expect(tall.view3D.width).toBeGreaterThan(wide.view3D.width);
    expect(wide.view3D.width).toBeGreaterThanOrEqual(800);
  });

  it('includes nearby edge labels without allowing distant outliers to shrink the room', () => {
    const nearby = planExportBounds(360, 540, { x: -40, y: -20, width: 440, height: 620 });
    expect(nearby.stageX).toBe(56);
    expect(nearby.stageY).toBe(36);
    expect(nearby.width).toBe(472);
    expect(nearby.height).toBe(652);

    const outlier = planExportBounds(360, 540, { x: -5000, y: -4000, width: 10000, height: 9000 });
    expect(outlier.width).toBeLessThanOrEqual(488);
    expect(outlier.height).toBeLessThanOrEqual(702);
    expect(360 / outlier.width).toBeGreaterThan(0.7);
    expect(540 / outlier.height).toBeGreaterThan(0.7);
  });

  it('forwards the rendered and English flags to the offscreen Camera View', () => {
    expect(previewSource).toContain('q.offscreen(w, options)');
  });
});
