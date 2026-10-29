import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InvalidNameError,
  MAX_NAME_LENGTH,
  suggestMachineName,
  validateName,
} from '../tools/scaffold/validate.mjs';

test('accepts valid machine names', () => {
  for (const name of ['hero_banner', 'card', 'cta2', 'a_b_c_1']) {
    assert.equal(validateName(name), name);
  }
});

test('rejects empty or missing names', () => {
  for (const input of [undefined, '', '   ']) {
    assert.throws(() => validateName(input), InvalidNameError);
  }
});

test('rejects names that are not machine names and suggests a fix', () => {
  assert.throws(() => validateName('Hero-Banner'), /¿Quisiste decir "hero_banner"\?/);
  assert.throws(() => validateName('heroBanner'), /"hero_banner"/);
  assert.throws(() => validateName('1card'), InvalidNameError);
  assert.throws(() => validateName('../evil'), InvalidNameError);
  assert.throws(() => validateName('card '), InvalidNameError);
});

test('omits the suggestion when nothing usable remains', () => {
  assert.throws(
    () => validateName('123'),
    (err) => err instanceof InvalidNameError && !err.message.includes('Quisiste'),
  );
});

test('rejects names longer than the Drupal limit', () => {
  assert.throws(() => validateName('a'.repeat(MAX_NAME_LENGTH + 1)), /supera 50/);
  assert.equal(validateName('a'.repeat(MAX_NAME_LENGTH)), 'a'.repeat(MAX_NAME_LENGTH));
});

test('rejects reserved names', () => {
  assert.throws(() => validateName('node'), /reservado/);
  assert.throws(() => validateName('class'), /reservado/);
});

test('suggestMachineName normalizes common mistakes', () => {
  assert.equal(suggestMachineName('Hero Banner'), 'hero_banner');
  assert.equal(suggestMachineName('my-card--v2'), 'my_card_v2');
  assert.equal(suggestMachineName('PromoCard'), 'promo_card');
  assert.equal(suggestMachineName('99problems'), 'problems');
});
