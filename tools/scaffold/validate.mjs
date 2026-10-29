// Drupal extension machine names: lowercase letter first, then lowercase letters,
// digits or underscores. Drupal core enforces a 50-character limit
// (DRUPAL_EXTENSION_NAME_MAX_LENGTH).
const MACHINE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
export const MAX_NAME_LENGTH = 50;

// Common clashes with core modules and PHP reserved words. Not exhaustive: a clash
// with any installed extension breaks the site, so this only catches the usual ones.
const RESERVED_NAMES = new Set([
  'block',
  'core',
  'drupal',
  'field',
  'file',
  'filter',
  'node',
  'system',
  'taxonomy',
  'user',
  'views',
  'abstract',
  'class',
  'function',
  'list',
  'new',
  'default',
  'static',
]);

export class InvalidNameError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidNameError';
  }
}

/**
 * Suggests a valid machine name for common mistakes (kebab-case, CamelCase, spaces).
 */
export function suggestMachineName(input) {
  return String(input)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * Returns the name unchanged if it is a valid machine name; throws InvalidNameError otherwise.
 */
export function validateName(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new InvalidNameError('Debes indicar el nombre del componente.');
  }

  const name = input;
  if (name.length > MAX_NAME_LENGTH) {
    throw new InvalidNameError(
      `El nombre "${name}" supera ${MAX_NAME_LENGTH} caracteres (límite de Drupal).`,
    );
  }

  if (!MACHINE_NAME_PATTERN.test(name)) {
    const suggestion = suggestMachineName(name);
    const hint = suggestion ? ` ¿Quisiste decir "${suggestion}"?` : '';
    throw new InvalidNameError(
      `El nombre "${name}" no es un machine name válido: usa minúsculas, números y guion bajo, empezando por letra.${hint}`,
    );
  }

  if (RESERVED_NAMES.has(name)) {
    throw new InvalidNameError(
      `El nombre "${name}" está reservado (choca con core de Drupal o con PHP).`,
    );
  }

  return name;
}
