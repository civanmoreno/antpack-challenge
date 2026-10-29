import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fsPromises from 'node:fs/promises';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TargetExistsError, generateComponent } from '../tools/scaffold/generator.mjs';
import { InvalidNameError } from '../tools/scaffold/validate.mjs';
import { namingVariants } from '../tools/scaffold/templates.mjs';

let baseDir;

beforeEach(async () => {
  baseDir = await mkdtemp(path.join(os.tmpdir(), 'scaffold-'));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

test('creates the component folder with the expected Drupal structure', async () => {
  const result = await generateComponent({ name: 'hero_banner', baseDir });

  const dir = path.join(baseDir, 'hero_banner');
  assert.equal(result.target, dir);
  const relative = result.files.map((f) => path.relative(dir, f)).sort();
  assert.deepEqual(relative, [
    'css/hero_banner.css',
    'hero_banner.info.yml',
    'hero_banner.libraries.yml',
    'hero_banner.module',
    'js/hero_banner.js',
    'templates/hero_banner.html.twig',
  ]);
});

test('info.yml contains name, type and core version requirement', async () => {
  await generateComponent({ name: 'hero_banner', baseDir });
  const info = await readFile(path.join(baseDir, 'hero_banner/hero_banner.info.yml'), 'utf8');

  assert.match(info, /^name: 'Hero Banner'$/m);
  assert.match(info, /^type: module$/m);
  assert.match(info, /^core_version_requirement: \^10\.3 \|\| \^11$/m);
});

test('generated files reference each other with consistent names', async () => {
  await generateComponent({ name: 'promo_card', baseDir });
  const dir = path.join(baseDir, 'promo_card');
  const [libraries, moduleFile, twig, css, js] = await Promise.all(
    [
      'promo_card.libraries.yml',
      'promo_card.module',
      'templates/promo_card.html.twig',
      'css/promo_card.css',
      'js/promo_card.js',
    ].map((f) => readFile(path.join(dir, f), 'utf8')),
  );

  assert.match(libraries, /css\/promo_card\.css/);
  assert.match(libraries, /js\/promo_card\.js/);
  assert.match(moduleFile, /function promo_card_theme\(\)/);
  assert.match(moduleFile, /'template' => 'promo_card'/);
  assert.match(twig, /attach_library\('promo_card\/promo_card'\)/);
  assert.match(twig, /addClass\('promo-card'\)/);
  assert.match(css, /^\.promo-card \{/m);
  assert.match(js, /Drupal\.behaviors\.promoCard = /);
});

test('aborts without touching anything when the target folder exists', async () => {
  const existing = path.join(baseDir, 'hero_banner');
  await mkdir(existing);
  await writeFile(path.join(existing, 'keep.txt'), 'original');

  await assert.rejects(generateComponent({ name: 'hero_banner', baseDir }), TargetExistsError);
  assert.deepEqual(await readdir(existing), ['keep.txt']);
  assert.equal(await readFile(path.join(existing, 'keep.txt'), 'utf8'), 'original');
});

test('aborts when a file with the component name exists', async () => {
  await writeFile(path.join(baseDir, 'hero_banner'), 'not a dir');
  await assert.rejects(generateComponent({ name: 'hero_banner', baseDir }), TargetExistsError);
});

test('rejects invalid names before creating anything', async () => {
  await assert.rejects(generateComponent({ name: '../escape', baseDir }), InvalidNameError);
  assert.deepEqual(await readdir(baseDir), []);
});

test('creates the base directory when it does not exist', async () => {
  const nested = path.join(baseDir, 'web/modules/custom');
  await generateComponent({ name: 'card', baseDir: nested });
  assert.ok((await readdir(nested)).includes('card'));
});

test('removes partial output when writing a file fails', async () => {
  let writes = 0;
  const failingFs = {
    ...fsPromises,
    writeFile: async (...args) => {
      writes += 1;
      if (writes === 3) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
      return fsPromises.writeFile(...args);
    },
  };

  await assert.rejects(generateComponent({ name: 'card', baseDir, fs: failingFs }), /disk full/);
  assert.deepEqual(await readdir(baseDir), []);
});

test('propagates unexpected errors when creating the folder', async () => {
  const failingFs = {
    ...fsPromises,
    mkdir: async (dir, opts) => {
      if (!opts?.recursive) throw Object.assign(new Error('denied'), { code: 'EACCES' });
      return fsPromises.mkdir(dir, opts);
    },
  };
  await assert.rejects(generateComponent({ name: 'card', baseDir, fs: failingFs }), /denied/);
});

test('namingVariants derives label, css class and js name', () => {
  assert.deepEqual(namingVariants('hero_banner_v2'), {
    machineName: 'hero_banner_v2',
    label: 'Hero Banner V2',
    cssClass: 'hero-banner-v2',
    jsName: 'heroBannerV2',
  });
});
