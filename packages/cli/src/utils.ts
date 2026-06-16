/**
 * Shared CLI display utilities — lightweight helpers used across command files.
 * Do not add business logic here; keep this strictly presentation-level.
 */

/** Truncate a URL to at most `maxLen` chars, appending "..." when clipped. */
export function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}
