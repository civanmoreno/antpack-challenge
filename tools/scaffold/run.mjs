import path from 'node:path';
import { parseArgs } from 'node:util';
import { TargetExistsError, generateComponent } from './generator.mjs';
import { InvalidNameError } from './validate.mjs';

export const DEFAULT_DIR = 'web/modules/custom';

const USAGE = `Uso:
  npm run scaffold -- <nombre> [--dir <ruta>]
  make component name=<nombre> [dir=<ruta>]

  <nombre>     machine name en snake_case (ej. hero_banner)
  --dir        carpeta base (por defecto: ${DEFAULT_DIR}, o $SCAFFOLD_DIR)
  -h, --help   muestra esta ayuda`;

/**
 * CLI entry point. Returns the process exit code instead of exiting,
 * so it can be tested without spawning processes.
 */
export async function run(argv, { cwd = process.cwd(), env = process.env, out, err } = {}) {
  const print = out ?? ((msg) => process.stdout.write(`${msg}\n`));
  const printError = err ?? ((msg) => process.stderr.write(`${msg}\n`));

  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        dir: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (parseError) {
    printError(`✖ ${parseError.message}\n\n${USAGE}`);
    return 1;
  }

  const { values, positionals } = args;
  if (values.help) {
    print(USAGE);
    return 0;
  }
  if (positionals.length !== 1) {
    printError(`✖ Debes indicar exactamente un nombre de componente.\n\n${USAGE}`);
    return 1;
  }

  const baseDir = path.resolve(cwd, values.dir ?? env.SCAFFOLD_DIR ?? DEFAULT_DIR);

  try {
    const result = await generateComponent({ name: positionals[0], baseDir });
    print(`✔ Componente "${result.machineName}" creado en ${displayPath(cwd, result.target)}`);
    for (const file of result.files) print(`  + ${displayPath(cwd, file)}`);
    print(`\nSiguiente paso: drush en ${result.machineName} -y`);
    return 0;
  } catch (error) {
    if (error instanceof TargetExistsError) {
      const target = displayPath(cwd, error.target);
      printError(
        [
          `✖ El componente "${path.basename(error.target)}" ya existe en ${target}`,
          '  No se creó ni modificó ningún archivo.',
          '',
          '  Opciones:',
          '    • Usa otro nombre para el nuevo componente.',
          `    • Si quieres regenerarlo desde cero, borra antes la carpeta: rm -rf ${target}`,
        ].join('\n'),
      );
      return 1;
    }
    if (error instanceof InvalidNameError) {
      printError(`✖ ${error.message}`);
      return 1;
    }
    printError(`✖ Error inesperado al generar el componente: ${error.message}`);
    return 2;
  }
}

// Relative paths are shorter and copy-pasteable; fall back to absolute outside cwd.
function displayPath(cwd, target) {
  const relative = path.relative(cwd, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? target : relative;
}
