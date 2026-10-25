import { useCallback, useState } from "react"

export type UsePaginationOptions = {
	initialPage?: number
	initialPageSize?: number
}

/** 管理独立的页码和每页数量；筛选条件与接口参数仍由业务页面维护。 */
export function usePagination({
	initialPage = 1,
	initialPageSize = 20,
}: UsePaginationOptions = {}) {
	const [page, setPage] = useState(initialPage)
	const [pageSize, setPageSizeState] = useState(initialPageSize)

	const setPageSize = useCallback(
		(nextPageSize: number) => {
			setPage(initialPage)
			setPageSizeState(nextPageSize)
		},
		[initialPage],
	)
	const resetPage = useCallback(() => setPage(initialPage), [initialPage])
	const resetPagination = useCallback(() => {
		setPage(initialPage)
		setPageSizeState(initialPageSize)
	}, [initialPage, initialPageSize])

	return {
		page,
		pageSize,
		resetPage,
		resetPagination,
		setPage,
		setPageSize,
	}
}
