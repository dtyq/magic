import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useDeepCompareEffect, useDebounceFn, useUpdateEffect, useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMessageChanges } from "../../hooks/useMessageChanges"
import Detail, { type DetailRef } from "../../components/Detail"
import { SendMessageOptions } from "../../components/MessagePanel/types"
import useStyles from "../Workspace/style"
import { JSONContent } from "@tiptap/core"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import projectFilesStore from "@/stores/projectFiles"
import { filterClickableMessageWithoutRevoked } from "../../utils/handleMessage"
import { useDetailModeCache } from "../../hooks/useDetailModeCache"
import { useAttachmentsPolling } from "../../hooks/useAttachmentsPolling"
import { useAutoOpenFile } from "../../hooks/useAutoOpenFile"
import { useDeferUntilFileTabsCacheLoaded } from "../../hooks/useDeferUntilFileTabsCacheLoaded"
import { useRefreshTopicDetailOnTaskComplete } from "../../hooks/useRefreshTopicDetailOnTaskComplete"
import { AttachmentDataProcessor } from "../../utils/attachmentDataProcessor"
import {
	releaseAttachmentsRefreshWaitersWithoutFetch,
	resolveAttachmentsRefreshWaitersForProject,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { isCollaborationWorkspace } from "../../constants"
import { useNoPermissionCollaborationProject } from "../../hooks/useNoPermissionCollaborationProject"
import { superMagicStore } from "@/pages/superMagic/stores"
import { observer } from "mobx-react-lite"
import { LongMemoryApi, SuperMagicApi } from "@/apis"
import { workspaceStore, projectStore, topicStore } from "../../stores/core"
import SuperMagicService from "../../services"
import { userStore } from "@/models/user"
import { LongMemory } from "@/types/longMemory"
import { useInterruptAndUndoMessage } from "../../hooks/useInterruptAndUndoMessage"
import { useTopicConversationLoading } from "../../hooks/useTopicConversationLoading"
import { useTopicMessages } from "../../hooks/useTopicMessages"
import { useCreateTopicListener } from "../../components/TopicMode/useCreateTopicListener"
import { useTopicFiles } from "./hooks/useTopicFiles"
import TopicSidebar from "./components/TopicSidebar"
import { isAudioProjectMode } from "../AudioRecordings/utils/is-audio-project-mode"
import TopicMessagePanel from "./components/TopicMessagePanel"
import TopicDesktopPanels from "./components/TopicDesktopPanels"
import { useTopicDetailPanelController } from "./hooks/useTopicDetailPanelController"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "./hooks/useTopicHistoryLayoutState"
import { useMessageHeaderTopicActions } from "./hooks/useMessageHeaderTopicActions"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { TaskStatus } from "../Workspace/types"
import { resolveMessageSendContext } from "../../services/messageSendPreparation"
import { messageSendService } from "../../services/messageSendFlowService"
import { isReadOnlyProject } from "../../utils/permission"
import { MessageHeaderTopicHistoryPanel } from "../../components/MessageHeader"
import topicReadProgressService from "../../services/topicReadProgressService"
import {
	applyOptimisticTopicRunningState,
	handleArrivedTopicStatusChange as syncArrivedTopicStatusChange,
	syncTopicStatusPatch,
} from "../../services/topicStatusSyncService"
import dayjs from "@/lib/dayjs"
import type { MessageItem } from "../../stores/types"

/** 任务消息状态变化后延迟拉工作区/项目详情，减轻后端尚未落库时单次请求仍返回 running 的问题 */
const WORKSPACE_PROJECT_STATUS_REFRESH_DELAY_MS = 1000

function normalizeMessageSendTimeToMs(value: unknown): number | null {
	if (value === null || value === undefined) return null

	const numericValue =
		typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
	if (!Number.isFinite(numericValue) || numericValue <= 0) return null

	// 10位秒、13位毫秒、16位微秒、19位纳秒
	if (numericValue < 1e11) return Math.floor(numericValue * 1000)
	if (numericValue < 1e14) return Math.floor(numericValue)
	if (numericValue < 1e17) return Math.floor(numericValue / 1000)
	return Math.floor(numericValue / 1e6)
}

function resolveReadProgressPayloadFromMessages(messages: Array<any>) {
	if (!Array.isArray(messages) || messages.length === 0)
		return {
			lastReadAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
			lastReadMessageId: undefined,
		}

	const latestMessage = messages[messages.length - 1]
	const fallbackReadAt = dayjs().format("YYYY-MM-DD HH:mm:ss")
	const normalizedSendTimeMs = normalizeMessageSendTimeToMs(latestMessage?.send_time)
	const parsedReadAt =
		normalizedSendTimeMs && normalizedSendTimeMs > 0
			? dayjs(normalizedSendTimeMs).format("YYYY-MM-DD HH:mm:ss")
			: fallbackReadAt

	return {
		lastReadAt: parsedReadAt,
		lastReadMessageId:
			typeof latestMessage?.app_message_id === "string"
				? latestMessage.app_message_id
				: undefined,
	}
}

function resolveReadProgressPayloadFromMessage(message?: {
	send_time?: unknown
	app_message_id?: unknown
}) {
	const fallbackReadAt = dayjs().format("YYYY-MM-DD HH:mm:ss")
	const normalizedSendTimeMs = normalizeMessageSendTimeToMs(message?.send_time)
	const parsedReadAt =
		normalizedSendTimeMs && normalizedSendTimeMs > 0
			? dayjs(normalizedSendTimeMs).format("YYYY-MM-DD HH:mm:ss")
			: fallbackReadAt

	return {
		lastReadAt: parsedReadAt,
		lastReadMessageId:
			typeof message?.app_message_id === "string" ? message.app_message_id : undefined,
	}
}

// 工作区组件
function TopicPage() {
	// Get workspace and project state from stores
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic
	const attachments = projectFilesStore.workspaceFileTree
	const attachmentList = projectFilesStore.workspaceFilesList
	const setAttachments = useMemoizedFn((nextAttachments: AttachmentItem[]) => {
		projectFilesStore.setWorkspaceFileTree(nextAttachments)
	})

	/** ======================== Hooks ======================== */
	const { styles } = useStyles()
	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

	/** ======================== Refs ======================== */
	const detailRef = useRef<DetailRef>(null)
	const delayedWorkspaceProjectStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)
	const previousTopicIdRef = useRef<string | null>(null)

	/** ======================== States ======================== */
	const [autoDetail, setAutoDetail] = useState<any>()
	const [userSelectDetail, setUserSelectDetail] = useState<any>()
	const [isShowLoadingInit, setIsShowLoadingInit] = useState(false)
	const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false)
	// Calculate read-only status based on user role
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)
	const hideProjectCard = isAudioProjectMode(selectedProject?.project_mode)
	const topicActions = useMessageHeaderTopicActions({
		selectedProject,
		selectedTopic,
		topicStore,
	})

	// Use topic files hook to manage file-related logic
	const { activeFileId, handleFileClick, topicFilesProps, setActiveFileId } = useTopicFiles({
		selectedProject,
		selectedWorkspace,
		selectedTopic,
		projects: projectStore.projects,
		workspaces: workspaceStore.workspaces,
		attachments,
		setAttachments,
		setUserSelectDetail,
		detailRef,
		isReadOnly,
	})

	const {
		shouldShowDetailPanel,
		handleFileClickWithPanel,
		topicFilesPropsWithPanel,
		handleActiveDetailTabChange,
		clearActiveDetailTabType,
	} = useTopicDetailPanelController({
		detailRef,
		isReadOnly,
		activeFileId,
		setActiveFileId,
		handleFileClick,
		topicFilesProps,
		attachmentList,
	})

	const { onFileTabsCacheLoaded, scheduleWhenTabsCacheReady } = useDeferUntilFileTabsCacheLoaded(
		selectedProject?.id,
	)

	const { isTopicHistoryPanelOpen, closeTopicHistoryPanel, toggleTopicHistoryPanel } =
		useTopicHistoryLayoutState({
			storageKey: TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.topicPage,
			isEnabled: !isReadOnly,
		})

	const activeFileIdRef = useRef<string | null>(activeFileId)
	activeFileIdRef.current = activeFileId

	// 使用详情模式缓存 hook
	useDetailModeCache({
		selectedProjectId: selectedProject?.id,
		autoDetail,
		userDetail: userSelectDetail,
		setAutoDetail,
		setUserDetail: setUserSelectDetail,
	})

	const {
		checkAndOpenFileByMessages,
		checkAndOpenFileByTopicChanged,
		reset: resetAutoOpenFile,
	} = useAutoOpenFile()

	useRefreshTopicDetailOnTaskComplete({
		selectedTopic,
		onTopicDetailLoaded: topicStore.updateTopic,
	})

	// 当项目或话题发生变化时，清理状态
	useUpdateEffect(() => {
		setAutoDetail(null)
		setUserSelectDetail(null)
		clearActiveDetailTabType()
		resetAutoOpenFile()
	}, [selectedProject?.id])

	const updateDetail = useMemoizedFn(
		({
			latestMessageDetail,
			isLoading,
			tool,
		}: {
			latestMessageDetail: any
			isLoading: boolean
			tool?: any
		}) => {
			if (isEmpty(latestMessageDetail)) {
				setAutoDetail({
					type: "empty",
					data: {
						text: isLoading ? "正在思考" : "完成任务",
					},
				})
			} else {
				setAutoDetail({
					...latestMessageDetail,
					id: tool?.id,
					name: tool?.name,
				})
			}
		},
	)

	useEffect(() => {
		return () => {
			if (delayedWorkspaceProjectStatusTimeoutRef.current) {
				clearTimeout(delayedWorkspaceProjectStatusTimeoutRef.current)
				delayedWorkspaceProjectStatusTimeoutRef.current = null
			}
			void topicReadProgressService.flushCurrentTopicReadProgress("route-leave")
		}
	}, [])

	useEffect(() => {
		const previousTopicId = previousTopicIdRef.current
		const currentTopicId = selectedTopic?.id || null
		if (previousTopicId && previousTopicId !== currentTopicId)
			void topicReadProgressService.flushTopicReadProgress({
				topicId: previousTopicId,
				reason: "switch-topic",
			})
		previousTopicIdRef.current = currentTopicId
	}, [selectedTopic?.id])

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState !== "hidden") return
			void topicReadProgressService.flushCurrentTopicReadProgress("page-hide")
		}

		const handleBeforeUnload = () => {
			void topicReadProgressService.flushCurrentTopicReadProgress("before-unload")
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("beforeunload", handleBeforeUnload)
		}
	}, [])

	const currentTopicStatus = selectedTopic?.task_status
	const currentTopicStatusRef = useRef<TaskStatus | undefined>(currentTopicStatus)
	const selectedProjectRef = useRef(selectedProject)
	const selectedWorkspaceRef = useRef(selectedWorkspace)
	currentTopicStatusRef.current = currentTopicStatus
	selectedProjectRef.current = selectedProject
	selectedWorkspaceRef.current = selectedWorkspace

	/**
	 * 处理到达消息引发的话题状态变化：
	 * 1) 仅在状态真正变化时更新本地话题状态；
	 * 2) 同步拉取话题 unread 补丁，避免后端短暂延迟导致状态不一致；
	 * 3) 延迟刷新工作区/项目状态，减少后端未落库时的无效请求；
	 * 4) 当任务结束且页面可见时，补记一次即时已读进度。
	 */
	const handleArrivedTopicStatusChange = useMemoizedFn(
		({
			nextStatus,
			topicId,
			lastReadAt,
			lastReadMessageId,
		}: {
			nextStatus?: TaskStatus
			topicId: string
			lastReadAt?: string
			lastReadMessageId?: string
		}) => {
			syncArrivedTopicStatusChange({
				scopeName: "TopicPage",
				topicStore,
				topicReadProgressService,
				currentTopicStatusRef,
				nextStatus,
				topicId,
				lastReadAt,
				lastReadMessageId,
				onTopicStatusChanged: (resolvedStatus, resolvedTopicId) => {
					void SuperMagicService.topic.updateTopicStatus(resolvedTopicId, resolvedStatus)

					const latestWorkspaceId = selectedWorkspaceRef.current?.id
					const latestProjectId = selectedProjectRef.current?.id
					if (delayedWorkspaceProjectStatusTimeoutRef.current) {
						clearTimeout(delayedWorkspaceProjectStatusTimeoutRef.current)
					}
					delayedWorkspaceProjectStatusTimeoutRef.current = setTimeout(() => {
						delayedWorkspaceProjectStatusTimeoutRef.current = null
						if (latestWorkspaceId) {
							void SuperMagicService.workspace.updateWorkspaceStatus(
								latestWorkspaceId,
							)
						}
						if (latestProjectId) {
							void SuperMagicService.project.updateProjectStatus(latestProjectId)
						}
					}, WORKSPACE_PROJECT_STATUS_REFRESH_DELAY_MS)
				},
			})
		},
	)

	useEffect(() => {
		if (!selectedTopic?.chat_topic_id || !selectedTopic?.id) return

		return superMagicStore.registerTopicMessageListener({
			topicId: selectedTopic.chat_topic_id,
			callback: ({
				message,
				messageNode,
			}: {
				message: MessageItem
				messageNode: { status?: unknown }
			}) => {
				if (message?.role === "user") return
				const readProgressPayload = resolveReadProgressPayloadFromMessage(message)
				handleArrivedTopicStatusChange({
					nextStatus: messageNode?.status as TaskStatus | undefined,
					topicId: selectedTopic.id,
					lastReadAt: readProgressPayload.lastReadAt,
					lastReadMessageId: readProgressPayload.lastReadMessageId,
				})
			},
		})
	}, [handleArrivedTopicStatusChange, selectedTopic?.chat_topic_id, selectedTopic?.id])

	const { messages, showLoading } = useTopicConversationLoading({
		selectedTopic,
		hideLoadingWhenBufferHasContent: true,
		onTopicMessagesChange: ({
			isLoading,
			lastMessageNode,
			selectedTopic: currentTopic,
			topicMessages,
		}) => {
			setIsShowLoadingInit(true)

			// 记录任务状态是否发生变化（用于判断是否为新消息导致的任务完成）
			const hasStatusChanged = lastMessageNode?.status !== currentTopicStatus
			const readProgressPayload = resolveReadProgressPayloadFromMessages(topicMessages)
			const targetTopicId = currentTopic?.id || selectedTopic?.id

			let lastDetailMessage = undefined
			for (let index = topicMessages.length - 1; index >= 0; index -= 1) {
				const message = topicMessages[index]
				const node = superMagicStore.getMessageNode(message?.app_message_id)
				if (!filterClickableMessageWithoutRevoked(node)) continue

				lastDetailMessage = message
				break
			}

			const lastDetailMessageNode = superMagicStore.getMessageNode(
				lastDetailMessage?.app_message_id,
			) as
				| {
						tool?: {
							detail?: any
							id?: string
							name?: string
						}
				  }
				| undefined
			if (filterClickableMessageWithoutRevoked(lastDetailMessageNode)) {
				updateDetail({
					latestMessageDetail: lastDetailMessageNode?.tool?.detail,
					isLoading,
					tool: lastDetailMessageNode?.tool,
				})

				scheduleWhenTabsCacheReady(() => {
					checkAndOpenFileByMessages({
						lastMessageNode,
						lastDetailMessageNode,
						lastDetailMessage,
						hasStatusChanged,
						activeFileId,
						getActiveFileId: () => activeFileIdRef.current,
					})
				})
			}

			if (targetTopicId) {
				topicReadProgressService.markTopicReadProgress({
					topicId: targetTopicId,
					lastReadAt: readProgressPayload.lastReadAt,
					lastReadMessageId: readProgressPayload.lastReadMessageId,
					reason: "message-change",
				})
			}
		},
	})

	const { hasMemoryUpdateMessage } = useMessageChanges(messages)

	useEffect(() => {
		if (!hasMemoryUpdateMessage) return
		// 更新长期记忆
		try {
			LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: 99,
			}).then((res) => {
				if (res?.success) {
					userStore.user.setPendingMemoryList(res.data || [])
				}
			})
		} catch (error) {
			console.error(error)
		}
	}, [hasMemoryUpdateMessage])

	// Handle interrupt and undo message functionality
	useInterruptAndUndoMessage({
		selectedTopic,
		messages,
		userInfo: userStore.user.userInfo,
	})

	useDeepCompareEffect(() => {
		setUserSelectDetail(null)
		clearActiveDetailTabType()
	}, [selectedTopic?.id, selectedTopic?.chat_topic_id])

	// 集成轮询hook（需在 useTopicMessages 之前，以注入 checkNowDebounced）
	const { checkNowDebounced } = useAttachmentsPolling({
		projectId: selectedProject?.id,
		onAttachmentsChange: useCallback(({ tree, list }: { tree: any[]; list: never[] }) => {
			// 统一处理 metadata，内部自闭环处理验证和返回逻辑
			const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
			projectFilesStore.setWorkspaceFileTree(processedData.tree)
		}, []),
		onError: useMemoizedFn((error: any, _projectId: string) => {
			if (isCollaborationWorkspace(selectedWorkspace)) {
				// 团队共享项目，如果权限不足，回到首页
				handleNoPermissionCollaborationProject(error)
				return
			}
		}),
	})

	const { handlePullMoreMessage, isMessagesInitialLoading, isSelectedTopicMessagesReady } =
		useTopicMessages({
			selectedTopic,
			checkNowDebounced,
		})

	useUpdateEffect(() => {
		if (!isSelectedTopicMessagesReady) return

		if (selectedTopic?.id) {
			const readProgressPayload = resolveReadProgressPayloadFromMessages(messages)
			void syncTopicStatusPatch({
				topicStore,
				topicId: selectedTopic.id,
			})
				.catch((error) => {
					console.warn("[TopicPage] 进入话题触发前同步话题 unread 状态失败:", error)
				})
				.finally(() => {
					topicReadProgressService.markTopicReadProgress({
						topicId: selectedTopic.id,
						lastReadAt: readProgressPayload.lastReadAt,
						lastReadMessageId: readProgressPayload.lastReadMessageId,
						reason: "enter-topic",
						immediate: true,
					})
				})
		}

		scheduleWhenTabsCacheReady(() => {
			checkAndOpenFileByTopicChanged({
				activeFileId,
				getActiveFileId: () => activeFileIdRef.current,
			})
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在话题 id / 消息首轮就绪变化时调度；回调内通过 ref 取最新 activeFileId
	}, [selectedTopic?.id, isSelectedTopicMessagesReady])

	const updateAttachments = useDebounceFn(
		(selectedProject: any, callback?: () => void) => {
			const projectId = selectedProject?.id as string | undefined
			if (!projectId) {
				projectFilesStore.setWorkspaceFileTree([])
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			try {
				pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
				withAttachmentsRefreshWaitersResolved(
					projectId,
					SuperMagicApi.getAttachmentsByProjectId({
						projectId,
						// @ts-ignore 使用window添加临时的token
						temporaryToken: window.temporary_token || "",
					})
						.then((res) => {
							// 统一处理 metadata，包括 index.html 文件的特殊逻辑，内部自闭环处理验证和返回逻辑
							const processedData = AttachmentDataProcessor.processAttachmentData(res)
							projectFilesStore.setWorkspaceFileTree(processedData.tree)
							GlobalMentionPanelStore.finishLoadAttachmentsPromise(projectId)
						})
						.finally(() => {
							pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
							callback?.()
						}),
				)
			} catch (error) {
				console.error("Failed to fetch attachments:", error)
				projectFilesStore.setWorkspaceFileTree([])
				resolveAttachmentsRefreshWaitersForProject(projectId)
				callback?.()
			}
		},
		{
			wait: 500,
		},
	).run

	useDeepCompareEffect(() => {
		const projectId = selectedProject?.id
		if (selectedProject) {
			// 初始化加载附件的Promise
			GlobalMentionPanelStore.initLoadAttachments(selectedProject?.id)
			updateAttachments(selectedProject)
		}

		return () => {
			if (projectId) {
				GlobalMentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
			}
		}
	}, [selectedProject?.id])

	const disPlayDetail = useMemo(() => {
		return userSelectDetail || autoDetail
	}, [userSelectDetail, autoDetail])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Update_Attachments, (callback) => {
			if (
				selectedProject &&
				selectedTopic
				// 消息只跟topic关联
				// &&
				// data?.chat_topic_id === selectedTopic.chat_topic_id
			) {
				updateAttachments(selectedProject, callback)
				return
			}
			callback?.()
			releaseAttachmentsRefreshWaitersWithoutFetch()
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Update_Attachments)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTopic, selectedProject])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Update_Auto_Detail, (data) => {
			setAutoDetail(data)
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Super_Magic_Update_Auto_Detail)
		}
	}, [])

	// Listen for Create_New_Topic event and handle topic creation
	useCreateTopicListener()

	// 封装消息发送处理函数
	const handleSendMsg = useMemoizedFn(
		(content: JSONContent | string, options?: SendMessageOptions) => {
			messageSendService.sendContent({
				content,
				options,
				showLoading: messages?.length > 1 && showLoading,
				context: resolveMessageSendContext({
					selectedProject,
					selectedTopic,
					selectedWorkspace,
					setSelectedTopic: topicStore.setSelectedTopic,
				}),
			})

			// 延迟200ms通知MessageList组件滚动到底部
			pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
		},
	)

	const handleEditorSendComplete = useMemoizedFn(
		({
			success,
			currentProject,
			currentTopic,
		}: {
			success: boolean
			currentProject: typeof selectedProject
			currentTopic: typeof selectedTopic
		}) => {
			if (!success) return

			applyOptimisticTopicRunningState({
				topicStore,
				topic: currentTopic ?? topicStore.selectedTopic,
				project: currentProject ?? selectedProjectRef.current,
				workspace: selectedWorkspaceRef.current,
			})
		},
	)

	const handleSelectedTopicChange = useMemoizedFn((topic: any) => {
		topicStore.setSelectedTopic(topic)
	})

	const renderMessagePanel = useMemoizedFn(
		({
			isConversationPanelCollapsed,
			isDraggingPanel,
			onToggleConversationPanel,
			onExpandConversationPanel,
			historyTriggerMode,
			isHistoryPanelOpen,
			onToggleHistoryPanel,
		}: {
			isConversationPanelCollapsed: boolean
			isDraggingPanel: boolean
			onToggleConversationPanel: () => void
			onExpandConversationPanel: () => void
			historyTriggerMode: "dropdown" | "layout"
			isHistoryPanelOpen: boolean
			onToggleHistoryPanel?: () => void
		}) => (
			<TopicMessagePanel
				selectedProject={selectedProject}
				selectedTopic={selectedTopic}
				messages={messages as any}
				showLoading={showLoading}
				isShowLoadingInit={isShowLoadingInit}
				currentTopicStatus={currentTopicStatus!}
				attachments={attachments}
				handleSendMsg={handleSendMsg}
				onSendComplete={handleEditorSendComplete}
				handlePullMoreMessage={handlePullMoreMessage}
				isMessagesLoading={isMessagesInitialLoading}
				handleFileClick={handleFileClickWithPanel}
				setUserSelectDetail={setUserSelectDetail}
				setSelectedTopic={handleSelectedTopicChange}
				topicActions={topicActions}
				isConversationPanelCollapsed={isConversationPanelCollapsed}
				isDraggingPanel={isDraggingPanel}
				onToggleConversationPanel={onToggleConversationPanel}
				onExpandConversationPanel={onExpandConversationPanel}
				detailPanelVisible={shouldShowDetailPanel}
				historyTriggerMode={historyTriggerMode}
				isHistoryPanelOpen={isHistoryPanelOpen}
				onToggleHistoryPanel={onToggleHistoryPanel}
			/>
		),
	)

	return (
		<TopicDesktopPanels
			containerClassName={styles.container}
			detailPanelClassName={styles.detailPanel}
			isDetailPanelFullscreen={isDetailPanelFullscreen}
			sidebar={
				<TopicSidebar
					selectedProject={selectedProject}
					selectedWorkspace={selectedWorkspace}
					selectedTopic={selectedTopic}
					isReadOnly={isReadOnly}
					topicFilesProps={topicFilesPropsWithPanel}
					hideProjectCard={hideProjectCard}
				/>
			}
			detailPanel={
				<Detail
					ref={detailRef}
					disPlayDetail={disPlayDetail}
					userSelectDetail={userSelectDetail}
					setUserSelectDetail={setUserSelectDetail}
					attachments={attachments}
					attachmentList={attachmentList}
					topicId={selectedTopic?.id}
					baseShareUrl={`${window.location.origin}/share`}
					currentTopicStatus={currentTopicStatus}
					messages={messages}
					autoDetail={autoDetail}
					allowEdit={!isReadOnly}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					activeFileId={activeFileId}
					onActiveFileChange={setActiveFileId}
					onActiveTabChange={handleActiveDetailTabChange}
					onFullscreenChange={setIsDetailPanelFullscreen}
					onFileTabsCacheLoaded={onFileTabsCacheLoaded}
				/>
			}
			isReadOnly={isReadOnly}
			keepDetailMountedWhenHidden
			historyLayout={{
				isOpen: isTopicHistoryPanelOpen,
				onClose: closeTopicHistoryPanel,
				onToggle: toggleTopicHistoryPanel,
				renderPanel: ({
					isConversationPanelCollapsed,
					onExpandConversationPanel,
					onClose,
					closeButtonRef,
				}) => (
					<MessageHeaderTopicHistoryPanel
						selectedProject={selectedProject}
						topicStore={topicStore}
						topicActions={topicActions}
						isConversationPanelCollapsed={isConversationPanelCollapsed}
						onExpandConversationPanel={onExpandConversationPanel}
						onClose={onClose}
						closeButtonRef={closeButtonRef}
					/>
				),
			}}
			shouldShowDetailPanel={shouldShowDetailPanel}
			renderMessagePanel={renderMessagePanel}
		/>
	)
}

// 导出的工作区组件
export default observer(TopicPage)
