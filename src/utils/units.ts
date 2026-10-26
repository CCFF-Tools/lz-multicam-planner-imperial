export type Units = 'metric' | 'imperial';
export const METERS_PER_INCH = 0.0254;
export const FEET_PER_METER = 1 / 0.3048;
export const INCHES_PER_METER = 1 / METERS_PER_INCH;

export interface ImperialLengthParts {
  feet: number;
  inches: number;
}

/** Split metres into architectural feet and inches at tenth-inch precision. */
export function splitImperialLength(meters: number): ImperialLengthParts {
  const totalTenths = Math.round(meters * INCHES_PER_METER * 10);
  const feet = Math.trunc(totalTenths / 120);
  const inches = Number(((totalTenths - feet * 120) / 10).toFixed(1));
  return { feet, inches };
}

/** Feet and inches are deliberately not range-limited; 26 inches normalises to 2 ft 2 in. */
export function imperialPartsToMeters(feet: number, inches: number): number {
  return (feet * 12 + inches) * METERS_PER_INCH;
}

export function formatLength(meters: number, units: Units): string {
  if (units === 'metric') return String(Number(meters.toFixed(4)));
  const { feet, inches } = splitImperialLength(Math.abs(meters));
  return `${meters < 0 ? '-' : ''}${feet}' ${inches}"`;
}

export function lengthUnit(units: Units): string {
  return units === 'metric' ? 'm' : 'ft / in';
}

export function formatLengthWithUnit(meters: number, units: Units): string {
  return `${formatLength(meters, units)}${units === 'metric' ? ' m' : ''}`;
}

export function formatDimensions(widthM: number, heightM: number, units: Units): string {
  return `${formatLength(widthM, units)} × ${formatLength(heightM, units)}${units === 'metric' ? ' m' : ''}`;
}

export function formatSpeed(metersPerSecond: number, units: Units): string {
  const value = units === 'metric' ? metersPerSecond : metersPerSecond * FEET_PER_METER;
  return `${Number(value.toFixed(2))} ${units === 'metric' ? 'm/s' : 'ft/s'}`;
}

export function scaleDisplayFactor(units: Units): number {
  return units === 'metric' ? 1000 : INCHES_PER_METER;
}

export function scaleUnit(units: Units): string {
  return units === 'metric' ? 'mm/px' : 'in/px';
}
/** Bare imperial numbers are decimal feet; explicit inches and mixed feet/inches are accepted. */
export function parseLength(text: string, units: Units): number | undefined {
  const s = text.trim();
  if (!s) return undefined;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return Number(s) * (units === 'imperial' ? 0.3048 : 1);
  const match = s.match(/^(-)?(?:(\d+(?:\.\d+)?)\s*(?:'|ft)\s*)?(?:(\d+(?:\.\d+)?)\s*(?:"|in))?$/i);
  if (!match || (!match[2] && !match[3])) return undefined;
  return (match[1] ? -1 : 1) * (Number(match[2] ?? 0) * 12 + Number(match[3] ?? 0)) * METERS_PER_INCH;
}
