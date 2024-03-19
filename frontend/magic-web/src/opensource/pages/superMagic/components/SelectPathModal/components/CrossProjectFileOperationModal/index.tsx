import React, { useState, useMemo, useEffect, useRef } from "react"
import { Dropdown, Menu } from "antd"
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
import { isEmpty, last } from "lodash-es"
import { useTranslation } from "react-i18next"

import { cn } from "@/opensource/lib/utils"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import BaseModal from "../BaseModal"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import { SuperMagicApi } from "@/opensource/apis"
import { AttachmentItem } from "../../../TopicFilesButton/hooks"
import FoldIcon from "@/opensource/pages/superMagic/assets/svg/file-folder.svg"
import EmptyFilesIcon from "@/opensource/pages/superMagic/assets/svg/empty-files.svg"
import { InputWithError } from "@/opensource/pages/superMagic/components/TopicFilesButton/components"
import IconWorkspace from "../../../icons/IconWorkspace"
import IconProject from "../../../icons/IconProject"

import type { CrossProjectFileOperationModalProps, ViewMode } from "../../types"
import type { BreadcrumbItem } from "../../utils/breadcrumbUtils"
import type {
	Workspace,
	ProjectListItem,
	CollaborationProjectListItem,
} from "../../../../pages/Workspace/types"
import { SHARE_WORKSPACE_ID, SHARE_WORKSPACE_DATA } from "../../../../constants"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MagicEllipseWithTooltip from "@/opensource/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
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
import magicToast from "@/opensource/components/base/MagicToaster/utils"

function CrossProjectFileOperationModal({
	visible,
	title,
	operationType,
	selectedWorkspace,
	selectedProject,
	workspaces,
	fileIds,
	sourceAttachments,
	initialPath = [],
	onClose,
	onSubmit,
}: CrossProjectFileOperationModalProps) {
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")

	// 视图状态：workspace -> project -> directory
	const [viewMode, setViewMode] = useState<ViewMode>("workspace")
	const [loading, setLoading] = useState(false)
	const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
	const [currentProject, setCurrentProject] = useState<ProjectListItem | null>(null)
	const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>(workspaces)
	const [availableProjects, setAvailableProjects] = useState<ProjectListItem[]>([])
	const [attachments, setAttachments] = useState<AttachmentItem[]>([])
	const [path, setPath] = useState<AttachmentItem[]>(initialPath)
	const [directories, setDirectories] = useState<AttachmentItem[]>([])
	const [isSearch, setIsSearch] = useState(false)
	const [fileName, setFileName] = useState("")
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	// 用于跟踪是否已经初始化，避免重复加载
	const initializedRef = useRef(false)
	// 面包屑容器宽度，用于动态计算可显示的项
	const breadcrumbRef = useRef<HTMLDivElement>(null)
	const [breadcrumbContainerWidth, setBreadcrumbContainerWidth] = useState(0)

	// 计算禁用的文件夹ID列表（仅移动操作时不能移动到当前路径或子路径，复制操作允许）
	const disabledFolderIds = useMemo(() => {
		if (operationType === "move") {
			return collectSelectedFolderIds(sourceAttachments, fileIds)
		}
		return [] // 复制操作不限制
	}, [sourceAttachments, fileIds, operationType])

	// 检查当前项目是否有编辑权限
	const canEdit = useMemo(() => {
		if (viewMode === "directory" && currentProject) {
			// 目录视图：检查项目权限
			return hasEditPermission(currentProject.user_role)
		} else if (viewMode === "project" && currentWorkspace) {
			// 项目视图：只要有工作区就可以创建项目（假设工作区创建者可以创建项目）
			return true
		} else if (viewMode === "workspace") {
			// 工作区视图：可以创建工作区
			return true
		}
		return false
	}, [viewMode, currentProject, currentWorkspace])

	// 过滤出有编辑权限的项目
	const editableProjects = useMemo(() => {
		return availableProjects.filter((project) => hasEditPermission(project.user_role))
	}, [availableProjects])

	// 获取工作区的显示名称（用于搜索匹配）
	const getWorkspaceDisplayName = useMemoizedFn((workspace: Workspace) => {
		if (workspace.id === SHARE_WORKSPACE_ID) {
			return t("workspace.shareWorkspaceName")
		}
		return workspace.name || t("workspace.unnamedWorkspace")
	})

	// 获取项目的显示名称（用于搜索匹配）
	const getProjectDisplayName = useMemoizedFn((project: ProjectListItem) => {
		return project.project_name || t("project.unnamedProject")
	})

	// 获取共享项目列表
	const fetchCollaborationProjects = useMemoizedFn(async () => {
		setLoading(true)
		try {
			const res = await SuperMagicApi.getCollaborationProjects({
				page: 1,
				page_size: 99,
			})
			// 将 CollaborationProjectListItem 转换为 ProjectListItem
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

	// 获取工作区的项目列表
	const fetchProjectsByWorkspace = useMemoizedFn(async (workspaceId: string) => {
		if (workspaceId === SHARE_WORKSPACE_ID) {
			await fetchCollaborationProjects()
			return
		}
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

	// 工作区选择处理
	const handleWorkspaceClick = useMemoizedFn(async (workspace: Workspace) => {
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
				page_size: 99,
			})
			const refreshedWorkspaces = res?.list || []
			// 更新内部工作区列表状态
			setAvailableWorkspaces(refreshedWorkspaces)
			return refreshedWorkspaces
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
			setCurrentWorkspace(foundWorkspace)
			setViewMode("project")
			await fetchProjectsByWorkspace(foundWorkspace.id)
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

	// 项目选择处理
	const handleProjectClick = useMemoizedFn(async (project: ProjectListItem) => {
		setLoading(true)
		setIsSearch(false)
		setIsSearchOpen(false)
		setFileName("")
		createDirectoryHook.cancelCreateDirectory()
		createProjectHook.cancelCreateProject()
		try {
			const res = await SuperMagicApi.getAttachmentsByProjectId({
				projectId: project.id,
				temporaryToken:
					(window as Window & { temporary_token?: string }).temporary_token || "",
			})
			setCurrentProject(project)
			setViewMode("directory")
			setAttachments(res?.tree || [])
			setPath([])
			const dirs = getDirectoriesFromPath(res?.tree || [], [])
			setDirectories(filesSort(dirs))
		} catch (error) {
			console.error("Failed to fetch attachments:", error)
			magicToast.error(t("selectPathModal.fetchAttachmentsFailed"))
		}
		setLoading(false)
	})

	// 返回项目列表
	const handleBackToProject = useMemoizedFn(async () => {
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
			const workspaceName =
				currentWorkspace.id === SHARE_WORKSPACE_ID
					? t("workspace.shareWorkspaceName")
					: currentWorkspace.name || t("workspace.unnamedWorkspace")
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
		if (viewMode === "directory") {
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
	}, [currentWorkspace, currentProject, path, viewMode, t])

	// 根据容器宽度计算可显示的面包屑项
	const breadcrumbItems = useMemo(() => {
		return calculateBreadcrumbDisplayItems(breadcrumbItemsRaw, breadcrumbContainerWidth)
	}, [breadcrumbItemsRaw, breadcrumbContainerWidth])

	// 测量面包屑容器宽度
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

		if (viewMode === "directory" && currentProject) {
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
				await fetchDirectories({
					projectId: params.projectId,
					parentId: lastPath ? getItemId(lastPath) : undefined,
				})
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

		if (viewMode === "workspace") {
			searchWorkspaces(value)
		} else if (viewMode === "project") {
			searchProjects(value)
		} else if (viewMode === "directory" && currentProject) {
			fetchFiles({
				value,
				projectId: currentProject.id,
			})
		}
	})

	const onBreadcrumbClick = useMemoizedFn(async (item: BreadcrumbItem) => {
		if (loading) return

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
		if (currentProject && viewMode === "directory") {
			const index = path.findIndex((o) => getItemId(o) === item.id)
			const newPath = index >= 0 ? path.slice(0, index + 1) : []
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

	const onDirectoryClick = useMemoizedFn(async (item: AttachmentItem) => {
		if (!currentProject) return
		setIsSearch(false)

		if (!item.is_directory) {
			return
		}

		// 仅移动操作时检查是否为禁用的文件夹（复制操作允许复制到自己或子级）
		if (operationType === "move") {
			const itemId = getItemId(item)
			if (disabledFolderIds.includes(itemId)) {
				magicToast.info(t("selectPathModal.cannotSelectCurrentFolder"))
				return
			}
		}

		const newPath = [...path, item]
		setPath(newPath)
		await fetchDirectories({
			projectId: currentProject.id,
			parentId: getItemId(item),
			pathOverride: newPath,
		})
		createDirectoryHook.cancelCreateDirectory()
		createWorkspaceHook.cancelCreateWorkspace()
		createProjectHook.cancelCreateProject()
	})

	const submit = useMemoizedFn(() => {
		if (!currentProject) return
		onSubmit &&
			onSubmit({
				targetProjectId: currentProject.id,
				targetPath: path,
				targetAttachments: attachments,
				sourceAttachments: sourceAttachments,
			})
		onClose && onClose()
	})

	// 是否可以提交（必须选择了工作区和项目）
	const canSubmit = useMemo(() => {
		return currentWorkspace !== null && currentProject !== null
	}, [currentWorkspace, currentProject])

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

		// 如果有当前工作区和当前项目，默认选中它们
		if (selectedWorkspace && selectedProject) {
			setCurrentWorkspace(selectedWorkspace)
			setCurrentProject(selectedProject)
			setViewMode("directory")
			setPath(initialPath)
			setFileName("")
			setIsSearch(false)
			setIsSearchOpen(false)
			createDirectoryHook.cancelCreateDirectory()
			createWorkspaceHook.cancelCreateWorkspace()
			createProjectHook.cancelCreateProject()

			// 加载项目附件数据
			const loadAttachments = async () => {
				setLoading(true)
				try {
					const res = await SuperMagicApi.getAttachmentsByProjectId({
						projectId: selectedProject.id,
						temporaryToken:
							(window as Window & { temporary_token?: string }).temporary_token || "",
					})
					setAttachments(res?.tree || [])
					// 使用 initialPath 来获取目录内容
					const dirs = getDirectoriesFromPath(res?.tree || [], initialPath)
					setDirectories(filesSort(dirs))
				} catch (error) {
					console.error("Failed to fetch attachments:", error)
					setAttachments([])
					setDirectories([])
				}
				setLoading(false)
			}

			loadAttachments()
		} else {
			// 否则重置到工作区选择视图
			setViewMode("workspace")
			setCurrentWorkspace(null)
			setCurrentProject(null)
			setAvailableProjects([])
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
	}, [visible])

	// 根据 viewMode 动态设置搜索 placeholder
	const searchPlaceholder = useMemo(() => {
		if (viewMode === "workspace") {
			return t("selectPathModal.searchWorkspace")
		} else if (viewMode === "project") {
			return t("selectPathModal.searchProject")
		} else {
			return t("selectPathModal.searchDirectory")
		}
	}, [viewMode, t])
	const storageLabel = t("selectPathModal.selectStorageLocation")
	const emptyStorageDescription = t("selectPathModal.emptyStorageDescription")
	const emptyStorageAction = t("selectPathModal.emptyStorageAction")
	const searchEmptyTitle = t("selectPathModal.searchEmptyTitle")
	const searchEmptyDescription = t("selectPathModal.searchEmptyDescription", {
		keyword: fileName,
	})

	const createAction = useMemo(() => {
		if (viewMode === "workspace") {
			return {
				onClick: createWorkspaceHook.showCreateWorkspace,
				label: t("selectPathModal.newWorkspace"),
				testId: "cross-project-file-modal-create-workspace",
			}
		}
		if (viewMode === "project" && canEdit) {
			return {
				onClick: createProjectHook.showCreateProject,
				label: t("selectPathModal.newProject"),
				testId: "cross-project-file-modal-create-project",
			}
		}
		if (viewMode === "directory" && canEdit) {
			return {
				onClick: createDirectoryHook.showCreateDirectory,
				label: t("selectPathModal.newSubfolder"),
				testId: "cross-project-file-modal-create-directory",
			}
		}
		return null
	}, [viewMode, canEdit, t, createWorkspaceHook, createProjectHook, createDirectoryHook])

	const footerConfig = {
		okText: t("selectPathModal.confirm"),
		cancelText: t("common.cancel"),
		onOk: submit,
		onCancel: handleCancel,
		okDisabled: isSearch || !canSubmit,
	}

	const handleKeyDown = useMemoizedFn((event: KeyboardEvent) => {
		if (event.key === "Escape") {
			backCatalogueSelect()
		}
	})

	useEffect(() => {
		if (visible) {
			window.addEventListener("keydown", handleKeyDown)
			return () => window.removeEventListener("keydown", handleKeyDown)
		} else {
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [visible, handleKeyDown])

	// 渲染工作区列表
	const renderWorkspaceList = () => {
		// 创建共享工作区对象
		const shareWorkspace = SHARE_WORKSPACE_DATA(t)
		// 合并工作区列表和共享工作区
		const allWorkspaces = [...availableWorkspaces, shareWorkspace]

		// 根据搜索关键词过滤工作区（使用显示名称进行匹配，支持未命名工作区和共享工作区）
		const filteredWorkspaces =
			isSearch && fileName
				? allWorkspaces.filter((workspace) =>
						getWorkspaceDisplayName(workspace)
							.toLowerCase()
							.includes(fileName.toLowerCase()),
					)
				: allWorkspaces

		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-[4px] p-2.5 transition-all hover:not(.disable):bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 md:max-w-[400px]"
		return (
			<>
				{createWorkspaceHook.createWorkspaceShown && (
					<div className={textFolderItemClass}>
						<div className={folderIconClass}>
							<IconWorkspace />
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
				{filteredWorkspaces.length > 0 ? (
					filteredWorkspaces.map((workspace, index) => (
						<div
							key={workspace.id || index}
							className={textFolderItemClass}
							onClick={() => handleWorkspaceClick(workspace)}
						>
							<div className="flex w-full flex-1 items-center justify-between gap-2.5">
								<div className="flex flex-1 items-center gap-1">
									<div className={folderIconClass}>
										<IconWorkspace />
									</div>
									<MagicEllipseWithTooltip
										title={
											workspace.id === SHARE_WORKSPACE_ID
												? t("workspace.shareWorkspaceName")
												: workspace.name || t("workspace.unnamedWorkspace")
										}
										text={
											workspace.id === SHARE_WORKSPACE_ID
												? t("workspace.shareWorkspaceName")
												: workspace.name || t("workspace.unnamedWorkspace")
										}
										className={nameClass}
										placement="topLeft"
									>
										{workspace.id === SHARE_WORKSPACE_ID
											? t("workspace.shareWorkspaceName")
											: workspace.name || t("workspace.unnamedWorkspace")}
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
				) : (
					<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
						<img src={EmptyFilesIcon} alt="" width={200} height={200} />
						<div className="text-sm leading-5 text-foreground/35">
							{isSearch && fileName
								? t("common.notFound")
								: t("selectPathModal.noWorkspace")}
						</div>
					</div>
				)}
			</>
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
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-[4px] p-2.5 transition-all hover:not(.disable):bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 md:max-w-[400px]"
		return (
			<>
				{createProjectHook.createProjectShown && (
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
							onPressEnter={createProjectHook.submitCreateProject}
							onKeyDown={createProjectHook.onCreateProjectInputKeyDown}
							onBlur={createProjectHook.submitCreateProject}
							placeholder={t("selectPathModal.inputProjectName")}
							errorMessage={createProjectHook.createProjectErrorMessage}
							showError={!!createProjectHook.createProjectErrorMessage}
						/>
					</div>
				)}
				{filteredProjects.length > 0 ? (
					filteredProjects.map((project, index) => (
						<div
							key={project.id || index}
							className={textFolderItemClass}
							onClick={() => handleProjectClick(project)}
						>
							<div className="flex w-full flex-1 items-center justify-between gap-2.5">
								<div className="flex flex-1 items-center gap-1">
									<div className={folderIconClass}>
										<IconProject />
									</div>
									<MagicEllipseWithTooltip
										title={project.project_name || t("project.unnamedProject")}
										text={project.project_name || t("project.unnamedProject")}
										className={nameClass}
										placement="topLeft"
									>
										{project.project_name || t("project.unnamedProject")}
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
				) : (
					<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
						<img src={EmptyFilesIcon} alt="" width={200} height={200} />
						<div className="text-sm leading-5 text-foreground/35">
							{isSearch && fileName
								? t("common.notFound")
								: t("selectPathModal.noProject")}
						</div>
					</div>
				)}
			</>
		)
	}

	// 渲染目录树
	const renderDirectoryTree = () => {
		const textFolderItemClass =
			"mb-0.5 flex h-10 cursor-pointer items-center gap-1 rounded-[4px] p-2.5 transition-all hover:not(.disable):bg-fill [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
		const folderIconClass =
			"flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill"
		const nameClass =
			"max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 md:max-w-[400px]"
		return (
			<>
				{createDirectoryHook.createDirectoryShown && (
					<div
						className={cn(textFolderItemClass, "gap-2")}
						data-testid="cross-project-file-modal-create-directory-row"
					>
						<div className="flex min-w-0 flex-1 items-center gap-1">
							<div className={folderIconClass}>
								<img src={FoldIcon} alt="folder" width={14} height={14} />
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
								className="size-8 shrink-0 rounded-md border-border [&_svg]:text-[#10b981]"
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
								className="size-8 shrink-0 rounded-md border-border [&_svg]:text-[#ef4444]"
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
						>
							<div className="flex w-full flex-1 items-center justify-between gap-2.5">
								<div className="flex flex-1 items-center gap-1">
									<div className={folderIconClass}>
										{directory.is_directory ? (
											<img
												src={FoldIcon}
												alt="folder"
												width={14}
												height={14}
											/>
										) : (
											<MagicFileIcon
												type={directory.file_extension}
												size={14}
											/>
										)}
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
		"inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-white text-foreground shadow-sm hover:bg-fill active:bg-fill-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:text-foreground dark:bg-card"
	const breadcrumbItemBase =
		"relative flex max-w-[150px] cursor-pointer items-center rounded-[4px] text-foreground transition-colors hover:not(.disable):not(.current):text-primary [&.disable]:cursor-not-allowed [&.disable]:opacity-50"
	const modalContent = (
		<div
			className={cn(
				"flex h-full min-h-0 flex-1 flex-col overflow-hidden",
				isMobile && "h-[calc(100%-141px)]",
			)}
		>
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
					<div className="flex min-w-0 flex-1 items-center gap-2">
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
									"m-0 mx-2.5 my-2.5 flex h-auto min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden p-0",
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
													(loading || !item.operation) && "disable",
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
											>
												<MagicEllipseWithTooltip
													title={item.name}
													text={item.name}
													className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap leading-6 md:max-w-[400px]"
													placement="topLeft"
												>
													{item.name}
												</MagicEllipseWithTooltip>
											</div>
										) : (
											<Dropdown
												placement="bottomLeft"
												dropdownRender={() => (
													<Menu
														style={{
															maxHeight: "250px",
															overflowY: "auto",
														}}
													>
														{item.children?.map((subitem, j) => (
															<Menu.Item
																key={j}
																onClick={() =>
																	onBreadcrumbClick(subitem)
																}
															>
																<div className="flex items-center [&_.lock-icon]:mr-0.5 [&_.lock-icon]:text-xs [&_.lock-icon]:text-orange-500 [&_.name]:max-w-[200px] [&_.name]:overflow-hidden [&_.name]:text-ellipsis [&_.name]:whitespace-nowrap">
																	<div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-fill">
																		<img
																			src={FoldIcon}
																			alt="folder"
																			width={14}
																			height={14}
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
																		className="name max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
																		placement="topLeft"
																	>
																		{subitem.name}
																	</MagicEllipseWithTooltip>
																</div>
															</Menu.Item>
														))}
													</Menu>
												)}
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
												className="mx-1 text-xs text-gray-400 dark:text-gray-500"
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
			<div className="mt-2.5 h-[360px] w-full overflow-y-auto overflow-x-hidden md:h-auto">
				<MagicSpin spinning={loading} className="h-full w-full">
					{viewMode === "workspace" && renderWorkspaceList()}
					{viewMode === "project" && renderProjectList()}
					{viewMode === "directory" && (
						<>
							{!isEmpty(directories) || createDirectoryHook.createDirectoryShown ? (
								renderDirectoryTree()
							) : isSearch ? (
								<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
									<div className="flex h-[400px] w-full flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-white p-6 dark:bg-card">
										<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm dark:bg-card">
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
									</div>
								</div>
							) : (
								<div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
									<div className="flex h-[400px] w-full flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-white p-6 dark:bg-card">
										<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm dark:bg-card">
											<IconFolder size={24} />
										</div>
										<div className="flex flex-col items-center gap-2 text-center">
											<div className="flex flex-col gap-1.5 text-center text-sm font-normal leading-5 text-foreground/35">
												<span>
													{emptyStorageDescription ||
														t("selectPathModal.emptyDataTip")}
												</span>
												<Button
													variant="link"
													className="h-auto p-0 leading-5 text-foreground disabled:pointer-events-none disabled:opacity-50"
													onClick={createAction?.onClick}
													disabled={!createAction}
													data-testid="cross-project-file-modal-empty-create-folder"
												>
													{emptyStorageAction}
												</Button>
											</div>
										</div>
									</div>
								</div>
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

export default CrossProjectFileOperationModal
