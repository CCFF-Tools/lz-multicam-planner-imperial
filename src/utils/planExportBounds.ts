export interface PlanContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlanExportBounds {
  width: number;
  height: number;
  stageX: number;
  stageY: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Canvas bounds centered on the physical room, with a controlled safety area
 * for edge cameras, labels, and nearby FOV lines. Distant outliers must not
 * shrink the room to a thumbnail in the delivery sheet.
 */
export function planExportBounds(
  roomWidth: number,
  roomHeight: number,
  content: PlanContentRect,
  margin = 16,
): PlanExportBounds {
  const contentRight = content.x + Math.max(0, content.width);
  const contentBottom = content.y + Math.max(0, content.height);
  const overflowX = clamp(roomWidth * 0.12, 48, 120);
  const overflowY = clamp(roomHeight * 0.12, 48, 120);
  const minX = clamp(Math.min(0, content.x), -overflowX, 0);
  const minY = clamp(Math.min(0, content.y), -overflowY, 0);
  const maxX = clamp(Math.max(roomWidth, contentRight), roomWidth, roomWidth + overflowX);
  const maxY = clamp(Math.max(roomHeight, contentBottom), roomHeight, roomHeight + overflowY);
  return {
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
    stageX: margin - minX,
    stageY: margin - minY,
  };
}

/** Complete physical drawing bounds for detached preset exports (coverage excluded). */
export function completePlanExportBounds(roomWidth: number, roomHeight: number, content: PlanContentRect): PlanExportBounds {
  const minX = Math.min(0, content.x), minY = Math.min(0, content.y);
  return {
    width: Math.max(roomWidth, content.x + content.width) - minX + 32,
    height: Math.max(roomHeight, content.y + content.height) - minY + 32,
    stageX: 16 - minX, stageY: 16 - minY,
  };
}
