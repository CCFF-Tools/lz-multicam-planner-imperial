import { describe, expect, it } from 'vitest';
import { buildProjectFile } from '../store/useStore';
import type { ReferencePerson, Venue, VenueCamera, Wall } from '../types';
import { planItemLabel } from '../utils/planItemLabel';

const venue: Venue = { name: 'Annotation test', widthM: 12, heightM: 8, stages: [] };
const camera: VenueCamera = {
  id: 'camera-1', label: 'Public Comment', cameraId: 'sony-hdc-3500', lensId: 'fuj-ha18x7.6',
  x: 2, y: 3, z: 1.8, pan: 0, tilt: 0, focalLength: 50, aperture: 2.8,
  focusDistance: 5, color: '#ef4444', extenderActive: 1, useSpeedbooster: false,
  showLabel2D: false, showHeight2D: true,
};
const person: ReferencePerson = {
  id: 'object-1', label: 'Presentation', objectType: 'lectern', x: 4, y: 2,
  width: 0.5, height: 1.2, showLabel2D: true, showHeight2D: false,
};
const wall: Wall = {
  id: 'wall-1', label: 'North wall', x1: 0, y1: 0, x2: 10, y2: 0, height: 3,
  openings: [
    { id: 'door-1', kind: 'door', offset: 1, width: 0.9, bottom: 0, top: 2.1, material: 'wood', color: '#80552f' },
    { id: 'window-1', kind: 'window', offset: 4, width: 1.5, bottom: 0.9, top: 2.2, material: 'glass' },
  ],
};

describe('2D item annotations', () => {
  it('keeps complete words and preserves legacy camera/object height defaults', () => {
    expect(planItemLabel({ label: 'Public Comment', heightText: `5' 11"`, defaultShowHeight: false })).toBe('Public Comment');
    expect(planItemLabel({ label: 'Presentation', heightText: '1.2m', defaultShowHeight: true })).toBe('Presentation\n1.2m');
  });

  it('toggles labels and heights independently', () => {
    expect(planItemLabel({ label: 'Camera 1', heightText: '1.8m', showLabel: false, showHeight: true, defaultShowHeight: false })).toBe('1.8m');
    expect(planItemLabel({ label: 'Lectern', heightText: '1.2m', showLabel: true, showHeight: false, defaultShowHeight: true })).toBe('Lectern');
    expect(planItemLabel({ label: 'Hidden', heightText: '1m', showLabel: false, showHeight: false, defaultShowHeight: true })).toBe('');
  });
});

describe('annotation and opening persistence', () => {
  it('round-trips camera/object switches and door/window properties in native projects', () => {
    const project = buildProjectFile({
      projectVersion: 1, venue, cameras: [camera], persons: [person], walls: [wall], backgroundPlan: null,
      avForeign: {}, stageForeign: {}, floorPlanForeign: {}, wallForeign: {}, personForeign: {},
    });
    const restored = JSON.parse(JSON.stringify(project));
    expect(restored.cameras[0]).toMatchObject({ showLabel2D: false, showHeight2D: true });
    expect(restored.persons[0]).toMatchObject({ showLabel2D: true, showHeight2D: false });
    expect(restored.walls[0].openings).toEqual(wall.openings);
  });
});
