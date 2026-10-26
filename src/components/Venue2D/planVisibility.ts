export type PlanVisibilityKey = 'floorplan' | 'stage' | 'room' | 'objects' | 'cameras';
export type PlanVisibility = Record<PlanVisibilityKey, boolean>;

export const DEFAULT_PLAN_VISIBILITY: PlanVisibility = {
  floorplan: true,
  stage: true,
  room: true,
  objects: true,
  cameras: true,
};
