import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useDebounce, useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { userStore } from "@/models/user"
import recentProjectsStore from "@/pages/superMagic/stores/core/recentProjects"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

const PAGE_SIZE = 20

interface SearchSnapshot {
	items: ProjectListItem[]
	page: number
	hasMore: boolean
	loading: boolean
	error: boolean
	stale: boolean
}

const emptySnapshot: SearchSnapshot = {
	items: [],
	page: 0,
	hasMore: true,
	loading: false,
	error: false,
	stale: true,
}

/** 关键词查询独立于全局最近快照；失败保留同一查询的结果，重试仍请求失败页。 */
export function useRecentProjectSearch(keyword: string, active: boolean, busy: boolean) {
	const query = keyword.trim()
	const debouncedQuery = useDebounce(query, { wait: 500 })
	const userId = userStore.user.userInfo?.user_id
	const organizationCode = userStore.user.organizationCode
	const revision = recentProjectsStore.revision
	const [snapshot, setSnapshot] = useState<SearchSnapshot>(emptySnapshot)
	const request = useRef<AbortController | null>(null)
	const requestId = useRef(0)
	const cancel = useMemoizedFn(() => {
		requestId.current++
		request.current?.abort()
		request.current = null
	})
	const loadPage = useMemoizedFn(async (page: number) => {
		if (
			!active ||
			busy ||
			!query ||
			query !== debouncedQuery ||
			!userId ||
			!organizationCode ||
			request.current
		)
			return
		const id = ++requestId.current
		const controller = new AbortController()
		request.current = controller
		setSnapshot((previous) => ({ ...previous, loading: true, error: false }))
		try {
			const response = await SuperMagicApi.getProjectsWithCollaboration(
				{
					project_name: query,
					sort_mode: "recent",
					include_special: 1,
					show_collaboration: 1,
					page,
					page_size: PAGE_SIZE,
					include_special: 1,
				},
				{ signal: controller.signal },
			)
			if (id !== requestId.current || controller.signal.aborted) return
			setSnapshot((previous) => {
				const existing = page === 1 ? [] : previous.items
				const items = Array.from(
					new Map(
						[...existing, ...response.list].map((item) => [item.id, item]),
					).values(),
				)
				return {
					items,
					page,
					loading: false,
					error: false,
					stale: false,
					hasMore: page * PAGE_SIZE < response.total && items.length > existing.length,
				}
			})
		} catch {
			if (id === requestId.current && !controller.signal.aborted)
				setSnapshot((previous) => ({ ...previous, error: true }))
		} finally {
			if (id === requestId.current) {
				request.current = null
				setSnapshot((previous) => ({ ...previous, loading: false }))
			}
		}
	})
	const refresh = useMemoizedFn(() => {
		cancel()
		setSnapshot((previous) => ({ ...previous, stale: true, error: false, loading: false }))
		void loadPage(1)
	})
	useLayoutEffect(() => {
		cancel()
		setSnapshot(emptySnapshot)
	}, [query, userId, organizationCode, cancel])
	useEffect(() => {
		if (active && !busy && query && query === debouncedQuery) refresh()
		else {
			cancel()
			setSnapshot((previous) => ({ ...previous, loading: false }))
		}
		return cancel
	}, [active, busy, query, debouncedQuery, userId, organizationCode, revision, refresh, cancel])
	const loadMore = useMemoizedFn(() => {
		if (!snapshot.stale && !snapshot.hasMore) return
		void loadPage(snapshot.stale ? 1 : snapshot.page + 1)
	})
	return { ...snapshot, loadMore, refresh, pending: query !== debouncedQuery }
}
