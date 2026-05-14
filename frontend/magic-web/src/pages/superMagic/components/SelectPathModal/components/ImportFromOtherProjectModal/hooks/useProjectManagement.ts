import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { TFunction } from "i18next"
import { SuperMagicApi, MagicClawApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type {
	ProjectListItem,
	CollaborationProjectListItem,
	ProjectStatus,
} from "../../../../../pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { SHARE_WORKSPACE_ID, MY_CLAW_WORKSPACE_ID } from "../../../../../constants"

interface UseProjectManagementOptions {
	t: TFunction<"super", undefined>
}

export function useProjectManagement(options: UseProjectManagementOptions) {
	const { t } = options

	const [currentSourceProject, setCurrentSourceProject] = useState<ProjectListItem | null>(null)
	const [availableProjects, setAvailableProjects] = useState<ProjectListItem[]>([])
	const [loading, setLoading] = useState(false)

	const getProjectDisplayName = useMemoizedFn((project: ProjectListItem) => {
		return project.project_name || t("project.unnamedProject")
	})

	// 获取龙虾项目列表
	const fetchMagicClawProjects = useMemoizedFn(async () => {
		setLoading(true)
		try {
			const res = await MagicClawApi.queryMagicClawList({
				page: 1,
				page_size: 100,
			})

			// @ts-ignore
			const clawProjects: ProjectListItem[] = (res?.list || []).map((claw) => ({
				id: claw.project_id,
				project_name: claw.name,
				project_description: claw.description || "",
				project_status: "waiting" as ProjectStatus,
				project_mode: "magiclaw" as TopicMode,
				workspace_id: MY_CLAW_WORKSPACE_ID,
				created_at: "",
				updated_at: "",
			}))

			setAvailableProjects(clawProjects)
		} catch (error) {
			console.error("Failed to fetch claw projects:", error)
			magicToast.error(t("selectPathModal.fetchClawsFailed"))
			setAvailableProjects([])
		}
		setLoading(false)
	})

	const fetchCollaborationProjects = useMemoizedFn(async () => {
		setLoading(true)
		try {
			const res = await SuperMagicApi.getCollaborationProjects({
				page: 1,
				page_size: 99,
			})
			const projects: ProjectListItem[] = (res?.list || []).map(
				(item: CollaborationProjectListItem) => ({
					...item,
					tag: "collaboration" as const,
				}),
			)
			setAvailableProjects(projects)
		} catch (error) {
			console.error("Failed to fetch collaboration projects:", error)
			magicToast.error(t("selectPathModal.fetchProjectsFailed"))
			setAvailableProjects([])
		}
		setLoading(false)
	})

	const fetchProjectsByWorkspace = useMemoizedFn(async (workspaceId: string) => {
		// 龙虾工作区：获取龙虾项目列表
		if (workspaceId === MY_CLAW_WORKSPACE_ID) {
			await fetchMagicClawProjects()
			return
		}

		// 共享工作区：获取协作项目列表
		if (workspaceId === SHARE_WORKSPACE_ID) {
			await fetchCollaborationProjects()
			return
		}

		// 普通工作区：获取工作区项目列表
		setLoading(true)
		try {
			const res = await SuperMagicApi.getProjectsWithCollaboration({
				workspace_id: workspaceId,
				page: 1,
				page_size: 99,
			})
			setAvailableProjects(res?.list || [])
		} catch (error) {
			console.error("Failed to fetch projects:", error)
			magicToast.error(t("selectPathModal.fetchProjectsFailed"))
			setAvailableProjects([])
		}
		setLoading(false)
	})

	const selectProject = useMemoizedFn((project: ProjectListItem) => {
		setCurrentSourceProject(project)
	})

	const clearProject = useMemoizedFn(() => {
		setCurrentSourceProject(null)
		setAvailableProjects([])
	})

	return {
		currentSourceProject,
		availableProjects,
		loading,
		getProjectDisplayName,
		fetchProjectsByWorkspace,
		selectProject,
		clearProject,
	}
}
