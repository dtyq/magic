import { useEffect, useRef, useState } from "react"
import { useDebounce, useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { isTaskWorkspace } from "./useTaskHomeContext"

/** Search is server-side so workspaces beyond the first page remain reachable. */
export function useTaskWorkspaceOptions(open: boolean) {
	const [search, setSearch] = useState("")
	const query = useDebounce(search.trim(), { wait: 250 })
	const [items, setItems] = useState<Workspace[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)
	const [hasMore, setHasMore] = useState(false)
	const pageRef = useRef(1)
	const revisionRef = useRef(0)
	const pendingRef = useRef(false)
	const load = useMemoizedFn(async (page = 1) => {
		if (page > 1 && pendingRef.current) return
		const revision = ++revisionRef.current
		pendingRef.current = true
		setLoading(true)
		setError(false)
		try {
			const response = await SuperMagicApi.getWorkspaces({
				page,
				page_size: 50,
				workspace_type: "default",
				auto_create: false,
				workspace_name: query || undefined,
			})
			if (revision !== revisionRef.current) return
			const list: Workspace[] = response.list.filter(isTaskWorkspace)
			setItems((previous) =>
				page === 1
					? list
					: [...new Map([...previous, ...list].map((item) => [item.id, item])).values()],
			)
			pageRef.current = page
			setHasMore(page * 50 < response.total)
		} catch {
			if (revision === revisionRef.current) setError(true)
		} finally {
			if (revision === revisionRef.current) {
				pendingRef.current = false
				setLoading(false)
			}
		}
	})
	useEffect(() => {
		if (open) {
			setItems([])
			void load()
		}
		return () => {
			revisionRef.current += 1
			pendingRef.current = false
		}
	}, [open, query, load])
	return {
		search,
		setSearch,
		items,
		loading,
		error,
		hasMore,
		retry: () => load(),
		loadMore: () => load(pageRef.current + 1),
	}
}
