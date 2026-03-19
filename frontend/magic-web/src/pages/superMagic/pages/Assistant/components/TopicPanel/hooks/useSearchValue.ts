import { useDebounce, useMemoizedFn } from "ahooks"
import { useState } from "react"

function useSearchValue({
	debounceWait = 500,
}: {
	debounceWait?: number
} = {}) {
	const [searchValue, setSearchValue] = useState("")
	const debouncedSearchValue = useDebounce(searchValue, { wait: debounceWait })

	const onSearchValueChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) =>
		setSearchValue(e.target.value),
	)

	return { searchValue, debouncedSearchValue, onSearchValueChange, setSearchValue }
}

export default useSearchValue
