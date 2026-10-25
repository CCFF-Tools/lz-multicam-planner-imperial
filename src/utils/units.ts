export type Units = 'metric' | 'imperial';
export const METERS_PER_INCH = 0.0254;
export function formatLength(meters: number, units: Units): string {
  if (units === 'metric') return String(Number(meters.toFixed(4)));
  const tenths = Math.round(Math.abs(meters) / METERS_PER_INCH * 10);
  return `${meters < 0 ? '-' : ''}${Math.floor(tenths / 120)}' ${Number((tenths % 120 / 10).toFixed(1))}"`;
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
