import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { runInAction } from "mobx"
import { useTranslation } from "react-i18next"
import { useDebounce, useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import useProjectItemActionProps from "@/pages/superMagic/components/EmptyWorkspacePanel/hooks/useProjectItemActionProps"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { projectStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import {
	createAiCanvasDocument,
	getAiCanvasDefaultFolderName,
} from "@/pages/superMagic/pages/TopicPage/utils/aiCanvas"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useCanvasCovers } from "./useCanvasCovers"
import { openAiCanvasProject } from "../utils/openAiCanvasProject"
import type { AiCanvasCardMenuActions } from "../components/AiCanvasProjectCard"

const PAGE_SIZE = 60
// Stable empty list so memoized derivations do not recompute before the workspace loads.
const NO_PROJECTS: ProjectListItem[] = []

/**
 * Data and actions of the AI canvas home, shared by the desktop page and the H5 page: the
 * system-managed ai-canvas workspace, its paged and searchable project list ("My canvases"),
 * lazy covers, pinning and blank-canvas creation. Callers render the list and attach
 * `viewportRef` to their scroll area so infinite scroll observes the right container.
 *
 * Data ownership: projects are written into projectStore.projectsByWorkspace for this workspace
 * only (never projectStore.projects), so shared rename/delete actions update the list in place
 * without replacing the sidebar's current workspace list.
 */
export function useAiCanvasHome() {
	const { t } = useTranslation("aiCanvas")
	const [workspace, setWorkspace] = useState<Workspace | null>(null)
	const [workspaceError, setWorkspaceError] = useState(false)
	const [listError, setListError] = useState(false)
	const [isListLoading, setIsListLoading] = useState(false)
	const [hasMore, setHasMore] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const pageRef = useRef(1)
	// Latest list request wins; older responses (e.g. a background refresh) are dropped.
	const listRequestRef = useRef<AbortController | null>(null)

	const workspaceProjects = workspace
		? projectStore.getProjectsByWorkspace(workspace.id)
		: NO_PROJECTS
	// Pinned canvases lead "My canvases"; the stable sort keeps the server order within each group.
	// Pinning mutates the item in place, so the pinned ids join the memo key (read in render, which
	// also keeps this observer reacting) and the list reference stays stable otherwise.
	const pinnedKey = workspaceProjects
		.filter((project) => project.is_pinned)
		.map((project) => project.id)
		.join(",")
	const projects = useMemo(
		() =>
			pinnedKey
				? [...workspaceProjects].sort(
						(a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)),
					)
				: workspaceProjects,
		[pinnedKey, workspaceProjects],
	)
	const actions = useProjectItemActionProps({ selectedWorkspace: workspace })
	// The project page card's menu actions beyond pin, rename and delete (collaboration link,
	// collaborators, transfer). They are provided by the enterprise overlay of useProjectItemActionProps (undefined in open source).
	const cardMenuActions = useMemo<AiCanvasCardMenuActions>(
		() => ({
			onCopyCollaborationLink: actions.handleCopyCollaborationLink,
			onAddCollaborators: actions.onAddCollaborators,
			onTransferProject: actions.handleTransferProject,
		}),
		[
			actions.handleCopyCollaborationLink,
			actions.onAddCollaborators,
			actions.handleTransferProject,
		],
	)
	// Cards that have neared the viewport; only their covers are read (see useCanvasCovers).
	const [visibleProjectIds, setVisibleProjectIds] = useState<ReadonlySet<string>>(() => new Set())
	const markProjectVisible = useMemoizedFn((projectId: string) => {
		setVisibleProjectIds((current) =>
			current.has(projectId) ? current : new Set(current).add(projectId),
		)
	})
	const covers = useCanvasCovers(projects, visibleProjectIds)

	const loadWorkspace = useMemoizedFn(async () => {
		setWorkspaceError(false)
		try {
			setWorkspace(await SuperMagicApi.getAiCanvasWorkspace())
		} catch {
			setWorkspaceError(true)
		}
	})

	/**
	 * Loads one page. `page === 1` replaces the cached first page but keeps rendered items until
	 * the request succeeds, so background reconciliation never blanks the list.
	 */
	// Name search, sent as the list API's project_name filter. Read through a ref so every
	// existing loader call (paging, refresh on return, pin) keeps the active search.
	const [searchInput, setSearchInput] = useState("")
	const searchName = useDebounce(searchInput.trim(), { wait: 300 })
	const searchNameRef = useRef("")
	// Keyword of the list on screen. While the typed keyword differs (debounce or request in
	// flight) the grid shows a loading skeleton instead of stale cards dropping out one by one.
	const [listSearchName, setListSearchName] = useState("")

	const loadProjects = useCallback(async (targetWorkspace: Workspace, page: number) => {
		listRequestRef.current?.abort()
		const controller = new AbortController()
		listRequestRef.current = controller
		setIsListLoading(true)
		setListError(false)
		try {
			const response = await SuperMagicApi.getProjects({
				workspace_id: targetWorkspace.id,
				project_name: searchNameRef.current || undefined,
				order_by: "updated_at",
				sort: "desc",
				page,
				page_size: PAGE_SIZE,
			})
			if (controller.signal.aborted) return
			// The ai-canvas workspace only holds the user's own projects, but this list API leaves
			// user_role out. Opening a project hands this item to the project page, where a missing
			// role reads as "not owner" (shortcut menu items, no rename) until details load.
			const list = (response?.list ?? []).map((item) =>
				item.user_role ? item : { ...item, user_role: CollaboratorPermissionEnum.OWNER },
			)
			runInAction(() => {
				if (page === 1) {
					// A fresh first page replaces the cache so projects deleted elsewhere disappear.
					projectStore.projectsByWorkspace.set(targetWorkspace.id, list)
				} else {
					projectStore.projectsByWorkspace.set(targetWorkspace.id, [
						...projectStore.getProjectsByWorkspace(targetWorkspace.id),
						...list.filter(
							(item) =>
								!projectStore
									.getProjectsByWorkspace(targetWorkspace.id)
									.some((existing) => existing.id === item.id),
						),
					])
				}
			})
			pageRef.current = page
			setHasMore(page * PAGE_SIZE < (response?.total ?? 0))
			if (page === 1) setListSearchName(searchNameRef.current)
		} catch {
			if (controller.signal.aborted) return
			setListError(true)
			// Settle the search either way, so a failed search never leaves the skeleton up.
			if (page === 1) setListSearchName(searchNameRef.current)
		} finally {
			if (listRequestRef.current === controller) {
				listRequestRef.current = null
				setIsListLoading(false)
			}
		}
	}, [])

	useEffect(() => {
		void loadWorkspace()
	}, [loadWorkspace])

	// A new search restarts from page one; the loader aborts the previous request, so a slower
	// response for an older keyword can never replace the newer results.
	useEffect(() => {
		if (!workspace) return
		searchNameRef.current = searchName
		void loadProjects(workspace, 1)
		return () => listRequestRef.current?.abort()
	}, [loadProjects, searchName, workspace])

	// Reconcile after the tab returns or a bfcache restore: projects may have been created,
	// renamed or deleted elsewhere. Re-reading the first page keeps scroll and rendered items.
	useEffect(() => {
		if (!workspace) return
		const refresh = () => {
			if (document.visibilityState !== "visible") return
			void loadProjects(workspace, 1)
		}
		const handlePageShow = (event: PageTransitionEvent) => {
			if (event.persisted) refresh()
		}
		document.addEventListener("visibilitychange", refresh)
		window.addEventListener("pageshow", handlePageShow)
		return () => {
			document.removeEventListener("visibilitychange", refresh)
			window.removeEventListener("pageshow", handlePageShow)
		}
	}, [loadProjects, workspace])

	const viewportRef = useRef<HTMLDivElement>(null)
	const loadNextPage = useMemoizedFn(() => {
		if (!workspace || isListLoading || !hasMore) return
		void loadProjects(workspace, pageRef.current + 1)
	})
	// Infinite scroll inside the page's own scroll area; disabled while a page is in flight or
	// the list is exhausted, so one sentinel sighting requests one page.
	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: viewportRef,
		disabled: !workspace || isListLoading || !hasMore,
		onLoadMore: loadNextPage,
		rootMargin: "320px 0px",
	})

	// Pin through the service, then re-read this home's first page. The shared pin action would
	// refetch projectStore.projects, which belongs to the sidebar's current workspace.
	const handleTogglePin = useMemoizedFn(async (project: ProjectListItem) => {
		if (!workspace) return
		try {
			await SuperMagicService.project.pinProject(project, !project.is_pinned)
		} catch {
			// The service already reports the failure.
			return
		}
		await loadProjects(workspace, 1)
	})

	const handleCreateCanvas = useMemoizedFn(async () => {
		if (!workspace?.id || isCreating) return
		setIsCreating(true)
		try {
			const created = await SuperMagicApi.createAiCanvasProject({
				workspace_id: String(workspace.id),
				// Starts with the same name as its canvas, which then follows renames.
				project_name: getAiCanvasDefaultFolderName(),
			})
			try {
				await createAiCanvasDocument(String(created.project.id))
			} catch {
				// The project page creates the missing canvas again, so opening it is still safe.
			}
			await openAiCanvasProject(created.project)
		} catch {
			magicToast.error(t("home.createFailed"))
		} finally {
			setIsCreating(false)
		}
	})

	const isInitialLoading = !workspace || (isListLoading && projects.length === 0)
	const isSearchPending = searchInput.trim() !== listSearchName
	const reloadFirstPage = useMemoizedFn(() => {
		if (workspace) void loadProjects(workspace, 1)
	})

	return {
		workspace,
		workspaceError,
		loadWorkspace,
		projects,
		actions,
		covers,
		markProjectVisible,
		searchInput,
		setSearchInput,
		listSearchName,
		isSearchPending,
		isInitialLoading,
		listError,
		isListLoading,
		hasMore,
		reloadFirstPage,
		viewportRef,
		loadMoreSentinelRef,
		handleTogglePin,
		cardMenuActions,
		isCreating,
		handleCreateCanvas,
		openProject: openAiCanvasProject,
	}
}
