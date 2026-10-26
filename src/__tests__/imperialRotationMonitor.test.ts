import { personYaw, objectYaw } from '../utils/objectOrientation';
import { buildProjectFile } from '../store/useStore';
import { describe, it, expect } from 'vitest';
import { formatDimensions, formatLength, formatLengthWithUnit, formatSpeed, imperialPartsToMeters, parseLength, scaleDisplayFactor, scaleUnit, splitImperialLength } from '../utils/units';
import { toVenueExchange, fromVenueExchange } from '../utils/venueExchange';
import { videowandNormal } from '../avplan/floorplan';
import type { ReferencePerson, Venue } from '../types';

describe('architectural measurements', () => {
  it('accepts decimal inches and signed feet without changing meter geometry', () => {
    expect(parseLength(`5' 6.1"`, 'imperial')).toBeCloseTo(66.1 * 0.0254, 12);
    expect(parseLength('-2 ft 3.5 in', 'imperial')).toBeCloseTo(-27.5 * 0.0254);
    expect(parseLength('10', 'imperial')).toBe(3.048);
    expect(parseLength('10', 'metric')).toBe(10);
    expect(parseLength('bad', 'imperial')).toBeUndefined();
  });
  it('rounds with carry and round-trips within half a tenth inch', () => {
    expect(formatLength(11.99 * 0.0254, 'imperial')).toBe(`1' 0"`);
    for (const m of [-12.34, 0, 1.685, 22.25]) expect(Math.abs(parseLength(formatLength(m, 'imperial'), 'imperial')! - m)).toBeLessThanOrEqual(0.00127);
  });
  it('normalises an unrestricted inches field into feet and inches', () => {
    const meters = imperialPartsToMeters(0, 26);
    expect(splitImperialLength(meters)).toEqual({ feet: 2, inches: 2 });
    expect(splitImperialLength(imperialPartsToMeters(3, 14.6))).toEqual({ feet: 4, inches: 2.6 });
  });
  it('formats dimensions, speeds, and floor-plan scale in the selected system', () => {
    expect(formatLengthWithUnit(2, 'metric')).toBe('2 m');
    expect(formatLengthWithUnit(0.3048, 'imperial')).toBe(`1' 0"`);
    expect(formatDimensions(0.3048, 0.6096, 'imperial')).toBe(`1' 0" × 2' 0"`);
    expect(formatSpeed(0.3048, 'imperial')).toBe('1 ft/s');
    expect(scaleUnit('metric')).toBe('mm/px');
    expect(scaleUnit('imperial')).toBe('in/px');
    expect(0.0254 * scaleDisplayFactor('imperial')).toBeCloseTo(1, 12);
  });
});
describe('venue compatibility', () => {
  const venue: Venue = { name: 'Test', widthM: 20, heightM: 10, stages: [], videoWalls: [{ id: 'monitor', displayType: 'monitor', x: 3, y: 2, widthM: 1.2, heightM: 0.675, bottomM: 1.5, rotationDeg: 37.5 }] };
  it.each(['person', 'sitting-person', 'lectern', 'chair', 'table'] as const)('preserves %s orientation and monitors through JSON exchange', objectType => {
    const person: ReferencePerson = { id: 'p', x: 2, y: 4, width: 0.5, height: 1.8, label: 'P', objectType, rotationDeg: -397.5, ...(objectType === 'table' ? { depth: 0.9 } : {}) };
    const result = fromVenueExchange(JSON.parse(JSON.stringify(toVenueExchange({ venue, persons: [person], walls: [], backgroundPlan: null, appVersion: '4.9.0', exportedAt: '2026-10-25T00:00:00Z' }))));
    expect(result.persons[0].rotationDeg).toBe(-397.5);
    expect(result.venue.videoWalls?.[0]).toEqual(venue.videoWalls![0]);
    expect(result.persons[0].x).toBe(2);
    if (objectType === 'table') expect(result.persons[0].depth).toBe(0.9);
  });
  it('retains old LED defaults and normalizes arbitrary monitor angles', () => {
    const wall = venue.videoWalls![0];
    expect(videowandNormal({ ...wall, displayType: undefined }).displayType).toBe('led-wall');
    expect(videowandNormal({ ...wall, rotationDeg: -397.5 }).rotationDeg).toBe(322.5);
  });
});

it('uses shared scene orientation while preserving automatic facing', () => {
  expect(personYaw(undefined, 70)).toBeCloseTo(20 * Math.PI / 180);
  expect(personYaw(37.5, 70)).toBeCloseTo(52.5 * Math.PI / 180);
  expect(objectYaw(397.5)).toBeCloseTo(-397.5 * Math.PI / 180);
  expect(objectYaw()).toBe(-0);
});
it('preserves optional fields through native project serialization', () => {
  const person: ReferencePerson = { id: 'p', x: 2, y: 3, height: 0.75, width: 1.2, depth: 0.8, label: 'Table', objectType: 'table', rotationDeg: 123.4 };
  const venue: Venue = { name: 'V', widthM: 20, heightM: 10, stages: [], videoWalls: [{ id: 'm', x: 1, y: 2, widthM: 1.2, heightM: 0.7, displayType: 'monitor', rotationDeg: 45 }] };
  const file = buildProjectFile({ projectVersion: 1, venue, persons: [person], cameras: [], walls: [], backgroundPlan: null, avForeign: {}, stageForeign: {}, floorPlanForeign: {}, wallForeign: {}, personForeign: {} });
  const restored = JSON.parse(JSON.stringify(file));
  expect(restored.persons[0]).toEqual(person);
  expect(restored.venue).toEqual(venue);
  expect(restored).not.toHaveProperty('units');
});
