export function parseDisplayName(value: unknown) {
	if (typeof value !== 'string') throw new Error('Display name is required.');
	const displayName = value.trim().replace(/\s+/g, ' ');
	if (!displayName) throw new Error('Display name is required.');
	if (displayName.length > 100) throw new Error('Display name must be 100 characters or fewer.');
	return displayName;
}
