import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { getRecycleBinTabIdFromSearchParams, type RecycleBinTabId } from "../tab-config"

interface UseRecycleBinTabSearchParamsSyncProps {
	onTabIdChange: (tabId: RecycleBinTabId) => void
}

export function useRecycleBinTabSearchParamsSync(props: UseRecycleBinTabSearchParamsSyncProps) {
	const { onTabIdChange } = props
	const [searchParams] = useSearchParams()

	useEffect(() => {
		const nextTabId = getRecycleBinTabIdFromSearchParams(searchParams)
		if (!nextTabId) return
		onTabIdChange(nextTabId)
	}, [onTabIdChange, searchParams])
}
