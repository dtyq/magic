import { useCallback, useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

const PAGE_SIZE = 99

export function useProjects(workspaceId?: string) {
	const { t } = useTranslation("super")
	const [projects, setProjects] = useState<ProjectListItem[]>([])
	const [loading, setLoading] = useState(false)
	const [hasMore, setHasMore] = useState(true)
	const [page, setPage] = useState(1)
	const [error, setError] = useState<string | null>(null)
	const [searchValue, setSearchValue] = useState("")

	const reset = useCallback(() => {
		setProjects([])
		setPage(1)
		setHasMore(true)
		setError(null)
		setSearchValue("")
	}, [])

	const fetchProjects = useMemoizedFn(async (currentPage: number, projectName?: string) => {
		try {
			setLoading(true)
			setError(null)

			const response =
				workspaceId === SHARE_WORKSPACE_ID
					? await SuperMagicApi.getCollaborationProjects({
						page: currentPage,
						page_size: PAGE_SIZE,
						name: projectName || undefined,
					})
					: await SuperMagicApi.getProjects({
						workspace_id: workspaceId || undefined,
						page: currentPage,
						page_size: PAGE_SIZE,
						project_name: projectName || undefined,
					})

			const newProjects = response?.list || []
			setProjects((prevProjects) =>
				currentPage === 1 ? newProjects : [...prevProjects, ...newProjects],
			)
			setHasMore(newProjects.length === 20)
		} catch (currentError) {
			setError(currentError instanceof Error ? currentError.message : t("loadProjectFailed"))
		} finally {
			setLoading(false)
		}
	})

	const loadMore = useMemoizedFn(() => {
		if (loading || !hasMore) return
		const nextPage = page + 1
		setPage(nextPage)
		fetchProjects(nextPage, searchValue || undefined)
	})

	const searchProjects = useMemoizedFn((projectName: string) => {
		fetchProjects(1, projectName)
	})

	function clearSearch() {
		setSearchValue("")
		setPage(1)
		setProjects([])
		setHasMore(true)
		setError(null)
		fetchProjects(1)
	}

	useEffect(() => {
		if (workspaceId) fetchProjects(1)
	}, [fetchProjects, workspaceId])

	const projectOptions = useMemo(() => {
		return projects.map((project) => ({
			...project,
			label: project.project_name || t("project.unnamedProject"),
			value: project.id,
		}))
	}, [projects, t])

	const handleAddProject = useCallback(
		async (projectName: string) => {
			try {
				if (!workspaceId) {
					magicToast.error(t("project.pleaseSelectWorkspace"))
					return null
				}

				const response = await SuperMagicApi.createProject({
					workspace_id: workspaceId,
					project_name: projectName || "",
					project_description: "",
					project_mode: "",
				})

				if (response?.project) fetchProjects(1)
				return response.project
			} catch (currentError) {
				console.log("创建项目失败，失败原因：", currentError)
			}
		},
		[fetchProjects, t, workspaceId],
	)

	return {
		projects,
		projectOptions,
		loading,
		hasMore,
		error,
		loadMore,
		reset,
		searchValue,
		searchProjects,
		clearSearch,
		handleAddProject,
	}
}
