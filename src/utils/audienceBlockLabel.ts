import { sitzblockNormal, sitzblockPlaetze, type VenueSeatingBlock } from '../avplan/floorplan';

export interface AudienceBlockCounts {
  capacity: number;
  occupied: number;
  percent: number;
}

export function audienceBlockCounts(block: VenueSeatingBlock): AudienceBlockCounts {
  const normal = sitzblockNormal(block);
  const capacity = sitzblockPlaetze(normal);
  return {
    capacity,
    occupied: Math.round(capacity * normal.occupancy),
    percent: Math.round(normal.occupancy * 100),
  };
}

export interface AudienceBlockLabelCopy {
  name: string;
  capacity: string;
  occupied: string;
  compactCapacity: string;
  compactOccupied: string;
}

export interface AudienceBlockLabelLine {
  text: string;
  y: number;
  bold: boolean;
}

export interface AudienceBlockLabelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  inside: boolean;
  lines: AudienceBlockLabelLine[];
}

/**
 * Three fixed lines avoid word-by-word wrapping. A footprint with less than
 * 64×44 px cannot hold a readable annotation, so its label moves immediately
 * below the block with a stable minimum width.
 */
export function audienceBlockLabelLayout(
  copy: AudienceBlockLabelCopy,
  blockWidthPx: number,
  blockHeightPx: number,
): AudienceBlockLabelLayout {
  const wideEnoughForFullCopy = blockWidthPx >= 128;
  const insideFontSize = wideEnoughForFullCopy ? 10 : 9;
  const insideLineHeight = Math.ceil(insideFontSize * 1.3);
  const insideHeight = insideLineHeight * 3 + 4;
  const inside = blockWidthPx >= 64 && blockHeightPx >= insideHeight + 12;
  const fullCopy = !inside || wideEnoughForFullCopy;
  const fontSize = fullCopy ? 10 : insideFontSize;
  const lineHeight = fullCopy ? Math.ceil(fontSize * 1.3) : insideLineHeight;
  const height = lineHeight * 3 + 4;
  const width = inside
    ? Math.max(48, blockWidthPx - 12)
    : Math.min(220, Math.max(128, blockWidthPx - 8));
  const x = -width / 2;
  const y = inside ? -blockHeightPx / 2 + 7 : blockHeightPx / 2 + 6;
  const countLines = fullCopy
    ? [copy.capacity, copy.occupied]
    : [copy.compactCapacity, copy.compactOccupied];
  return {
    x,
    y,
    width,
    height,
    fontSize,
    lineHeight,
    inside,
    lines: [copy.name, ...countLines].map((text, index) => ({
      text,
      y: 2 + index * lineHeight,
      bold: index === 0,
    })),
  };
}
