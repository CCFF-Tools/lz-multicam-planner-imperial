/**
 * Keep every physical camera in a rendered camera view except the camera
 * whose sensor is producing that image. Reapplying this on every render also
 * restores the model hidden for the previous Multiview tile.
 */
export function applyCameraViewVisibility(
  models: Iterable<readonly [string, { visible: boolean }]>,
  activeCameraId: string,
): void {
  for (const [cameraId, model] of models) model.visible = cameraId !== activeCameraId;
}
