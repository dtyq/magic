import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import type { ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/opensource/apis"

export function useProjects() {
	const { t } = useTranslation("super/longMemory")
	const [projects, setProjects] = useState<ProjectListItem[]>([])
	const [loading, setLoading] = useState(false)
	const [hasMore, setHasMore] = useState(true)
	const [page, setPage] = useState(1)
	const [error, setError] = useState<string | null>(null)
	const [searchValue, setSearchValue] = useState<string>("")
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// 重置状态
	const reset = useCallback(() => {
		setProjects([])
		setPage(1)
		setHasMore(true)
		setError(null)
		setSearchValue("")
	}, [])

	// 加载项目数据
	const loadProjects = useCallback(
		async (currentPage: number, projectName?: string) => {
			try {
				setLoading(true)
				setError(null)

				const response = await SuperMagicApi.getProjects({
					page: currentPage,
					page_size: 20,
					project_name: projectName || undefined,
				})

				const newProjects = response.list || []

				setProjects((prev) => (currentPage === 1 ? newProjects : [...prev, ...newProjects]))
				setHasMore(newProjects.length === 20)
			} catch (err) {
				setError(err instanceof Error ? err.message : t("loadProjectFailed"))
			} finally {
				setLoading(false)
			}
		},
		[t],
	)

	// 加载更多
	const loadMore = useCallback(() => {
		if (!loading && hasMore) {
			const nextPage = page + 1
			setPage(nextPage)
			loadProjects(nextPage, searchValue || undefined)
		}
	}, [loading, hasMore, page, loadProjects, searchValue])

	// 搜索项目（带防抖）
	const searchProjects = useCallback(
		(projectName: string) => {
			// 清除之前的定时器
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current)
			}

			setSearchValue(projectName)

			// 如果搜索值为空，立即重置
			if (!projectName.trim()) {
				setPage(1)
				setProjects([])
				setHasMore(true)
				setError(null)
				loadProjects(1)
				return
			}

			// 防抖搜索
			searchTimeoutRef.current = setTimeout(() => {
				setPage(1)
				setProjects([])
				setHasMore(true)
				setError(null)
				loadProjects(1, projectName)
			}, 300)
		},
		[loadProjects],
	)

	// 清空搜索并重置
	const clearSearch = useCallback(() => {
		setSearchValue("")
		setPage(1)
		setProjects([])
		setHasMore(true)
		setError(null)
		loadProjects(1)
	}, [loadProjects])

	// 初始加载
	useEffect(() => {
		loadProjects(1)
	}, [loadProjects])

	// 将项目按工作区分组
	const groupedOptions = useMemo(() => {
		const workspaceMap = new Map<string, ProjectListItem[]>()

		// 按工作区分组
		projects.forEach((project) => {
			const workspaceName = project.workspace_name || t("unnamedWorkspace")
			if (!workspaceMap.has(workspaceName)) {
				workspaceMap.set(workspaceName, [])
			}
			const workspaceProjects = workspaceMap.get(workspaceName)
			if (workspaceProjects) {
				workspaceProjects.push(project)
			}
		})

		// 转换为Select组件需要的格式
		return Array.from(workspaceMap.entries()).map(([workspaceName, workspaceProjects]) => ({
			label: workspaceName,
			options: workspaceProjects.map((project) => ({
				label: project.project_name || t("unnamedProject"),
				value: project.id,
			})),
		}))
	}, [projects, t])

	return {
		projects,
		groupedOptions,
		loading,
		hasMore,
		error,
		loadMore,
		reset,
		searchValue,
		searchProjects,
		clearSearch,
	}
}
