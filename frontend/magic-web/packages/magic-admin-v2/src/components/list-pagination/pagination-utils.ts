export type PaginationMeta = {
	canGoNext: boolean
	canGoPrevious: boolean
	currentPage: number
	pageCount: number
}

export type PaginationMetaInput = {
	hasNextPage?: boolean
	page: number
	pageCount?: number
	pageSize?: number
	total?: number
}

/** 将不同接口的分页信息归一化为组件可直接消费的页码边界。 */
export function getPaginationMeta({
	hasNextPage,
	page,
	pageCount,
	pageSize,
	total,
}: PaginationMetaInput): PaginationMeta {
	const normalizedPageSize = Math.max(1, pageSize ?? 1)
	const calculatedPageCount = Math.max(
		1,
		pageCount ?? (total === undefined ? page : Math.ceil(total / normalizedPageSize)),
	)
	const normalizedPage = Math.max(1, page)
	const hasExplicitNextPage = hasNextPage !== undefined
	const currentPage = hasExplicitNextPage
		? normalizedPage
		: Math.min(normalizedPage, calculatedPageCount)
	const resolvedPageCount = hasExplicitNextPage
		? Math.max(currentPage, calculatedPageCount)
		: calculatedPageCount

	return {
		canGoNext: hasExplicitNextPage ? Boolean(hasNextPage) : currentPage < resolvedPageCount,
		canGoPrevious: currentPage > 1,
		currentPage,
		pageCount: resolvedPageCount,
	}
}
