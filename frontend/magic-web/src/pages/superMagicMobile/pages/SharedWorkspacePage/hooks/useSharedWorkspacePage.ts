import { useEffect, useMemo, useRef, useState } from "react"
import { useDebounce, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import { SuperMagicApi } from "@/apis"
import { SHARE_WORKSPACE_DATA } from "@/pages/superMagic/constants"
import SuperMagicService from "@/pages/superMagic/services"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import {
	CollaborationProjectType,
	type CollaborationProjectCreator,
} from "@/pages/superMagic/pages/Workspace/types"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

import type {
	SharedWorkspaceCreatorOption,
	SharedWorkspaceProject,
	SharedWorkspaceTab,
} from "../types"

const SHARED_WORKSPACE_PAGE_SIZE = 100

const TAB_TO_COLLABORATION_TYPE: Record<SharedWorkspaceTab, CollaborationProjectType> = {
	sharedWithMe: CollaborationProjectType.Received,
	sharedByMe: CollaborationProjectType.Shared,
}

export interface UseSharedWorkspacePageReturn {
	tab: SharedWorkspaceTab
	searchValue: string
	setSearchValue: (value: string) => void
	debouncedSearchValue: string
	projects: SharedWorkspaceProject[]
	isLoading: boolean
	isEmpty: boolean
	isSearchEmpty: boolean
	isFilterOpen: boolean
	canShowFilter: boolean
	selectedCreatorIds: string[]
	availableCreators: SharedWorkspaceCreatorOption[]
	activeFilterCount: number
	total: number
	/** 下拉刷新 */
	loadProjects: () => Promise<void>
	/** 是否还有更多项目 */
	hasMore: boolean
	/** 加载下一页项目 */
	loadMore: () => Promise<void>
	openFilterSheet: () => void
	closeFilterSheet: () => void
	handleBack: () => void
	handleTabChange: (nextTab: SharedWorkspaceTab) => void
	handleCreatorToggle: (creatorId: string) => void
	handleCreatorRemove: (creatorId: string) => void
	handleResetFilter: () => void
	handleOpenProject: (project: SharedWorkspaceProject) => void
}

/**
 * 将接口返回的创建者统一成筛选器可消费的选项结构。
 */
function normalizeCreatorOption(
	creator: CollaborationProjectCreator,
): SharedWorkspaceCreatorOption {
	return {
		id: creator.user_id || creator.id,
		name: creator.name,
		avatarUrl: creator.avatar_url,
	}
}

/**
 * 从当前列表兜底派生创建者，避免 creators 接口失败时筛选入口完全不可用。
 */
function deriveCreatorOptionsFromProjects(projects: SharedWorkspaceProject[]) {
	const creatorMap = new Map<string, SharedWorkspaceCreatorOption>()

	projects.forEach((project) => {
		const creator = project.creator
		const creatorId = creator?.user_id
		const creatorName = creator?.nickname
		if (!creatorId || !creatorName || creatorMap.has(creatorId)) return

		creatorMap.set(creatorId, {
			id: creatorId,
			name: creatorName,
			avatarUrl: creator.avatar_url,
		})
	})

	return Array.from(creatorMap.values())
}

/**
 * 共享工作区页面容器 Hook：集中管理真实协作项目请求、筛选降级与导航副作用。
 */
export function useSharedWorkspacePage(): UseSharedWorkspacePageReturn {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const requestSeqRef = useRef(0)
	const [tab, setTab] = useState<SharedWorkspaceTab>("sharedWithMe")
	const [searchValue, setSearchValue] = useState("")
	const debouncedSearchValue = useDebounce(searchValue.trim(), { wait: 300 })
	const [projects, setProjects] = useState<SharedWorkspaceProject[]>([])
	const [total, setTotal] = useState(0)
	const [isLoading, setIsLoading] = useState(false)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([])
	const [creatorOptions, setCreatorOptions] = useState<SharedWorkspaceCreatorOption[]>([])

	const selectedCreatorKey = useMemo(() => selectedCreatorIds.join(","), [selectedCreatorIds])

	/**
	 * creators 接口仅用于“他人共享的”创建者筛选；失败时由列表数据兜底。
	 */
	const loadCreators = useMemoizedFn(async () => {
		try {
			const creators = await SuperMagicApi.getCollaborationProjectCreators()
			setCreatorOptions(creators.map(normalizeCreatorOption))
		} catch (error) {
			console.error("加载共享项目创建者失败:", error)
		}
	})

	/**
	 * 按当前 Tab 和已支持筛选条件请求协作项目，不发送未登记的排序或权限参数。
	 */
	const loadProjects = useMemoizedFn(async () => {
		const requestSeq = requestSeqRef.current + 1
		requestSeqRef.current = requestSeq
		setIsLoading(true)

		try {
			const response = await SuperMagicApi.getCollaborationProjects({
				page: 1,
				page_size: SHARED_WORKSPACE_PAGE_SIZE,
				type: TAB_TO_COLLABORATION_TYPE[tab],
				name: debouncedSearchValue || undefined,
				sort_field: "updated_at",
				sort_direction: "desc",
				creator_user_ids:
					tab === "sharedWithMe" && selectedCreatorIds.length > 0
						? selectedCreatorIds
						: undefined,
			})

			if (requestSeq !== requestSeqRef.current) return

			setProjects(response.list as unknown as SharedWorkspaceProject[])
			setTotal(response.total ?? response.list.length)
			setCurrentPage(1)
		} catch (error) {
			if (requestSeq !== requestSeqRef.current) return

			console.error("加载共享项目失败:", error)
			setProjects([])
			setTotal(0)
		} finally {
			if (requestSeq === requestSeqRef.current) setIsLoading(false)
		}
	})

	useEffect(() => {
		void loadCreators()
	}, [loadCreators])

	useEffect(() => {
		workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
	}, [t])

	useEffect(() => {
		void loadProjects()
	}, [debouncedSearchValue, loadProjects, selectedCreatorKey, tab])

	const derivedCreatorOptions = useMemo(
		() => deriveCreatorOptionsFromProjects(projects),
		[projects],
	)
	const availableCreators = creatorOptions.length > 0 ? creatorOptions : derivedCreatorOptions
	const canShowFilter = tab === "sharedWithMe" && availableCreators.length > 0
	const activeFilterCount = selectedCreatorIds.length
	const hasActiveSearchOrFilter = Boolean(debouncedSearchValue) || activeFilterCount > 0
	const isEmpty = !isLoading && !hasActiveSearchOrFilter && projects.length === 0
	const isSearchEmpty = !isLoading && hasActiveSearchOrFilter && projects.length === 0

	/**
	 * 返回工作区列表，保持共享项目页和普通工作区页同一层级。
	 */
	const handleBack = useMemoizedFn(() => {
		navigate({ name: RouteName.SuperWorkspacesList })
	})

	/**
	 * 切换 Tab 时重置筛选，避免“他人共享的”创建者条件误带到“我共享的”。
	 */
	const handleTabChange = useMemoizedFn((nextTab: SharedWorkspaceTab) => {
		if (nextTab === tab) return

		setTab(nextTab)
		setSelectedCreatorIds([])
	})

	/**
	 * 创建者筛选复用接口的 `creator_user_ids`，仅在“他人共享的”Tab 生效。
	 */
	const handleCreatorToggle = useMemoizedFn((creatorId: string) => {
		setSelectedCreatorIds((prev) =>
			prev.includes(creatorId) ? prev.filter((id) => id !== creatorId) : [...prev, creatorId],
		)
	})

	/**
	 * 从已选 chips 中移除创建者筛选条件。
	 */
	const handleCreatorRemove = useMemoizedFn((creatorId: string) => {
		setSelectedCreatorIds((prev) => prev.filter((id) => id !== creatorId))
	})

	/**
	 * 重置所有本期可支持的筛选条件，保持未支持项不参与请求。
	 */
	const handleResetFilter = useMemoizedFn(() => {
		setSelectedCreatorIds([])
	})

	/**
	 * 打开项目沿用现有移动端协作项目切换链路，不重新实现权限和路由规则。
	 */
	const handleOpenProject = useMemoizedFn((project: SharedWorkspaceProject) => {
		SuperMagicService.switchProjectInMobile(project)
	})

	/**
	 * 加载下一页协作项目并追加到现有列表，搜索/筛选态下禁止调用。
	 */
	const loadMore = useMemoizedFn(async () => {
		// 搜索/筛选态不分页，保持单次全量请求行为
		if (debouncedSearchValue || selectedCreatorIds.length > 0 || isLoadingMore) return
		const nextPage = currentPage + 1
		setIsLoadingMore(true)
		const requestSeq = requestSeqRef.current

		try {
			const response = await SuperMagicApi.getCollaborationProjects({
				page: nextPage,
				page_size: SHARED_WORKSPACE_PAGE_SIZE,
				type: TAB_TO_COLLABORATION_TYPE[tab],
				sort_field: "updated_at",
				sort_direction: "desc",
			})

			if (requestSeq !== requestSeqRef.current) return

			setProjects((prev) => [
				...prev,
				...(response.list as unknown as SharedWorkspaceProject[]),
			])
			setTotal(response.total ?? total)
			setCurrentPage(nextPage)
		} catch (error) {
			console.error("加载更多共享项目失败:", error)
		} finally {
			setIsLoadingMore(false)
		}
	})

	// 是否还有更多项目（搜索/筛选态禁用）
	const hasMore =
		!debouncedSearchValue && selectedCreatorIds.length === 0 && projects.length < total

	return {
		tab,
		searchValue,
		setSearchValue,
		debouncedSearchValue,
		projects,
		isLoading,
		isEmpty,
		isSearchEmpty,
		isFilterOpen,
		canShowFilter,
		selectedCreatorIds,
		availableCreators,
		activeFilterCount,
		total,
		loadProjects,
		hasMore,
		loadMore,
		openFilterSheet: () => setIsFilterOpen(true),
		closeFilterSheet: () => setIsFilterOpen(false),
		handleBack,
		handleTabChange,
		handleCreatorToggle,
		handleCreatorRemove,
		handleResetFilter,
		handleOpenProject,
	}
}
