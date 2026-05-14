import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MyCrewStore } from "../stores/my-crew"
import {
	countActiveMyCrewFilters,
	MY_CREW_MOBILE_FILTER_DEFAULT,
	resolveMyCrewListVariant,
	type MyCrewMobileFilterState,
} from "../components/my-crew-mobile-shared"

interface UseMyCrewMobileListParams {
	includeTeamShared: boolean
}

/** 负责 `MyCrew` 移动页的数据组织，仅复用主仓已支持的分类列表与分页能力。 */
export function useMyCrewMobileList({ includeTeamShared }: UseMyCrewMobileListParams) {
	const storeRef = useRef(new MyCrewStore())
	const store = storeRef.current
	const [filter, setFilter] = useState<MyCrewMobileFilterState>(MY_CREW_MOBILE_FILTER_DEFAULT)
	const currentListVariant = useMemo(() => resolveMyCrewListVariant(filter.type), [filter.type])

	// 分类切换直接复用现有 store 的真实列表接口，避免前端拼装伪“全部”语义。
	useEffect(() => {
		void store.fetchAgents({ listVariant: currentListVariant, page: 1 })
	}, [currentListVariant, store])

	// 页面卸载时统一重置 store，避免上次路由状态污染再次进入后的列表。
	useEffect(() => {
		return () => {
			store.reset()
		}
	}, [store])

	const activeFilterCount = useMemo(() => countActiveMyCrewFilters(filter), [filter])

	// 无限滚动始终走 store 分页，保持与 PC 端相同的数据延展语义。
	const loadMore = useCallback(() => {
		void store.loadMore()
	}, [store])

	// 团队共享在个人组织态不可用时，主动回到默认分类，避免保留失效筛选值。
	useEffect(() => {
		if (includeTeamShared || filter.type !== "teamShared") return
		setFilter(MY_CREW_MOBILE_FILTER_DEFAULT)
	}, [filter.type, includeTeamShared])

	return {
		filter,
		setFilter,
		activeFilterCount,
		currentListVariant,
		visibleList: store.list,
		loading: store.loading,
		loadingMore: store.loadingMore,
		hasMore: store.hasMore,
		loadMore,
	}
}
