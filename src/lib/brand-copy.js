/**
 * Present legacy notification titles with the current Formant brand.
 * Persisted notifications are intentionally left unchanged.
 */
export function formatFormantBrandText(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/\bCareerlyst\s+Team\b/gi, 'Formant team')
    .replace(/\bCareerlyst\b/gi, 'Formant');
}
