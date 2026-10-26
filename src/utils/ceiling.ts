import type { CeilingMaterial, CeilingZone, ReferencePerson, Venue } from '../types';

export const DEFAULT_CEILING_HEIGHT_M = 3;
export const DEFAULT_CEILING_MATERIAL: CeilingMaterial = 'drywall';

let ceilingZoneCounter = 0;

export function ceilingZoneId(): string {
  ceilingZoneCounter += 1;
  return `ceiling-${Date.now().toString(36)}-${ceilingZoneCounter}`;
}

export function normaliseCeilingZone(zone: CeilingZone): CeilingZone {
  const positive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback;
  return {
    id: zone.id,
    ...(zone.label !== undefined ? { label: zone.label } : {}),
    x: Number.isFinite(zone.x) ? zone.x : 0,
    y: Number.isFinite(zone.y) ? zone.y : 0,
    widthM: positive(zone.widthM, 1),
    depthM: positive(zone.depthM, 1),
    heightM: positive(zone.heightM, DEFAULT_CEILING_HEIGHT_M),
    material: zone.material === 'drop-tile' ? 'drop-tile' : 'drywall',
  };
}

export function ceilingZoneAt(venue: Pick<Venue, 'ceilingZones'>, x: number, y: number): CeilingZone | undefined {
  const zones = venue.ceilingZones ?? [];
  for (let index = zones.length - 1; index >= 0; index -= 1) {
    const zone = normaliseCeilingZone(zones[index]);
    if (Math.abs(x - zone.x) <= zone.widthM / 2 && Math.abs(y - zone.y) <= zone.depthM / 2) return zone;
  }
  return undefined;
}

export function ceilingHeightAt(venue: Pick<Venue, 'ceilingHeightM' | 'ceilingZones'>, x: number, y: number): number | undefined {
  return ceilingZoneAt(venue, x, y)?.heightM ?? venue.ceilingHeightM;
}

export function ceilingMaterialAt(venue: Pick<Venue, 'ceilingMaterial' | 'ceilingZones'>, x: number, y: number): CeilingMaterial {
  return ceilingZoneAt(venue, x, y)?.material ?? venue.ceilingMaterial ?? DEFAULT_CEILING_MATERIAL;
}

/** Bottom elevation for a ceiling-suspended object. Ordinary objects retain their floor elevation. */
export function objectBaseElevation(venue: Pick<Venue, 'ceilingHeightM' | 'ceilingZones'>, object: ReferencePerson, floorM: number): number {
  if (object.objectType !== 'linear-light') return floorM;
  const ceilingM = ceilingHeightAt(venue, object.x, object.y) ?? DEFAULT_CEILING_HEIGHT_M;
  const dropM = Math.max(0, object.suspensionDropM ?? 1);
  return Math.max(0, ceilingM - dropM - Math.max(0.01, object.height));
}
