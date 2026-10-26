import { describe, expect, it } from 'vitest';
import type { ProjectFile, ReferencePerson, Venue } from '../types';
import { OBJECT_PRESETS, buildProjectFile } from '../store/useStore';
import { ceilingHeightAt, ceilingMaterialAt, normaliseCeilingZone, objectBaseElevation } from '../utils/ceiling';
import { fromVenueExchange, toVenueExchange } from '../utils/venueExchange';
import { objectYaw } from '../utils/objectOrientation';

const light: ReferencePerson = {
  id: 'linear-1',
  x: 5,
  y: 4,
  height: 0.09,
  width: 0.07,
  depth: 1.8,
  suspensionDropM: 0.65,
  rotationDeg: 32.5,
  label: 'Pendant 1',
  objectType: 'linear-light',
};

const venue: Venue = {
  name: 'Ceiling test',
  widthM: 12,
  heightM: 9,
  ceilingHeightM: 4,
  ceilingMaterial: 'drywall',
  ceilingZones: [{ id: 'drop-1', label: 'Lobby soffit', x: 5, y: 4, widthM: 3, depthM: 2, heightM: 3.2, material: 'drop-tile' }],
  stages: [],
};

describe('ceiling zones and suspended linear lights', () => {
  it('uses the last matching ceiling override for height and finish', () => {
    const layered = {
      ...venue,
      ceilingZones: [...venue.ceilingZones!, { id: 'inner', x: 5, y: 4, widthM: 1, depthM: 1, heightM: 2.8, material: 'drywall' as const }],
    };
    expect(ceilingHeightAt(layered, 5, 4)).toBe(2.8);
    expect(ceilingMaterialAt(layered, 5, 4)).toBe('drywall');
    expect(ceilingHeightAt(layered, 1, 1)).toBe(4);
    expect(ceilingMaterialAt(layered, 1, 1)).toBe('drywall');
  });

  it('places the fixture below its local ceiling and preserves arbitrary rotation', () => {
    expect(objectBaseElevation(venue, light, 0)).toBeCloseTo(3.2 - 0.65 - 0.09, 8);
    expect(objectYaw(light.rotationDeg)).toBeCloseTo(-32.5 * Math.PI / 180, 8);
    expect(OBJECT_PRESETS['linear-light']).toMatchObject({ depth: 1.2, suspensionDropM: 1 });
  });

  it('normalises invalid ceiling values without changing valid dimensions', () => {
    expect(normaliseCeilingZone({ id: 'z', x: Number.NaN, y: 2, widthM: -1, depthM: 3, heightM: 0, material: 'drywall' })).toEqual({
      id: 'z', x: 0, y: 2, widthM: 1, depthM: 3, heightM: 3, material: 'drywall',
    });
  });

  it('round-trips ceiling areas and suspension dimensions through venue exchange', () => {
    const exchange = JSON.parse(JSON.stringify(toVenueExchange({
      venue,
      persons: [light],
      walls: [],
      backgroundPlan: null,
      appVersion: '4.9.0',
      exportedAt: '2026-10-26T00:00:00Z',
    })));
    const restored = fromVenueExchange(exchange);
    expect(restored.venue.ceilingMaterial).toBe('drywall');
    expect(restored.venue.ceilingZones).toEqual(venue.ceilingZones);
    expect(restored.persons[0]).toMatchObject({ depth: 1.8, suspensionDropM: 0.65, rotationDeg: 32.5, objectType: 'linear-light' });
  });

  it('preserves the same fields in native project files', () => {
    const project = JSON.parse(JSON.stringify(buildProjectFile({
      projectVersion: 3,
      venue,
      cameras: [],
      persons: [light],
      walls: [],
      backgroundPlan: null,
      avForeign: {},
      stageForeign: {},
      floorPlanForeign: {},
      wallForeign: {},
      personForeign: {},
    }))) as ProjectFile;
    expect(project.venue.ceilingZones).toEqual(venue.ceilingZones);
    expect(project.persons[0]).toMatchObject({ width: 0.07, depth: 1.8, height: 0.09, suspensionDropM: 0.65 });
  });
});
