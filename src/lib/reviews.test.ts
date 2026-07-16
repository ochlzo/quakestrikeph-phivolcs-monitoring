import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReviewInput } from './reviews.ts';

test('accepts an editable completed review and rejects incomplete reviewed text', () => {
	const valid = new FormData();
	valid.set('status', 'REVIEWED_NO_ALERT');
	valid.set('review_text', '  Reviewed assessment.  ');
	valid.set('internal_note', ' Internal only. ');
	assert.deepEqual(parseReviewInput(valid), {
		status: 'REVIEWED_NO_ALERT',
		reviewText: 'Reviewed assessment.',
		internalNote: 'Internal only.',
	});

	const invalid = new FormData();
	invalid.set('status', 'REVIEWED_FOR_ALERT');
	assert.throws(() => parseReviewInput(invalid), /require review text/);
});
