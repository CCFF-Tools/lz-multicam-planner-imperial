import type { Wall } from '../types';

export interface WallPoint { x: number; y: number }
export interface WallPathSegment {
  a: WallPoint;
  b: WallPoint;
  fromM: number;
  toM: number;
  lengthM: number;
}

export const wallIsCurved = (wall: Pick<Wall, 'cx' | 'cy'>): boolean =>
  Number.isFinite(wall.cx) && Number.isFinite(wall.cy);

export function wallPoint(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>, t: number): WallPoint {
  if (!wallIsCurved(wall)) {
    return { x: wall.x1 + (wall.x2 - wall.x1) * t, y: wall.y1 + (wall.y2 - wall.y1) * t };
  }
  const u = 1 - t;
  return {
    x: u * u * wall.x1 + 2 * u * t * wall.cx! + t * t * wall.x2,
    y: u * u * wall.y1 + 2 * u * t * wall.cy! + t * t * wall.y2,
  };
}

/** A short-segment centreline shared by the 2D, 3D and camera renderers. */
export function wallPathPoints(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>, maxSegmentM = 0.4): WallPoint[] {
  if (!wallIsCurved(wall)) return [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }];
  const controlLength = Math.hypot(wall.cx! - wall.x1, wall.cy! - wall.y1)
    + Math.hypot(wall.x2 - wall.cx!, wall.y2 - wall.cy!);
  const count = Math.max(8, Math.min(96, Math.ceil(controlLength / Math.max(0.1, maxSegmentM))));
  return Array.from({ length: count + 1 }, (_, index) => wallPoint(wall, index / count));
}

export function wallPathSegments(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>, maxSegmentM = 0.4): WallPathSegment[] {
  const points = wallPathPoints(wall, maxSegmentM);
  const result: WallPathSegment[] = [];
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const lengthM = Math.hypot(b.x - a.x, b.y - a.y);
    if (lengthM < 1e-6) continue;
    result.push({ a, b, fromM: distance, toM: distance + lengthM, lengthM });
    distance += lengthM;
  }
  return result;
}

export const wallPathLength = (wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>): number => {
  const segments = wallPathSegments(wall);
  return segments.length > 0 ? segments[segments.length - 1].toM : 0;
};

export function defaultWallControlPoint(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): WallPoint {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: wall.x1, y: wall.y1 };
  const offset = Math.min(2, Math.max(0.5, length * 0.2));
  return {
    x: (wall.x1 + wall.x2) / 2 - (dy / length) * offset,
    y: (wall.y1 + wall.y2) / 2 + (dx / length) * offset,
  };
}
