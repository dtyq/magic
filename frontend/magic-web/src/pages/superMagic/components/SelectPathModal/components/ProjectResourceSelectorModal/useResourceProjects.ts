import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { type Workspace, type ProjectListItem } from "../../../../pages/Workspace/types"
import {
	MY_CLAW_WORKSPACE_DATA,
	MY_SKILLS_WORKSPACE_DATA,
	MY_AGENTS_WORKSPACE_DATA,
	SHARE_WORKSPACE_ID,
	MY_CLAW_WORKSPACE_ID,
	MY_SKILLS_WORKSPACE_ID,
	MY_AGENTS_WORKSPACE_ID,
	MICRO_APPS_WORKSPACE_ID,
} from "../../../../constants"
import { loadResourceProjectPage, type AgentResourceScope } from "../../utils/resourceProjects"
import { loadSharedWorkspaceProjects } from "../../utils/sharedWorkspaceProjects"
import type { ResourceProject } from "../../resourceProjectTypes"

export const RESOURCE_WORKSPACE_IDS = new Set<string>([
	MY_SKILLS_WORKSPACE_ID,
	MY_AGENTS_WORKSPACE_ID,
	MY_CLAW_WORKSPACE_ID,
	MICRO_APPS_WORKSPACE_ID,
])
/** Align with MySkills / MyCrew list page size; selector loads more on demand. */
const RESOURCE_PROJECTS_PAGE_SIZE = 20

export type { ResourceProject } from "../../resourceProjectTypes"

/** 来源列表只持有项目元数据；切换来源或关闭时使旧请求失效，不加载项目文件树。 */
export function useResourceProjects({
	visible,
	isMentionMode,
	currentWorkspace,
	loading,
	setLoading,
	setLoadError,
}: {
	visible: boolean
	isMentionMode: boolean
	currentWorkspace: Workspace | null
	loading: boolean
	setLoading: (loading: boolean) => void
	setLoadError: (error: boolean) => void
}) {
	const { t } = useTranslation("super")
	const [availableProjects, setAvailableProjects] = useState<ResourceProject[]>([])
	const [loadingMoreResources, setLoadingMoreResources] = useState(false)
	const [resourceProjectsPage, setResourceProjectsPage] = useState(1)
	const [hasMoreResourceProjects, setHasMoreResourceProjects] = useState(false)
	const loadingMoreResourcesRef = useRef(false)
	const projectsRequestId = useRef(0)
	const sharedRequestRef = useRef<AbortController | null>(null)
	const keywordRef = useRef("")
	const [agentScope, setAgentScope] = useState<AgentResourceScope>("created")
	const agentScopeRef = useRef<AgentResourceScope>("created")
	const microWorkspaceRef = useRef<Workspace | null>(null)
	const cancelProjectRequest = useMemoizedFn(() => {
		projectsRequestId.current += 1
		sharedRequestRef.current?.abort()
	})
	useEffect(() => {
		return () => {
			cancelProjectRequest()
			microWorkspaceRef.current = null
		}
	}, [visible, cancelProjectRequest])
	// 获取共享项目列表
	const fetchCollaborationProjects = useMemoizedFn(async () => {
		const requestId = ++projectsRequestId.current
		setLoadError(false)
		setLoading(true)
		try {
			sharedRequestRef.current?.abort()
			const request = new AbortController()
			sharedRequestRef.current = request
			const list = await loadSharedWorkspaceProjects({ signal: request.signal })
			if (requestId !== projectsRequestId.current) return
			const projects: ProjectListItem[] = list.map((item) => ({
				...item,
				tag: "collaboration" as const,
			}))
			setAvailableProjects(projects)
		} catch (error) {
			if (requestId !== projectsRequestId.current) return
			setLoadError(true)
			console.error("Failed to fetch collaboration projects:", error)
			magicToast.error(t("selectPathModal.fetchProjectsFailed"))
			setAvailableProjects([])
		}
		setLoading(false)
	})

	const resetResourceProjectsPagination = useMemoizedFn(() => {
		setResourceProjectsPage(1)
		setHasMoreResourceProjects(false)
		setLoadingMoreResources(false)
		loadingMoreResourcesRef.current = false
	})

	const fetchResourceProjects = useMemoizedFn(async (workspaceId: string, page = 1) => {
		const isLoadMore = page > 1
		if (isLoadMore) {
			if (loadingMoreResourcesRef.current || loading || !hasMoreResourceProjects) return
			loadingMoreResourcesRef.current = true
			setLoadingMoreResources(true)
		} else {
			setLoading(true)
			resetResourceProjectsPagination()
		}

		const requestId = ++projectsRequestId.current
		setLoadError(false)
		try {
			const workspace =
				workspaceId === MY_CLAW_WORKSPACE_ID
					? MY_CLAW_WORKSPACE_DATA(t)
					: workspaceId === MY_SKILLS_WORKSPACE_ID
						? MY_SKILLS_WORKSPACE_DATA(t)
						: MY_AGENTS_WORKSPACE_DATA(t)
			const response = await loadResourceProjectPage({
				workspace,
				page,
				pageSize: RESOURCE_PROJECTS_PAGE_SIZE,
				keyword: keywordRef.current,
				agentScope: agentScopeRef.current,
			})
			const mapped = response.list
			if (requestId !== projectsRequestId.current) return
			setAvailableProjects((prev) => {
				if (!isLoadMore) return mapped
				const existingIds = new Set(prev.map((project) => project.id))
				return [...prev, ...mapped.filter((project) => !existingIds.has(project.id))]
			})
			setResourceProjectsPage(page)
			setHasMoreResourceProjects(page * RESOURCE_PROJECTS_PAGE_SIZE < response.total)
		} catch (error) {
			if (requestId !== projectsRequestId.current) return
			setLoadError(true)
			console.error("Failed to fetch personal resources:", error)
			magicToast.error(t("selectPathModal.fetchProjectsFailed"))
			if (!isLoadMore) {
				setAvailableProjects([])
				resetResourceProjectsPagination()
			}
		} finally {
			if (requestId === projectsRequestId.current) {
				if (isLoadMore) {
					loadingMoreResourcesRef.current = false
					setLoadingMoreResources(false)
				} else {
					setLoading(false)
				}
			}
		}
	})

	const handleLoadMoreResourceProjects = useMemoizedFn(async () => {
		if (!currentWorkspace) return
		if (currentWorkspace.workspace_type === "micro-app") {
			await fetchMicroAppProjects(resourceProjectsPage + 1)
			return
		}
		if (!RESOURCE_WORKSPACE_IDS.has(currentWorkspace.id)) return
		await fetchResourceProjects(currentWorkspace.id, resourceProjectsPage + 1)
	})

	const fetchMicroAppProjects = useMemoizedFn(async (page = 1) => {
		if (page > 1 && (loadingMoreResourcesRef.current || loading || !hasMoreResourceProjects))
			return
		const requestId = ++projectsRequestId.current
		setLoadError(false)
		if (page === 1) {
			resetResourceProjectsPagination()
			setLoading(true)
		} else {
			loadingMoreResourcesRef.current = true
			setLoadingMoreResources(true)
		}
		try {
			const workspace =
				microWorkspaceRef.current ?? (await SuperMagicApi.getMicroAppWorkspace())
			if (requestId !== projectsRequestId.current) return
			microWorkspaceRef.current = workspace
			const result = await loadResourceProjectPage({
				workspace,
				page,
				pageSize: RESOURCE_PROJECTS_PAGE_SIZE,
				keyword: keywordRef.current,
			})
			if (requestId !== projectsRequestId.current) return
			setAvailableProjects((previous) =>
				page === 1
					? result.list
					: [
							...previous,
							...result.list.filter(
								(item) => !previous.some((existing) => existing.id === item.id),
							),
						],
			)
			setResourceProjectsPage(page)
			setHasMoreResourceProjects(page * RESOURCE_PROJECTS_PAGE_SIZE < result.total)
		} catch (error) {
			if (requestId !== projectsRequestId.current) return
			setLoadError(true)
			magicToast.error(t("selectPathModal.fetchProjectsFailed"))
		} finally {
			if (requestId === projectsRequestId.current) {
				setLoading(false)
				loadingMoreResourcesRef.current = false
				setLoadingMoreResources(false)
			}
		}
	})

	// 获取工作区的项目列表
	const fetchProjectsByWorkspace = useMemoizedFn(async (workspaceId: string, keyword = "") => {
		sharedRequestRef.current?.abort()
		keywordRef.current = keyword
		if (
			isMentionMode &&
			(workspaceId === MICRO_APPS_WORKSPACE_ID ||
				workspaceId === microWorkspaceRef.current?.id)
		) {
			await fetchMicroAppProjects()
			return
		}
		if (RESOURCE_WORKSPACE_IDS.has(workspaceId)) {
			await fetchResourceProjects(workspaceId, 1)
			return
		}
		resetResourceProjectsPagination()
		if (workspaceId === SHARE_WORKSPACE_ID) {
			await fetchCollaborationProjects()
			return
		}

		const requestId = ++projectsRequestId.current
		setLoadError(false)
		setLoading(true)
		try {
			const res = await SuperMagicApi.getProjectsWithCollaboration({
				workspace_id: workspaceId,
				project_name: keyword,
				page: 1,
				page_size: 99,
			})
			if (requestId !== projectsRequestId.current) return
			setAvailableProjects(res?.list || [])
		} catch (error) {
			if (requestId !== projectsRequestId.current) return
			setLoadError(true)
			console.error("Failed to fetch projects:", error)
			magicToast.error(t("selectPathModal.fetchProjectsFailed"))
			setAvailableProjects([])
		}
		setLoading(false)
	})

	const resolveSelectionWorkspace = (workspace: Workspace): Workspace =>
		workspace.workspace_type === "micro-app" && microWorkspaceRef.current
			? { ...microWorkspaceRef.current, name: workspace.name }
			: workspace
	const changeAgentScope = useMemoizedFn((scope: AgentResourceScope) => {
		if (scope === agentScopeRef.current) return
		agentScopeRef.current = scope
		setAgentScope(scope)
		// 清空旧分类结果并立即使旧请求失效，搜索词和已选文件仍保留。
		setAvailableProjects([])
		void fetchResourceProjects(MY_AGENTS_WORKSPACE_ID)
	})
	return {
		agentScope,
		changeAgentScope,
		availableProjects,
		setAvailableProjects,
		loadingMoreResources,
		hasMoreResourceProjects,
		resetResourceProjectsPagination,
		fetchProjectsByWorkspace,
		handleLoadMoreResourceProjects,
		cancelProjectRequest,
		resolveSelectionWorkspace,
	}
}
