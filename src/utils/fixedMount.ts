import type { FixedMountLocation, VenueCamera } from '../types';

export type ResolvedFixedMountLocation = Exclude<FixedMountLocation, 'auto'>;

/**
 * Resolves the physical attachment while preserving the original automatic
 * behavior: non-PTZ cameras use a wall, while high PTZ cameras use the ceiling.
 */
export function resolveFixedMountLocation(
  cam: Pick<VenueCamera, 'z' | 'fixedMountLocation'>,
  isPtz: boolean,
  ceilingHeightM?: number,
): ResolvedFixedMountLocation {
  if (cam.fixedMountLocation === 'wall' || cam.fixedMountLocation === 'ceiling') return cam.fixedMountLocation;
  if (!isPtz) return 'wall';
  const nearCeiling = ceilingHeightM !== undefined && ceilingHeightM - cam.z < 1;
  return cam.z >= 2.5 || nearCeiling ? 'ceiling' : 'wall';
}

/** Rejects unknown values from hand-edited or future project files. */
export function normaliseFixedMountLocation(value: unknown): FixedMountLocation | undefined {
  return value === 'auto' || value === 'wall' || value === 'ceiling' ? value : undefined;
}
