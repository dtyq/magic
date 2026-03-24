interface KeywordParams {
	keyword?: string | null
}

interface BeginPageRequestParams {
	page: number
	loading: boolean
	currentRequestId: number
}

interface IsLatestPageRequestParams {
	requestId: number
	currentRequestId: number
}

export function resolveKeywordParam(params: KeywordParams, fallbackKeyword: string): string {
	if (Object.prototype.hasOwnProperty.call(params, "keyword")) {
		return params.keyword?.trim() ?? ""
	}

	return fallbackKeyword
}

export function toOptionalKeyword(keyword: string): string | undefined {
	return keyword || undefined
}

export function beginPageRequest({
	page,
	loading,
	currentRequestId,
}: BeginPageRequestParams): number | null {
	if (page !== 1 && loading) return null
	return currentRequestId + 1
}

export function isLatestPageRequest({
	requestId,
	currentRequestId,
}: IsLatestPageRequestParams): boolean {
	return requestId === currentRequestId
}

export function appendUniqueById<T extends { id: string }>(currentList: T[], nextList: T[]): T[] {
	const existingIds = new Set(currentList.map((item) => item.id))
	const appendList = nextList.filter((item) => !existingIds.has(item.id))
	return [...currentList, ...appendList]
}
