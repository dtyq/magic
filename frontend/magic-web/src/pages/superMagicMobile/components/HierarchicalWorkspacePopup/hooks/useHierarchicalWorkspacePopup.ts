import { useMemo, useEffect, useImperativeHandle, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Ref } from "react"
import {
	Workspace,
	ProjectListItem,
	Topic,
	CollaborationProjectType,
} from "@/pages/superMagic/pages/Workspace/types"
import { useProjectOperations } from "./useProjectOperations"
import { useNavigationState } from "./useNavigationState"
import { useModalStates } from "./useModalStates"
import { useActionButtons } from "./useActionButtons"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { isCollaborationWorkspace } from "@/pages/superMagic/constants"
import magicToast from "@/components/base/MagicToaster/utils"
import SuperMagicService from "@/pages/superMagic/services"
import useAddCollaborationToWorkspaceModal from "@/pages/superMagic/components/WorkspacesMenu/components/AddCollaborationToWorkspaceModal/hooks/useAddCollaborationToWorkspaceModal"
import useCollaboratorUpdatePanel from "@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import { workspaceStore, projectStore } from "@/pages/superMagic/stores/core"
import { openModal } from "@/utils/react"
import DeleteDangerModal from "@/components/business/DeleteDangerModal"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import { HierarchicalWorkspacePopupProps, HierarchicalWorkspacePopupRef } from "../types"

const EMPTY_PROJECTS: ProjectListItem[] = []

export function useHierarchicalWorkspacePopup(
	_props: HierarchicalWorkspacePopupProps,
	ref: Ref<HierarchicalWorkspacePopupRef>,
) {
	const { t } = useTranslation("super")

	// Get data from stores
	const workspaces = workspaceStore.workspaces
	const selectedWorkspace = workspaceStore.selectedWorkspace ?? undefined
	const selectedProject = projectStore.selectedProject ?? undefined
	const currentProjects = selectedWorkspace?.id
		? projectStore.getProjectsByWorkspace(selectedWorkspace.id) || EMPTY_PROJECTS
		: EMPTY_PROJECTS

	const [collaborationTabKey, _setCollaborationTabKey] = useState<CollaborationProjectType>(
		CollaborationProjectType.Received,
	)

	// 创建工作区弹窗状态
	const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false)

	// 弹窗状态管理
	const modalStates = useModalStates()
	const {
		visible,
		currentActionItem,
		actionsPopupVisible,
		renameModalVisible,
		deleteModalVisible,
		shareModalVisible,
		setRenameModalVisible,
		setDeleteModalVisible,
		setShareModalVisible,
		handleWorkspaceActionClick,
		handleProjectActionClick,
		handleTopicActionClick,
		closeActionsPopup,
		updateCurrentActionItem,
		showPopup,
		closePopup,
	} = modalStates

	// 导航状态管理
	const navigationState = useNavigationState({
		selectedProject,
		visible,
	})
	const {
		navigationState: navState,
		handleBackClick,
		navigateToProjects,
		handleAutoNavigation,
	} = navigationState

	// Store setters
	const setSelectedProject = useMemoizedFn((project: ProjectListItem | null) => {
		projectStore.setSelectedProject(project)
	})

	// Project deletion handler (kept for useProjectOperations compatibility)
	const handleDeleteProject = useMemoizedFn(async (projectId: string) => {
		if (!selectedWorkspace) return
		try {
			await SuperMagicService.project.deleteProject(projectId, selectedWorkspace.id)
		} catch (error) {
			console.log("Delete project failed:", error)
			throw error
		}
	})

	const onAddWorkspaceClick = useMemoizedFn(async (workspaceName: string) => {
		try {
			await SuperMagicService.createWorkspace(workspaceName)
		} catch (error) {
			console.error(error)
		}
	})

	// 项目操作（使用新的 useProjectOperations）
	const projectOperations = useProjectOperations({
		currentProject: selectedProject,
		currentProjects,
		setRenameModalVisible,
		setDeleteModalVisible,
		setSelectedProject,
		collaborationTabKey,
	})
	const {
		projects,
		loadProjects,
		handleRenameProject,
		handleDeleteProject: handleDeleteProjectInternal,
	} = projectOperations

	// 为指定工作区创建项目
	const createProjectInWorkspace = useMemoizedFn(async (workspaceId: string) => {
		if (!workspaceId) return

		const result = await SuperMagicService.createProjectAndActivateInMobile(workspaceId)
		if (result) {
			// 项目创建成功，已自动切换，无需额外操作
		}
	})

	// 暴露给父组件的方法
	useImperativeHandle(
		ref,
		() => ({
			close: closePopup,
			show: () => {
				showPopup()
				handleAutoNavigation()
			},
			showAndNavigateToWorkspace: (
				workspace: Workspace,
				options?: { hideBackButton?: boolean },
			) => {
				// 先设置导航状态，再打开弹窗
				// useNavigationState 中的 useEffect 会检查 navigationState 的状态，避免覆盖手动设置
				navigateToProjects(workspace, options)
				loadProjects({
					workspaceId: workspace.id || "",
				})
				showPopup()
			},
			openCreateWorkspaceModal: () => {
				closePopup()
				setCreateWorkspaceModalOpen(true)
			},
			createProjectInWorkspace,
		}),
		[
			closePopup,
			showPopup,
			handleAutoNavigation,
			navigateToProjects,
			loadProjects,
			createProjectInWorkspace,
		],
	)

	// 处理工作区选中
	const handleWorkspaceSelect = useMemoizedFn((workspace: Workspace) => {
		SuperMagicService.switchWorkspace(workspace)
		closePopup()
	})

	// 处理工作区点击（合并自 useWorkspaceActions）
	const handleWorkspaceClick = useMemoizedFn((workspace: Workspace) => {
		if (navState.level === "workspace") {
			navigateToProjects(workspace)
			loadProjects({
				workspaceId: workspace.id || "",
			})
		}
	})

	// Handle workspace rename using service
	const handleRenameWorkspace = useMemoizedFn(async (workspace: Workspace) => {
		try {
			await SuperMagicService.workspace.renameWorkspaceWithRefresh(
				workspace.id,
				workspace.name,
			)
			magicToast.success(t("hierarchicalWorkspacePopup.renameSuccess"))
			setRenameModalVisible(false)
		} catch (error) {
			if (error instanceof Error && error.message === "workspaceNameRequired") {
				magicToast.error(t("hierarchicalWorkspacePopup.workspaceNameRequired"))
			}
		}
	})

	// 处理工作区删除
	const handleDeleteWorkspace = useMemoizedFn((workspaceId: string) => {
		if (!workspaceId) return
		openModal(DeleteDangerModal, {
			content:
				workspaceStore.getWorkspaceById(workspaceId)?.name ||
				t("workspace.unnamedWorkspace"),
			needConfirm: true,
			onSubmit: async () => {
				await SuperMagicService.deleteWorkspace(workspaceId)
			},
		})
	})

	// 处理项目点击
	const handleProjectClick = (project: ProjectListItem) => {
		SuperMagicService.switchProjectInMobile(project)
		closePopup()
	}

	// 处理各种删除确认
	const handleDeleteConfirm = useMemoizedFn(() => {
		if (currentActionItem?.type === "workspace") {
			if (!currentActionItem?.workspace?.id) return
			handleDeleteWorkspace(currentActionItem.workspace.id)
		} else if (currentActionItem?.type === "project") {
			if (!currentActionItem?.project?.id) return
			handleDeleteProjectInternal(currentActionItem.project.id, handleDeleteProject)
		}
	})

	// 处理各种重命名
	const handleRename = () => {
		if (currentActionItem?.type === "workspace" && currentActionItem.workspace) {
			handleRenameWorkspace(currentActionItem.workspace)
		} else if (
			currentActionItem?.type === "project" &&
			currentActionItem.project &&
			currentActionItem.workspace
		) {
			handleRenameProject(currentActionItem.project, currentActionItem.workspace.id)
		}
	}

	// 处理分享保存
	// const handleShareSave = async ({ type, extraData }: { type: any; extraData: any }) => {
	// 	if (currentActionItem?.topic?.id) {
	// 		await topicActions.handleShareTopic({
	// 			type,
	// 			extraData,
	// 			topicId: currentActionItem.topic.id,
	// 		})
	// 	}
	// }

	// Handle copy collaboration link using service
	const handleCopyCollaborationLink = useMemoizedFn(async (project?: ProjectListItem) => {
		if (!project) return
		const success = await SuperMagicService.project.copyCollaborationLink(project)
		if (success) {
			magicToast.success(t("collaborators.copySuccess"))
		}
	})

	const {
		AddCollaborationToWorkspaceModal: AddCollaborationToWorkspacePopup,
		onOpen: onAddWorkspaceShortcut,
	} = useAddCollaborationToWorkspaceModal({
		workspaces,
		fetchWorkspaces: SuperMagicService.workspace.fetchWorkspaces,
		onSuccess: (workspaceId) => {
			refetchCollaborationProjects()
			if (selectedWorkspace?.id === workspaceId) {
				SuperMagicService.project.fetchProjects({
					workspaceId: workspaceId,
					clearWhenNoProjects: false,
				})
			}
		},
	})

	// Handle cancel workspace shortcut using service with auto refresh
	const cancelWorkspaceShortcut = useMemoizedFn(async (project: ProjectListItem) => {
		if (!project || !currentActionItem?.workspace) return
		const targetWorkspaceId = currentActionItem?.workspace?.id
		if (!targetWorkspaceId) return
		try {
			await SuperMagicService.project.cancelWorkspaceShortcutAndRefresh(
				project.id,
				targetWorkspaceId,
				selectedWorkspace?.id,
			)
			// Refresh local list
			loadProjects({
				workspaceId: targetWorkspaceId,
			})
		} catch (error) {
			// Error already handled in service
		}
	})

	// Handle pin project using service with auto refresh
	const handlePinProject = useMemoizedFn(async (project?: ProjectListItem) => {
		if (!project || !navState.currentWorkspace?.id) return
		try {
			await SuperMagicService.project.pinProjectAndRefresh(
				project,
				!project.is_pinned,
				navState.currentWorkspace.id,
				selectedWorkspace?.id,
			)
			// Refresh local list
			loadProjects({
				workspaceId: navState.currentWorkspace.id,
			})
		} catch (error) {
			// Error already handled in service
		}
		closeActionsPopup()
	})

	const shortcutNavigateToWorkspace = useMemoizedFn((project: ProjectListItem) => {
		if (project.bind_workspace_id) {
			routeManageService.navigateToState({
				workspaceId: project.bind_workspace_id,
				projectId: null,
				topicId: null,
			})

			closeActionsPopup()
			closePopup()
		}
	})

	const { openManageModal, CollaboratorUpdatePanel } = useCollaboratorUpdatePanel({
		selectedProject: currentActionItem?.project || null,
	})

	// 操作按钮配置（使用新的 useActionButtons hook）
	const actionButtonList = useActionButtons({
		currentActionItem,
		setRenameModalVisible,
		setDeleteModalVisible,
		closeActionsPopup,
		handleDeleteConfirm,
		handlePinProject,
		handleCopyCollaborationLink,
		openManageModal,
		onAddWorkspaceShortcut,
		shortcutNavigateToWorkspace,
		cancelWorkspaceShortcut,
		currentProjects,
		currentWorkspace: navState.currentWorkspace,
	})

	// 获取标题
	const getTitle = useMemo(() => {
		if (navState.level === "workspace") {
			return t("hierarchicalWorkspacePopup.allWorkspaces", { count: workspaces.length })
		} else if (navState.level === "project") {
			if (navState.currentWorkspace && isCollaborationWorkspace(navState.currentWorkspace)) {
				return t("hierarchicalWorkspacePopup.shareWorkspace", { count: projects.length })
			}
			return `${navState.currentWorkspace?.name || t("workspace.unnamedWorkspace")} (${projects.length})`
		}
	}, [navState.currentWorkspace, navState.level, t, workspaces.length, projects.length])

	// 初始化数据：弹窗打开时的初始化逻辑
	useEffect(() => {
		if (!visible) return

		// 初始化项目列表
		if (projects.length === 0 && currentProjects) {
			projectOperations.setProjects(currentProjects)
		}

		// 如果是工作区 level，重新拉取工作区列表
		if (navState.level === "workspace") {
			SuperMagicService.workspace.fetchWorkspaces({
				isAutoSelect: false,
				isSelectLast: false,
				isEditLast: false,
				page: 1,
			})
		}

		// 如果导航到项目列表层级且项目列表为空，自动加载项目
		if (
			navState.level === "project" &&
			navState.currentWorkspace &&
			projects.length === 0 &&
			!isCollaborationWorkspace(navState.currentWorkspace)
		) {
			loadProjects({
				workspaceId: navState.currentWorkspace.id || "",
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible, navState.level])

	// 监听导航层级变化，切换层级时刷新数据
	useUpdateEffect(() => {
		if (navState.level === "workspace") {
			SuperMagicService.workspace.fetchWorkspaces({
				isAutoSelect: false,
				isSelectLast: false,
				isEditLast: false,
				page: 1,
			})
		}
	}, [navState.level])

	const refetchCollaborationProjects = useMemoizedFn(
		(_collaborationTabKey?: CollaborationProjectType) => {
			if (isCollaborationWorkspace(navState.currentWorkspace)) {
				loadProjects({
					workspaceId: navState.currentWorkspace?.id || "",
					collaborationTabKey: _collaborationTabKey || collaborationTabKey,
				})
			}
		},
	)

	const setCollaborationTabKey = useMemoizedFn(
		(collaborationTabKey: CollaborationProjectType) => {
			_setCollaborationTabKey(collaborationTabKey)
			refetchCollaborationProjects(collaborationTabKey)
		},
	)

	// 监听协作工作区变化，自动加载协作项目
	useEffect(() => {
		if (visible && isCollaborationWorkspace(navState.currentWorkspace)) {
			refetchCollaborationProjects()
		}
	}, [visible, navState.currentWorkspace, refetchCollaborationProjects])

	// 弹窗关闭时清理状态
	useEffect(() => {
		if (!visible) {
			// 清理操作项（保留导航状态以便下次快速定位）
			updateCurrentActionItem(() => null)
		}
	}, [visible, updateCurrentActionItem])

	// Handle add project using service orchestration
	const onAddProjectClick = useMemoizedFn(async () => {
		const workspaceId = navState.currentWorkspace?.id || ""
		if (!workspaceId) return

		const result = await SuperMagicService.createProjectAndActivateInMobile(workspaceId)
		if (result) {
			// Refresh local project list
			loadProjects({ workspaceId })
			closePopup()
		}
	})

	return {
		// 状态
		visible,
		navState,
		currentActionItem,
		workspaces,
		projects,
		actionsPopupVisible,
		renameModalVisible,
		deleteModalVisible,
		shareModalVisible,
		selectedWorkspace,
		selectedProject,

		// 配置
		actionButtonList,
		getTitle,

		// 事件处理
		handleWorkspaceSelect,
		handleWorkspaceClick,
		handleProjectClick,
		handleBackClick,
		handleWorkspaceActionClick,
		handleProjectActionClick: (project: ProjectListItem) =>
			handleProjectActionClick(project, navState.currentWorkspace),
		handleTopicActionClick: (topic: Topic) =>
			handleTopicActionClick(topic, navState.currentWorkspace, navState.currentProject),
		handleDeleteConfirm,
		handleRename,
		onAddWorkspaceClick,
		onAddProjectClick,
		closePopup,
		closeActionsPopup,

		// 模态框状态控制
		setRenameModalVisible,
		setDeleteModalVisible,
		setShareModalVisible,
		updateCurrentActionItem,

		// 创建工作区弹窗
		createWorkspaceModalOpen,
		setCreateWorkspaceModalOpen,

		// 翻译
		t,

		// 协作项目tab
		collaborationTabKey,
		setCollaborationTabKey,
		refetchCollaborationProjects,
		CollaboratorUpdatePanel,

		// 添加工作区快捷方式
		AddCollaborationToWorkspacePopup,
	}
}
