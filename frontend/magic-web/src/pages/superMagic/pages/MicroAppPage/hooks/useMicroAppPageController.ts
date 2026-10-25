import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDebounceFn, useDeepCompareEffect, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import { SuperMagicApi } from "@/apis"
import type { UpdateMicroAppBody } from "@/apis/modules/superMagic"
import magicToast from "@/components/base/MagicToaster/utils"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import useCollaboratorUpdatePanel from "@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import {
	normalizeUpdateAttachmentsPayload,
	releaseAttachmentsRefreshWaitersWithoutFetch,
	type SuperMagicUpdateAttachmentsRequest,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import {
	canEditProject,
	canManageProject,
	isReadOnlyProject,
} from "@/pages/superMagic/utils/permission"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useOrganization } from "@/models/user/hooks/useOrganization"

import type { DetailRef } from "@/pages/superMagic/components/Detail"
import { getFileManagerRequest } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/fileManagerTabs"
import { useAppStore } from "../context"
import { captureMicroAppCover } from "../utils/captureMicroAppCover"
import { canEditMicroAppMetadata, canPublishMicroApp } from "../utils/microAppPermissions"
import { getAttachmentId, resolveSelectedHtmlEntry } from "../utils/microAppFiles"
import { useMicroAppSelectedProjectSync } from "./useMicroAppSelectedProjectSync"
import { useMicroAppVisit } from "./useMicroAppVisit"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"

/**
 * 微应用桌面端和移动端共用的数据控制层。
 * 文件加载、默认入口恢复和项目权限只维护一份，页面组件只负责各自的布局。
 */
export function useMicroAppPageController(appId: string, projectId: string) {
	const { t } = useTranslation("super")
	const { organizationCode: currentOrganizationCode } = useOrganization()
	const store = useAppStore()
	const { conversation } = store
	const conversationType = store.conversationType
	const navigate = useNavigate()
	const [isInitialAttachmentsLoaded, setIsInitialAttachmentsLoaded] = useState(false)
	const [activeFileId, setActiveFileId] = useState<string | null>(null)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>(null)
	const [isFileTabsCacheLoaded, setIsFileTabsCacheLoaded] = useState(false)
	const [publishDialogOpen, setPublishDialogOpen] = useState(false)
	const [editDialogOpen, setEditDialogOpen] = useState(false)
	const [editSubmitting, setEditSubmitting] = useState(false)
	const [isDatabasePanelOpen, setIsDatabasePanelOpen] = useState(false)
	const [publishedDefaultOpenFileId, setPublishedDefaultOpenFileId] = useState<string | null>(
		null,
	)
	const [sourceOrganizationCode, setSourceOrganizationCode] = useState("")
	const detailRef = useRef<DetailRef>(null)
	const defaultEntryOpenedKeyRef = useRef<string | null>(null)
	const recordVisit = useMicroAppVisit(appId)
	// Files, database and publish configuration always belong to the development
	// project. The active conversation may point at the usage project.
	const selectedProject = store.developmentConversation.selectedProject
	// Both layouts use the development app name, even when the usage conversation is active.
	useNamedPageTitle({
		entityName: selectedProject?.id === projectId ? selectedProject.project_name : undefined,
		fallbackName: t("microAppsPage.unnamedApp"),
	})
	const selectedTopic = store.developmentConversation.topicStore.selectedTopic
	const canUseDevelopment = canEditProject(
		store.developmentConversation.selectedProject?.user_role,
	)
	// Developers already sit in the source org; fall back while detail loads.
	const resolvedSourceOrganizationCode =
		sourceOrganizationCode || (canUseDevelopment ? currentOrganizationCode || "" : "")
	const hasRunningTopic =
		selectedTopic?.task_status === TaskStatus.RUNNING ||
		store.developmentConversation.topicStore.topics.some(
			(topic) => topic.task_status === TaskStatus.RUNNING,
		)
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)
	const canEdit = canEditMicroAppMetadata(selectedProject)
	const canPublish = canPublishMicroApp(selectedProject)
	const attachments = store.projectFilesStore.workspaceFileTree
	const attachmentList = store.projectFilesStore.workspaceFilesList
	const collaborationProject = useMemo(
		() =>
			selectedProject
				? {
						...selectedProject,
						// 协作接口继续使用 project_id，协作弹窗的访问地址使用微应用 app_id。
						app_id: appId,
					}
				: null,
		[appId, selectedProject],
	)

	const setAttachments = useMemoizedFn((nextAttachments: AttachmentItem[]) => {
		store.projectFilesStore.setWorkspaceFileTree(nextAttachments)
	})

	useEffect(() => {
		if (projectId && store.projectId !== projectId) {
			store.initFromProjectId(projectId)
		}
	}, [appId, projectId, store])

	useEffect(() => {
		const canUseRuntime = Boolean(
			appId &&
			currentOrganizationCode &&
			resolvedSourceOrganizationCode &&
			currentOrganizationCode === resolvedSourceOrganizationCode,
		)
		if (canUseRuntime) {
			void store.loadRuntimeProject(appId)
			return
		}
		store.resetRuntimeProjectContext()
	}, [appId, currentOrganizationCode, resolvedSourceOrganizationCode, store])

	useEffect(() => {
		if (selectedProject && !canUseDevelopment && conversationType === "development") {
			store.setConversationType("usage")
		}
	}, [canUseDevelopment, conversationType, selectedProject, store])

	useEffect(() => {
		setActiveFileId(null)
		setUserSelectDetail(null)
		setIsFileTabsCacheLoaded(false)
		defaultEntryOpenedKeyRef.current = null
		setPublishDialogOpen(false)
		setEditDialogOpen(false)
		setEditSubmitting(false)
		setIsDatabasePanelOpen(false)
		setPublishedDefaultOpenFileId(null)
	}, [projectId])

	useEffect(() => {
		if (!appId) return

		let active = true
		setSourceOrganizationCode("")
		void SuperMagicApi.getMicroAppProject(appId, { enableErrorMessagePrompt: false })
			.then((detail) => {
				if (!active) return
				setSourceOrganizationCode(detail.organization_code?.trim() || "")
				const published = detail.publish as
					{ default_open_file_id?: string | null } | undefined
				setPublishedDefaultOpenFileId(published?.default_open_file_id ?? null)
			})
			.catch(() => {
				if (active) setPublishedDefaultOpenFileId(null)
			})

		return () => {
			active = false
		}
	}, [appId])

	useDefaultModeModelListRefreshOnMount()

	const updateAttachments = useDebounceFn(
		(pid?: string, callback?: (didLoad: boolean) => void) => {
			if (!pid) {
				store.projectFilesStore.setWorkspaceFileTree([])
				releaseAttachmentsRefreshWaitersWithoutFetch()
				callback?.(false)
				return
			}

			let didLoad = false

			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			withAttachmentsRefreshWaitersResolved(
				pid,
				SuperMagicApi.getAttachmentsByProjectId({
					projectId: pid,
				})
					.then((res) => {
						const processedData = AttachmentDataProcessor.processAttachmentData(res)
						store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
						store.mentionPanelStore.finishLoadAttachmentsPromise(pid)
						didLoad = true
					})
					.catch((error) => {
						console.error("Failed to fetch micro app attachments:", error)
						store.projectFilesStore.setWorkspaceFileTree([])
					})
					.finally(() => {
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
						callback?.(didLoad)
					}),
			)
		},
		{ wait: 500 },
	).run

	const defaultEntryFile = useMemo(
		() =>
			resolveSelectedHtmlEntry({
				items: attachmentList,
				selectedFileId: publishedDefaultOpenFileId,
			}),
		[publishedDefaultOpenFileId, attachmentList],
	)
	const handleAttachmentsChange = useCallback(
		({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
			const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
			store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
			setIsInitialAttachmentsLoaded(true)
		},
		[store.projectFilesStore],
	)

	useEffect(() => {
		if (!isInitialAttachmentsLoaded || !isFileTabsCacheLoaded || !defaultEntryFile) {
			return
		}

		// FilesViewer 会异步恢复缓存标签，等待恢复完成后再打开默认入口，避免缓存覆盖入口页。
		const entryId = String(getAttachmentId(defaultEntryFile))
		const openKey = `${projectId}:${entryId}`
		if (defaultEntryOpenedKeyRef.current === openKey) return

		defaultEntryOpenedKeyRef.current = openKey
		setActiveFileId(entryId)
		detailRef.current?.openFileTab(defaultEntryFile)
		recordVisit()
	}, [
		defaultEntryFile,
		isFileTabsCacheLoaded,
		isInitialAttachmentsLoaded,
		projectId,
		recordVisit,
	])

	useMicroAppSelectedProjectSync(store.projectFilesStore, selectedProject)

	const { checkNowDebounced: checkAttachmentsNowDebounced } = useAttachmentsPolling({
		projectId: selectedProject?.id,
		store: store.projectFilesStore,
		onAttachmentsChange: handleAttachmentsChange,
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll micro app attachments:", error)
		}),
	})

	useProjectAttachmentsChangeRealtime({
		projectId: selectedProject?.id,
		store: store.projectFilesStore,
		onAttachmentsChange: handleAttachmentsChange,
		onFallbackError: useMemoizedFn((error: unknown) => {
			console.error("Failed to refresh realtime micro app attachments:", error)
		}),
	})

	useDeepCompareEffect(() => {
		const pid = selectedProject?.id
		if (!pid) {
			setIsInitialAttachmentsLoaded(false)
			return
		}

		let isActive = true
		setIsInitialAttachmentsLoaded(false)

		store.mentionPanelStore.initLoadAttachments(pid)
		updateAttachments(pid, (didLoad) => {
			if (!isActive || !didLoad) return
			setIsInitialAttachmentsLoaded(true)
		})

		return () => {
			isActive = false
			store.mentionPanelStore.clearInitLoadAttachmentsPromise(pid)
		}
	}, [selectedProject?.id])

	useEffect(() => {
		const handleUpdateAttachments = (
			payloadOrCallback?: SuperMagicUpdateAttachmentsRequest,
		) => {
			const payload = normalizeUpdateAttachmentsPayload(payloadOrCallback)
			const pid = selectedProject?.id
			if (!pid) {
				payload.callback?.()
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			updateAttachments(pid, payload.callback)
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		}
	}, [selectedProject?.id, updateAttachments])

	const handleOpenFile = useMemoizedFn((value?: unknown) => {
		const fileItem = value as AttachmentItem | undefined
		if (!fileItem?.file_id && !getFileManagerRequest(value)) return
		detailRef.current?.openFileTab(fileItem)
	})

	const handleActiveFileChange = useMemoizedFn((fileId: string | null) => {
		setActiveFileId(fileId)
	})

	const topicFilesProps = useMemo(
		() => ({
			attachments,
			setUserSelectDetail: () => undefined,
			onFileClick: handleOpenFile,
			projectId: selectedProject?.id,
			activeFileId,
			selectedTopic,
			onAttachmentsChange: setAttachments,
			allowEdit: !isReadOnly,
			selectedWorkspace: undefined,
			selectedProject,
			projects: [],
			workspaces: [],
			isInProject: true,
		}),
		[
			attachments,
			handleOpenFile,
			activeFileId,
			isReadOnly,
			selectedProject,
			selectedTopic,
			setAttachments,
		],
	)

	const handleBackToMicroApps = useMemoizedFn(() => {
		navigate({ name: RouteName.MicroApps })
	})

	const handleOpenPublishDialog = useMemoizedFn(() => {
		if (!canPublish || !defaultEntryFile) return
		setPublishDialogOpen(true)
	})

	const handleToggleDatabasePanel = useMemoizedFn(() => {
		if (!selectedProject?.id) return
		setIsDatabasePanelOpen((current) => !current)
	})

	const handleFileTabsCacheLoaded = useMemoizedFn((loadedProjectId: string) => {
		if (loadedProjectId === selectedProject?.id) {
			setIsFileTabsCacheLoaded(true)
		}
	})

	const {
		openManageModal,
		CollaboratorUpdatePanel,
		canManageCollaborators: hasCollaboratorManagementCapability,
	} = useCollaboratorUpdatePanel({ selectedProject: collaborationProject })
	// 能力位只表示当前版本支持协作者管理，项目角色仍决定当前用户是否有权使用该入口。
	const canManageCollaborators =
		hasCollaboratorManagementCapability && canManageProject(selectedProject?.user_role)

	const handleManageCollaborators = useMemoizedFn(() => {
		if (!selectedProject || !canManageCollaborators) return
		openManageModal()
	})

	const handleProjectNameChange = useMemoizedFn((projectName: string) => {
		if (!selectedProject) return
		store.developmentConversation.setSelectedProject({
			...selectedProject,
			project_name: projectName,
		})
	})

	const handleCaptureCover = useMemoizedFn(() => {
		if (!defaultEntryFile) return Promise.reject(new Error("Micro app index.html is not ready"))
		return captureMicroAppCover({
			entryFile: defaultEntryFile,
			attachments,
			attachmentList,
		})
	})

	const handleEditMicroApp = useMemoizedFn(async (changes: UpdateMicroAppBody) => {
		if (!selectedProject?.id || !canEdit) return false
		if (changes.app_name === undefined && changes.cover_file_key === undefined) return false

		setEditSubmitting(true)
		try {
			const metadata = await SuperMagicApi.updateMicroApp(appId, changes)
			const nextProjectName = metadata.app_name?.trim()
			if (changes.app_name !== undefined && nextProjectName) {
				handleProjectNameChange(nextProjectName)
				pubsub.publish(
					PubSubEvents.Update_Project_Name,
					selectedProject.id,
					nextProjectName,
				)
			}
			magicToast.success(t("microAppPage.edit.success"))
			return true
		} catch (error) {
			console.error("Failed to edit micro app:", error)
			magicToast.error(t("microAppPage.edit.failed"))
			return false
		} finally {
			setEditSubmitting(false)
		}
	})

	const handleConversationTypeChange = useMemoizedFn((type: "development" | "usage") => {
		store.setConversationType(type)
	})
	const ensureUsageProject = useMemoizedFn(() => {
		if (
			!currentOrganizationCode ||
			!resolvedSourceOrganizationCode ||
			currentOrganizationCode !== resolvedSourceOrganizationCode
		) {
			const message = t("microAppShare.crossOrganizationConversationUnsupported")
			magicToast.error(message)
			return Promise.reject(new Error(message))
		}
		return store.ensureUsageProject(appId)
	})

	return {
		store,
		conversation,
		conversationType: store.conversationType,
		canUseDevelopment,
		runtimeProject: store.runtimeProject,
		runtimeProjectState: store.runtimeProjectState,
		ensureUsageProject,
		sourceOrganizationCode: resolvedSourceOrganizationCode,
		handleConversationTypeChange,
		selectedProject,
		selectedTopic,
		hasRunningTopic,
		isReadOnly,
		canEdit,
		canPublish,
		attachments,
		attachmentList,
		activeFileId,
		userSelectDetail,
		setUserSelectDetail,
		defaultEntryFile,
		detailRef,
		topicFilesProps,
		handleOpenFile,
		handleActiveFileChange,
		handleBackToMicroApps,
		handleOpenPublishDialog,
		handleToggleDatabasePanel,
		handleFileTabsCacheLoaded,
		checkAttachmentsNowDebounced,
		publishDialogOpen,
		setPublishDialogOpen,
		setPublishedDefaultOpenFileId,
		editDialogOpen,
		setEditDialogOpen,
		editSubmitting,
		isDatabasePanelOpen,
		setIsDatabasePanelOpen,
		CollaboratorUpdatePanel,
		canManageCollaborators,
		handleManageCollaborators,
		handleProjectNameChange,
		captureCoverReady: Boolean(defaultEntryFile),
		handleCaptureCover,
		handleEditMicroApp,
	}
}
