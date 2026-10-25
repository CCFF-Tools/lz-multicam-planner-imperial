/** Plan angles are clockwise from +X. Model people face +Z at rest. */
export function personYaw(rotationDeg: number | undefined, automaticFacingDeg: number): number {
  return Math.PI / 2 - (rotationDeg ?? automaticFacingDeg) * Math.PI / 180;
}
/** Legacy furniture keeps its original pose at zero. */
export function objectYaw(rotationDeg?: number): number {
  return -(rotationDeg ?? 0) * Math.PI / 180;
}
