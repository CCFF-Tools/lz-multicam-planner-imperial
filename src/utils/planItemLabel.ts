export interface PlanItemLabelOptions {
  label: string;
  heightText: string;
  showLabel?: boolean;
  showHeight?: boolean;
  /** Existing objects showed height; existing cameras did not. */
  defaultShowHeight: boolean;
  suffix?: string;
}

/** Builds whole annotation lines; the canvas may wrap only between words. */
export function planItemLabel(options: PlanItemLabelOptions): string {
  const lines: string[] = [];
  if (options.showLabel !== false && options.label.trim()) lines.push(options.label.trim());
  if (options.showHeight ?? options.defaultShowHeight) {
    lines.push(`${options.heightText}${options.suffix ?? ''}`);
  }
  return lines.join('\n');
}
