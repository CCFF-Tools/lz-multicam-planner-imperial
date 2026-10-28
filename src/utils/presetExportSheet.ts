export interface ExportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectedPresetSheetLayout {
  width: number;
  height: number;
  headerHeight: number;
  plan2D: ExportRect;
  view3D: ExportRect;
  cameraView: ExportRect;
  data: ExportRect;
}

/** Fixed 16:9 delivery canvas for the selected-camera-preset batch. */
export function selectedPresetSheetLayout(): SelectedPresetSheetLayout {
  const width = 1920;
  const height = 1080;
  const padding = 16;
  const headerHeight = 64;
  const topY = headerHeight + padding;
  const topHeight = 500;
  const topWidth = (width - padding * 3) / 2;
  const bottomY = topY + topHeight + padding;
  const bottomHeight = height - bottomY - padding;
  const cameraWidth = Math.round(bottomHeight * 16 / 9);
  return {
    width,
    height,
    headerHeight,
    plan2D: { x: padding, y: topY, width: topWidth, height: topHeight },
    view3D: { x: padding * 2 + topWidth, y: topY, width: topWidth, height: topHeight },
    cameraView: { x: padding, y: bottomY, width: cameraWidth, height: bottomHeight },
    data: {
      x: padding * 2 + cameraWidth,
      y: bottomY,
      width: width - padding * 3 - cameraWidth,
      height: bottomHeight,
    },
  };
}
