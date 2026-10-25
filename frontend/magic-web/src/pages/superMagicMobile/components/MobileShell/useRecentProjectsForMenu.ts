import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { type ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import {
	isSelfCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/pages/superMagic/constants"
import { projectStore } from "@/pages/superMagic/stores/core"
import { useTranslation } from "react-i18next"
import {
	getCachedChatWorkspaceId,
	ensureChatWorkspaceId,
} from "@/pages/superMagic/hooks/useChatWorkspace"
import type { MobileShellMenuRecentItem } from "./MobileShellMenuContext"
import { mergeProjectListItemWithStoreCache } from "@/pages/superMagicMobile/utils/mergeProjectListItemWithStoreCache"

const RECENT_PROJECTS_PAGE_SIZE = 20

/** Derives the last fetchable page from API total and fixed page size. */
function getRecentProjectsMaxPage(total: number) {
	if (total <= 0) return 0
	return Math.ceil(total / RECENT_PROJECTS_PAGE_SIZE)
}

/** True when list count or page cursor indicates all server pages are consumed. */
function hasMoreRecentProjects({
	loadedCount,
	total,
	currentPage,
}: {
	loadedCount: number
	total: number
	currentPage: number
}) {
	if (total <= 0) return false
	return loadedCount < total && currentPage < getRecentProjectsMaxPage(total)
}

function getRecentProjectTitle(
	project: ProjectListItem,
	chatWorkspaceId: string | null,
	translations: {
		unnamedChat: string
		unnamedProject: string
	},
) {
	if (project.project_name?.trim()) return project.project_name

	return chatWorkspaceId && project.workspace_id === chatWorkspaceId
		? translations.unnamedChat
		: translations.unnamedProject
}

function isRunningLikeStatus(status: string | undefined | null) {
	return status === "running" || status === "waiting_for_user"
}

// Chat projects are identified by workspace_id, not project_mode.
function mapRecentProjectToMenuItem(
	project: ProjectListItem,
	chatWorkspaceId: string | null,
	translations: {
		unnamedChat: string
		unnamedProject: string
	},
): MobileShellMenuRecentItem {
	return {
		id: project.id,
		title: getRecentProjectTitle(project, chatWorkspaceId, translations),
		project,
		inProgress:
			isRunningLikeStatus(project.current_topic_status) ||
			isRunningLikeStatus(project.project_status),
		isShared: isSelfCollaborationProject(project),
		isLinked: Boolean(isWorkspaceShortcutProject(project)),
		isChatProject: chatWorkspaceId != null && project.workspace_id === chatWorkspaceId,
	}
}

function mapProjectsToMenuItems(
	projects: ProjectListItem[],
	chatWorkspaceId: string | null,
	translations: {
		unnamedChat: string
		unnamedProject: string
	},
) {
	return projects.map((project) =>
		mapRecentProjectToMenuItem(project, chatWorkspaceId, translations),
	)
}

function mergeRecentMenuItems(
	prev: MobileShellMenuRecentItem[],
	next: MobileShellMenuRecentItem[],
) {
	if (next.length === 0) return prev

	const existingIds = new Set(prev.map((item) => item.id))
	const uniqueNext = next.filter((item) => !existingIds.has(item.id))
	if (uniqueNext.length === 0) return prev

	return [...prev, ...uniqueNext]
}

async function requestRecentProjects(page: number): Promise<{
	projects: ProjectListItem[]
	total: number
	chatWorkspaceId: string | null
}> {
	const [projectsResult, chatWorkspaceId] = await Promise.all([
		// Same list as the web sidebar's "Recent" (recentProjectsStore): ordered by last visit, with
		// collaboration and special projects and their permission fields, so badges match.
		SuperMagicApi.getProjectsWithCollaboration({
			page,
			page_size: RECENT_PROJECTS_PAGE_SIZE,
			show_collaboration: 1,
			sort_mode: "recent",
			include_special: 1,
		}).catch((error) => {
			console.error("Failed to load recent projects for mobile menu:", error)
			return { list: [], total: 0 }
		}),
		getCachedChatWorkspaceId() != null
			? Promise.resolve(getCachedChatWorkspaceId())
			: ensureChatWorkspaceId(),
	])

	return {
		projects: projectsResult.list || [],
		total: projectsResult.total ?? 0,
		chatWorkspaceId,
	}
}

/** Writes recent rows into workspace cache without dropping richer permission fields. */
function warmRecentProjectsCache(projects: ProjectListItem[]) {
	projects.forEach((project) => {
		const cachedProjects = projectStore.getProjectsByWorkspace(project.workspace_id)
		const existing = cachedProjects.find((item) => item.id === project.id)

		if (existing?.user_role && !project.user_role) return

		const merged = mergeProjectListItemWithStoreCache(project) ?? project

		if (existing) {
			projectStore.setProjectsForWorkspace(
				project.workspace_id,
				cachedProjects.map((item) => (item.id === project.id ? merged : item)),
			)
			return
		}

		projectStore.setProjectsForWorkspace(project.workspace_id, [merged, ...cachedProjects])
	})
}

export function useRecentProjectsForMenu() {
	const { t } = useTranslation("super")
	const [recentItems, setRecentItems] = useState<MobileShellMenuRecentItem[]>([])
	const [recentTotal, setRecentTotal] = useState(0)
	const [currentPage, setCurrentPage] = useState(1)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	// Synchronous guard: React state cannot block concurrent InfiniteScroll triggers in the same tick.
	const isLoadingMoreRef = useRef(false)
	const recentItemTranslations = useMemo(
		() => ({
			unnamedChat: t("chat.unnamedChat"),
			unnamedProject: t("project.unnamedProject"),
		}),
		[t],
	)

	const hasMore = hasMoreRecentProjects({
		loadedCount: recentItems.length,
		total: recentTotal,
		currentPage,
	})

	const applyRecentPage = useMemoizedFn(
		({
			projects,
			total,
			chatWorkspaceId,
			mode,
		}: {
			projects: ProjectListItem[]
			total: number
			chatWorkspaceId: string | null
			mode: "replace" | "append"
		}) => {
			warmRecentProjectsCache(projects)
			const mapped = mapProjectsToMenuItems(projects, chatWorkspaceId, recentItemTranslations)

			setRecentTotal(total)
			setRecentItems((prev) =>
				mode === "replace" ? mapped : mergeRecentMenuItems(prev, mapped),
			)
		},
	)

	const reloadRecentItems = useMemoizedFn(async () => {
		const { projects, total, chatWorkspaceId } = await requestRecentProjects(1)
		setCurrentPage(1)
		applyRecentPage({ projects, total, chatWorkspaceId, mode: "replace" })
	})

	/** Ends pagination when the next page adds no rows, keeping hasMore in sync with loaded items. */
	const stopPaginationWithNoProgress = useMemoizedFn((loadedCount: number, nextPage: number) => {
		setRecentTotal(loadedCount)
		setCurrentPage(nextPage)
	})

	const loadMoreRecentItems = useMemoizedFn(async () => {
		if (!hasMore || isLoadingMore || isLoadingMoreRef.current) return

		isLoadingMoreRef.current = true
		setIsLoadingMore(true)
		const nextPage = currentPage + 1
		const loadedCountBeforeRequest = recentItems.length

		try {
			const { projects, total, chatWorkspaceId } = await requestRecentProjects(nextPage)
			const existingIds = new Set(recentItems.map((item) => item.id))
			const uniqueNewCount = projects.filter((project) => !existingIds.has(project.id)).length

			if (projects.length === 0) {
				stopPaginationWithNoProgress(loadedCountBeforeRequest, nextPage)
				return
			}

			if (uniqueNewCount === 0) {
				stopPaginationWithNoProgress(loadedCountBeforeRequest, nextPage)
				return
			}

			applyRecentPage({ projects, total, chatWorkspaceId, mode: "append" })
			setCurrentPage(nextPage)
		} catch (error) {
			console.error("Failed to load more recent projects:", error)
		} finally {
			isLoadingMoreRef.current = false
			setIsLoadingMore(false)
		}
	})

	useEffect(() => {
		let disposed = false

		async function loadRecentProjects() {
			const { projects, total, chatWorkspaceId } = await requestRecentProjects(1)
			if (disposed) return

			applyRecentPage({ projects, total, chatWorkspaceId, mode: "replace" })
			if (disposed) return

			setCurrentPage(1)
		}

		void loadRecentProjects()

		return () => {
			disposed = true
		}
	}, [applyRecentPage])

	return useMemo(
		() => ({
			recentItems,
			reloadRecentItems,
			loadMoreRecentItems,
			hasMore,
			isLoadingMore,
		}),
		[recentItems, reloadRecentItems, loadMoreRecentItems, hasMore, isLoadingMore],
	)
}
