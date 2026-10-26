import { describe, expect, it } from 'vitest';
import type { VenueCamera } from '../types';
import { cameraRowDetail } from '../components/Venue3D/cameraRow';

const cam = { focalLength: 50, focusDistance: 3.048, mountType: 'tripod' } as VenueCamera;
const t = (_key: string, english: string) => english;

describe('3D camera list measurements', () => {
  it('formats focus distance in the selected units', () => {
    expect(cameraRowDetail(t, cam, 'Camera', { focalLengthMin: 24, focalLengthMax: 70 }, 'imperial')).toContain(`Focus 10' 0"`);
    expect(cameraRowDetail(t, cam, 'Camera', null, 'metric')).toContain('Focus 3.048 m');
  });
});
