import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import {
	CollaborationJoinMethod,
	CollaborationProjectType,
	type CollaborationProjectCreator,
	type CollaborationProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import { SortType } from "../../../EmptyWorkspacePanel/components/ProjectItem"

interface UseCollaborationProjectsOptions {
	open: boolean
	tab: CollaborationProjectType
	name: string
	sortType: SortType
	joinType: CollaborationJoinMethod
	creatorFilter: CollaborationProjectCreator[]
}

const PAGE_SIZE = 99

/** 每个共享标签独立持有查询和分页，不把搜索结果写入侧栏缓存。 */
export function useCollaborationProjects({
	open,
	tab,
	name,
	sortType,
	joinType,
	creatorFilter,
}: UseCollaborationProjectsOptions) {
	const [projects, setProjects] = useState<CollaborationProjectListItem[]>([])
	const [page, setPage] = useState(0)
	const [total, setTotal] = useState<number>()
	const [loading, setLoading] = useState(open)
	const [failedPage, setFailedPage] = useState<number | null>(null)
	const requestId = useRef(0)
	const controller = useRef<AbortController | null>(null)
	const isOpen = useRef(open)

	const cancel = useMemoizedFn(() => {
		isOpen.current = false
		requestId.current += 1
		controller.current?.abort()
	})

	const load = useMemoizedFn(async (nextPage = 1) => {
		if (!isOpen.current) return
		controller.current?.abort()
		const request = new AbortController()
		controller.current = request
		const id = ++requestId.current
		const isCurrentRequest = () =>
			!request.signal.aborted && isOpen.current && requestId.current === id
		setLoading(true)
		setFailedPage(null)
		try {
			const result = await SuperMagicApi.getCollaborationProjects(
				{
					page: nextPage,
					page_size: PAGE_SIZE,
					name,
					type: tab,
					sort_field: sortType,
					sort_direction: "desc",
					creator_user_ids:
						tab === CollaborationProjectType.Received &&
						joinType === CollaborationJoinMethod.Internal &&
						creatorFilter.length > 0
							? creatorFilter.map((item) => item.user_id)
							: undefined,
					join_method: joinType,
				},
				{ signal: request.signal },
			)
			if (!isCurrentRequest()) return
			setProjects((previous) => {
				if (nextPage === 1) return result.list
				const existingIds = new Set(previous.map((project) => project.id))
				return [
					...previous,
					...result.list.filter((project) => !existingIds.has(project.id)),
				]
			})
			setPage(nextPage)
			setTotal(result.total)
		} catch {
			// 保留已加载页供继续浏览，失败页单独重试；不能把请求失败显示成空结果。
			if (isCurrentRequest()) setFailedPage(nextPage)
		} finally {
			if (isCurrentRequest()) setLoading(false)
		}
	})

	useEffect(() => {
		isOpen.current = open
		if (!open) return
		// 新条件不能继续显示旧条件的项目；动作完成后的 refresh 则保留当前列表直到查询结束。
		setProjects([])
		setPage(0)
		setTotal(undefined)
		void load()
		return cancel
	}, [open, tab, name, sortType, joinType, creatorFilter, load, cancel])

	const refresh = useMemoizedFn(() => load())
	const loadMore = useMemoizedFn(() => load(page + 1))
	const retry = useMemoizedFn(() => load(failedPage ?? 1))

	return {
		projects,
		loading,
		total,
		failed: failedPage !== null,
		hasMore: total !== undefined && page * PAGE_SIZE < total,
		refresh,
		loadMore,
		retry,
		cancel,
	}
}
