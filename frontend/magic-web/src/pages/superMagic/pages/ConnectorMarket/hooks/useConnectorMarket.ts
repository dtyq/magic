import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounce } from "ahooks"
import { FlowApi } from "@/apis"
import {
	MCPManagerService,
	OrganizationStrategy,
} from "@/components/Agent/MCP/service/MCPManagerService"
import type { IMCPItem } from "@/components/Agent/MCP/types"
import {
	CONNECTOR_MARKET_GROUPS,
	type ConnectorMarketGroup,
} from "../components/ConnectorCategoryFilter"

export function useConnectorMarket(
	searchQuery: string,
	group: ConnectorMarketGroup,
	addedItems: IMCPItem[] = [],
	enabled = true,
) {
	const [list, setList] = useState<IMCPItem[]>([])
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [loadingMoreError, setLoadingMoreError] = useState(false)
	const [error, setError] = useState(false)
	const [hasMore, setHasMore] = useState(false)
	const pageRef = useRef(1)
	const requestIdRef = useRef(0)
	const addedItemsRef = useRef(addedItems)
	const debouncedSearchQuery = useDebounce(searchQuery, { wait: 350 })

	useEffect(() => {
		addedItemsRef.current = addedItems
	}, [addedItems])

	const fetchConnectors = useCallback(
		async (name: string, currentGroup: ConnectorMarketGroup, page = 1, append = false) => {
			const requestId = ++requestIdRef.current
			if (append) setLoadingMore(true)
			else setLoading(true)
			if (append) setLoadingMoreError(false)
			else setError(false)

			try {
				let response: IMCPItem[]
				let nextHasMore = false
				if (currentGroup === CONNECTOR_MARKET_GROUPS.added) {
					const keyword = name.trim().toLowerCase()
					response = addedItemsRef.current.filter((item) => {
						if (!keyword) return true
						return [item.name, item.description].some((value) =>
							value?.toLowerCase().includes(keyword),
						)
					})
				} else if (currentGroup === CONNECTOR_MARKET_GROUPS.mine) {
					const result = await FlowApi.getMcpList({
						page,
						pageSize: 20,
						name: name.trim(),
					})
					response = result?.list ?? []
					nextHasMore = page * 20 < (result?.total ?? 0)
				} else if (currentGroup === CONNECTOR_MARKET_GROUPS.official) {
					const result = await FlowApi.getUseableMCPList({
						office: true,
						name: name.trim(),
						page,
						page_size: 20,
					})
					response = result?.list ?? []
					nextHasMore = page * 20 < (result?.total ?? 0)
				} else {
					const service = new MCPManagerService(new OrganizationStrategy())
					response = (await service.getMCPList(name.trim() || undefined)) ?? []
				}
				if (requestId !== requestIdRef.current) return
				pageRef.current = page
				setList((current) => (append ? [...current, ...response] : response))
				setHasMore(nextHasMore)
			} catch {
				if (requestId !== requestIdRef.current) return
				if (append) setLoadingMoreError(true)
				else {
					setError(true)
					setList([])
				}
			} finally {
				if (requestId === requestIdRef.current) {
					setLoading(false)
					setLoadingMore(false)
				}
			}
		},
		[],
	)

	useEffect(() => {
		if (!enabled) return
		if (group === CONNECTOR_MARKET_GROUPS.added) return
		void fetchConnectors(debouncedSearchQuery, group)
	}, [debouncedSearchQuery, enabled, fetchConnectors, group])

	useEffect(() => {
		if (!enabled || group !== CONNECTOR_MARKET_GROUPS.added) return
		void fetchConnectors(debouncedSearchQuery, group)
	}, [addedItems, debouncedSearchQuery, enabled, fetchConnectors, group])

	return {
		list,
		loading,
		loadingMore,
		loadingMoreError,
		hasMore,
		error,
		retry: () => fetchConnectors(searchQuery, group, 1, false),
		loadMore: async () => {
			if (!hasMore || loading || loadingMore) return
			await fetchConnectors(searchQuery, group, pageRef.current + 1, true)
		},
		removeItem: (id: string) => setList((current) => current.filter((item) => item.id !== id)),
		updateItem: (id: string, updater: (item: IMCPItem) => IMCPItem) =>
			setList((current) => current.map((item) => (item.id === id ? updater(item) : item))),
	}
}
