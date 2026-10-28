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

/**
 * Canvas bounds that contain both the physical room and every visible Konva
 * item, including camera markers, labels, and FOV lines outside the walls.
 */
export function planExportBounds(
  worldWidth: number,
  worldHeight: number,
  content: PlanContentRect,
  margin = 32,
): PlanExportBounds {
  const contentRight = content.x + Math.max(0, content.width);
  const contentBottom = content.y + Math.max(0, content.height);
  const minX = Math.min(0, content.x);
  const minY = Math.min(0, content.y);
  const maxX = Math.max(worldWidth, contentRight);
  const maxY = Math.max(worldHeight, contentBottom);
  return {
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
    stageX: margin - minX,
    stageY: margin - minY,
  };
}
