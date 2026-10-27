import { describe, expect, it } from 'vitest';
import type { VenueCamera } from '../types';
import { cameraExportJobs } from '../utils/exportBatch';

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
