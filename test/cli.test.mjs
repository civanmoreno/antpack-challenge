import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DEFAULT_DIR, run } from '../tools/scaffold/run.mjs';

const CLI = fileURLToPath(new URL('../tools/scaffold/cli.mjs', import.meta.url));
let cwd;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(os.tmpdir(), 'scaffold-cli-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

async function runCaptured(argv, env = {}) {
  const out = [];
  const err = [];
  const code = await run(argv, {
    cwd,
    env,
    out: (m) => out.push(m),
    err: (m) => err.push(m),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('creates the component in the default directory', async () => {
  const { code, out } = await runCaptured(['hero_banner']);
  assert.equal(code, 0);
  assert.match(out, /Componente "hero_banner" creado en web\/modules\/custom\/hero_banner/);
  assert.ok((await readdir(path.join(cwd, DEFAULT_DIR))).includes('hero_banner'));
});

test('honours --dir and SCAFFOLD_DIR, with --dir taking precedence', async () => {
  assert.equal((await runCaptured(['a_one'], { SCAFFOLD_DIR: 'from_env' })).code, 0);
  assert.equal((await runCaptured(['a_two', '--dir', 'from_flag'], { SCAFFOLD_DIR: 'x' })).code, 0);
  assert.deepEqual(await readdir(path.join(cwd, 'from_env')), ['a_one']);
  assert.deepEqual(await readdir(path.join(cwd, 'from_flag')), ['a_two']);
});

test('fails with a clear message when the folder already exists', async () => {
  await runCaptured(['card']);
  const { code, err } = await runCaptured(['card']);
  assert.equal(code, 1);
  assert.match(err, /El componente "card" ya existe en web\/modules\/custom\/card\n/);
  assert.match(err, /No se creó ni modificó ningún archivo/);
  assert.match(err, /rm -rf web\/modules\/custom\/card$/);
});

test('shows absolute paths when the target is outside the working directory', async () => {
  const outside = await mkdtemp(path.join(os.tmpdir(), 'scaffold-outside-'));
  try {
    const { code, out } = await runCaptured(['card', '--dir', outside]);
    assert.equal(code, 0);
    assert.match(out, new RegExp(`creado en ${path.join(outside, 'card')}`));
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test('fails with a hint on invalid names', async () => {
  const { code, err } = await runCaptured(['Hero-Banner']);
  assert.equal(code, 1);
  assert.match(err, /hero_banner/);
});

test('fails when the name is missing or duplicated', async () => {
  assert.equal((await runCaptured([])).code, 1);
  assert.equal((await runCaptured(['a', 'b'])).code, 1);
});

test('fails on unknown options', async () => {
  const { code, err } = await runCaptured(['card', '--force']);
  assert.equal(code, 1);
  assert.match(err, /Uso:/);
});

test('prints help', async () => {
  const { code, out } = await runCaptured(['--help']);
  assert.equal(code, 0);
  assert.match(out, /Uso:/);
});

test('returns exit code 2 on unexpected errors', async () => {
  // A regular file used as base dir makes mkdir fail with a non-domain error.
  const { code, err } = await runCaptured(['card', '--dir', '/dev/null/nope']);
  assert.equal(code, 2);
  assert.match(err, /Error inesperado/);
});

test('real process exits with the right codes', async () => {
  const exec = promisify(execFile);
  const ok = await exec(process.execPath, [CLI, 'card'], { cwd });
  assert.match(ok.stdout, /creado/);

  await assert.rejects(exec(process.execPath, [CLI, 'card'], { cwd }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /ya existe en web\/modules\/custom\/card/);
    return true;
  });
});
