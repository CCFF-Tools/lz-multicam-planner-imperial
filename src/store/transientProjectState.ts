let depth = 0;

/**
 * Marks synchronous store writes as render-only state. Subscribers use this
 * to keep exports out of project revision tracking and undo history.
 */
export function withTransientProjectState<T>(write: () => T): T {
  depth++;
  try {
    return write();
  } finally {
    depth--;
  }
}

export function isTransientProjectState(): boolean {
  return depth > 0;
}
