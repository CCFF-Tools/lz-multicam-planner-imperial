import { describe, expect, it } from 'vitest';
import { audienceBlockCounts, audienceBlockLabelLayout, type AudienceBlockLabelCopy } from '../utils/audienceBlockLabel';

const copy: AudienceBlockLabelCopy = {
  name: 'Main audience',
  capacity: 'Capacity: 100 seats',
  occupied: 'Occupied: 50 seats (50%)',
  compactCapacity: 'Cap. 100',
  compactOccupied: 'Occ. 50 (50%)',
};

describe('audience block capacity labels', () => {
  it('reports full and populated capacity independently', () => {
    expect(audienceBlockCounts({
      id: 'audience', x: 0, y: 0, width: 5.5, rows: 10,
      seatWidthM: 0.55, occupancy: 0.5,
    })).toEqual({ capacity: 100, occupied: 50, percent: 50 });
  });

  it('uses three stable full-text lines in a large block', () => {
    const layout = audienceBlockLabelLayout(copy, 180, 90);
    expect(layout.inside).toBe(true);
    expect(layout.lines.map((line) => line.text)).toEqual([
      'Main audience', 'Capacity: 100 seats', 'Occupied: 50 seats (50%)',
    ]);
    expect(layout.lines[1].y - layout.lines[0].y).toBe(layout.lineHeight);
    expect(layout.lines[2].y - layout.lines[1].y).toBe(layout.lineHeight);
  });

  it('uses concise lines in a narrow block without automatic wrapping', () => {
    const layout = audienceBlockLabelLayout(copy, 72, 60);
    expect(layout.inside).toBe(true);
    expect(layout.lines.map((line) => line.text)).toEqual(['Main audience', 'Cap. 100', 'Occ. 50 (50%)']);
    expect(layout.width).toBe(60);
  });

  it('moves the complete annotation outside blocks too small to read', () => {
    const layout = audienceBlockLabelLayout(copy, 45, 25);
    expect(layout.inside).toBe(false);
    expect(layout.width).toBeGreaterThanOrEqual(128);
    expect(layout.y).toBeGreaterThan(25 / 2);
    expect(layout.lines.map((line) => line.text)).toEqual([
      'Main audience', 'Capacity: 100 seats', 'Occupied: 50 seats (50%)',
    ]);
  });
});
