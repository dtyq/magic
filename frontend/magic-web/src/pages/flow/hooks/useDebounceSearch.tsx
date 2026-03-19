import { useEffect, useState } from "react"

// 搜索防抖
export const useDebounceSearch = (search: string, delay: number) => {
	const [debouncedSearch, setDebouncedSearch] = useState(search)

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedSearch(search)
		}, delay)

		return () => {
			clearTimeout(handler)
		}
	}, [search, delay])

	return debouncedSearch
}
