export const TABLE_PAGE_SIZES = [50, 100, 250, 500, 1000, 2000] as const;

export function parseTableRequest(url: URL) {
	const requestedLimit = Number(url.searchParams.get('limit') ?? TABLE_PAGE_SIZES[0]);
	const requestedPage = Number(url.searchParams.get('page') ?? 1);
	const limit = TABLE_PAGE_SIZES.includes(requestedLimit as (typeof TABLE_PAGE_SIZES)[number])
		? requestedLimit
		: TABLE_PAGE_SIZES[0];
	const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
		? Math.min(requestedPage, 1_000_000)
		: 1;

	return {
		limit,
		page,
		offset: (page - 1) * limit,
		query: (url.searchParams.get('q') ?? '').trim().slice(0, 200),
	};
}

export function optionalNumberParam(params: URLSearchParams, name: string) {
	const value = params.get(name);
	if (value === null || value.trim() === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function dateParam(params: URLSearchParams, name: string) {
	const value = params.get(name);
	return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function allowedValues<const T extends readonly string[]>(params: URLSearchParams, name: string, allowed: T): T[number][] {
	return [...new Set(params.getAll(name).filter((value): value is T[number] => allowed.includes(value as T[number])))];
}
