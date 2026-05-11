import { observer } from "mobx-react-lite"
import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useRequest } from "ahooks"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { ChevronRight, Folder, Box, UsersRound } from "lucide-react"
import { Switch } from "@/components/shadcn-ui/switch"
import { StepNavigation } from "../../../components"
import type { ProjectDocumentStore } from "../../../store"
import { workspaceStore, projectStore } from "@/pages/superMagic/stores/core"
import { cn } from "@/lib/utils"
import { SuperMagicApi } from "@/apis"
import FileSelector from "@/pages/superMagic/components/Share/FileSelector/FileSelector"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"

const WORKSPACE_LIST_DEFAULT_PX = 280
const WORKSPACE_LIST_MIN_PX = 200
const WORKSPACE_LIST_MAX_PX = 400
const WORKSPACE_LIST_WIDTH_KEY = "MAGIC:document-create-project-workspace-width"

const PROJECT_LIST_DEFAULT_PX = 280
const PROJECT_LIST_MIN_PX = 200
const PROJECT_LIST_MAX_PX = 400
const PROJECT_LIST_WIDTH_KEY = "MAGIC:document-create-project-list-width"

/**
 * ProjectSelectionStep组件Props
 */
export interface ProjectSelectionStepProps {
	store: ProjectDocumentStore
	onNext: () => void
	/** 下一步按钮文本 */
	nextText?: string
	/** 是否隐藏下一步按钮的箭头图标 */
	hideNextIcon?: boolean
	/** 是否显示加载状态 */
	nextLoading?: boolean
	/** 编辑中的文档 code：存在时表示仅改配置，可不重新选择项目/文件 */
	editDocumentCode?: string | null
}

/**
 * Project第1步：选择工作区、项目和文件
 * 三栏布局：Select Workspace → Select Project → Select File
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2278543
 */
export const ProjectSelectionStep = observer(function ProjectSelectionStep({
	store,
	onNext,
	nextText,
	hideNextIcon,
	nextLoading,
	editDocumentCode = null,
}: ProjectSelectionStepProps) {
	const { t } = useTranslation("crew/create")
	const containerRef = useRef<HTMLDivElement>(null)

	// 本地状态 - 从 store 初始化
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
		store.selectedWorkspaceId,
	)
	const [isSharedWorkspace, setIsSharedWorkspace] = useState(
		store.selectedWorkspaceId === "shared",
	)
	// 支持多项目选择
	const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
		store.selectedProjects.map((p) => p.projectId),
	)
	// 记录每个项目的 checkbox 状态（是否选择整个项目）
	const [projectCheckboxMap, setProjectCheckboxMap] = useState<Record<string, boolean>>(
		store.selectedProjects.reduce(
			(map, p) => ({ ...map, [p.projectId]: p.isWholeProjectSelected }),
			{},
		),
	)
	// 当前正在查看文件列表的项目（用于右侧第三栏显示）
	const [currentViewProjectId, setCurrentViewProjectId] = useState<string | null>(
		store.selectedProjects.length > 0 ? store.selectedProjects[0].projectId : null,
	)
	// 当前查看项目的文件选择
	const [selectedFileIds, setSelectedFileIds] = useState<string[]>(store.selectedFileIds)
	const [clampedWorkspaceWidth, setClampedWorkspaceWidth] = useState(WORKSPACE_LIST_DEFAULT_PX)
	const [clampedProjectWidth, setClampedProjectWidth] = useState(PROJECT_LIST_DEFAULT_PX)

	// 拖拽调整宽度
	const {
		width: workspaceWidthPx,
		isDragging: isDraggingWorkspace,
		handleMouseDown: onWorkspaceResizeStart,
	} = useResizablePanel({
		minWidth: WORKSPACE_LIST_MIN_PX,
		maxWidth: WORKSPACE_LIST_MAX_PX,
		defaultWidth: WORKSPACE_LIST_DEFAULT_PX,
		storageKey: WORKSPACE_LIST_WIDTH_KEY,
		direction: "left",
	})

	const {
		width: projectWidthPx,
		isDragging: isDraggingProject,
		handleMouseDown: onProjectResizeStart,
	} = useResizablePanel({
		minWidth: PROJECT_LIST_MIN_PX,
		maxWidth: PROJECT_LIST_MAX_PX,
		defaultWidth: PROJECT_LIST_DEFAULT_PX,
		storageKey: PROJECT_LIST_WIDTH_KEY,
		direction: "left",
	})

	// 同步 store 的状态到本地状态（用于回显）
	useEffect(() => {
		console.log("ProjectSelectionStep - 同步 store 状态到本地:", {
			selectedWorkspaceId: store.selectedWorkspaceId,
			selectedProjects: store.selectedProjects,
			currentLocalViewProjectId: currentViewProjectId,
		})

		setSelectedWorkspaceId(store.selectedWorkspaceId)
		setIsSharedWorkspace(store.selectedWorkspaceId === "shared")
		setSelectedProjectIds(store.selectedProjects.map((p) => p.projectId))
		setProjectCheckboxMap(
			store.selectedProjects.reduce(
				(map, p) => ({ ...map, [p.projectId]: p.isWholeProjectSelected }),
				{},
			),
		)
		// 如果有项目选择，设置第一个为当前查看的项目
		if (store.selectedProjects.length > 0) {
			// 如果当前没有查看的项目，或者当前查看的项目不在选中列表中，重置为第一个
			const currentProjectExists = store.selectedProjects.some(
				(p) => p.projectId === currentViewProjectId,
			)
			// 注意：只有在当前没有查看项目时才自动设置，如果当前查看的项目已被移除，保持不变（UI层面）
			if (!currentViewProjectId) {
				const firstProject = store.selectedProjects[0]
				console.log(
					"ProjectSelectionStep - 设置第一个项目为当前查看:",
					firstProject.projectId,
				)
				setCurrentViewProjectId(firstProject.projectId)
				// 立即更新文件选择
				setSelectedFileIds([...firstProject.selectedFileIds])

				// 如果该项目没有选择整个项目，且文件列表为空，立即加载文件
				if (!firstProject.isWholeProjectSelected && projectFiles.length === 0) {
					console.log("ProjectSelectionStep - 立即加载第一个项目的文件")
					loadProjectFiles(firstProject.projectId)
				}
			}
			// 如果当前查看的项目已被移除（数据层面），但我们保持UI层面的视图，所以不做任何操作
		}
		// 更新当前查看项目的文件选择
		const currentProject = store.selectedProjects.find(
			(p) => p.projectId === currentViewProjectId,
		)
		if (currentProject) {
			console.log(
				"ProjectSelectionStep - 更新当前项目的文件选择:",
				currentProject.selectedFileIds,
			)
			setSelectedFileIds([...currentProject.selectedFileIds])
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		store.selectedWorkspaceId,
		// 使用 JSON.stringify 来检测数组内容变化
		// eslint-disable-next-line react-hooks/exhaustive-deps
		JSON.stringify(store.selectedProjects.map((p) => p.projectId)),
		JSON.stringify(
			store.selectedProjects.map((p) => ({
				id: p.projectId,
				whole: p.isWholeProjectSelected,
				files: p.selectedFileIds,
			})),
		),
	])

	// 调试：监控 FileSelector 的 disabled 状态
	useEffect(() => {
		if (currentViewProjectId) {
			const isDisabled = projectCheckboxMap[currentViewProjectId]
			console.log("ProjectSelectionStep - FileSelector disabled 状态:", {
				currentViewProjectId,
				isDisabled,
				projectCheckboxMap,
			})
		}
	}, [currentViewProjectId, projectCheckboxMap])

	// 动态限制宽度，确保 File 列始终可见
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const updateWidths = () => {
			const containerWidth = container.clientWidth
			if (containerWidth <= 0) return

			const FILE_LIST_MIN = 400 // File 列最小宽度
			const RESIZE_HANDLE_WIDTH = 8 // 拖拽手柄宽度

			// 计算 Workspace 列的最大宽度
			let maxWorkspace = WORKSPACE_LIST_MAX_PX
			const hasCurrentProject = currentViewProjectId !== null
			const currentCheckbox = currentViewProjectId
				? projectCheckboxMap[currentViewProjectId]
				: false

			if (hasCurrentProject && !currentCheckbox) {
				// 三栏模式：Workspace + Project + File
				maxWorkspace = Math.min(
					WORKSPACE_LIST_MAX_PX,
					containerWidth - PROJECT_LIST_MIN_PX - FILE_LIST_MIN - RESIZE_HANDLE_WIDTH * 2,
				)
			} else if (selectedWorkspaceId) {
				// 两栏模式：Workspace + Project
				maxWorkspace = Math.min(
					WORKSPACE_LIST_MAX_PX,
					containerWidth - PROJECT_LIST_MIN_PX - RESIZE_HANDLE_WIDTH,
				)
			}
			maxWorkspace = Math.max(WORKSPACE_LIST_MIN_PX, maxWorkspace)
			const clampedWorkspace = Math.max(
				WORKSPACE_LIST_MIN_PX,
				Math.min(maxWorkspace, workspaceWidthPx),
			)
			setClampedWorkspaceWidth(clampedWorkspace)

			// 计算 Project 列的最大宽度
			if (selectedWorkspaceId) {
				let maxProject = PROJECT_LIST_MAX_PX
				if (hasCurrentProject && !currentCheckbox) {
					// 三栏模式
					maxProject = Math.min(
						PROJECT_LIST_MAX_PX,
						containerWidth - clampedWorkspace - FILE_LIST_MIN - RESIZE_HANDLE_WIDTH * 2,
					)
				}
				maxProject = Math.max(PROJECT_LIST_MIN_PX, maxProject)
				const clampedProject = Math.max(
					PROJECT_LIST_MIN_PX,
					Math.min(maxProject, projectWidthPx),
				)
				setClampedProjectWidth(clampedProject)
			}
		}

		updateWidths()

		const resizeObserver = new ResizeObserver(updateWidths)
		resizeObserver.observe(container)

		return () => resizeObserver.disconnect()
	}, [
		workspaceWidthPx,
		projectWidthPx,
		selectedWorkspaceId,
		currentViewProjectId,
		projectCheckboxMap,
	])

	// 初始化：从 store 恢复状态时，判断是否是共享工作区，并加载项目列表
	useEffect(() => {
		if (store.selectedWorkspaceId) {
			const isShared = store.selectedWorkspaceId === "shared"
			setIsSharedWorkspace(isShared)

			// 加载项目列表（如果是普通工作区且未加载）
			if (!isShared && !projectStore.hasLoadedWorkspace(store.selectedWorkspaceId)) {
				console.log(
					"ProjectSelectionStep - 触发加载工作区项目列表:",
					store.selectedWorkspaceId,
				)
				void projectStore.loadProjectsForWorkspace(store.selectedWorkspaceId)
			}
		}
		// 依赖 store.selectedWorkspaceId，确保在回显数据后能触发加载
	}, [store.selectedWorkspaceId])

	useEffect(() => {
		store.setConfigUpdateMode(Boolean(editDocumentCode))
	}, [editDocumentCode, store])

	// 初始化：从 store 恢复状态时，如果有选中的项目且未勾选整个项目，需要加载文件列表
	useEffect(() => {
		// console.log("ProjectSelectionStep - 检查是否需要加载文件列表:", {
		// 	currentViewProjectId,
		// 	projectFilesLength: projectFiles.length,
		// 	selectedProjects: store.selectedProjects,
		// 	selectedWorkspaceId: store.selectedWorkspaceId,
		// })

		// 如果有当前查看的项目，且该项目没有选择整个项目，需要加载文件列表
		if (currentViewProjectId && store.selectedWorkspaceId) {
			const currentProject = store.selectedProjects.find(
				(p) => p.projectId === currentViewProjectId,
			)
			// console.log("ProjectSelectionStep - 当前项目:", currentProject)

			// 只有在项目存在且没有选择整个项目时，才需要加载文件列表
			if (currentProject) {
				// 如果文件列表为空，或者当前文件列表不属于这个项目，就加载
				const needLoad = projectFiles.length === 0
				// console.log("ProjectSelectionStep - 是否需要加载文件列表:", needLoad)
				if (needLoad) {
					// console.log("ProjectSelectionStep - 开始加载项目文件:", currentViewProjectId)
					loadProjectFiles(currentViewProjectId)
				}
			} else if (!currentProject) {
				// 如果当前查看的项目不在选中列表中，说明需要重新同步
				// console.log("ProjectSelectionStep - 当前查看的项目不存在于选中列表，等待同步")
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentViewProjectId, store.selectedWorkspaceId, store.selectedProjects.length])

	// 获取workspaces - 直接从store读取，MobX自动追踪
	const workspaces = workspaceStore.workspaces

	// 当选中共享工作区时，异步加载共享项目
	const { data: sharedProjects = [] } = useRequest(
		async () => {
			if (!isSharedWorkspace || !selectedWorkspaceId) return []
			const res = await SuperMagicApi.getCollaborationProjects({
				page: 1,
				page_size: 99,
			})
			return res?.list || []
		},
		{
			refreshDeps: [selectedWorkspaceId, isSharedWorkspace],
			ready: isSharedWorkspace && !!selectedWorkspaceId,
		},
	)

	// 获取普通工作区的项目列表 - 直接从store读取，不使用useMemo，让MobX自动追踪
	const normalProjects =
		selectedWorkspaceId && !isSharedWorkspace
			? projectStore.getProjectsByWorkspace(selectedWorkspaceId)
			: []

	// 检查是否正在加载
	const isLoadingProjects =
		selectedWorkspaceId && !isSharedWorkspace
			? projectStore.isLoadingWorkspace(selectedWorkspaceId)
			: false

	// 最终显示的项目列表
	const displayProjects = isSharedWorkspace ? sharedProjects : normalProjects

	// 加载项目文件列表
	const {
		data: projectFiles = [],
		loading: filesLoading,
		run: loadProjectFiles,
		mutate: setProjectFiles,
	} = useRequest(
		async (projectId: string) => {
			const res = await SuperMagicApi.getAttachmentsByProjectId({
				projectId,
				temporaryToken:
					(window as Window & { temporary_token?: string }).temporary_token || "",
			})
			return res?.tree || []
		},
		{
			manual: true,
		},
	)

	// 当文件列表加载完成后，缓存所有文件节点到 store（用于构建 source_bindings）
	useEffect(() => {
		if (projectFiles.length > 0 && currentViewProjectId) {
			// 需要展平树结构来缓存所有节点
			const flattenFiles = (items: any[]): any[] => {
				const result: any[] = []
				const traverse = (nodes: any[]) => {
					nodes.forEach((node) => {
						result.push(node)
						if (node.children && node.children.length > 0) {
							traverse(node.children)
						}
					})
				}
				traverse(items)
				return result
			}

			store.cacheFileNodes(flattenFiles(projectFiles), currentViewProjectId)
		}
	}, [projectFiles, store, currentViewProjectId])

	/**
	 * 处理workspace选择（支持跨工作区选择项目）
	 */
	const handleWorkspaceClick = useMemoizedFn((workspaceId: string, isShared: boolean) => {
		setSelectedWorkspaceId(workspaceId)
		setIsSharedWorkspace(isShared)

		// 立即清空当前查看的项目和文件列表，避免显示错误的文件列表
		setCurrentViewProjectId(null)
		setSelectedFileIds([])
		setProjectFiles([]) // 清空文件列表数据

		// 切换工作区，但不清空已选择的项目（第三个参数传 false）
		const workspace = workspaces.find((w) => w.id === workspaceId)
		const workspaceName = isShared
			? t("documentCreate.project.sharedWorkspace")
			: workspace?.name || null
		store.setSelectedWorkspace(workspaceId, workspaceName, false)

		// 加载workspace的项目列表（非共享工作区）
		if (!isShared && !projectStore.hasLoadedWorkspace(workspaceId)) {
			projectStore.loadProjectsForWorkspace(workspaceId)
		}

		// 延迟设置当前查看的项目，等待项目列表加载完成
		setTimeout(() => {
			// 查找当前工作区中已选择的项目
			const currentWorkspaceProjects = store.selectedProjects.filter(
				(p) => p.workspaceId === workspaceId,
			)

			if (currentWorkspaceProjects.length > 0) {
				// 如果当前工作区有已选的项目，显示第一个项目的文件树
				const firstProject = currentWorkspaceProjects[0]
				setCurrentViewProjectId(firstProject.projectId)
				setSelectedFileIds([...firstProject.selectedFileIds])

				// 如果不是整个项目选择，需要加载文件列表
				if (!firstProject.isWholeProjectSelected) {
					loadProjectFiles(firstProject.projectId)
				}
			} else {
				setCurrentViewProjectId(null)
				setSelectedFileIds([])
				setProjectFiles([])
			}
			// 如果没有项目，currentViewProjectId 已经是 null，不需要额外处理
		}, 150) // 增加延迟时间，确保状态更新完成
	})

	/**
	 * 处理project点击（切换查看的项目）
	 */
	const handleProjectClick = useMemoizedFn((projectId: string) => {
		// 设置为当前查看的项目
		setCurrentViewProjectId(projectId)

		// 查找该项目在 store 中的信息
		const currentProject = store.selectedProjects.find((p) => p.projectId === projectId)
		if (currentProject) {
			// 如果项目已在 store 中（已选中），加载其文件选择状态
			setSelectedFileIds([...currentProject.selectedFileIds])
		} else {
			// 如果项目未选中，清空文件选择
			setSelectedFileIds([])
		}

		// 加载项目文件列表
		loadProjectFiles(projectId)
	})

	/**
	 * 处理project checkbox（选择整个项目）
	 */
	const handleProjectCheckbox = useMemoizedFn(
		(projectId: string, checked: boolean, e: React.MouseEvent) => {
			e.stopPropagation()

			const project = displayProjects.find((p) => p.id === projectId)
			const projectName = project?.project_name || null

			if (checked) {
				// 勾选整个项目
				const newCheckboxMap = { ...projectCheckboxMap, [projectId]: true }
				setProjectCheckboxMap(newCheckboxMap)

				// 添加到选择列表（如果还未添加）
				if (!selectedProjectIds.includes(projectId)) {
					setSelectedProjectIds([...selectedProjectIds, projectId])
				}

				// 设置为当前查看的项目
				setCurrentViewProjectId(projectId)
				setSelectedFileIds([])

				// 更新 store
				store.setSelectedProject(projectId, true, projectName)
			} else {
				// 取消勾选整个项目：
				// - 数据层面：从选中列表移除（不传给后端）
				// - UI层面：保持文件预览视图，但取消disabled状态
				console.log("ProjectSelectionStep - 取消勾选整个项目:", {
					projectId,
					currentProjectCheckboxMap: projectCheckboxMap,
					currentViewProjectId,
				})

				const newCheckboxMap = { ...projectCheckboxMap }
				delete newCheckboxMap[projectId]
				setProjectCheckboxMap(newCheckboxMap)

				// 从选择列表中移除（数据层面）
				const newSelectedIds = selectedProjectIds.filter((id) => id !== projectId)
				setSelectedProjectIds(newSelectedIds)

				// 从 store 中移除（不传给后端）
				store.removeProject(projectId)

				// UI层面：如果是当前查看的项目，清空文件选择
				// 避免文件选择导致项目重新被添加回 store
				if (currentViewProjectId === projectId) {
					console.log("ProjectSelectionStep - 清空文件选择，避免重新添加")
					setSelectedFileIds([])

					// 如果文件列表还没加载，加载它（用户可以重新选择文件）
					if (projectFiles.length === 0) {
						loadProjectFiles(projectId)
					}
				}
			}
		},
	)

	/**
	 * 处理文件选择变化（针对当前查看的项目）
	 */
	const handleFileSelectionChange = useMemoizedFn((fileIds: string[], files: any[]) => {
		if (!currentViewProjectId) return

		console.log("ProjectSelectionStep - 文件选择变化:", {
			currentViewProjectId,
			fileIds,
			projectInStore: store.selectedProjects.some(
				(p) => p.projectId === currentViewProjectId,
			),
		})

		setSelectedFileIds(fileIds)

		// 如果选择了文件，需要确保项目在 store 中
		if (fileIds.length > 0) {
			// 如果项目不在 store 中，重新添加项目
			const projectInStore = store.selectedProjects.some(
				(p) => p.projectId === currentViewProjectId,
			)
			if (!projectInStore) {
				console.log("ProjectSelectionStep - 项目不在 store 中，重新添加")
				// 获取 project 名称
				const project = displayProjects.find((p) => p.id === currentViewProjectId)
				const projectName = project?.project_name || null
				// 添加项目到 store，isWholeProjectSelected = false
				store.setSelectedProject(currentViewProjectId, false, projectName)
				// 同时更新本地状态
				if (!selectedProjectIds.includes(currentViewProjectId)) {
					setSelectedProjectIds([...selectedProjectIds, currentViewProjectId])
				}
			}

			store.setSelectedFiles(fileIds, currentViewProjectId)
			// 缓存文件节点信息，用于构建 source_bindings 时区分文件和文件夹类型
			store.cacheFileNodes(files, currentViewProjectId)

			// 取消当前项目的整个项目选择
			if (projectCheckboxMap[currentViewProjectId]) {
				const newCheckboxMap = { ...projectCheckboxMap }
				delete newCheckboxMap[currentViewProjectId]
				setProjectCheckboxMap(newCheckboxMap)
			}
		} else {
			// 如果取消了所有文件选择，且没有勾选整个项目，则从 store 移除
			// 避免 targets 变成空数组（后端会识别为全选）
			if (!projectCheckboxMap[currentViewProjectId]) {
				console.log(
					"ProjectSelectionStep - 文件为空且未全选，从 store 移除项目",
					currentViewProjectId,
				)
				store.removeProject(currentViewProjectId)
				setSelectedProjectIds(
					selectedProjectIds.filter((id) => id !== currentViewProjectId),
				)
			} else {
				// 如果勾选了整个项目，更新文件列表为空（保持全选状态）
				store.setSelectedFiles(fileIds, currentViewProjectId)
			}
		}
	})

	// 不可 useMemo 缓存：store 引用不变时 MobX 已更新 selectedFileIds，memo 会得不到新结果
	const canGoNext = store.canGoNext(1)

	return (
		<div className="flex h-full flex-col">
			{/* 三栏布局容器 */}
			<div
				ref={containerRef}
				className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border"
			>
				{/* 第一栏：Select Workspace */}
				<div
					className="flex shrink-0 flex-col bg-background"
					style={{
						width: selectedWorkspaceId ? clampedWorkspaceWidth : undefined,
						flex: selectedWorkspaceId ? undefined : 1,
						minWidth: 0,
						willChange: isDraggingWorkspace ? "width" : undefined,
						transition: isDraggingWorkspace ? "none" : "width 0.2s ease",
					}}
				>
					<div
						className={cn(
							"shrink-0 border-b border-border px-4 py-3",
							selectedWorkspaceId && "border-r",
						)}
					>
						<div className="text-sm font-medium">
							{t("documentCreate.project.selectWorkspace")}
						</div>
					</div>
					<div
						className={cn(
							"relative flex min-h-0 flex-1 flex-col overflow-hidden",
							selectedWorkspaceId && "border-r border-border",
						)}
					>
						<ScrollArea className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block">
							<div className="space-y-1 p-2">
								{/* 普通工作区 */}
								{workspaces.map((workspace) => (
									<div
										key={workspace.id}
										className={cn(
											"flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent",
											selectedWorkspaceId === workspace.id &&
												!isSharedWorkspace &&
												"bg-accent",
										)}
										onClick={() => handleWorkspaceClick(workspace.id, false)}
									>
										<Box className="size-4 shrink-0 text-muted-foreground" />
										<span className="flex-1 truncate text-sm">
											{workspace.name ||
												t("super:workspace.unnamedWorkspace")}
										</span>
										<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
									</div>
								))}
							</div>
						</ScrollArea>

						{/* 共享工作区 - 固定在底部 */}
						<div className="shrink-0 cursor-pointer border-t border-border bg-background p-1">
							<div
								className={cn(
									"flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent",
									isSharedWorkspace && "bg-accent",
								)}
								onClick={() => handleWorkspaceClick("shared", true)}
							>
								<UsersRound className="size-4 shrink-0 text-muted-foreground" />
								<span className="flex-1 truncate text-sm">
									{t("documentCreate.project.sharedWorkspace")}
								</span>
								<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
							</div>
						</div>

						{/* Workspace 拖拽手柄 - 绝对定位在右侧 */}
						{selectedWorkspaceId && (
							<div
								className="absolute right-0 top-0 h-full"
								style={{ pointerEvents: "none" }}
							>
								<div style={{ pointerEvents: "auto", height: "100%" }}>
									<TopicResizeHandle
										onMouseDown={onWorkspaceResizeStart}
										className={cn(
											"h-full shrink-0",
											isDraggingWorkspace && "before:opacity-100",
										)}
									/>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 第二栏：Select Project（选中workspace后显示） */}
				{selectedWorkspaceId && (
					<div
						className="flex shrink-0 flex-col bg-background"
						style={{
							width: currentViewProjectId ? clampedProjectWidth : undefined,
							flex: currentViewProjectId ? undefined : 1,
							minWidth: 0,
							willChange: isDraggingProject ? "width" : undefined,
							transition: isDraggingProject ? "none" : "width 0.2s ease",
						}}
					>
						<div
							className={cn(
								"shrink-0 border-b border-border px-4 py-3",
								currentViewProjectId && "border-r",
							)}
						>
							<div className="text-sm font-medium">
								{t("documentCreate.project.selectProject")}
							</div>
						</div>
						<div
							className={cn(
								"relative flex min-h-0 flex-1 overflow-hidden",
								currentViewProjectId && "border-r border-border",
							)}
						>
							<ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block">
								{isLoadingProjects ? (
									<div className="flex items-center justify-center py-8">
										<Spinner className="animate-spin" size={16} />
									</div>
								) : displayProjects.length === 0 ? (
									<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
										{t("documentCreate.common.emptyState")}
									</div>
								) : (
									<div className="space-y-1 p-2">
										{displayProjects.map((project) => {
											const isWholeProject =
												projectCheckboxMap[project.id] || false
											const isCurrentView =
												currentViewProjectId === project.id

											// 判断是否处于半选状态：项目在选中列表中但没有选中整个项目
											const projectSelection = store.selectedProjects.find(
												(p) => p.projectId === project.id,
											)
											const hasSelectedFiles =
												projectSelection &&
												projectSelection.selectedFileIds.length > 0 &&
												!projectSelection.isWholeProjectSelected

											// 计算 Checkbox 状态
											const checkboxState = isWholeProject
												? true
												: hasSelectedFiles
													? "indeterminate"
													: false

											return (
												<div
													key={project.id}
													className={cn(
														"group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent",
														isCurrentView && "bg-accent",
													)}
													onClick={() => handleProjectClick(project.id)}
												>
													<Checkbox
														checked={checkboxState}
														onClick={(e: React.MouseEvent) =>
															handleProjectCheckbox(
																project.id,
																!isWholeProject,
																e,
															)
														}
														className="shrink-0"
													/>
													<Folder className="size-4 shrink-0 text-muted-foreground" />
													<span className="flex-1 truncate text-sm">
														{project.project_name ||
															t("super:project.unnamedProject")}
													</span>
													<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
												</div>
											)
										})}
									</div>
								)}
							</ScrollArea>

							{/* Project 拖拽手柄 - 绝对定位在右侧 */}
							{currentViewProjectId && (
								<div
									className="absolute right-0 top-0 h-full"
									style={{ pointerEvents: "none" }}
								>
									<div style={{ pointerEvents: "auto", height: "100%" }}>
										<TopicResizeHandle
											onMouseDown={onProjectResizeStart}
											className={cn(
												"h-full shrink-0",
												isDraggingProject && "before:opacity-100",
											)}
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* 第三栏：Select File（选中project时显示） */}
				{currentViewProjectId && (
					<div className="flex flex-1 flex-col bg-background">
						<div className="shrink-0 border-b border-border px-4 py-3">
							<div className="text-sm font-medium">
								{t("documentCreate.project.selectFile")}
							</div>
						</div>
						{filesLoading ? (
							<div className="flex flex-1 items-center justify-center">
								<Spinner className="animate-spin" size={16} />
							</div>
						) : projectFiles.length === 0 ? (
							<div className="flex flex-1 items-center justify-center">
								<div className="text-sm text-muted-foreground">
									{t("documentCreate.common.emptyState")}
								</div>
							</div>
						) : (
							<div className="flex-1 overflow-hidden">
								<FileSelector
									key={currentViewProjectId} // 确保不同项目使用不同的组件实例
									attachments={projectFiles}
									selectedFileIds={selectedFileIds}
									onSelectionChange={handleFileSelectionChange}
									disabled={
										currentViewProjectId
											? projectCheckboxMap[currentViewProjectId]
											: false
									}
									supportedFileExtensions={[
										"txt",
										"md",
										"html",
										"htm",
										"xml",
										"json",
										"csv",
										"xlsx",
										"xlsm",
										"docx",
										"pptx",
										"pdf",
										"jpg",
										"jpeg",
										"png",
										"bmp",
									]}
									allowSetDefaultOpen={false}
									allowEmptySelection={true}
									showSelectAll={
										!currentViewProjectId ||
										!projectCheckboxMap[currentViewProjectId]
									}
									className={`!w-full !border-r-0 ${currentViewProjectId && projectCheckboxMap[currentViewProjectId] ? "opacity-50" : ""}`}
								/>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Real-time Updates 配置 */}
			<div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3">
				<Switch
					checked={store.enableRealtimeUpdates}
					onCheckedChange={(checked) => store.setEnableRealtimeUpdates(checked)}
				/>
				<div className="flex flex-1 flex-col gap-1">
					<div className="text-sm font-medium">
						{t("documentCreate.project.realtimeUpdates")}
					</div>
					<div className="text-xs text-muted-foreground">
						{t("documentCreate.project.realtimeUpdatesDescription")}
					</div>
				</div>
			</div>

			{/* 底部导航 */}
			<div className="shrink-0 px-8 py-8">
				<StepNavigation
					showPrevious={false}
					onNext={onNext}
					nextDisabled={!canGoNext}
					nextText={nextText}
					hideNextIcon={hideNextIcon}
					nextLoading={nextLoading}
				/>
			</div>
		</div>
	)
})
