import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDisplayName } from './operator-profile.ts';

test('normalizes valid operator display names and rejects invalid values', () => {
	assert.equal(parseDisplayName('  Ana   Reyes  '), 'Ana Reyes');
	assert.throws(() => parseDisplayName('   '), /required/);
	assert.throws(() => parseDisplayName('x'.repeat(101)), /100 characters/);
});
