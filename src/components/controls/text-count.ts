/** Placeholder. The real implementation follows in the next commit (AJA-1764). */
export function countGraphemes(text: string, _locale: string): number {
  return text.length;
}

export function truncateGraphemes(text: string, max: number, _locale: string): string {
  return text.slice(0, max);
}
