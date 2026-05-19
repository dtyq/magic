import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	countActiveMyCrewFilters,
	MY_CREW_MOBILE_FILTER_DEFAULT,
	resolveFilterScope,
	type MyCrewMobileFilterState,
} from "../components/my-crew-mobile-shared"
import { MyCrewMobileStore } from "../stores/my-crew-mobile"

interface UseMyCrewMobileListParams {
	includeTeamShared: boolean
}

/**
 * @deprecated This hook is unused. Mobile My Crew page now uses MyCrewMobileStore directly.
 * Kept temporarily to avoid orphan-deletion in a refactor PR.
 */
export function useMyCrewMobileList({ includeTeamShared }: UseMyCrewMobileListParams) {
	const storeRef = useRef(new MyCrewMobileStore())
	const store = storeRef.current
	const [filter, setFilter] = useState<MyCrewMobileFilterState>(MY_CREW_MOBILE_FILTER_DEFAULT)
	const currentScope = useMemo(() => resolveFilterScope(filter.type), [filter.type])

	useEffect(() => {
		void store.fetchAgents({ scope: currentScope })
	}, [currentScope, store])

	useEffect(() => {
		return () => {
			store.reset()
		}
	}, [store])

	const activeFilterCount = useMemo(() => countActiveMyCrewFilters(filter), [filter])

	const loadMore = useCallback(() => {
		void store.loadMore()
	}, [store])

	useEffect(() => {
		if (includeTeamShared || filter.type !== "teamShared") return
		setFilter(MY_CREW_MOBILE_FILTER_DEFAULT)
	}, [filter.type, includeTeamShared])

	return {
		filter,
		setFilter,
		activeFilterCount,
		currentScope,
		visibleList: store.list,
		loading: store.loading,
		loadingMore: store.loadingMore,
		hasMore: store.hasMore,
		loadMore,
	}
}
