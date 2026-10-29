import * as nodeFs from 'node:fs/promises';
import path from 'node:path';
import { buildFiles } from './templates.mjs';
import { validateName } from './validate.mjs';

export class TargetExistsError extends Error {
  constructor(target) {
    super(`La carpeta destino ya existe: ${target}. No se sobrescribió nada.`);
    this.name = 'TargetExistsError';
    this.target = target;
  }
}

/**
 * Creates the component folder and its files under baseDir.
 * Never overwrites: aborts if the folder exists and removes partial output on failure.
 * `fs` is injectable so tests can simulate I/O failures.
 */
export async function generateComponent({ name, baseDir, fs = nodeFs }) {
  const { mkdir, rm, writeFile } = fs;
  const machineName = validateName(name);
  const target = path.resolve(baseDir, machineName);

  await mkdir(path.resolve(baseDir), { recursive: true });

  // Non-recursive mkdir is the existence check: it fails atomically with EEXIST,
  // so there is no window between "check" and "create" for a race.
  try {
    await mkdir(target);
  } catch (err) {
    if (err.code === 'EEXIST') throw new TargetExistsError(target);
    throw err;
  }

  const files = buildFiles(machineName);
  try {
    for (const file of files) {
      const filePath = path.join(target, file.path);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, { flag: 'wx' });
    }
  } catch (err) {
    // The folder did not exist before this run, so removing it only undoes our own work.
    await rm(target, { recursive: true, force: true });
    throw err;
  }

  return { machineName, target, files: files.map((f) => path.join(target, f.path)) };
}
