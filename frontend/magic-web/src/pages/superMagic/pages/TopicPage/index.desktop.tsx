import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useDeepCompareEffect, useDebounceFn, useUpdateEffect, useMemoizedFn } from "ahooks"
import { isEmpty, isObject } from "lodash-es"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMessageChanges } from "../../hooks/useMessageChanges"
import Detail, { type DetailRef } from "../../components/Detail"
import { SendMessageOptions } from "../../components/MessagePanel/types"
import useStyles from "../Workspace/style"
import { JSONContent } from "@tiptap/core"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/store"
import projectFilesStore from "@/stores/projectFiles"
import { filterClickableMessageWithoutRevoked } from "../../utils/handleMessage"
import { useDetailModeCache } from "../../hooks/useDetailModeCache"
import { useAttachmentsPolling } from "../../hooks/useAttachmentsPolling"
import { useAutoOpenFileOnTaskComplete } from "../../hooks/useAutoOpenFileOnTaskComplete"
import { useRefreshTopicDetailOnTaskComplete } from "../../hooks/useRefreshTopicDetailOnTaskComplete"
import { AttachmentDataProcessor } from "../../utils/attachmentDataProcessor"
import { isCollaborationWorkspace } from "../../constants"
import { useNoPermissionCollaborationProject } from "../../hooks/useNoPermissionCollaborationProject"
import { superMagicStore } from "@/pages/superMagic/stores"
import { reaction } from "mobx"
import { observer } from "mobx-react-lite"
import { LongMemoryApi, SuperMagicApi } from "@/apis"
import { workspaceStore, projectStore, topicStore } from "../../stores/core"
import SuperMagicService from "../../services"
import { userStore } from "@/models/user"
import { LongMemory } from "@/types/longMemory"
import { useInterruptAndUndoMessage } from "../../hooks/useInterruptAndUndoMessage"
import { SuperMagicMessageItem } from "../../components/MessageList/type"
import { useTopicMessages } from "../../hooks/useTopicMessages"
import { useCreateTopicListener } from "../../components/TopicMode/useCreateTopicListener"
import { useTopicFiles } from "./hooks/useTopicFiles"
import TopicSidebar from "./components/TopicSidebar"
import TopicMessagePanel from "./components/TopicMessagePanel"
import TopicDesktopPanels from "./components/TopicDesktopPanels"
import { useTopicDesktopLayout } from "./hooks/useTopicDesktopLayout"
import { useTopicDetailPanelController } from "./hooks/useTopicDetailPanelController"
import { useTopicDesktopPanelMotion } from "./hooks/useTopicDesktopPanelMotion"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { messageSendService } from "../../services/messageSendFlowService"
import { isReadOnlyProject } from "../../utils/permission"

// 工作区组件
function TopicPage() {
	// Get workspace and project state from stores
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic
	const messages = superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || []
	const attachments = projectFilesStore.workspaceFileTree
	const attachmentList = projectFilesStore.workspaceFilesList
	const setAttachments = useMemoizedFn((nextAttachments: AttachmentItem[]) => {
		projectFilesStore.setWorkspaceFileTree(nextAttachments)
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

	/** ======================== Hooks ======================== */
	const { styles } = useStyles()
	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

	/** ======================== Refs ======================== */
	const detailRef = useRef<DetailRef>(null)

	/** ======================== States ======================== */
	const [autoDetail, setAutoDetail] = useState<any>()
	const [userSelectDetail, setUserSelectDetail] = useState<any>()
	const [showLoading, setShowLoading] = useState(false)
	const [isShowLoadingInit, setIsShowLoadingInit] = useState(false)
	const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false)

	// Get current topic status from historyItems (which has the latest status)
	const currentTopicStatus = selectedTopic?.task_status
	// Calculate read-only status based on user role
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)

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
	})

	// 使用详情模式缓存 hook
	useDetailModeCache({
		selectedProjectId: selectedProject?.id,
		autoDetail,
		userDetail: userSelectDetail,
		setAutoDetail,
		setUserDetail: setUserSelectDetail,
	})

	// 使用自动打开文件 hook
	const { checkAndOpenFile, reset: resetAutoOpenFile } = useAutoOpenFileOnTaskComplete()

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

	const handleTopicMessagesChange = useMemoizedFn((topicMessages: SuperMagicMessageItem[]) => {
		if (topicMessages.length > 1) {
			const lastMessageWithRole = topicMessages.findLast((m) => m.role === "assistant")
			const lastMessage = topicMessages?.[topicMessages.length - 1]
			const lastMessageNode = superMagicStore.getMessageNode(
				lastMessageWithRole?.app_message_id,
			)

			// 因新版本结构，所有消息都有 seq_id，所以从 !lastMessage?.seq_id 更改为 lastMessage.type === "rich_text"
			const isLoading =
				lastMessageNode?.status === "running" ||
				lastMessage.type === "rich_text" ||
				isObject(lastMessageNode?.content) ||
				Boolean(lastMessageNode?.rich_text?.content) ||
				Boolean(lastMessageNode?.text?.content)

			setShowLoading(isLoading)
			setIsShowLoadingInit(true)

			// 记录任务状态是否发生变化（用于判断是否为新消息导致的任务完成）
			const hasStatusChanged = lastMessageNode?.status !== currentTopicStatus

			// 接收到任务消息并监测到状态变化后，需重新拉取工作区、项目、话题，更新其工作状态
			if (hasStatusChanged && selectedProject) {
				if (selectedWorkspace?.id) {
					void SuperMagicService.workspace.updateWorkspaceStatus(selectedWorkspace.id)
				}
				if (selectedProject?.id) {
					void SuperMagicService.project.updateProjectStatus(selectedProject.id)
				}
				if (selectedTopic?.id) {
					void SuperMagicService.topic.updateTopicStatus(
						selectedTopic.id,
						lastMessageNode?.status,
					)
				}
			}

			const lastDetailMessage = topicMessages.findLast((m) => {
				const node = superMagicStore.getMessageNode(m?.app_message_id)
				return filterClickableMessageWithoutRevoked(node)
			})

			const lastDetailMessageNode = superMagicStore.getMessageNode(
				lastDetailMessage?.app_message_id,
			)
			// 当且仅当为结束任务时才会调用
			if (filterClickableMessageWithoutRevoked(lastDetailMessageNode)) {
				updateDetail({
					latestMessageDetail: lastDetailMessageNode?.tool?.detail,
					isLoading,
					tool: lastDetailMessageNode?.tool,
				})

				// 使用 hook 检查并打开文件
				checkAndOpenFile({
					currentTopicStatus,
					lastMessageNode,
					lastDetailMessageNode,
					hasStatusChanged,
					activeFileId,
				})
			}
		} else if (topicMessages?.length === 1) {
			setShowLoading(true)
		}
	})

	useEffect(() => {
		return reaction(
			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
			(topicMessages) => {
				handleTopicMessagesChange(topicMessages as SuperMagicMessageItem[])
			},
		)
	}, [handleTopicMessagesChange, selectedTopic?.chat_topic_id])

	useEffect(() => {
		// 订阅缓冲区是否存在内容（当存在消息没有被消费时取消loading状态）
		return reaction(
			() => superMagicStore.buffer.get(selectedTopic?.chat_topic_id || ""),
			(next) => {
				if (next && next?.length > 0) {
					setShowLoading(false)
				}
			},
		)
	}, [selectedTopic?.chat_topic_id])

	useDeepCompareEffect(() => {
		setShowLoading(false)
		setUserSelectDetail(null)
		clearActiveDetailTabType()
	}, [selectedTopic?.id, selectedTopic?.chat_topic_id])

	// 集成轮询hook
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

	// Use unified topic messages hook
	const { handlePullMoreMessage, isMessagesInitialLoading } = useTopicMessages({
		selectedTopic,
		checkNowDebounced,
	})

	const updateAttachments = useDebounceFn(
		(selectedProject: any, callback?: () => void) => {
			if (!selectedProject?.id) {
				projectFilesStore.setWorkspaceFileTree([])
				return
			}
			try {
				pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
				SuperMagicApi.getAttachmentsByProjectId({
					projectId: selectedProject?.id,
					// @ts-ignore 使用window添加临时的token
					temporaryToken: window.temporary_token || "",
				})
					.then((res) => {
						// 统一处理 metadata，包括 index.html 文件的特殊逻辑，内部自闭环处理验证和返回逻辑
						const processedData = AttachmentDataProcessor.processAttachmentData(res)
						projectFilesStore.setWorkspaceFileTree(processedData.tree)
						GlobalMentionPanelStore.finishLoadAttachmentsPromise(selectedProject?.id)
					})
					.finally(() => {
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
					})
			} catch (error) {
				console.error("Failed to fetch attachments:", error)
				projectFilesStore.setWorkspaceFileTree([])
			} finally {
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
	}, [selectedProject])

	const disPlayDetail = useMemo(() => {
		return userSelectDetail || autoDetail
	}, [userSelectDetail, autoDetail])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Update_Attachments, (callback: any) => {
			if (
				selectedProject &&
				selectedTopic
				// 消息只跟topic关联
				// &&
				// data?.chat_topic_id === selectedTopic.chat_topic_id
			) {
				updateAttachments(selectedProject, callback)
			}
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Update_Attachments)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTopic, selectedProject])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Update_Auto_Detail, (data: any) => {
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
			})

			// 延迟200ms通知MessageList组件滚动到底部
			pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
		},
	)

	const {
		containerRef,
		containerWidthPx,
		projectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		startDragProjectSider,
		startDragMessagePanel,
		toggleConversationPanel,
		expandConversationPanel,
		ensureExpandedWhenDetailVisible,
	} = useTopicDesktopLayout({ isReadOnly })

	const {
		panelResizeTransition,
		messageTransform,
		messagePanelTransition,
		detailContentTransform,
		detailContentTransition,
		targetMessagePanelWidth,
		targetRightHandleWidth,
		targetDetailPanelWidth,
	} = useTopicDesktopPanelMotion({
		isReadOnly,
		shouldShowDetailPanel,
		containerWidthPx,
		projectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		ensureExpandedWhenDetailVisible,
	})

	return (
		<TopicDesktopPanels
			containerRef={containerRef}
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
				/>
			}
			messagePanel={
				<TopicMessagePanel
					selectedProject={selectedProject}
					selectedTopic={selectedTopic}
					messages={messages as any}
					showLoading={showLoading}
					isShowLoadingInit={isShowLoadingInit}
					currentTopicStatus={currentTopicStatus}
					attachments={attachments}
					handleSendMsg={handleSendMsg}
					handlePullMoreMessage={handlePullMoreMessage}
					isMessagesLoading={isMessagesInitialLoading}
					handleFileClick={handleFileClickWithPanel}
					setUserSelectDetail={setUserSelectDetail}
					setSelectedTopic={(topic) => topicStore.setSelectedTopic(topic)}
					isConversationPanelCollapsed={
						shouldShowDetailPanel ? isConversationPanelCollapsed : false
					}
					onToggleConversationPanel={toggleConversationPanel}
					onExpandConversationPanel={expandConversationPanel}
					detailPanelVisible={shouldShowDetailPanel}
				/>
			}
			isReadOnly={isReadOnly}
			shouldShowDetailPanel={shouldShowDetailPanel}
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			isDraggingProjectSider={isDraggingProjectSider}
			isDraggingMessagePanel={isDraggingMessagePanel}
			projectSiderWidthPx={projectSiderWidthPx}
			targetDetailPanelWidth={targetDetailPanelWidth}
			targetRightHandleWidth={targetRightHandleWidth}
			targetMessagePanelWidth={targetMessagePanelWidth}
			panelResizeTransition={panelResizeTransition}
			detailContentTransform={detailContentTransform}
			detailContentTransition={detailContentTransition}
			messageTransform={messageTransform}
			messagePanelTransition={messagePanelTransition}
			onProjectResizeStart={startDragProjectSider}
			onMessageResizeStart={startDragMessagePanel}
		/>
	)
}

// 导出的工作区组件
export default observer(TopicPage)
