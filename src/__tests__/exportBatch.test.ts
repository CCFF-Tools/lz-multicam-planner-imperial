import { describe, expect, it } from 'vitest';
import type { VenueCamera } from '../types';
import { cameraExportJobs, presetExportJobs, presetExportKey } from '../utils/exportBatch';

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
      { number: 8, name: 'Close', pan: 20, tilt: -5, focalLength: 120, focusDistance: 9 },
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
    expect(jobs[0].cameraOverride).toMatchObject({ pan: 20, tilt: -5, focalLength: 120, focusDistance: 9 });
  });
});
