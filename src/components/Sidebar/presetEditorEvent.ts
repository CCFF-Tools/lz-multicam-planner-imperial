/** Shared entry point for the camera sidebar and shotlist PTZ preset editor. */
export const EDIT_PTZ_PRESET_EVENT = 'multicam-edit-ptz-preset';

export function openPtzPresetEditor(cameraId: string, presetNumber: number): void {
  window.dispatchEvent(new CustomEvent(EDIT_PTZ_PRESET_EVENT, {
    detail: { cameraId, presetNumber },
  }));
}
