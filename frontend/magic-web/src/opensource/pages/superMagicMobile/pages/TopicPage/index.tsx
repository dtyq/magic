import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks"
import { throttle, isObject } from "lodash-es"
import { useMemo, useRef, useState, useEffect, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { reaction } from "mobx"
import MessageList, {
	MessageListProvider,
} from "@/opensource/pages/superMagic/components/MessageList"
import { useStyles } from "./styles"
import { Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { userStore } from "@/opensource/models/user"
import { useMessageChanges } from "@/opensource/pages/superMagic/hooks/useMessageChanges"
import GlobalMentionPanelStore from "@/opensource/components/business/MentionPanel/store"
import { topicStore, projectStore, workspaceStore } from "@/opensource/pages/superMagic/stores/core"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { useTaskData } from "@/opensource/pages/superMagic/hooks/useTaskData"
import SuperMagicService from "@/opensource/pages/superMagic/services"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { LongMemoryApi, SuperMagicApi } from "@/opensource/apis"
import { AttachmentDataProcessor } from "@/opensource/pages/superMagic/utils/attachmentDataProcessor"
import { useAttachmentsPolling } from "@/opensource/pages/superMagic/hooks/useAttachmentsPolling"
import projectFilesStore from "@/opensource/stores/projectFiles"
import { useInterruptAndUndoMessage } from "@/opensource/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { isCollaborationWorkspace } from "@/opensource/pages/superMagic/constants"
import { useNoPermissionCollaborationProject } from "@/opensource/pages/superMagic/hooks/useNoPermissionCollaborationProject"
import ChatHeader from "./components/ChatHeader"
import { useTopicListActions } from "../ProjectPage/ProjectPageMain/hooks"
import PreviewDetailPopup, {
	PreviewDetail,
	PreviewDetailPopupRef,
} from "../../components/PreviewDetailPopup"
import { useTopicMessages } from "@/opensource/pages/superMagic/hooks/useTopicMessages"
import { getFileType } from "@/opensource/pages/superMagic/utils/handleFIle"
import { LongMemory } from "@/opensource/types/longMemory"
import { cn } from "@/opensource/lib/utils"
import ProjectPageInputContainer from "@/opensource/pages/superMagic/components/ProjectPageInputContainer"
import ChatActions from "../ProjectPage/ProjectPageMain/components/ChatActions"

interface TopicPageProps {
	onHistoryClick?: () => void
	className?: string
}

function TopicPage({ onHistoryClick, className }: TopicPageProps = {}) {
	const { styles, cx } = useStyles()

	// Get state from stores
	const selectedTopic = topicStore.selectedTopic
	const selectedProject = projectStore.selectedProject
	const selectedWorkspace = workspaceStore.selectedWorkspace

	// Get messages from store
	const messages = selectedTopic?.chat_topic_id
		? superMagicStore.messages?.get(selectedTopic?.chat_topic_id) || []
		: []

	// Calculate isEmptyStatus
	const isEmptyStatus = messages.length === 0

	// Get task data
	const { taskData } = useTaskData({ selectedTopic })

	// Local state
	const [showLoading, setShowLoading] = useState(false)
	const attachments = projectFilesStore.workspaceFileTree
	const attachmentList = projectFilesStore.workspaceFilesList

	// Refs
	const footerRef = useRef<HTMLDivElement>(null)
	const nodesPanelRef = useRef<HTMLDivElement | null>(null)
	const [isProgrammaticScroll, setIsProgrammaticScroll] = useState(false)
	const scrollHeightRef = useRef<number>(0)
	const scrollTopRef = useRef<number>(0)
	const messagePanelContainerRef = useRef<HTMLDivElement>(null)
	const [isShowLoadingInit, setIsShowLoadingInit] = useState(false)

	// Hooks
	const { userInfo } = userStore.user
	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

	// Monitor message changes and update loading state
	useEffect(() => {
		return reaction(
			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
			(topicMessages) => {
				if (topicMessages.length > 1) {
					const lastMessageWithRole = topicMessages.findLast(
						(m) => m.role === "assistant",
					)
					const lastMessage = topicMessages?.[topicMessages.length - 1]
					const lastMessageNode = superMagicStore.getMessageNode(
						lastMessageWithRole?.app_message_id,
					)

					const isLoading =
						lastMessageNode?.status === "running" ||
						lastMessage.type === "rich_text" ||
						isObject(lastMessageNode?.content) ||
						Boolean(lastMessageNode?.rich_text?.content) ||
						Boolean(lastMessageNode?.text?.content)

					setShowLoading(isLoading)
					setIsShowLoadingInit(true)
				} else if (topicMessages?.length === 1) {
					setShowLoading(true)
				}
			},
		)
	}, [selectedTopic?.chat_topic_id])

	// Subscribe to buffer changes
	useEffect(() => {
		return reaction(
			() => superMagicStore.buffer.get(selectedTopic?.chat_topic_id || ""),
			(next) => {
				if (next && next?.length > 0) {
					setShowLoading(false)
				}
			},
		)
	}, [selectedTopic?.chat_topic_id])

	// Attachment polling
	const { checkNowDebounced } = useAttachmentsPolling({
		projectId: selectedProject?.id,
		onAttachmentsChange: useCallback(({ tree, list }: { tree: any[]; list: never[] }) => {
			const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
			projectFilesStore.setWorkspaceFileTree(processedData.tree)
		}, []),
		onError: useMemoizedFn((error: any) => {
			if (isCollaborationWorkspace(selectedWorkspace)) {
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

	useDeepCompareEffect(() => {
		setShowLoading(false)
	}, [selectedTopic?.id, selectedTopic?.chat_topic_id])

	// Update attachments
	const updateAttachments = useMemoizedFn((selectedProject: any, callback?: () => void) => {
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
				.then((res: any) => {
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
	})

	// Update attachments when project changes
	useUpdateEffect(() => {
		const projectId = selectedProject?.id
		if (selectedProject) {
			GlobalMentionPanelStore.initLoadAttachments(selectedProject?.id)
			updateAttachments(selectedProject)
		}
		return () => {
			if (projectId) {
				GlobalMentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
			}
		}
	}, [selectedProject?.id])

	// Callback functions
	const onFileClick = useMemoizedFn((fileItem?: any) => {
		const fileId = fileItem?.file_id
		setTimeout(() => {
			// Also open in preview popup for mobile
			const fileAttachment = attachmentList.find((item) => item.file_id === fileId)
			if (fileAttachment) {
				const fileExtension = fileAttachment.file_extension ?? ""
				const type = getFileType(fileExtension)
				setUserSelectDetail({
					type,
					data: {
						file_id: fileId,
						file_name: fileItem?.file_name || fileAttachment.file_name,
					},
					currentFileId: fileId,
				} as any)
			}
		}, 100)
	})

	const onNewTopicClick = useMemoizedFn(() => {
		return SuperMagicService.handleCreateTopic({
			selectedProject,
		})
	})

	const onShareClick = useMemoizedFn(() => {
		// Open share modal for current topic
		if (selectedTopic && selectedProject) {
			openShareModal(selectedTopic, selectedProject)
		}
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
		userInfo,
	})

	// 保存滚动位置的函数
	const saveScrollPosition = () => {
		if (!nodesPanelRef.current) return
		const element = nodesPanelRef.current
		scrollHeightRef.current = element.scrollHeight
		scrollTopRef.current = element.scrollTop
	}

	// 优化滚动逻辑，使用 RAF 确保平滑滚动，并根据滚动条位置决定是否保持位置
	useDeepCompareEffect(() => {
		if (!nodesPanelRef.current || !messages || messages.length === 0) return

		const element = nodesPanelRef.current
		// 判断滚动条是否在底部或接近底部（距离底部50px以内）
		const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 50

		if (isAtBottom) {
			// 如果在底部，则自动滚动到新内容
			setIsProgrammaticScroll(true)
			requestAnimationFrame(() => {
				element.scrollTo({
					top: element.scrollHeight,
					behavior: "smooth", // 可选
				})
				setIsProgrammaticScroll(false)
				saveScrollPosition()
			})
		} else if (scrollHeightRef.current > 0) {
			// 如果不在底部，且有之前的滚动高度记录
			// 计算滚动位置的偏移量以保持相对位置
			const heightDiff = element.scrollHeight - scrollHeightRef.current
			if (heightDiff > 0) {
				setIsProgrammaticScroll(true)
				requestAnimationFrame(() => {
					element.scrollTo({
						top: scrollTopRef.current + heightDiff,
						behavior: "auto", // 可选
					})
					setIsProgrammaticScroll(false)
					saveScrollPosition()
					// setTimeout(() => {

					// }, 100)
				})
			}
		}

		// 初次加载时保存滚动位置
		if (scrollHeightRef.current === 0) {
			saveScrollPosition()
		}
	}, [messages.length])

	// 当selectedNodeId变化时，滚动到底部
	useDeepCompareEffect(() => {
		if (!nodesPanelRef.current || !selectedTopic?.id) return

		const element = nodesPanelRef.current
		setIsProgrammaticScroll(true)
		setTimeout(() => {
			element.scrollTo({
				top: element.scrollHeight,
				behavior: "smooth", // 可选
			})
			setTimeout(() => {
				setIsProgrammaticScroll(false)
				saveScrollPosition()
			}, 100)
		}, 300)
	}, [selectedTopic])

	// 添加滚动监听，当滚动到顶部时触发handlePullMoreMessage
	useDeepCompareEffect(() => {
		const handleScroll = throttle(() => {
			console.log("触发了handleScroll", nodesPanelRef.current?.scrollTop)
			if (!nodesPanelRef.current || isProgrammaticScroll) return

			// 保存用户手动滚动后的位置
			saveScrollPosition()

			if (nodesPanelRef.current.scrollTop <= 300 && handlePullMoreMessage) {
				handlePullMoreMessage(selectedTopic)
			}
		}, 500)

		const element = nodesPanelRef.current
		if (element) {
			element.addEventListener("scroll", handleScroll)
		}

		return () => {
			if (element) {
				element.removeEventListener("scroll", handleScroll)
			}
		}
	}, [isProgrammaticScroll, nodesPanelRef, handlePullMoreMessage, selectedTopic])

	const value = useMemo(() => {
		return {
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: true,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			onTopicSwitch: topicStore.setSelectedTopic,
		}
	}, [])

	const setUserSelectDetail = useMemoizedFn((detail: PreviewDetail | null) => {
		if (!detail) return
		previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
	})

	// Topic list actions
	const { openActionsPopup, openShareModal, topicActionComponents } = useTopicListActions()

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)

	return (
		<div className={cn(styles.container, className)}>
			<ChatHeader
				selectedTopic={selectedTopic}
				openActionsPopup={(topic: Topic) => {
					openActionsPopup(topic, selectedProject)
				}}
				onNewTopicClick={onNewTopicClick}
				onHistoryClick={onHistoryClick}
				onShareClick={onShareClick}
			/>
			<div className={styles.body} ref={nodesPanelRef}>
				<MessageListProvider value={value}>
					<MessageList
						data={messages as any}
						setSelectedDetail={setUserSelectDetail}
						selectedTopic={selectedTopic}
						className={cx(isEmptyStatus && styles.emptyMessageWelcome)}
						handlePullMoreMessage={handlePullMoreMessage}
						showLoading={showLoading}
						onFileClick={onFileClick}
						isMessagesLoading={isMessagesInitialLoading}
					/>
				</MessageListProvider>
			</div>
			<div ref={footerRef} className={styles.footer}>
				<div className="flex flex-col gap-2">
					<ChatActions
						onNewTopicClick={onNewTopicClick}
						onHistoryTopicsClick={onHistoryClick}
					/>
					<ProjectPageInputContainer
						className="mx-auto max-w-3xl rounded-2xl"
						classNames={{
							editor: "border-none",
						}}
						messages={messages}
						showLoading={showLoading}
						selectedProject={selectedProject}
						selectedTopic={selectedTopic}
						setSelectedTopic={topicStore.setSelectedTopic}
						onFileClick={onFileClick}
						selectedWorkspace={selectedWorkspace}
						attachments={attachments}
						isShowLoadingInit={isShowLoadingInit}
					/>
				</div>
			</div>
			{topicActionComponents}
			<PreviewDetailPopup
				ref={previewDetailPopupRef}
				setUserSelectDetail={setUserSelectDetail}
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				onOpenNewPopup={(detail, attachmentTree, attachmentList) => {
					linkPreviewPopupRef.current?.open(detail, attachmentTree, attachmentList)
				}}
			/>
			{/* 用于打开链接的新弹层 */}
			<PreviewDetailPopup
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				ref={linkPreviewPopupRef}
				setUserSelectDetail={(detail: any) => {
					linkPreviewPopupRef.current?.open(detail, attachments, attachmentList)
				}}
				onClose={() => {
					// 关闭链接弹层时不做任何操作
				}}
			/>
		</div>
	)
}

export default observer(TopicPage)
