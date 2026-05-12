import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks"
import { throttle } from "lodash-es"
import { useMemo, useRef, useState, useEffect, useCallback } from "react"
import { observer } from "mobx-react-lite"
import MessageList, { MessageListProvider } from "@/pages/superMagic/components/MessageList"
import { useStyles } from "./styles"
import { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { userStore } from "@/models/user"
import { useMessageChanges } from "@/pages/superMagic/hooks/useMessageChanges"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import { topicStore, projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { useTaskData } from "@/pages/superMagic/hooks/useTaskData"
import SuperMagicService from "@/pages/superMagic/services"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { LongMemoryApi, SuperMagicApi } from "@/apis"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import projectFilesStore from "@/stores/projectFiles"
import {
	releaseAttachmentsRefreshWaitersWithoutFetch,
	resolveAttachmentsRefreshWaitersForProject,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { isCollaborationWorkspace } from "@/pages/superMagic/constants"
import { useNoPermissionCollaborationProject } from "@/pages/superMagic/hooks/useNoPermissionCollaborationProject"
import { useScopedTopicReadProgress } from "@/pages/superMagic/hooks/useScopedTopicReadProgress"
import ChatHeader from "./components/ChatHeader"
import { useTopicListActions } from "../ProjectPage/ProjectPageMain/hooks"
import PreviewDetailPopup, {
	PreviewDetail,
	PreviewDetailPopupRef,
} from "../../components/PreviewDetailPopup"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { LongMemory } from "@/types/longMemory"
import { cn } from "@/lib/utils"
import ProjectPageInputContainer from "@/pages/superMagic/components/ProjectPageInputContainer"
import ChatActions from "../ProjectPage/ProjectPageMain/components/ChatActions"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"

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

	// Get task data
	useTaskData({ selectedTopic })

	// Local state
	const attachments = projectFilesStore.workspaceFileTree
	const attachmentList = projectFilesStore.workspaceFilesList

	// Refs
	const footerRef = useRef<HTMLDivElement>(null)
	const nodesPanelRef = useRef<HTMLDivElement | null>(null)
	const [isProgrammaticScroll, setIsProgrammaticScroll] = useState(false)
	const scrollHeightRef = useRef<number>(0)
	const scrollTopRef = useRef<number>(0)
	const [isShowLoadingInit, setIsShowLoadingInit] = useState(false)

	// Hooks
	const { userInfo } = userStore.user
	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()
	const handleTopicMessagesChangeRef = useRef<
		| ((payload: {
				lastMessageNode?: {
					status?: unknown
				}
				selectedTopic?: Topic | null
				topicMessages: SuperMagicMessageItem[]
		  }) => void)
		| null
	>(null)

	const { messages, showLoading } = useTopicConversationLoading({
		selectedTopic,
		hideLoadingWhenBufferHasContent: true,
		onTopicMessagesChange: ({
			lastMessageNode,
			selectedTopic: currentTopic,
			topicMessages,
		}) => {
			setIsShowLoadingInit(true)
			handleTopicMessagesChangeRef.current?.({
				lastMessageNode,
				selectedTopic: currentTopic,
				topicMessages,
			})

			// if (filterClickableMessageWithoutRevoked(lastDetailMessageNode)) {
			// 	updateDetail({
			// 		latestMessageDetail: lastDetailMessageNode?.tool?.detail,
			// 		isLoading,
			// 		tool: lastDetailMessageNode?.tool,
			// 	})

			// 	scheduleWhenTabsCacheReady(() => {
			// 		checkAndOpenFileByMessages({
			// 			lastMessageNode,
			// 			lastDetailMessageNode,
			// 			hasStatusChanged,
			// 			activeFileId,
			// 			getActiveFileId: () => activeFileIdRef.current,
			// 		})
			// 	})
			// }
		},
	})

	// Calculate isEmptyStatus
	const isEmptyStatus = messages.length === 0

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
	const { handlePullMoreMessage, isMessagesInitialLoading, isSelectedTopicMessagesReady } =
		useTopicMessages({
			selectedTopic,
			checkNowDebounced,
		})

	const { handleTopicMessagesChange } = useScopedTopicReadProgress({
		scopeName: "MobileTopicPage",
		topicStore,
		selectedTopic,
		isSelectedTopicMessagesReady,
	})
	handleTopicMessagesChangeRef.current = handleTopicMessagesChange

	// Update attachments
	const updateAttachments = useMemoizedFn((selectedProject: any, callback?: () => void) => {
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
					.then((res: any) => {
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
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Update_Attachments, (callback) => {
			if (selectedProject && selectedTopic) {
				updateAttachments(selectedProject, callback)
				return
			}
			callback?.()
			releaseAttachmentsRefreshWaitersWithoutFetch()
		})
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- 与桌面 TopicPage 一致：仅依赖 project/topic 引用
	}, [selectedProject, selectedTopic])

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

	const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])
	const { topicMode, setTopicMode } = useTopicMode({
		selectedTopic,
		selectedProject,
	})

	useTopicModel({
		selectedTopic,
		selectedProject,
		topicMode,
		topicModelStore: sharedTopicModelStore,
	})

	const topicModeConfig = useMemo(() => {
		return superMagicModeService.getModeConfigWithLegacy(
			topicMode,
			undefined,
			false,
			selectedTopic?.agent_code,
		)
	}, [topicMode, selectedTopic?.agent_code])
	const value = useMemo<MessageListContextState>(() => {
		return {
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: true,
			allowMessageTooltip: true,
			allowConversationCopy: true,
			onTopicSwitch: topicStore.setSelectedTopic,
			renderAssistantAvatar: topicModeConfig?.mode
				? ({ className } = {}) => (
						<ModeAvatar
							mode={topicModeConfig.mode}
							className={className}
							iconSize={20}
						/>
					)
				: undefined,
		}
	}, [topicModeConfig])

	const setUserSelectDetail = useMemoizedFn((detail: PreviewDetail | null) => {
		if (!detail) return
		previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
	})

	// Topic list actions
	const { openActionsPopup, openShareModal, topicActionComponents } = useTopicListActions()

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)

	// 消息里 HTML 预览组件的全局按钮在移动端复用现有弹层，不走桌面详情面板。
	useEffect(() => {
		const handleOpenFileTab = (data: { fileId?: string; fileData?: any }) => {
			const filePayload = data?.fileData
			const fileId = filePayload?.file_id || data?.fileId

			// 移动端统一把携带完整 fileData 的打开请求桥接到现有预览弹层；不需要感知来源模块。
			if (filePayload) {
				if (!fileId) return

				setUserSelectDetail({
					type: getFileType(filePayload?.file_extension || ""),
					data: {
						...filePayload,
						file_id: fileId,
						file_name: filePayload?.file_name || filePayload?.display_filename || "",
					},
					currentFileId: fileId,
				} as PreviewDetail)
				return
			}

			onFileClick({
				file_id: fileId,
				file_name: filePayload?.file_name,
			})
		}

		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		}
	}, [onFileClick, setUserSelectDetail])

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
						stickyMessageClassName="-top-[1px] pt-2 [--sticky-message-mask-bg:rgb(255_255_255)] [--sticky-message-mask-fade-from:rgb(255_255_255)]"
					/>
				</MessageListProvider>
			</div>
			<div ref={footerRef} className={styles.footer}>
				<div className="flex flex-col">
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
						enableReEditMessageFromPubSub
						topicModeLogic={{
							topicMode,
							setTopicMode,
						}}
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
