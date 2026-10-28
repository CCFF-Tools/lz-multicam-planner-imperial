import * as THREE from 'three';

/**
 * A wall box whose longitudinal end faces can be omitted independently.
 * Removing only internal caps prevents transparent wall pieces from exposing
 * full-height planes at the edges of a door or window.
 */
export function wallBoxGeometry(
  lengthM: number,
  heightM: number,
  thicknessM: number,
  caps: { start: boolean; end: boolean },
): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(lengthM, heightM, thicknessM);
  const source = geometry.getIndex();
  if (!source) return geometry;

  // BoxGeometry groups 0/1 are +X/-X: end/start along the wall piece.
  const keep = geometry.groups.filter((group) => {
    const materialIndex = group.materialIndex ?? 0;
    return materialIndex >= 2
      || (materialIndex === 0 && caps.end)
      || (materialIndex === 1 && caps.start);
  });
  const indices: number[] = [];
  for (const group of keep) {
    for (let offset = 0; offset < group.count; offset += 1) indices.push(source.getX(group.start + offset));
  }
  geometry.setIndex(indices);
  geometry.clearGroups();
  return geometry;
}
