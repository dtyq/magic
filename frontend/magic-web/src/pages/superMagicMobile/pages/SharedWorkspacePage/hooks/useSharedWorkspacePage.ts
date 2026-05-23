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
	SharedWorkspaceTabState,
} from "../types"
import {
	createInitialTabStateMap,
	resolveSharedWorkspaceHasMore,
} from "./shared-workspace-tab-state"

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
 * 共享工作区页面容器 Hook：按 Tab 分桶缓存列表，避免切换时串台与分页竞态。
 */
export function useSharedWorkspacePage(): UseSharedWorkspacePageReturn {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const requestSeqByTabRef = useRef<Record<SharedWorkspaceTab, number>>({
		sharedWithMe: 0,
		sharedByMe: 0,
	})
	const [tab, setTab] = useState<SharedWorkspaceTab>("sharedWithMe")
	const [searchValue, setSearchValue] = useState("")
	const debouncedSearchValue = useDebounce(searchValue.trim(), { wait: 300 })
	const [tabState, setTabState] = useState(createInitialTabStateMap)
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([])
	const [creatorOptions, setCreatorOptions] = useState<SharedWorkspaceCreatorOption[]>([])

	const selectedCreatorKey = useMemo(() => selectedCreatorIds.join(","), [selectedCreatorIds])
	const activeTabState = tabState[tab]
	const { projects, total, isLoading, isLoadingMore } = activeTabState

	/**
	 * Patches one tab bucket without touching the other tab's cached list or pagination.
	 */
	const patchTabState = useMemoizedFn(
		(
			targetTab: SharedWorkspaceTab,
			patch:
				| Partial<SharedWorkspaceTabState>
				| ((current: SharedWorkspaceTabState) => SharedWorkspaceTabState),
		) => {
			setTabState((prev) => {
				const current = prev[targetTab]
				const next = typeof patch === "function" ? patch(current) : { ...current, ...patch }
				return { ...prev, [targetTab]: next }
			})
		},
	)

	/**
	 * Bumps the per-tab request generation so stale loadProjects/loadMore callbacks are ignored.
	 */
	const bumpTabRequestSeq = useMemoizedFn((targetTab: SharedWorkspaceTab) => {
		const nextSeq = requestSeqByTabRef.current[targetTab] + 1
		requestSeqByTabRef.current[targetTab] = nextSeq
		return nextSeq
	})

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
	 * 按指定 Tab 和筛选条件请求协作项目，只写入对应 Tab 的状态桶。
	 */
	const loadProjects = useMemoizedFn(async (targetTab: SharedWorkspaceTab = tab) => {
		const requestSeq = bumpTabRequestSeq(targetTab)
		patchTabState(targetTab, { isLoading: true })

		try {
			const response = await SuperMagicApi.getCollaborationProjects({
				page: 1,
				page_size: SHARED_WORKSPACE_PAGE_SIZE,
				type: TAB_TO_COLLABORATION_TYPE[targetTab],
				name: debouncedSearchValue || undefined,
				sort_field: "updated_at",
				sort_direction: "desc",
				creator_user_ids:
					targetTab === "sharedWithMe" && selectedCreatorIds.length > 0
						? selectedCreatorIds
						: undefined,
			})

			if (requestSeq !== requestSeqByTabRef.current[targetTab]) return

			patchTabState(targetTab, {
				projects: response.list as unknown as SharedWorkspaceProject[],
				total: response.total ?? response.list.length,
				currentPage: 1,
				isLoading: false,
			})
		} catch (error) {
			if (requestSeq !== requestSeqByTabRef.current[targetTab]) return

			console.error("加载共享项目失败:", error)
			patchTabState(targetTab, {
				projects: [],
				total: 0,
				currentPage: 1,
				isLoading: false,
			})
		}
	})

	useEffect(() => {
		void loadCreators()
	}, [loadCreators])

	useEffect(() => {
		workspaceStore.setSelectedWorkspace(SHARE_WORKSPACE_DATA(t))
	}, [t])

	useEffect(() => {
		void loadProjects(tab)
	}, [debouncedSearchValue, loadProjects, selectedCreatorKey, tab])

	const derivedCreatorOptions = useMemo(
		() => deriveCreatorOptionsFromProjects(tabState.sharedWithMe.projects),
		[tabState.sharedWithMe.projects],
	)
	const availableCreators = creatorOptions.length > 0 ? creatorOptions : derivedCreatorOptions
	const canShowFilter = tab === "sharedWithMe" && availableCreators.length > 0
	const activeFilterCount = selectedCreatorIds.length
	const hasActiveSearchOrFilter = Boolean(debouncedSearchValue) || activeFilterCount > 0
	const isEmpty = !isLoading && !hasActiveSearchOrFilter && projects.length === 0
	const isSearchEmpty = !isLoading && hasActiveSearchOrFilter && projects.length === 0

	/**
	 * Prefer history back; when opened via deep link without history, fall back to workspace list.
	 */
	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			name: RouteName.SuperWorkspacesList,
			viewTransition: false,
		})
	})

	/**
	 * 切换 Tab 时重置筛选，并依赖分桶状态展示目标 Tab 自己的缓存/加载态。
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
	 * 加载下一页协作项目并追加到当前 Tab 桶，搜索/筛选或首屏加载中禁止调用。
	 */
	const loadMore = useMemoizedFn(async () => {
		const targetTab = tab
		const { isLoading: tabIsLoading, isLoadingMore: tabIsLoadingMore } = tabState[targetTab]

		if (
			debouncedSearchValue ||
			selectedCreatorIds.length > 0 ||
			tabIsLoadingMore ||
			tabIsLoading
		)
			return

		const nextPage = tabState[targetTab].currentPage + 1
		const requestSeq = requestSeqByTabRef.current[targetTab]
		patchTabState(targetTab, { isLoadingMore: true })

		try {
			const response = await SuperMagicApi.getCollaborationProjects({
				page: nextPage,
				page_size: SHARED_WORKSPACE_PAGE_SIZE,
				type: TAB_TO_COLLABORATION_TYPE[targetTab],
				sort_field: "updated_at",
				sort_direction: "desc",
			})

			if (requestSeq !== requestSeqByTabRef.current[targetTab]) return

			patchTabState(targetTab, (current) => ({
				...current,
				projects: [
					...current.projects,
					...(response.list as unknown as SharedWorkspaceProject[]),
				],
				total: response.total ?? current.total,
				currentPage: nextPage,
				isLoadingMore: false,
			}))
		} catch (error) {
			if (requestSeq !== requestSeqByTabRef.current[targetTab]) return

			console.error("加载更多共享项目失败:", error)
			patchTabState(targetTab, { isLoadingMore: false })
		}
	})

	const hasMore = resolveSharedWorkspaceHasMore({
		projectsLength: projects.length,
		total,
		isLoading,
		isLoadingMore,
		hasActiveSearchOrFilter,
	})

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
		loadProjects: () => loadProjects(tab),
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
