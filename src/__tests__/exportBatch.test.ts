import { describe, expect, it } from 'vitest';
import type { VenueCamera } from '../types';
import { cameraExportJobs, presetExportJobs, presetExportKey } from '../utils/exportBatch';
import { selectedPresetSheetLayout, containExportImage } from '../utils/presetExportSheet';
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
  it('uses fixed 2560×1440 geometry with two views and four aligned technical panels', () => {
    const layout = selectedPresetSheetLayout();
    expect([layout.width, layout.height]).toEqual([2560, 1440]);
    expect(layout.width / layout.height).toBe(16 / 9);
    expect(layout.cameraView.width / (layout.cameraView.width + layout.plan2D.width)).toBeCloseTo(.65, 2);
    expect(layout).not.toHaveProperty('view3D');
    const rects = [layout.cameraView, layout.plan2D, ...layout.sections];
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(layout.headerHeight);
      expect(rect.x + rect.width).toBeLessThanOrEqual(layout.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(layout.height);
      for (const other of rects.filter(r => r !== rect)) {
        expect(rect.x + rect.width <= other.x || other.x + other.width <= rect.x
          || rect.y + rect.height <= other.y || other.y + other.height <= rect.y).toBe(true);
      }
    }
    expect(new Set(layout.sections.map(r => r.y)).size).toBe(1);
    expect(new Set(layout.sections.map(r => r.height)).size).toBe(1);
  });

  it.each([[13.4, 19.2], [24, 8], [8, 24], [10, 10], [1280, 720]])('contains %s×%s sources without cropping or distortion', (width, height) => {
    const rect = selectedPresetSheetLayout().plan2D;
    const image = containExportImage(width, height, rect);
    expect(image.width / image.height).toBeCloseTo(width / height, 10);
    expect(image.x).toBeGreaterThanOrEqual(rect.x - 1e-8);
    expect(image.y).toBeGreaterThanOrEqual(rect.y - 1e-8);
    expect(image.x + image.width).toBeLessThanOrEqual(rect.x + rect.width + 1e-8);
    expect(image.y + image.height).toBeLessThanOrEqual(rect.y + rect.height + 1e-8);
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
