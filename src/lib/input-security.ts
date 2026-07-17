// eslint-disable-next-line no-control-regex -- Control characters are intentionally stripped at this input boundary.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const SPACING_CHARACTERS = /\s+/g;

export function sanitizeSearchInput(value: string) {
  return value
    .normalize('NFKC')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(SPACING_CHARACTERS, ' ')
    .slice(0, 120);
}
