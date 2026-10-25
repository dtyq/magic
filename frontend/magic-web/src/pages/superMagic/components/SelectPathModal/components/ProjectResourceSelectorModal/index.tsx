import {
	resolveFilePresentation,
	getFilePresentationIndex,
} from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import React, { useState, useMemo, useEffect, useRef } from "react"
import { Checkbox, Dropdown, Menu } from "antd"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import {
	IconCheck,
	IconChevronRight,
	IconDots,
	IconLock,
	IconFolderPlus,
	IconSearch,
	IconX,
	IconFolder,
	IconFileSearch,
} from "@tabler/icons-react"
import { Bot, Box, Loader2, UsersRound, Wrench } from "lucide-react"
import { isEmpty, last } from "lodash-es"
import { useTranslation } from "react-i18next"
import { useMatch } from "react-router"

import { cn } from "@/utils/cn"
import { RoutePath } from "@/constants/routes"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import BaseModal from "../BaseModal"
import MagicModal from "@/components/base/MagicModal"
import MobileFilesMoveSheet from "../SelectDirectoryModal/MobileFilesMoveSheet"
import MagicSpin from "@/components/base/MagicSpin"
import { SuperMagicApi } from "@/apis"
import { AttachmentItem } from "../../../TopicFilesButton/hooks"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import EmptyFilesIcon from "@/pages/superMagic/assets/svg/empty-files.svg"
import { InputWithError } from "@/pages/superMagic/components/TopicFilesButton/components"
import IconProject from "../../../icons/IconProject"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"

import type {
	ProjectResourceSelection,
	ProjectResourceSelectorModalProps,
	ViewMode,
} from "../../types"
import { MAX_MENTION_PROJECT_COUNT } from "../../types"
import type { BreadcrumbItem } from "../../utils/breadcrumbUtils"
import type { Workspace, ProjectListItem } from "../../../../pages/Workspace/types"
import {
	SHARE_WORKSPACE_ID,
	SHARE_WORKSPACE_DATA,
	MY_CLAW_WORKSPACE_ID,
	MY_CLAW_WORKSPACE_DATA,
	MY_SKILLS_WORKSPACE_ID,
	MY_AGENTS_WORKSPACE_ID,
	MY_SKILLS_WORKSPACE_DATA,
	MY_AGENTS_WORKSPACE_DATA,
	isCollaborationWorkspace,
} from "../../../../constants"
import { MagiClaw } from "@/enhance/lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import {
	getItemName,
	getItemId,
	getDirectoriesFromPath,
	searchInAttachments,
	hasEditPermission,
	collectSelectedFolderIds,
} from "../../utils/attachmentUtils"
import { calculateBreadcrumbDisplayItems } from "../../utils/breadcrumbUtils"
import { useCreateDirectory } from "../../hooks/useCreateDirectory"
import { useCreateWorkspace } from "../../hooks/useCreateWorkspace"
import { useCreateProject } from "../../hooks/useCreateProject"
import magicToast from "@/components/base/MagicToaster/utils"
import { loadProjectAttachments } from "@/pages/superMagic/services"
import { useSingleDocumentStaticDependencies } from "@/pages/superMagic/hooks/useSingleDocumentStaticDependencies"
import { MentionDesktopPicker } from "./MentionDesktopPicker"
import { AgentResourceScopeSwitch } from "./AgentResourceScopeSwitch"
import {
	DestinationCreationDialog,
	type DestinationCreationOptions,
} from "./DestinationCreationDialog"
import { buildAttachmentIndex } from "../../../TopicFilesButton/utils/attachmentIndex"
import { useResourceProjects, RESOURCE_WORKSPACE_IDS } from "./useResourceProjects"
import type { ResourceProject } from "../../resourceProjectTypes"
import type { FileManagerCheckChange } from "../../../TopicFilesButton/components/FileManager/types"

const FIXED_WORKSPACE_IDS = new Set<string>([SHARE_WORKSPACE_ID, MY_CLAW_WORKSPACE_ID])

function EmptyStateBox({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
			<div className="flex h-[320px] w-full flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-card p-6">
				{children}
			</div>
		</div>
	)
}

function isFixedWorkspace(workspace: Workspace) {
	return FIXED_WORKSPACE_IDS.has(workspace.id)
}

function renderWorkspaceIcon(workspaceId: string) {
	if (workspaceId === MY_SKILLS_WORKSPACE_ID) return <Wrench className="size-4 text-current" />
	if (workspaceId === MY_AGENTS_WORKSPACE_ID) return <Bot className="size-4 text-current" />
	if (workspaceId === SHARE_WORKSPACE_ID) return <UsersRound className="size-4 text-current" />
	if (workspaceId === MY_CLAW_WORKSPACE_ID)
		return <MagiClaw className="size-4 text-current" strokeWidth={1.25} />
	return <Box className="size-4 text-current" />
}

function ProjectResourceSelectorModal({
	visible,
	title,
	operationType,
	selectedWorkspace,
	selectedProject,
	workspaces,
	fileIds,
	sourceAttachments,
	sourceAttachmentsLoading = false,
	initialPath = [],
	includeFixedWorkspaces = true,
	closeOnSubmit = true,
	allowWorkspaceRootSubmit = false,
	defaultProjectName,
	selectionMode = "destination",
	excludeProjectIds = [],
	emptyDirectoryDescription,
	emptyDirectoryActionLabel,
	submitting: externalSubmitting = false,
	onClose,
	onSubmit,
}: ProjectResourceSelectorModalProps) {
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")
	const [includeDocumentDependencies, setIncludeDocumentDependencies] = useState(true)
	const documentStaticDependencies = useSingleDocumentStaticDependencies({
		active: visible,
		fileIds,
		attachments: sourceAttachments,
	})
	const selectedFileIdForDependencyReset = fileIds.length === 1 ? fileIds[0] : ""

	useEffect(() => {
		if (visible) setIncludeDocumentDependencies(true)
	}, [visible, selectedFileIdForDependencyReset])

	// 判断是否为龙虾场景
	// 实际路由格式: /:clusterCode/claw/:code (例如: /global/claw/MC-xxx)
	const clawMatch = useMatch({
		path: `/:clusterCode${RoutePath.ClawPlayground}`,
		end: false,
	})
	const isClawContext = !!clawMatch

	// 获取龙虾项目ID
	const clawProjectId = useMemo(() => {
		if (!isClawContext) return null
		// 从 sourceAttachments 中提取 project_id（所有文件的 project_id 应该相同）
		return sourceAttachments[0]?.project_id || null
	}, [isClawContext, sourceAttachments])

	const isProjectOnly =
		operationType === "move" && fileIds.length === 0 && sourceAttachments.length === 0

	// 视图状态：workspace -> project -> directory
	const [viewMode, setViewMode] = useState<ViewMode>("workspace")
	const effectiveViewMode = isProjectOnly && viewMode === "directory" ? "project" : viewMode
	const [loading, setLoading] = useState(false)
	const [loadError, setLoadError] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const submittingRef = useRef(false)
	const submitEpochRef = useRef(0)
	const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
	const [currentProject, setCurrentProject] = useState<ProjectListItem | null>(null)
	const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>(workspaces)
	const [attachments, setAttachments] = useState<AttachmentItem[]>([])
	const [path, setPath] = useState<AttachmentItem[]>(initialPath)
	const [directories, setDirectories] = useState<AttachmentItem[]>([])
	const [selectedResources, setSelectedResources] = useState<ProjectResourceSelection[]>([])
	const isMentionMode = selectionMode === "mention"
	const isResourceSelectionMode = isMentionMode || selectionMode === "import"
	const isDesktopDestination = !isMobile && !isProjectOnly && !isResourceSelectionMode
	const allowProjectSelection = isMentionMode
	const {
		availableProjects,
		agentScope,
		changeAgentScope,
		setAvailableProjects,
		loadingMoreResources,
		hasMoreResourceProjects,
		resetResourceProjectsPagination,
		fetchProjectsByWorkspace,
		handleLoadMoreResourceProjects,
		cancelProjectRequest,
		resolveSelectionWorkspace,
	} = useResourceProjects({
		visible,
		isMentionMode: isResourceSelectionMode,
		currentWorkspace,
		loading,
		setLoading,
		setLoadError,
	})
	const handleProjectSearch = useMemoizedFn((keyword: string) => {
		if (currentWorkspace && !currentProject)
			void fetchProjectsByWorkspace(currentWorkspace.id, keyword)
	})
	// This option only applies to multi-file transfers into another project; same-project
	// operations retain their existing flat target-directory semantics.
	const showPreserveParentPathOption =
		!isResourceSelectionMode &&
		fileIds.length > 1 &&
		currentProject !== null &&
		currentProject.id !== (selectedProject?.id || sourceAttachments[0]?.project_id)
	const confirmPreserveParentPath = useMemoizedFn(
		() =>
			new Promise<boolean | null>((resolve) => {
				let shouldPreserveParentPath = false
				MagicModal.confirm({
					title: t("selectPathModal.preserveParentPathConfirmTitle"),
					content: (
						<div className="flex flex-col gap-3">
							<div className="text-sm leading-5 text-muted-foreground">
								{t("selectPathModal.preserveParentPathDescription")}
							</div>
							<label
								className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
								data-testid="cross-project-file-preserve-parent-path-option"
							>
								<Checkbox
									onChange={(event) => {
										shouldPreserveParentPath = event.target.checked
									}}
								/>
								<span>{t("selectPathModal.preserveParentPath")}</span>
							</label>
						</div>
					),
					okText: t("selectPathModal.confirm"),
					cancelText: t("common.cancel"),
					maskClosable: false,
					onOk: () => resolve(shouldPreserveParentPath),
					onCancel: () => resolve(null),
				})
			}),
	)
	const [isSearch, setIsSearch] = useState(false)
	const [fileName, setFileName] = useState("")
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const pathRef = useRef<AttachmentItem[]>(initialPath)
	pathRef.current = path
	// 用于跟踪是否已经初始化，避免重复加载
	const initializedRef = useRef(false)
	const attachmentRequestRef = useRef<{
		controller: AbortController
		requestId: number
	} | null>(null)
	const attachmentRequestIdRef = useRef(0)
	const beginAttachmentRequest = useMemoizedFn(() => {
		attachmentRequestRef.current?.controller.abort()
		const controller = new AbortController()
		const requestId = ++attachmentRequestIdRef.current
		attachmentRequestRef.current = { controller, requestId }
		return { controller, requestId }
	})
	const isCurrentProjectTarget = Boolean(
		selectedProject?.id && currentProject?.id === selectedProject.id,
	)
	// 面包屑容器宽度，用于动态计算可显示的项
	const breadcrumbRef = useRef<HTMLDivElement>(null)
	const [breadcrumbContainerWidth, setBreadcrumbContainerWidth] = useState(0)
	const getSelectionKey = useMemoizedFn((selection: ProjectResourceSelection) => {
		if (selection.level === "project") return `project:${selection.project.id}`
		return `attachment:${selection.project.id}:${getItemId(selection.attachment)}`
	})
	const toggleMentionSelection = useMemoizedFn((selection: ProjectResourceSelection) => {
		const selectionKey = getSelectionKey(selection)
		const existingIndex = selectedResources.findIndex(
			(item) => getSelectionKey(item) === selectionKey,
		)
		if (existingIndex >= 0) {
			setSelectedResources((previous) =>
				previous.filter((_, index) => index !== existingIndex),
			)
			return
		}

		const selectedProjectIds = new Set(selectedResources.map((item) => item.project.id))
		if (
			!selectedProjectIds.has(selection.project.id) &&
			selectedProjectIds.size >= MAX_MENTION_PROJECT_COUNT
		) {
			magicToast.info(t("selectPathModal.mentionProjectLimit"))
			return
		}

		setSelectedResources((previous) => [...previous, selection])
	})
	useEffect(() => {
		if (isProjectOnly && viewMode === "directory") {
			setViewMode("project")
		}
	}, [isProjectOnly, viewMode])

	// 计算禁用的文件夹ID列表（仅移动操作时不能移动到当前路径或子路径，复制操作允许）
	const disabledFolderIds = useMemo(() => {
		if (operationType === "move") {
			return collectSelectedFolderIds(sourceAttachments, fileIds)
		}
		return [] // 复制操作不限制
	}, [sourceAttachments, fileIds, operationType])
	const disabledFolderIdSet = useMemo(() => new Set(disabledFolderIds), [disabledFolderIds])
	const attachmentIndex = useMemo(() => buildAttachmentIndex(attachments), [attachments])
	const handleTargetDirectoryChange = useMemoizedFn((directoryId: string) => {
		const directory = directoryId ? attachmentIndex.getItemById(directoryId) : undefined
		if (directoryId && (!directory?.is_directory || disabledFolderIdSet.has(directoryId)))
			return
		// 根目录提交空路径；子目录必须携带完整祖先，供复制准备与父路径处理复用。
		const nextPath = directory
			? [...attachmentIndex.getParentItemsById(directoryId), directory].filter(
					(item) => item.is_directory && getItemId(item),
				)
			: []
		if (
			path.length === nextPath.length &&
			path.every((item, index) => getItemId(item) === getItemId(nextPath[index]))
		)
			return
		pathRef.current = nextPath
		setPath(nextPath)
		setDirectories(filesSort(getDirectoriesFromPath(attachments, nextPath)))
	})

	// Check whether creation is allowed at the current location.
	const canEdit = useMemo(() => {
		if (effectiveViewMode === "directory" && currentProject) {
			// Shared workspaces are read-only in this selector.
			return (
				!isCollaborationWorkspace(currentWorkspace) &&
				hasEditPermission(currentProject.user_role)
			)
		} else if (effectiveViewMode === "project" && currentWorkspace) {
			// Only regular workspaces allow creating projects.
			return !isCollaborationWorkspace(currentWorkspace)
		} else if (effectiveViewMode === "workspace") {
			// Workspace view allows creating workspaces.
			return true
		}
		return false
	}, [effectiveViewMode, currentProject, currentWorkspace])

	// Mention 只要求可见权限；移动/复制目标仍要求编辑权限。
	const editableProjects = useMemo(() => {
		return availableProjects.filter(
			(project) =>
				!excludeProjectIds.includes(project.id) &&
				(isResourceSelectionMode || hasEditPermission(project.user_role)),
		)
	}, [availableProjects, excludeProjectIds, isResourceSelectionMode])
	const shouldBlockPanelForLoading =
		loading &&
		((effectiveViewMode === "workspace" && availableWorkspaces.length === 0) ||
			(effectiveViewMode === "project" && editableProjects.length === 0) ||
			(effectiveViewMode === "directory" && directories.length === 0))

	// 获取工作区的显示名称（用于搜索匹配）
	const getWorkspaceDisplayName = useMemoizedFn((workspace: Workspace) => {
		if (workspace.id === SHARE_WORKSPACE_ID) {
			return t("workspace.shareWorkspaceName")
		}
		if (workspace.id === MY_CLAW_WORKSPACE_ID) {
			return t("workspace.myClawWorkspaceName")
		}
		return workspace.name || t("workspace.unnamedWorkspace")
	})

	// 获取项目的显示名称（用于搜索匹配）
	const getProjectDisplayName = useMemoizedFn((project: ProjectListItem) => {
		return project.project_name || t("project.unnamedProject")
	})

	// 工作区选择处理
	const handleWorkspaceClick = useMemoizedFn(async (workspace: Workspace) => {
		attachmentRequestRef.current?.controller.abort()
		setAvailableProjects([])
		setCurrentWorkspace(workspace)
		setViewMode("project")
		setCurrentProject(null)
		setPath([])
		setAttachments([])
		setDirectories([])
		setIsSearch(false)
		setIsSearchOpen(false)
		setFileName("")
		createDirectoryHook.cancelCreateDirectory()
		createWorkspaceHook.cancelCreateWorkspace()
		createProjectHook.cancelCreateProject()
		await fetchProjectsByWorkspace(workspace.id)
	})

	// 刷新工作区列表
	const refreshWorkspaces = useMemoizedFn(async () => {
		try {
			const res = await SuperMagicApi.getWorkspaces({
				page: 1,
				page_size: 999,
			})
			const refreshedWorkspaces = res?.list || []
			const nextWorkspaces = includeFixedWorkspaces
				? refreshedWorkspaces
				: refreshedWorkspaces.filter((workspace: Workspace) => !isFixedWorkspace(workspace))
			// 更新内部工作区列表状态
			setAvailableWorkspaces(nextWorkspaces)
			return nextWorkspaces
		} catch (error) {
			console.error("Failed to refresh workspaces:", error)
			return []
		}
	})

	// 返回工作区列表
	const handleBackToWorkspace = useMemoizedFn(() => {
		setViewMode("workspace")
		setCurrentWorkspace(null)
		setCurrentProject(null)
		setAvailableProjects([])
		resetResourceProjectsPagination()
		setAttachments([])
		setPath([])
		setDirectories([])
		setIsSearch(false)
		setIsSearchOpen(false)
		setFileName("")
		// 刷新工作区列表以确保显示最新数据
		refreshWorkspaces()
		createDirectoryHook.cancelCreateDirectory()
		createWorkspaceHook.cancelCreateWorkspace()
		createProjectHook.cancelCreateProject()
	})

	// 新建工作区 hook
	const createWorkspaceHook = useCreateWorkspace({
		workspaces: availableWorkspaces,
		onWorkspaceCreated: async (workspace: Workspace) => {
			// 刷新工作区列表，找到完整的工作区信息
			const refreshedWorkspaces = await refreshWorkspaces()
			// 从刷新后的列表中找到新创建的工作区
			const foundWorkspace =
				refreshedWorkspaces.find((w: Workspace) => w.id === workspace.id) || workspace

			// 自动选中新创建的工作区并进入项目视图
			await handleWorkspaceClick(foundWorkspace)
		},
		onWorkspacesRefresh: async () => {
			// 刷新工作区列表
			await refreshWorkspaces()
		},
	})

	// 新建项目 hook
	const createProjectHook = useCreateProject({
		workspaceId: currentWorkspace?.id || "",
		projects: availableProjects,
		defaultProjectName,
		onProjectCreated: async (project: ProjectListItem) => {
			// 自动选中新创建的项目并进入目录视图
			await handleProjectClick(project)
		},
		onProjectsRefresh: async () => {
			// 刷新项目列表
			if (currentWorkspace) {
				await fetchProjectsByWorkspace(currentWorkspace.id)
			}
		},
	})
	const { run: submitCreateProjectDebounced } = useDebounceFn(
		async () => {
			await createProjectHook.submitCreateProject()
		},
		{ wait: 400 },
	)

	// 更新 attachments 数据，将新创建的文件夹添加到父级的 children 中
	const updateAttachmentsWithNewDirectory = useMemoizedFn(
		(newDirectory: AttachmentItem, parentPath: AttachmentItem[]) => {
			const updateAttachments = (items: AttachmentItem[]): AttachmentItem[] => {
				return items.map((item) => {
					// 如果当前项是父级目录
					if (parentPath.length === 0) {
						// 根目录，直接添加新文件夹
						return item
					}

					const parentId = getItemId(parentPath[parentPath.length - 1])
					if (getItemId(item) === parentId) {
						// 找到父级目录，添加新文件夹到 children
						return {
							...item,
							children: item.children
								? [...item.children, newDirectory]
								: [newDirectory],
						}
					}

					// 递归处理子目录
					if (item.children) {
						return {
							...item,
							children: updateAttachments(item.children),
						}
					}

					return item
				})
			}

			if (parentPath.length === 0) {
				// 根目录，直接添加到 attachments
				setAttachments((prev) => [...prev, newDirectory])
			} else {
				// 更新 attachments
				setAttachments((prev) => updateAttachments(prev))
			}
		},
	)

	// 新建文件夹 hook
	const createDirectoryHook = useCreateDirectory({
		projectId: currentProject?.id || "",
		path,
		directories,
		onDirectoryCreated: async (newDirectory: AttachmentItem, newPath: AttachmentItem[]) => {
			if (!currentProject) return

			// 更新 attachments 数据，确保新文件夹在父级列表中可见
			updateAttachmentsWithNewDirectory(newDirectory, path)

			// 自动进入新创建的文件夹
			setPath(newPath)
			await fetchDirectories({
				projectId: currentProject.id,
				parentId: getItemId(newDirectory),
				pathOverride: newPath,
			})
		},
	})

	// 过滤隐藏文件（显示所有文件和文件夹，但文件会被disabled）
	const filesSort = useMemoizedFn((files: AttachmentItem[]) => {
		return files.filter((item) => !item.is_hidden)
	})

	// 获取目录内容（基于 attachments）
	const fetchDirectories = useMemoizedFn(
		async (params: {
			projectId: string
			parentId?: string
			pathOverride?: AttachmentItem[]
		}) => {
			setLoading(true)
			try {
				const currentPath = params.pathOverride !== undefined ? params.pathOverride : path
				const dirs = getDirectoriesFromPath(attachments, currentPath)
				setDirectories(filesSort(dirs))
			} catch (error) {
				console.error("Failed to fetch directories:", error)
				setDirectories([])
			}
			setLoading(false)
		},
	)

	// 项目选择处理。Mention 模式把“选中项目”和“进入项目”拆开，移动模式保持原交互。
	const handleProjectClick = useMemoizedFn(
		async (
			project: ProjectListItem,
			action: "select" | "enter" = "enter",
			workspaceOverride?: Workspace,
		) => {
			const selectionWorkspace = workspaceOverride ?? currentWorkspace
			if (isDesktopDestination && !hasEditPermission(project.user_role)) return
			if (
				(project as ResourceProject).resourceType &&
				!(project as ResourceProject).project_id
			) {
				magicToast.info(t("fileManager.locateUnavailable"))
				return
			}
			setLoadError(false)
			if (isMentionMode && action === "select") {
				if (!selectionWorkspace) return
				toggleMentionSelection({
					level: "project",
					workspace: resolveSelectionWorkspace(selectionWorkspace),
					project,
				})
				return
			}
			if (workspaceOverride && workspaceOverride.id !== currentWorkspace?.id) {
				setCurrentWorkspace(workspaceOverride)
			}

			cancelProjectRequest()
			if (isProjectOnly) {
				attachmentRequestRef.current?.controller.abort()
				setCurrentProject(project)
				setViewMode("project")
				pathRef.current = []
				setAttachments([])
				setPath([])
				setDirectories([])
				setIsSearch(false)
				setIsSearchOpen(false)
				setFileName("")
				createDirectoryHook.cancelCreateDirectory()
				createProjectHook.cancelCreateProject()
				setLoading(false)
				return
			}

			// The source page owns the current project's attachment request. Reuse its
			// streamed snapshots instead of starting a second full-tree request.
			if (project.id === selectedProject?.id) {
				attachmentRequestRef.current?.controller.abort()
				setCurrentProject(project)
				setViewMode("directory")
				pathRef.current = []
				setPath([])
				setAttachments(sourceAttachments)
				setDirectories(filesSort(getDirectoriesFromPath(sourceAttachments, [])))
				setLoading(sourceAttachmentsLoading)
				return
			}

			const request = beginAttachmentRequest()
			setCurrentProject(project)
			setViewMode("directory")
			pathRef.current = []
			setPath([])
			// Do not keep rendering the previous project's tree while the new
			// project's first attachment snapshot is still pending.
			setAttachments([])
			setDirectories([])
			setLoading(true)
			setIsSearch(false)
			setIsSearchOpen(false)
			setFileName("")
			createDirectoryHook.cancelCreateDirectory()
			createProjectHook.cancelCreateProject()
			try {
				const res = await loadProjectAttachments({
					projectId: project.id,
					// This selector is loading the signed-in user's target project. Do not
					// inherit the source share token, which rewrites the project ID to 0.
					temporaryToken: null,
					signal: request.controller.signal,
					onBatchSnapshot: (snapshot) => {
						if (
							request.controller.signal.aborted ||
							request.requestId !== attachmentRequestIdRef.current
						) {
							return
						}
						setAttachments(snapshot.tree)
						setDirectories(
							filesSort(getDirectoriesFromPath(snapshot.tree, pathRef.current)),
						)
					},
				})
				if (
					request.controller.signal.aborted ||
					request.requestId !== attachmentRequestIdRef.current
				) {
					return
				}
				setAttachments(res?.tree || [])
				const dirs = getDirectoriesFromPath(res?.tree || [], pathRef.current)
				setDirectories(filesSort(dirs))
			} catch (error) {
				if (request.controller.signal.aborted) return
				setLoadError(true)
				console.error("Failed to fetch attachments:", error)
				magicToast.error(t("selectPathModal.fetchAttachmentsFailed"))
			}
			if (
				!request.controller.signal.aborted &&
				request.requestId === attachmentRequestIdRef.current
			) {
				setLoading(false)
			}
		},
	)

	// 龙虾场景初始化处理
	const handleClawContextInitialization = useMemoizedFn(async (projectId: string) => {
		setLoading(true)
		setIsSearch(false)
		setIsSearchOpen(false)
		setFileName("")
		createDirectoryHook.cancelCreateDirectory()
		createWorkspaceHook.cancelCreateWorkspace()
		createProjectHook.cancelCreateProject()

		try {
			// 1. 设置"我的龙虾"工作区
			const myClawWorkspace = MY_CLAW_WORKSPACE_DATA(t)
			setCurrentWorkspace(myClawWorkspace)

			// 2. 获取龙虾项目详情
			const project = await SuperMagicApi.getProjectDetail({ id: projectId })

			if (!project) {
				return
			}

			// 3. 设置当前项目
			setCurrentProject(project)

			// 4. 根据是否 projectOnly 设置视图模式
			if (isProjectOnly) {
				setViewMode("project")
				setPath([])
				setAttachments([])
				setDirectories([])
			} else {
				setViewMode("directory")
				setPath(initialPath)

				// 5. 获取项目文件树
				const res = await loadProjectAttachments({
					projectId: project.id,
					// Claw projects selected as a destination use the current user's auth.
					temporaryToken: null,
				})

				setAttachments(res?.tree || [])
				const dirs = getDirectoriesFromPath(res?.tree || [], initialPath)
				setDirectories(filesSort(dirs))
			}
		} catch (error) {
			console.error("Failed to initialize claw context:", error)
			magicToast.error(t("selectPathModal.fetchProjectsFailed"))
			// 失败时回退到工作区列表
			setViewMode("workspace")
			setCurrentWorkspace(null)
			setCurrentProject(null)
			setAttachments([])
			setPath([])
			setDirectories([])
		}

		setLoading(false)
	})

	// 返回项目列表
	const handleBackToProject = useMemoizedFn(async () => {
		attachmentRequestRef.current?.controller.abort()
		setViewMode("project")
		setCurrentProject(null)
		setAttachments([])
		setPath([])
		setDirectories([])
		setIsSearch(false)
		setIsSearchOpen(false)
		setFileName("")
		createDirectoryHook.cancelCreateDirectory()
		createWorkspaceHook.cancelCreateWorkspace()
		createProjectHook.cancelCreateProject()
		// 重新获取项目列表
		if (currentWorkspace) {
			await fetchProjectsByWorkspace(currentWorkspace.id)
		}
	})

	// 面包屑项（原始列表）
	const breadcrumbItemsRaw = useMemo<BreadcrumbItem[]>(() => {
		const output: BreadcrumbItem[] = []

		// 工作空间入口（始终显示）
		output.push({
			name: t("selectPathModal.workspace"),
			id: "workspace-root",
			operation: "all",
		})

		// 如果选择了工作区，显示工作区
		if (currentWorkspace) {
			const workspaceName = getWorkspaceDisplayName(currentWorkspace)
			output.push({
				name: workspaceName,
				id: currentWorkspace.id,
				operation: "all",
				isWorkspace: true,
			})
		}

		// 如果选择了项目，显示项目
		if (currentProject) {
			output.push({
				name: currentProject.project_name || t("project.unnamedProject"),
				id: currentProject.id,
				operation: "all",
				isProject: true,
			})
		}

		// 如果处于目录视图，显示路径
		if (effectiveViewMode === "directory") {
			output.push(
				...path.map(
					(o) =>
						({
							name: getItemName(o),
							id: getItemId(o),
							operation: "all",
						}) as BreadcrumbItem,
				),
			)
		}

		return output
	}, [currentWorkspace, currentProject, path, effectiveViewMode, getWorkspaceDisplayName, t])

	// 根据容器宽度计算可显示的面包屑项
	const breadcrumbItems = useMemo(() => {
		return calculateBreadcrumbDisplayItems(breadcrumbItemsRaw, breadcrumbContainerWidth)
	}, [breadcrumbItemsRaw, breadcrumbContainerWidth])

	// 测量面包屑容器宽度
	useEffect(() => {
		return () => {
			attachmentRequestRef.current?.controller.abort()
			cancelProjectRequest()
		}
	}, [cancelProjectRequest])

	useEffect(() => {
		if (!visible) {
			setBreadcrumbContainerWidth(0)
			return
		}

		let resizeObserver: ResizeObserver | null = null

		// 等待 DOM 渲染完成后再测量
		const timer = setTimeout(() => {
			if (!breadcrumbRef.current) return

			// 立即测量一次宽度
			setBreadcrumbContainerWidth(breadcrumbRef.current.offsetWidth)

			// 监听后续的尺寸变化
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					setBreadcrumbContainerWidth(entry.contentRect.width)
				}
			})

			resizeObserver.observe(breadcrumbRef.current)
		}, 100)

		return () => {
			clearTimeout(timer)
			if (resizeObserver) {
				resizeObserver.disconnect()
			}
		}
	}, [visible])

	const backCatalogueSelect = useMemoizedFn(() => {
		setFileName("")
		setIsSearch(false)
		setIsSearchOpen(false)

		if (effectiveViewMode === "directory" && currentProject) {
			const lastPath = last(path)
			fetchDirectories({
				projectId: currentProject.id,
				parentId: lastPath ? getItemId(lastPath) : undefined,
			})
		}
	})

	// 搜索文件（基于 attachments）
	const { run: fetchFiles } = useDebounceFn(
		async (params: { value: string; projectId: string }) => {
			if (!params.value) {
				setIsSearch(false)
				const lastPath = last(path)
				if (!isProjectOnly) {
					await fetchDirectories({
						projectId: params.projectId,
						parentId: lastPath ? getItemId(lastPath) : undefined,
					})
				}
				return
			}

			setIsSearch(true)
			setLoading(true)

			try {
				const searchResults = searchInAttachments(attachments, params.value)
				setDirectories(filesSort(searchResults))
			} catch (error) {
				console.error("Failed to search files:", error)
				setDirectories([])
			}
			setLoading(false)
		},
		{ wait: 400 },
	)

	// 搜索工作区（前端过滤）
	const searchWorkspaces = useMemoizedFn((value: string) => {
		setFileName(value)
		if (!value.trim()) {
			setIsSearch(false)
			return
		}
		setIsSearch(true)
		// 前端过滤，不需要额外处理，渲染时会根据 fileName 过滤
	})

	// 搜索项目（前端过滤）
	const searchProjects = useMemoizedFn((value: string) => {
		setFileName(value)
		if (!value.trim()) {
			setIsSearch(false)
			return
		}
		setIsSearch(true)
		// 前端过滤，不需要额外处理，渲染时会根据 fileName 过滤
	})

	const searchDirectories = useMemoizedFn(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.currentTarget.value
		setFileName(value)

		if (effectiveViewMode === "workspace") {
			searchWorkspaces(value)
		} else if (effectiveViewMode === "project") {
			searchProjects(value)
		} else if (effectiveViewMode === "directory" && currentProject) {
			fetchFiles({
				value,
				projectId: currentProject.id,
			})
		}
	})

	const onBreadcrumbClick = useMemoizedFn(async (item: BreadcrumbItem) => {
		if (shouldBlockPanelForLoading) return

		// 点击"工作空间"回到最初
		if (item.id === "workspace-root") {
			handleBackToWorkspace()
			return
		}

		// 点击工作区，回到项目列表
		if (item.isWorkspace && currentWorkspace) {
			handleBackToProject()
			return
		}

		// 点击项目，回到目录树根目录
		if (item.isProject && currentProject) {
			if (isProjectOnly) {
				return
			}
			pathRef.current = []
			setPath([])
			await fetchDirectories({
				projectId: currentProject.id,
				parentId: undefined,
				pathOverride: [],
			})
			createDirectoryHook.cancelCreateDirectory()
			createWorkspaceHook.cancelCreateWorkspace()
			createProjectHook.cancelCreateProject()
			return
		}

		// 点击目录路径
		if (currentProject && effectiveViewMode === "directory") {
			const index = path.findIndex((o) => getItemId(o) === item.id)
			const newPath = index >= 0 ? path.slice(0, index + 1) : []
			pathRef.current = newPath
			setPath(newPath)
			await fetchDirectories({
				projectId: currentProject.id,
				parentId: item.id,
				pathOverride: newPath,
			})
			createDirectoryHook.cancelCreateDirectory()
			createWorkspaceHook.cancelCreateWorkspace()
			createProjectHook.cancelCreateProject()
		}
	})

	const onDirectoryClick = useMemoizedFn(
		async (item: AttachmentItem, action: "select" | "enter" = "enter") => {
			if (!currentProject) return
			if (isProjectOnly) return
			setIsSearch(false)

			if (isResourceSelectionMode && action === "select") {
				if (!currentWorkspace) return
				toggleMentionSelection({
					level: "attachment",
					workspace: resolveSelectionWorkspace(currentWorkspace),
					project: currentProject,
					attachment: item,
				})
				return
			}

			if (!item.is_directory) {
				return
			}

			const itemId = getItemId(item)
			// A directory row can remain visible while its children are being
			// resolved. Ignore repeated clicks on a directory already in the path so
			// the same node cannot be appended multiple times before the next render.
			if (path.some((pathItem) => getItemId(pathItem) === itemId)) {
				return
			}

			// 仅移动操作时检查是否为禁用的文件夹（复制操作允许复制到自己或子级）
			if (operationType === "move") {
				if (disabledFolderIds.includes(itemId)) {
					magicToast.info(t("selectPathModal.cannotSelectCurrentFolder"))
					return
				}
			}

			const newPath = [...path, item]
			pathRef.current = newPath
			setPath(newPath)
			await fetchDirectories({
				projectId: currentProject.id,
				parentId: getItemId(item),
				pathOverride: newPath,
			})
			createDirectoryHook.cancelCreateDirectory()
			createWorkspaceHook.cancelCreateWorkspace()
			createProjectHook.cancelCreateProject()
		},
	)

	const submit = useMemoizedFn(async () => {
		if (
			isDesktopDestination &&
			(loading ||
				loadError ||
				documentStaticDependencies.isLoading ||
				path.some((item) => disabledFolderIdSet.has(getItemId(item))) ||
				(currentProject && !hasEditPermission(currentProject.user_role)))
		)
			return
		if (isResourceSelectionMode) {
			if (submittingRef.current || externalSubmitting) return
			const firstSelection = selectedResources[0]
			if (!firstSelection) return
			submittingRef.current = true
			setSubmitting(true)
			const epoch = submitEpochRef.current
			try {
				await onSubmit({
					targetProjectId: firstSelection.project.id,
					targetWorkspaceId: firstSelection.workspace.id,
					targetProject: firstSelection.project,
					targetPath: path,
					targetAttachments: attachments,
					sourceAttachments,
					selection: firstSelection,
					selections: selectedResources,
					includeDocumentDependencies,
					documentDependencyFileIds: documentStaticDependencies.dependencyTransferFileIds,
					preserveParentPath: false,
				})
				if (closeOnSubmit && epoch === submitEpochRef.current) onClose?.()
			} finally {
				if (epoch === submitEpochRef.current) {
					submittingRef.current = false
					setSubmitting(false)
				}
			}
			return
		}

		if (!currentWorkspace) return
		if (!currentProject && !allowWorkspaceRootSubmit) return

		// Some flows, such as recording copy, let users save at workspace level so
		// the submit handler can create a normal target project before copying.
		let preserveParentPath = false
		if (showPreserveParentPathOption) {
			const preserveParentPathChoice = await confirmPreserveParentPath()
			if (preserveParentPathChoice === null) return
			preserveParentPath = preserveParentPathChoice
		}

		const targetPath = currentProject ? path : []
		const targetAttachments = currentProject ? attachments : []
		onSubmit &&
			onSubmit({
				targetProjectId: currentProject?.id || "",
				targetWorkspaceId: currentWorkspace?.id,
				targetProject: currentProject ?? undefined,
				targetPath,
				targetAttachments,
				sourceAttachments: sourceAttachments,
				includeDocumentDependencies,
				documentDependencyFileIds: documentStaticDependencies.dependencyTransferFileIds,
				preserveParentPath,
			})
		if (closeOnSubmit) onClose && onClose()
	})

	// Workspace-level submit is opt-in; default file operations still require a target project.
	const canSubmit = useMemo(() => {
		if (isResourceSelectionMode) return selectedResources.length > 0
		return (
			currentWorkspace !== null &&
			(currentProject !== null ||
				(allowWorkspaceRootSubmit && effectiveViewMode === "project"))
		)
	}, [
		isResourceSelectionMode,
		selectedResources.length,
		allowWorkspaceRootSubmit,
		currentWorkspace,
		currentProject,
		effectiveViewMode,
	])

	const handleCancel = () => {
		onClose && onClose()
	}

	const handleToggleSearch = useMemoizedFn(() => {
		if (isSearchOpen) {
			setIsSearchOpen(false)
			backCatalogueSelect()
			return
		}

		setIsSearchOpen(true)
	})

	useEffect(() => {
		if (isSearchOpen) {
			searchInputRef.current?.focus()
		}
	}, [isSearchOpen])

	useEffect(() => {
		if (!visible) {
			submitEpochRef.current += 1
			submittingRef.current = false
			setSubmitting(false)
			cancelProjectRequest()
			attachmentRequestRef.current?.controller.abort()
			// 弹窗关闭时重置初始化标记
			initializedRef.current = false
			setIsSearchOpen(false)
			return
		}

		// 如果已经初始化过，不再重复执行
		if (initializedRef.current) {
			return
		}

		initializedRef.current = true
		setSelectedResources([])

		// 龙虾场景特殊处理
		if (isClawContext && clawProjectId) {
			handleClawContextInitialization(clawProjectId)
			return
		}

		// 如果有当前工作区和当前项目，默认选中它们
		if (selectedWorkspace && selectedProject) {
			setCurrentWorkspace(selectedWorkspace)
			setCurrentProject(selectedProject)
			setViewMode(isProjectOnly ? "project" : "directory")
			pathRef.current = isProjectOnly ? [] : initialPath
			setPath(isProjectOnly ? [] : initialPath)
			setFileName("")
			setIsSearch(false)
			setIsSearchOpen(false)
			createDirectoryHook.cancelCreateDirectory()
			createWorkspaceHook.cancelCreateWorkspace()
			createProjectHook.cancelCreateProject()

			if (isProjectOnly) {
				setAttachments([])
				setDirectories([])
				setLoading(false)
				return
			}

			// The current project's file tree is already owned by the page and may
			// still be in first/middle batch snapshot delivery. Render what exists now;
			// the snapshot-sync effect below will fill in later batches.
			setAttachments(sourceAttachments)
			setDirectories(filesSort(getDirectoriesFromPath(sourceAttachments, initialPath)))
			setLoading(sourceAttachmentsLoading)
		} else {
			// 否则重置到工作区选择视图
			setViewMode("workspace")
			setCurrentWorkspace(null)
			setCurrentProject(null)
			setAvailableProjects([])
			resetResourceProjectsPagination()
			setAttachments([])
			setPath([])
			setDirectories([])
			setFileName("")
			setIsSearch(false)
			// 刷新工作区列表以确保显示最新数据
			refreshWorkspaces()
			createDirectoryHook.cancelCreateDirectory()
			createWorkspaceHook.cancelCreateWorkspace()
			createProjectHook.cancelCreateProject()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible, isClawContext, clawProjectId])

	useEffect(() => {
		if (!visible || !isCurrentProjectTarget || isSearch) return

		setAttachments(sourceAttachments)
		setDirectories(filesSort(getDirectoriesFromPath(sourceAttachments, path)))
		setLoading(sourceAttachmentsLoading)
	}, [
		visible,
		isCurrentProjectTarget,
		isSearch,
		sourceAttachments,
		sourceAttachmentsLoading,
		path,
		filesSort,
	])

	// 根据 viewMode 动态设置搜索 placeholder
	const searchPlaceholder = useMemo(() => {
		if (effectiveViewMode === "workspace") {
			return t("selectPathModal.searchWorkspace")
		} else if (effectiveViewMode === "project") {
			return t("selectPathModal.searchProject")
		} else {
			return t("selectPathModal.searchDirectory")
		}
	}, [effectiveViewMode, t])
	const storageLabel = isResourceSelectionMode
		? t("selectPathModal.selectMentionResource")
		: t("selectPathModal.selectStorageLocation")
	const emptyStorageDescription =
		emptyDirectoryDescription || t("selectPathModal.emptyStorageDescription")
	const emptyStorageAction =
		emptyDirectoryActionLabel === undefined
			? t("selectPathModal.emptyStorageAction")
			: emptyDirectoryActionLabel
	const searchEmptyTitle = t("selectPathModal.searchEmptyTitle")
	const searchEmptyDescription = t("selectPathModal.searchEmptyDescription", {
		keyword: fileName,
	})

	const createAction = useMemo(() => {
		if (isResourceSelectionMode) return null
		if (effectiveViewMode === "workspace") {
			return {
				onClick: createWorkspaceHook.showCreateWorkspace,
				label: t("selectPathModal.newWorkspace"),
				testId: "cross-project-file-modal-create-workspace",
			}
		}
		if (effectiveViewMode === "project" && canEdit) {
			return {
				onClick: createProjectHook.showCreateProject,
				label: t("selectPathModal.newProject"),
				testId: "cross-project-file-modal-create-project",
			}
		}
		if (effectiveViewMode === "directory" && canEdit) {
			return {
				onClick: createDirectoryHook.showCreateDirectory,
				label: t("selectPathModal.newSubfolder"),
				testId: "cross-project-file-modal-create-directory",
			}
		}
		return null
	}, [
		isResourceSelectionMode,
		effectiveViewMode,
		canEdit,
		t,
		createWorkspaceHook,
		createProjectHook,
		createDirectoryHook,
	])

	const footerConfig = {
		okText: t("selectPathModal.confirm"),
		cancelText: t("common.cancel"),
		onOk: submit,
		onCancel: handleCancel,
		okDisabled:
			(isResourceSelectionMode ? false : isSearch) ||
			!canSubmit ||
			documentStaticDependencies.isLoading,
	}

	const handleKeyDown = useMemoizedFn((event: KeyboardEvent) => {
		if (event.key === "Escape") {
			backCatalogueSelect()
		}
	})

	useEffect(() => {
		if (visible && !isResourceSelectionMode && !isDesktopDestination) {
			window.addEventListener("keydown", handleKeyDown)
			return () => window.removeEventListener("keydown", handleKeyDown)
		} else {
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [visible, handleKeyDown, isResourceSelectionMode, isDesktopDestination])

	// 渲染工作区列表
	const renderWorkspaceList = () => {
		// 创建共享工作区对象
		const shareWorkspace = SHARE_WORKSPACE_DATA(t)
		// 创建我的龙虾工作区对象
		const myClawWorkspace = MY_CLAW_WORKSPACE_DATA(t)
		const resourceWorkspaces = [MY_SKILLS_WORKSPACE_DATA(t), MY_AGENTS_WORKSPACE_DATA(t)]
		// 合并工作区列表和底部固定频道：共享工作区、我的龙虾
		const allWorkspaces = availableWorkspaces

		// 根据搜索关键词过滤工作区（使用显示名称进行匹配，支持未命名工作区和共享工作区）
		const filteredWorkspaces =
			isSearch && fileName
				? allWorkspaces.filter((workspace) =>
						getWorkspaceDisplayName(workspace)
							.toLowerCase()
							.includes(fileName.toLowerCase()),
					)
				: allWorkspaces
		const regularWorkspaces = filteredWorkspaces.filter(
			(workspace) =>
				!isFixedWorkspace(workspace) && !RESOURCE_WORKSPACE_IDS.has(workspace.id),
		)
		const fixedWorkspaces = [
			...(includeFixedWorkspaces ? [myClawWorkspace] : []),
			...resourceWorkspaces,
			...(includeFixedWorkspaces ? [shareWorkspace] : []),
		].filter((workspace) =>
			getWorkspaceDisplayName(workspace).toLowerCase().includes(fileName.toLowerCase()),
		)

		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-md p-2.5 transition-all hover:bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"
		const shouldSeparateFixedChannels =
			createWorkspaceHook.createWorkspaceShown || regularWorkspaces.length > 0

		const renderWorkspaceItem = (workspace: Workspace, index: number) => {
			const workspaceName = getWorkspaceDisplayName(workspace)

			return (
				<div
					key={workspace.id || index}
					className={textFolderItemClass}
					onClick={() => handleWorkspaceClick(workspace)}
					data-testid="handle-workspace-click"
				>
					<div className="flex w-full flex-1 items-center justify-between gap-2.5">
						<div className="flex flex-1 items-center gap-1">
							<div className={folderIconClass}>
								{renderWorkspaceIcon(workspace.id)}
							</div>
							<MagicEllipseWithTooltip
								title={workspaceName}
								text={workspaceName}
								className={nameClass}
								placement="topLeft"
							>
								{workspaceName}
							</MagicEllipseWithTooltip>
						</div>
						<div className="flex min-w-0 flex-[0_0_500px] shrink items-center justify-end gap-2.5">
							<IconChevronRight
								className="size-5 flex-[0_0_20px] shrink-0 text-base text-muted-foreground"
								size={16}
							/>
						</div>
					</div>
				</div>
			)
		}

		return (
			<div className="flex h-full min-h-0 flex-col">
				<div
					className="scrollbar-y-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
					data-testid="project-resource-selector-regular-workspaces"
				>
					{createWorkspaceHook.createWorkspaceShown && (
						<div className={textFolderItemClass}>
							<div className={folderIconClass}>
								<Box className="size-4 text-current" />
							</div>
							<InputWithError
								height={24}
								className="text-sm"
								autoFocus
								size="small"
								value={createWorkspaceHook.createWorkspaceName}
								onChange={createWorkspaceHook.onCreateWorkspaceInputChange}
								onFocus={createWorkspaceHook.onCreateWorkspaceInputFocus}
								onPressEnter={createWorkspaceHook.submitCreateWorkspace}
								onKeyDown={createWorkspaceHook.onCreateWorkspaceInputKeyDown}
								onBlur={createWorkspaceHook.submitCreateWorkspace}
								placeholder={t("selectPathModal.inputWorkspaceName")}
								errorMessage={createWorkspaceHook.createWorkspaceErrorMessage}
								showError={!!createWorkspaceHook.createWorkspaceErrorMessage}
							/>
						</div>
					)}
					{regularWorkspaces.length > 0 ? (
						regularWorkspaces.map(renderWorkspaceItem)
					) : fixedWorkspaces.length > 0 ||
					  createWorkspaceHook.createWorkspaceShown ? null : isSearch && fileName ? (
						<EmptyStateBox>
							<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
								<IconFileSearch size={24} />
							</div>
							<div className="flex flex-col items-center gap-2 text-center">
								<div className="text-lg font-medium leading-7 text-foreground">
									{searchEmptyTitle}
								</div>
								<div className="text-center text-sm font-normal leading-5 text-foreground/35">
									{searchEmptyDescription}
								</div>
							</div>
						</EmptyStateBox>
					) : (
						<div className="flex h-full w-full flex-col items-center justify-center gap-1">
							<img
								src={EmptyFilesIcon}
								alt=""
								width={200}
								height={200}
								data-testid="cross-project-file-operation-modal-image"
							/>
							<div className="text-sm leading-5 text-foreground/35">
								{t("selectPathModal.noWorkspace")}
							</div>
						</div>
					)}
				</div>
				{fixedWorkspaces.length > 0 && (
					<div
						className="shrink-0 bg-card"
						data-testid="project-resource-selector-fixed-workspaces"
					>
						{shouldSeparateFixedChannels && (
							<div
								className="my-2 border-t border-border"
								data-testid="cross-project-file-modal-fixed-workspace-divider"
							/>
						)}
						{fixedWorkspaces.map(renderWorkspaceItem)}
					</div>
				)}
			</div>
		)
	}

	// 渲染项目列表
	const renderProjectList = () => {
		// 根据搜索关键词过滤项目（使用显示名称进行匹配，支持未命名项目）
		const filteredProjects =
			isSearch && fileName
				? editableProjects.filter((project) =>
						getProjectDisplayName(project)
							.toLowerCase()
							.includes(fileName.toLowerCase()),
					)
				: editableProjects

		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-md p-2.5 transition-all hover:bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"
		// 与 MoveProjectModal 统一的勾选样式（仅选中时显示，使用主题色以支持暗黑）
		const checkboxWrapperClass =
			"[&_.ant-checkbox-inner]:rounded-md [&_.ant-checkbox-checked_.ant-checkbox-inner]:border-primary [&_.ant-checkbox-checked_.ant-checkbox-inner]:bg-primary"

		return (
			<>
				{currentWorkspace?.id === MY_AGENTS_WORKSPACE_ID && (
					<AgentResourceScopeSwitch value={agentScope} onChange={changeAgentScope} />
				)}
				{canEdit && createProjectHook.createProjectShown && (
					<div className={textFolderItemClass}>
						<div className={folderIconClass}>
							<IconProject />
						</div>
						<InputWithError
							height={24}
							className="text-sm"
							autoFocus
							size="small"
							value={createProjectHook.createProjectName}
							onChange={createProjectHook.onCreateProjectInputChange}
							onFocus={createProjectHook.onCreateProjectInputFocus}
							onPressEnter={submitCreateProjectDebounced}
							onKeyDown={createProjectHook.onCreateProjectInputKeyDown}
							onBlur={submitCreateProjectDebounced}
							placeholder={t("selectPathModal.inputProjectName")}
							errorMessage={createProjectHook.createProjectErrorMessage}
							showError={!!createProjectHook.createProjectErrorMessage}
						/>
					</div>
				)}
				{filteredProjects.length > 0 ? (
					isProjectOnly ? (
						filteredProjects.map((project, index) => {
							const isSelected = currentProject?.id === project.id
							return (
								<div
									key={project.id || index}
									className={cn(
										"mb-0.5 flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-lg border px-2 py-2.5 transition-all hover:bg-fill",
										isSelected ? "border-border bg-fill" : "border-transparent",
									)}
									onClick={() => handleProjectClick(project)}
									data-testid="cross-project-file-modal-project-item"
									data-selected={isSelected}
								>
									<div className="flex min-w-0 flex-1 items-center gap-1">
										<div className={folderIconClass}>
											<IconProject />
										</div>
										<MagicEllipseWithTooltip
											title={getProjectDisplayName(project)}
											text={getProjectDisplayName(project)}
											className={nameClass}
											placement="topLeft"
										>
											{getProjectDisplayName(project)}
										</MagicEllipseWithTooltip>
									</div>
									{isSelected && (
										<div
											className={cn(
												checkboxWrapperClass,
												"pointer-events-none",
											)}
											data-testid="cross-project-file-modal-project-checkbox"
										>
											<Checkbox checked />
										</div>
									)}
								</div>
							)
						})
					) : (
						filteredProjects.map((project, index) => (
							<div
								key={project.id || index}
								className={textFolderItemClass}
								onClick={() => handleProjectClick(project)}
								data-testid="handle-project-click"
							>
								<div className="flex w-full flex-1 items-center justify-between gap-2.5">
									<div className="flex flex-1 items-center gap-1">
										<div className={folderIconClass}>
											{(project as ResourceProject).resourceType ===
											"skill" ? (
												<Wrench className="size-4" />
											) : (project as ResourceProject).resourceType ===
											  "agent" ? (
												<Bot className="size-4" />
											) : (
												<IconProject />
											)}
										</div>
										<MagicEllipseWithTooltip
											title={getProjectDisplayName(project)}
											text={getProjectDisplayName(project)}
											className={nameClass}
											placement="topLeft"
										>
											{getProjectDisplayName(project)}
										</MagicEllipseWithTooltip>
									</div>
									<div className="flex min-w-0 flex-[0_0_500px] shrink items-center justify-end gap-2.5">
										<IconChevronRight
											className="size-5 flex-[0_0_20px] shrink-0 text-base text-muted-foreground"
											size={16}
										/>
									</div>
								</div>
							</div>
						))
					)
				) : isSearch && fileName ? (
					<EmptyStateBox>
						<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
							<IconFileSearch size={24} />
						</div>
						<div className="flex flex-col items-center gap-2 text-center">
							<div className="text-lg font-medium leading-7 text-foreground">
								{searchEmptyTitle}
							</div>
							<div className="text-center text-sm font-normal leading-5 text-foreground/35">
								{searchEmptyDescription}
							</div>
						</div>
					</EmptyStateBox>
				) : (
					<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
						<img
							src={EmptyFilesIcon}
							alt=""
							width={200}
							height={200}
							data-testid="cross-project-file-operation-modal-image-2"
						/>
						<div className="text-sm leading-5 text-foreground/35">
							{t("selectPathModal.noProject")}
						</div>
					</div>
				)}
				{hasMoreResourceProjects &&
				currentWorkspace &&
				RESOURCE_WORKSPACE_IDS.has(currentWorkspace.id) ? (
					<div className="px-1 py-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-full text-xs text-muted-foreground"
							onClick={() => void handleLoadMoreResourceProjects()}
							disabled={loadingMoreResources || loading}
							data-testid="project-resource-selector-load-more"
						>
							{loadingMoreResources ? (
								<>
									<Loader2 className="mr-1 size-3.5 animate-spin" />
									{t("selectPathModal.loadingMore")}
								</>
							) : (
								t("selectPathModal.loadMore")
							)}
						</Button>
					</div>
				) : null}
			</>
		)
	}

	// 渲染目录树
	const renderDirectoryTree = () => {
		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-md p-2.5 transition-all hover:bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"
		return (
			<>
				{canEdit && createDirectoryHook.createDirectoryShown && (
					<div
						className={cn(textFolderItemClass, "gap-2")}
						data-testid="cross-project-file-modal-create-directory-row"
					>
						<div className="flex min-w-0 flex-1 items-center gap-1">
							<div className={folderIconClass}>
								<img
									src={FoldIcon}
									alt="folder"
									width={14}
									height={14}
									data-testid="cross-project-file-operation-modal-image-3"
								/>
							</div>
							<InputWithError
								height={24}
								className="min-w-0 flex-1 text-sm"
								autoFocus
								size="small"
								value={createDirectoryHook.createDirectoryName}
								onChange={createDirectoryHook.onCreateDirectoryInputChange}
								onFocus={createDirectoryHook.onCreateDirectoryInputFocus}
								onPressEnter={createDirectoryHook.submitCreateDirectory}
								onKeyDown={createDirectoryHook.onCreateDirectoryInputKeyDown}
								placeholder={t("selectPathModal.inputFolderName")}
								errorMessage={createDirectoryHook.createDirectoryErrorMessage}
								showError={!!createDirectoryHook.createDirectoryErrorMessage}
							/>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								className="size-8 shrink-0 rounded-md border-border [&_svg]:text-emerald-500"
								onMouseDown={(e) => e.preventDefault()}
								onClick={createDirectoryHook.submitCreateDirectory}
								disabled={createDirectoryHook.loading}
								aria-label={t("common.confirm")}
								data-testid="cross-project-file-modal-create-directory-confirm"
							>
								<IconCheck size={14} />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="size-8 shrink-0 rounded-md border-border [&_svg]:text-destructive"
								onMouseDown={(e) => e.preventDefault()}
								onClick={createDirectoryHook.cancelCreateDirectory}
								disabled={createDirectoryHook.loading}
								aria-label={t("common.cancel")}
								data-testid="cross-project-file-modal-create-directory-cancel"
							>
								<IconX size={14} />
							</Button>
						</div>
					</div>
				)}
				{directories.map((directory, index) => {
					const isDisabled =
						(operationType === "move" &&
							disabledFolderIds.includes(getItemId(directory))) ||
						!directory.is_directory
					return (
						<div
							key={index}
							className={cn(textFolderItemClass, isDisabled && "disable")}
							onClick={() => !isDisabled && onDirectoryClick(directory)}
							data-testid="on-directory-click"
						>
							<div className="flex w-full flex-1 items-center justify-between gap-2.5">
								<div className="flex flex-1 items-center gap-1">
									<div className={folderIconClass}>
										<FileResourceIcon
											presentation={resolveFilePresentation(directory, {
												index: getFilePresentationIndex(attachments),
											})}
											size={14}
											folderTestId="cross-project-file-operation-modal-image-4"
										/>
									</div>

									<MagicEllipseWithTooltip
										title={getItemName(directory)}
										text={getItemName(directory)}
										className={nameClass}
										placement="topLeft"
									>
										{getItemName(directory)}
									</MagicEllipseWithTooltip>
								</div>

								<div className="flex min-w-0 flex-[0_0_500px] shrink items-center justify-end gap-2.5">
									{isSearch && directory.relative_file_path && (
										<MagicEllipseWithTooltip
											title={directory.relative_file_path}
											text={directory.relative_file_path}
											className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-right text-sm leading-5 text-foreground/35"
											placement="rightTop"
										>
											{directory.relative_file_path}
										</MagicEllipseWithTooltip>
									)}
									{directory.is_directory && (
										<IconChevronRight
											className="size-5 flex-[0_0_20px] shrink-0 text-base text-muted-foreground"
											size={16}
										/>
									)}
								</div>
							</div>
						</div>
					)
				})}
			</>
		)
	}

	const toolbarButtonClass =
		"inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm hover:bg-fill active:bg-fill-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:text-foreground"
	const breadcrumbItemBase =
		"relative flex max-w-[150px] cursor-pointer items-center rounded-[4px] text-foreground transition-colors hover:not(.disable):not(.current):text-primary [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
	const destinationCreation: DestinationCreationOptions | null =
		createWorkspaceHook.createWorkspaceShown
			? {
					title: t("selectPathModal.newWorkspace"),
					name: createWorkspaceHook.createWorkspaceName,
					error: createWorkspaceHook.createWorkspaceErrorMessage,
					loading: createWorkspaceHook.loading,
					onChange: createWorkspaceHook.onCreateWorkspaceInputChange,
					onSubmit: createWorkspaceHook.submitCreateWorkspace,
					onClose: createWorkspaceHook.cancelCreateWorkspace,
				}
			: createProjectHook.createProjectShown
				? {
						title: t("selectPathModal.newProject"),
						name: createProjectHook.createProjectName,
						error: createProjectHook.createProjectErrorMessage,
						loading: createProjectHook.loading,
						onChange: createProjectHook.onCreateProjectInputChange,
						onSubmit: createProjectHook.submitCreateProject,
						onClose: createProjectHook.cancelCreateProject,
					}
				: createDirectoryHook.createDirectoryShown
					? {
							title: t("selectPathModal.newSubfolder"),
							name: createDirectoryHook.createDirectoryName,
							error: createDirectoryHook.createDirectoryErrorMessage,
							loading: createDirectoryHook.loading,
							onChange: createDirectoryHook.onCreateDirectoryInputChange,
							onSubmit: createDirectoryHook.submitCreateDirectory,
							onClose: createDirectoryHook.cancelCreateDirectory,
						}
					: null
	const documentDependenciesOption =
		documentStaticDependencies.fileType &&
		documentStaticDependencies.dependencyFileIds.length > 0 ? (
			<label
				className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5"
				data-testid="cross-project-file-document-dependencies-option"
			>
				<Checkbox
					checked={includeDocumentDependencies}
					onChange={(event) => setIncludeDocumentDependencies(event.target.checked)}
				/>
				<span className="flex flex-col gap-1 text-left">
					<span className="text-sm font-medium leading-5 text-foreground">
						{t("share.includeDocumentDependencies", {
							count: documentStaticDependencies.dependencyFileIds.length,
						})}
					</span>
					<span className="text-xs leading-4 text-muted-foreground">
						{t("share.includeDocumentDependenciesDescription", {
							type:
								documentStaticDependencies.fileType === "markdown"
									? "Markdown"
									: "HTML",
						})}
					</span>
				</span>
			</label>
		) : null

	if (isMobile && isResourceSelectionMode) {
		return (
			<MobileFilesMoveSheet
				visible={visible}
				submitting={externalSubmitting}
				title={title}
				attachments={[]}
				defaultPath={initialPath}
				disabledFolderIds={[]}
				mobileCrossProjectConfig={{
					currentProject: selectedProject,
					currentWorkspace: selectedWorkspace,
					sourceAttachments,
					initialViewMode: "workspace",
					workspaces,
					includeSpecialWorkspaces: includeFixedWorkspaces,
					selectionMode: selectionMode === "import" ? "import" : "mention",
					excludeProjectIds,
				}}
				rootLabel={t("selectPathModal.rootDirectory")}
				backLabel={t("back")}
				homeLabel={t("selectPathModal.rootDirectory")}
				closeLabel={t("close")}
				confirmLabel={t("selectPathModal.confirm")}
				clearSearchAriaLabel={t("clearSearch")}
				searchPlaceholder={searchPlaceholder}
				searchEmptyDescription={searchEmptyDescription}
				emptyTip={emptyDirectoryDescription || t("selectPathModal.emptyDataTip")}
				closeOnSubmit={closeOnSubmit}
				onClose={onClose}
				onSubmit={(params) => {
					const selections =
						params.selections || (params.selection ? [params.selection] : [])
					const firstSelection = selections[0]
					if (!firstSelection) return
					onSubmit({
						targetProjectId: firstSelection.project.id,
						targetWorkspaceId: firstSelection.workspace.id,
						targetProject: firstSelection.project,
						targetPath: params.path,
						targetAttachments: params.targetAttachments || [],
						sourceAttachments,
						selection: firstSelection,
						selections,
					})
				}}
			/>
		)
	}

	if (isResourceSelectionMode || isDesktopDestination) {
		return visible ? (
			<MentionDesktopPicker
				title={title}
				workspaces={availableWorkspaces}
				workspace={currentWorkspace}
				project={currentProject}
				projects={availableProjects}
				resourceFilter={
					currentWorkspace?.id === MY_AGENTS_WORKSPACE_ID ? (
						<AgentResourceScopeSwitch value={agentScope} onChange={changeAgentScope} />
					) : undefined
				}
				selectionMode={selectionMode === "import" ? "import" : "mention"}
				allowProjectSelection={allowProjectSelection}
				destination={
					isDesktopDestination
						? {
								path,
								canSubmit:
									canSubmit &&
									!loading &&
									!loadError &&
									!documentStaticDependencies.isLoading &&
									!path.some((item) =>
										disabledFolderIdSet.has(getItemId(item)),
									) &&
									(!currentProject ||
										hasEditPermission(currentProject.user_role)),
								disabledFolderIds: disabledFolderIdSet,
								onDirectoryChange: handleTargetDirectoryChange,
								createWorkspaceAction: (
									<Button
										variant="ghost"
										size="sm"
										className="w-full justify-start text-xs"
										onClick={createWorkspaceHook.showCreateWorkspace}
									>
										{t("selectPathModal.newWorkspace")}
									</Button>
								),
								createAction:
									currentWorkspace && createAction ? (
										<Button
											variant="outline"
											size="sm"
											className="h-7 shrink-0 text-xs"
											onClick={createAction.onClick}
											data-testid={createAction.testId}
										>
											{createAction.label}
										</Button>
									) : undefined,
								creationDialog: (
									<DestinationCreationDialog options={destinationCreation} />
								),
								footerOptions: documentDependenciesOption ? (
									<div className="shrink-0 border-t px-4 py-2">
										{documentDependenciesOption}
									</div>
								) : undefined,
							}
						: undefined
				}
				attachments={attachments}
				loading={loading}
				error={loadError}
				submitting={submitting || externalSubmitting}
				includeFixedWorkspaces={includeFixedWorkspaces}
				excludeProjectIds={excludeProjectIds}
				selections={selectedResources}
				hasMore={hasMoreResourceProjects}
				loadingMore={loadingMoreResources}
				onLoadMore={handleLoadMoreResourceProjects}
				onProjectSearch={handleProjectSearch}
				onWorkspace={handleWorkspaceClick}
				onProject={(project, action, workspace) =>
					handleProjectClick(project, action, workspace)
				}
				onRecent={handleBackToWorkspace}
				onBack={handleBackToProject}
				onRefresh={() => {
					if (currentProject) void handleProjectClick(currentProject)
					else if (currentWorkspace) void fetchProjectsByWorkspace(currentWorkspace.id)
					else void refreshWorkspaces()
				}}
				onCheck={(change: FileManagerCheckChange) => {
					if (!currentProject || !currentWorkspace) return
					const projectIds = new Set(
						selectedResources.map((selection) => selection.project.id),
					)
					if (
						change.added.length &&
						!projectIds.has(currentProject.id) &&
						projectIds.size >= MAX_MENTION_PROJECT_COUNT
					) {
						magicToast.info(t("selectPathModal.mentionProjectLimit"))
						return
					}
					const workspace = resolveSelectionWorkspace(currentWorkspace)
					setSelectedResources((previous) => {
						const next = previous.filter(
							(selection) =>
								!(
									selection.level === "attachment" &&
									selection.project.id === currentProject.id &&
									change.removedIds.includes(getItemId(selection.attachment))
								),
						)
						const keys = new Set(next.map(getSelectionKey))
						for (const attachment of change.added) {
							const selection: ProjectResourceSelection = {
								level: "attachment",
								workspace,
								project: currentProject,
								attachment,
							}
							const key = getSelectionKey(selection)
							if (!keys.has(key)) {
								next.push(selection)
								keys.add(key)
							}
						}
						return next
					})
				}}
				onRemove={toggleMentionSelection}
				onClear={() => setSelectedResources([])}
				onNavigate={(selection) => {
					setCurrentWorkspace(selection.workspace)
					void handleProjectClick(selection.project)
				}}
				onSubmit={submit}
				onClose={onClose}
			/>
		) : null
	}

	const modalContent = (
		<div
			className={cn(
				"flex h-full min-h-0 flex-1 flex-col overflow-hidden",
				isMobile && "h-[calc(100%-141px)]",
			)}
		>
			{documentDependenciesOption && <div className="mb-3">{documentDependenciesOption}</div>}
			<div
				className="flex items-center justify-start gap-2.5 p-0"
				data-testid="cross-project-file-modal-toolbar"
			>
				{!isSearchOpen && (
					<div className="whitespace-nowrap text-sm font-medium leading-[14px] text-foreground">
						{storageLabel}
					</div>
				)}
				{isSearchOpen ? (
					<div className="flex h-[44px] min-w-0 flex-1 items-center gap-2">
						<div className="relative min-w-0 flex-1">
							<IconSearch
								size={16}
								className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								ref={searchInputRef}
								className="h-8 rounded-lg border-border py-1 pl-9 pr-3 text-sm leading-5 placeholder:text-foreground/35 focus-visible:ring-0  "
								placeholder={searchPlaceholder}
								value={fileName}
								onChange={searchDirectories}
								data-testid="cross-project-file-modal-search-input"
							/>
						</div>
						<Button
							variant="outline"
							size="icon"
							className={toolbarButtonClass}
							onClick={handleToggleSearch}
							aria-label={t("common.cancel")}
							data-testid="cross-project-file-modal-search-close"
						>
							<IconX size={16} />
						</Button>
					</div>
				) : (
					<>
						{!isSearch && (
							<div
								className={cn(
									"text-md mx-2.5 my-2.5 flex h-auto min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden",
									isMobile && "flex-wrap gap-y-1.5 overflow-visible",
								)}
								ref={breadcrumbRef}
							>
								{breadcrumbItems.map((item, i) => (
									<div key={i} className="flex items-center">
										{isEmpty(item.children) ? (
											<div
												className={cn(
													breadcrumbItemBase,
													(shouldBlockPanelForLoading ||
														!item.operation) &&
														"disable",
												)}
												style={{
													maxWidth:
														breadcrumbItems.length > 1
															? 470 / (breadcrumbItems.length - 1) -
																24
															: undefined,
													cursor: !item.operation
														? "not-allowed"
														: "pointer",
												}}
												onClick={() => onBreadcrumbClick(item)}
												data-testid="on-breadcrumb-click"
											>
												<MagicEllipseWithTooltip
													title={item.name}
													text={item.name}
													className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 text-foreground md:max-w-[400px]"
													placement="topLeft"
												>
													{item.name}
												</MagicEllipseWithTooltip>
											</div>
										) : (
											<Dropdown
												placement="bottomLeft"
												trigger={["click"]}
												overlayStyle={{ zIndex: 9999 }}
												getPopupContainer={(trigger) =>
													trigger.parentElement || document.body
												}
												autoAdjustOverflow={false}
												dropdownRender={() => {
													return (
														<Menu
															style={{
																maxHeight: "250px",
																overflowY: "auto",
															}}
															onClick={(info) => {
																// 通过 key (索引) 找到对应的 subitem
																const index = parseInt(
																	info.key as string,
																	10,
																)
																const subitem =
																	item.children?.[index]
																if (subitem) {
																	onBreadcrumbClick(subitem)
																}
															}}
														>
															{item.children?.map((subitem, j) => (
																<Menu.Item
																	key={j}
																	className="rounded-md transition-colors hover:bg-fill active:bg-fill-secondary"
																>
																	<div
																		className="flex items-center [&_.lock-icon]:mr-0.5 [&_.lock-icon]:text-xs [&_.lock-icon]:text-orange-500 [&_.name]:max-w-[200px] [&_.name]:overflow-hidden [&_.name]:text-ellipsis [&_.name]:whitespace-nowrap"
																		style={{
																			paddingLeft: j * 12,
																		}}
																	>
																		<div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill">
																			<img
																				src={FoldIcon}
																				alt="folder"
																				width={14}
																				height={14}
																				data-testid="cross-project-file-operation-modal-image-5"
																			/>
																		</div>
																		{!subitem.operation && (
																			<IconLock
																				className="lock-icon mr-0.5 text-xs text-orange-500 dark:text-orange-400"
																				size={12}
																			/>
																		)}
																		<MagicEllipseWithTooltip
																			title={subitem.name}
																			text={subitem.name}
																			className="name ml-2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
																			placement="topLeft"
																		>
																			{subitem.name}
																		</MagicEllipseWithTooltip>
																	</div>
																</Menu.Item>
															))}
														</Menu>
													)
												}}
											>
												<div
													className={cn(
														breadcrumbItemBase,
														"ellipsis p-0.5",
													)}
												>
													<IconDots
														className="mx-1 text-base text-muted-foreground"
														size={16}
													/>
												</div>
											</Dropdown>
										)}
										{i < breadcrumbItems.length - 1 && (
											<IconChevronRight
												className="mx-1 text-xs text-muted-foreground"
												size={18}
											/>
										)}
									</div>
								))}
							</div>
						)}
						<div className="ml-auto flex items-center gap-2">
							{createAction && (
								<Button
									variant="outline"
									size="icon"
									disabled={isSearch}
									className={toolbarButtonClass}
									onClick={createAction.onClick}
									aria-label={createAction.label}
									data-testid={createAction.testId}
								>
									<IconFolderPlus size={20} />
								</Button>
							)}
							<Button
								variant="outline"
								size="icon"
								className={toolbarButtonClass}
								onClick={handleToggleSearch}
								aria-label={searchPlaceholder}
								data-testid="cross-project-file-modal-search-toggle"
							>
								<IconSearch size={20} />
							</Button>
						</div>
					</>
				)}
			</div>
			<div
				className={cn(
					"mt-2.5 h-[360px] w-full overflow-x-hidden md:h-auto",
					effectiveViewMode === "workspace"
						? "min-h-0 overflow-hidden md:flex-1"
						: "scrollbar-y-thin overflow-y-auto",
				)}
			>
				{/* MagicSpin 会额外生成一层内容容器；工作区视图必须把高度和 min-h-0 传递到该层，内部滚动区才不会按内容撑开。 */}
				<MagicSpin
					spinning={shouldBlockPanelForLoading}
					className="h-full min-h-0 w-full"
					innerClassName={
						effectiveViewMode === "workspace"
							? "h-full min-h-0 overflow-hidden"
							: undefined
					}
				>
					{effectiveViewMode === "workspace" &&
						(!shouldBlockPanelForLoading ? (
							renderWorkspaceList()
						) : (
							<div className="h-full min-h-[320px] w-full" />
						))}
					{effectiveViewMode === "project" &&
						(!shouldBlockPanelForLoading ? (
							renderProjectList()
						) : (
							<div className="h-full min-h-[320px] w-full" />
						))}
					{effectiveViewMode === "directory" && (
						<>
							{shouldBlockPanelForLoading ? (
								<div className="h-full min-h-[320px] w-full" />
							) : !isEmpty(directories) ||
							  createDirectoryHook.createDirectoryShown ? (
								renderDirectoryTree()
							) : isSearch ? (
								<EmptyStateBox>
									<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
										<IconFileSearch size={24} />
									</div>
									<div className="flex flex-col items-center gap-2 text-center">
										<div className="text-lg font-medium leading-7 text-foreground">
											{searchEmptyTitle}
										</div>
										<div className="text-center text-sm font-normal leading-5 text-foreground/35">
											{searchEmptyDescription}
										</div>
									</div>
								</EmptyStateBox>
							) : (
								<EmptyStateBox>
									<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
										<IconFolder size={24} />
									</div>
									<div className="flex flex-col items-center gap-2 text-center">
										<div className="flex flex-col gap-1.5 text-center text-sm font-normal leading-5 text-foreground/35">
											<span>{emptyStorageDescription}</span>
											{emptyStorageAction && createAction && (
												<Button
													variant="link"
													className="h-auto p-0 leading-5 text-foreground"
													onClick={createAction.onClick}
													data-testid="cross-project-file-modal-empty-create-folder"
												>
													{emptyStorageAction}
												</Button>
											)}
										</div>
									</div>
								</EmptyStateBox>
							)}
						</>
					)}
				</MagicSpin>
			</div>
		</div>
	)

	return (
		<BaseModal
			visible={visible}
			title={title}
			content={modalContent}
			footer={footerConfig}
			onClose={onClose}
			maskClosable={false}
		/>
	)
}

export default ProjectResourceSelectorModal
