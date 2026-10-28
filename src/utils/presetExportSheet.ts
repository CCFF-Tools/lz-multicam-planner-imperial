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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Fixed 16:9 delivery canvas for the selected-camera-preset batch.
 *
 * The plan owns a full-height column whose width follows the room footprint.
 * The clamps guarantee useful 3D/Camera View space for unusually square or
 * wide rooms while still making a narrow venue visibly narrow.
 */
export function selectedPresetSheetLayout(roomWidthM = 16, roomDepthM = 12): SelectedPresetSheetLayout {
  const width = 1920;
  const height = 1080;
  const padding = 16;
  const headerHeight = 64;
  const bodyY = headerHeight + padding;
  const bodyHeight = height - bodyY - padding;
  const dataWidth = 440;
  const visualWidth = width - padding * 4 - dataWidth;
  const roomAspect = Math.max(0.05, roomWidthM) / Math.max(0.05, roomDepthM);
  const planWidth = Math.round(clamp(bodyHeight * roomAspect, 340, visualWidth - 800));
  const centerWidth = visualWidth - planWidth;
  const centerX = padding * 2 + planWidth;
  const halfHeight = (bodyHeight - padding) / 2;
  const dataX = centerX + centerWidth + padding;
  return {
    width,
    height,
    headerHeight,
    plan2D: { x: padding, y: bodyY, width: planWidth, height: bodyHeight },
    view3D: { x: centerX, y: bodyY, width: centerWidth, height: halfHeight },
    cameraView: { x: centerX, y: bodyY + halfHeight + padding, width: centerWidth, height: halfHeight },
    data: { x: dataX, y: bodyY, width: dataWidth, height: bodyHeight },
  };
}
