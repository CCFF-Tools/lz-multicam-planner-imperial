import { describe, expect, it } from 'vitest';
import type { Wall } from '../types';
import { wandStuecke } from '../utils/wallOpenings';
import { defaultWallControlPoint, wallPathLength, wallPathPoints, wallPoint } from '../utils/wallPath';

const straight: Wall = { id: 'w', x1: 0, y1: 0, x2: 10, y2: 0, label: 'Wall' };

describe('curved walls', () => {
  it('keeps legacy straight walls as one exact segment', () => {
    expect(wallPathPoints(straight)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(wandStuecke(straight, 3)).toEqual([{ x: 5, y: 0, unten: 0, hoehe: 3, laenge: 10, winkel: 0 }]);
  });

  it('samples a quadratic control point for 2D and physical wall segments', () => {
    const curved = { ...straight, cx: 5, cy: 4 };
    expect(wallPoint(curved, 0.5)).toEqual({ x: 5, y: 2 });
    expect(wallPathPoints(curved).length).toBeGreaterThan(8);
    const pieces = wandStuecke(curved, 3);
    expect(pieces.length).toBeGreaterThan(8);
    expect(pieces.reduce((sum, piece) => sum + piece.laenge, 0)).toBeCloseTo(wallPathLength(curved), 8);
    expect(new Set(pieces.map((piece) => piece.winkel.toFixed(3))).size).toBeGreaterThan(2);
  });

  it('creates a visible default bow perpendicular to the endpoints', () => {
    const control = defaultWallControlPoint(straight);
    expect(control.x).toBe(5);
    expect(control.y).toBeGreaterThan(0);
  });
});
