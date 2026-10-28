import { describe, expect, it } from 'vitest';
import { buildProjectFile } from '../store/useStore';
import type { Venue, VenueCamera } from '../types';
import { normaliseFixedMountLocation, resolveFixedMountLocation } from '../utils/fixedMount';

const camera = (fixedMountLocation: VenueCamera['fixedMountLocation']): VenueCamera => ({
  id: 'camera-1', label: 'Fixed PTZ', cameraId: 'ptz', lensId: 'integrated',
  x: 2, y: 3, z: 2.2, pan: 0, tilt: 0, focalLength: 20, aperture: 2.8,
  focusDistance: 5, color: '#ef4444', extenderActive: 1, useSpeedbooster: false,
  mountType: 'fixed', fixedMountLocation,
});

describe('fixed mount location', () => {
  it('retains legacy automatic thresholds and accepts explicit overrides', () => {
    expect(resolveFixedMountLocation(camera('auto'), true, 5)).toBe('wall');
    expect(resolveFixedMountLocation({ ...camera(undefined), z: 3 }, true, 5)).toBe('ceiling');
    expect(resolveFixedMountLocation(camera('auto'), true, 3)).toBe('ceiling');
    expect(resolveFixedMountLocation(camera(undefined), false, 3)).toBe('wall');
    expect(resolveFixedMountLocation(camera('ceiling'), false, 5)).toBe('ceiling');
    expect(resolveFixedMountLocation(camera('wall'), true, 2.5)).toBe('wall');
  });

  it('normalises project input to the supported values', () => {
    expect(normaliseFixedMountLocation('auto')).toBe('auto');
    expect(normaliseFixedMountLocation('wall')).toBe('wall');
    expect(normaliseFixedMountLocation('ceiling')).toBe('ceiling');
    expect(normaliseFixedMountLocation('floor')).toBeUndefined();
  });

  it('persists the explicit choice through native project JSON', () => {
    const venue: Venue = { name: 'Room', widthM: 10, heightM: 8, stages: [] };
    const project = buildProjectFile({
      projectVersion: 1, venue, cameras: [camera('ceiling')], persons: [], walls: [], backgroundPlan: null,
      avForeign: {}, stageForeign: {}, floorPlanForeign: {}, wallForeign: {}, personForeign: {},
    });
    const restored = JSON.parse(JSON.stringify(project));
    expect(restored.cameras[0].fixedMountLocation).toBe('ceiling');
  });
});
