import { create } from 'zustand';
import { loadJSON, saveJSON } from '../utils/storage';
import type { Units } from '../utils/units';
export const useUnits = create<{ units: Units; setUnits: (units: Units) => void }>((set) => ({
  units: loadJSON<string>('multicam-units', 'metric') === 'imperial' ? 'imperial' : 'metric',
  setUnits: (units) => { saveJSON('multicam-units', units); set({ units }); },
}));
