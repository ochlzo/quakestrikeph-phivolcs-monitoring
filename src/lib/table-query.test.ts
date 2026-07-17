import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedValues, dateParam, optionalNumberParam, parseTableRequest } from './table-query.ts';

test('parseTableRequest accepts supported sizes and ignores UI-only parameters', () => {
  assert.deepEqual(
    parseTableRequest(
      new URL('https://portal.test/events?limit=250&page=3&q=%20Leyte%20&filters=1'),
    ),
    {
      limit: 250,
      page: 3,
      offset: 500,
      query: 'Leyte',
    },
  );
  assert.equal(parseTableRequest(new URL('https://portal.test/events?limit=75&page=-1')).limit, 50);
  assert.equal(parseTableRequest(new URL('https://portal.test/events?limit=75&page=-1')).page, 1);
});

test('filter parameter helpers reject malformed values and remove duplicates', () => {
  const params = new URLSearchParams(
    'depth=12.5&bad=abc&date=2026-07-17&invalid_date=17-07-2026&status=low&status=bad&status=low',
  );
  assert.equal(optionalNumberParam(params, 'depth'), 12.5);
  assert.equal(optionalNumberParam(params, 'bad'), null);
  assert.equal(dateParam(params, 'date'), '2026-07-17');
  assert.equal(dateParam(params, 'invalid_date'), null);
  assert.deepEqual(allowedValues(params, 'status', ['low', 'medium', 'high'] as const), ['low']);
});
