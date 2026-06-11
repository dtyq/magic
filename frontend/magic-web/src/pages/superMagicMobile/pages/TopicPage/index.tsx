import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks"
import { throttle } from "lodash-es"
import {
	useMemo,
	useRef,
	useState,
	useEffect,
	useCallback,
	useLayoutEffect,
	type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import MessageList, { MessageListProvider } from "@/pages/superMagic/components/MessageList"
import { useStyles } from "./styles"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
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
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"
import ChatHeader from "./components/ChatHeader"
import { TopicFilesPopup } from "./components/TopicFilesPopup"
import { useTopicListActions } from "../ProjectPage/ProjectPageMain/hooks"
import PreviewDetailPopup, {
	PreviewDetail,
	PreviewDetailPopupRef,
} from "../../components/PreviewDetailPopup"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { useMobileFilePreviewPubSub } from "@/pages/superMagic/hooks/useMobileFilePreviewPubSub"
import { useMobileKnowledgeBasePreview } from "@/pages/superMagic/hooks/useMobileKnowledgeBasePreview"
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
import { RouteName } from "@/routes/constants"
import { useLocation } from "react-router"
import { routesMatch } from "@/routes/history/helpers"
import {
	getMobileTopicPageCapabilities,
	MobileTopicPageKind,
	resolveMobileTopicPageKind,
} from "../shared/topicPageCapabilities"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode/useCreateTopicListener"
import { Ellipsis } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { PORTAL_IDS } from "@/constants"
import usePortalTarget from "@/hooks/usePortalTarget"
import { useIsMobile } from "@/hooks/useIsMobile"
import ConversationActionsPopup from "@/pages/superMagicMobile/components/ConversationActionsPopup"
import { MobileSettingsFeedbackSheet } from "@/layouts/BaseLayoutMobile/components/MobileSettings/components/FeedbackSheet"
import { useConversationFeedbackSheet } from "@/pages/superMagicMobile/hooks/useConversationFeedbackSheet"
import { useMobileProjectTopicSwitch } from "@/pages/superMagicMobile/hooks/useMobileProjectTopicSwitch"
import { useProjectTopicConversationActions } from "./hooks/useProjectTopicConversationActions"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { resolveTopicPageMessageListFallback } from "./components/TopicPageMessageListFallback"
import KnowledgeBasePreviewPopup from "@/pages/superMagic/components/KnowledgeBasePreviewPopup"

interface TopicPageProps {
	onHistoryClick?: () => void
	className?: string
	hideHeader?: boolean
	hideChatActions?: boolean
	hideTopicActions?: boolean
	messageListFallbackRender?: ReactNode
	messageListClassName?: string
	bodyClassName?: string
	footerClassName?: string
	footerInnerClassName?: string
	pageKind?: MobileTopicPageKind
	onInitialMessagesLoadingChange?: (isLoading: boolean) => void
	onInitialMessagesReadyChange?: (isReady: boolean) => void
}

function TopicPage({
	onHistoryClick,
	className,
	hideHeader = false,
	hideChatActions = true,
	hideTopicActions = false,
	messageListFallbackRender,
	messageListClassName,
	bodyClassName,
	footerClassName,
	footerInnerClassName,
	pageKind,
	onInitialMessagesLoadingChange,
	onInitialMessagesReadyChange,
}: TopicPageProps = {}) {
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const location = useLocation()
	const routeName = routesMatch(location.pathname)?.route.name as RouteName | undefined
	const resolvedPageKind = pageKind ?? resolveMobileTopicPageKind(routeName)
	const capabilities = getMobileTopicPageCapabilities(resolvedPageKind)
	const isStandaloneProjectTopicPage = routeName === RouteName.SuperWorkspaceProjectTopicState
	// 独立项目话题子页由壳层头部承载返回与标题，避免与页内 ChatHeader 叠成双头部。
	const shouldRenderInlineHeader = !hideHeader && !isStandaloneProjectTopicPage
	const projectTopicMorePortalTarget = usePortalTarget({
		portalId: PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_MORE_BUTTON,
		enabled: isMobile && isStandaloneProjectTopicPage,
	})
	useCreateTopicListener({
		enabled: capabilities.canCreateSiblingTopic,
	})

	// Get state from stores
	const selectedTopic = topicStore.selectedTopic
	const selectedProject = projectStore.selectedProject
	const { switchToProjectTopic } = useMobileProjectTopicSwitch({
		projectId: selectedProject?.id,
	})
	const selectedWorkspace = workspaceStore.selectedWorkspace

	// Get task data
	useTaskData({ selectedTopic })

	// Local state
	const attachments = projectFilesStore.workspaceFileTree
	const attachmentList = projectFilesStore.workspaceFilesList
	const {
		feedbackSheetOpen: projectTopicFeedbackSheetOpen,
		feedbackPrefill: projectTopicFeedbackPrefill,
		openConversationFeedback: openProjectTopicConversationFeedback,
		closeConversationFeedback: closeProjectTopicConversationFeedback,
	} = useConversationFeedbackSheet({
		selectedProject,
		selectedTopic,
	})
	const {
		actionSheetVisible: projectTopicActionSheetVisible,
		filesDrawerOpen: projectTopicFilesDrawerOpen,
		setFilesDrawerOpen: setProjectTopicFilesDrawerOpen,
		openConversationActionSheet: openProjectTopicActionSheet,
		closeConversationActionSheet: closeProjectTopicActionSheet,
		conversationActionGroups: projectTopicActionGroups,
		conversationActionPopupTitle: projectTopicActionPopupTitle,
		conversationActionPopupSubtitle: projectTopicActionPopupSubtitle,
		topicActionComponents: projectTopicActionComponents,
	} = useProjectTopicConversationActions({
		selectedProject,
		selectedTopic,
		topics: topicStore.topics,
		onOpenConversationFeedback: openProjectTopicConversationFeedback,
	})

	// Refs
	const footerRef = useRef<HTMLDivElement>(null)
	const nodesPanelRef = useRef<HTMLDivElement | null>(null)
	const [isProgrammaticScroll, setIsProgrammaticScroll] = useState(false)
	const scrollHeightRef = useRef<number>(0)
	const scrollTopRef = useRef<number>(0)
	const [isShowLoadingInit, setIsShowLoadingInit] = useState(false)
	const [filesPopupOpen, setFilesPopupOpen] = useState(false)

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

	// 让外层壳层区分“真的空会话”和“历史消息首轮还在补齐”，避免欢迎态抢占首屏。
	useLayoutEffect(() => {
		onInitialMessagesLoadingChange?.(isMessagesInitialLoading)
	}, [isMessagesInitialLoading, onInitialMessagesLoadingChange])

	useLayoutEffect(() => {
		onInitialMessagesReadyChange?.(isSelectedTopicMessagesReady)
	}, [isSelectedTopicMessagesReady, onInitialMessagesReadyChange])

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

	const refreshTopicFiles = useMemoizedFn(() => {
		return updateAttachments(selectedProject)
	})

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
		if (!capabilities.canCreateSiblingTopic) {
			return
		}

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

	const handleEditorSendComplete = useMemoizedFn(
		({
			success,
			currentProject,
			currentTopic,
		}: {
			success: boolean
			currentProject: typeof selectedProject | null
			currentTopic: typeof selectedTopic | null
		}) => {
			if (!success) return

			applyOptimisticTopicRunningState({
				topicStore,
				topic: currentTopic ?? topicStore.selectedTopic,
				project: currentProject ?? projectStore.selectedProject,
				workspace: selectedWorkspace,
			})
		},
	)

	/**
	 * 话题页文件入口只负责切起独立查看弹层；文件树和预览逻辑继续复用项目详情链路。
	 */
	const handleOpenFilesPopup = useMemoizedFn(() => {
		setFilesPopupOpen(true)
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
	const resolvedMessageListFallbackRender = useMemo(
		() => resolveTopicPageMessageListFallback(messageListFallbackRender),
		[messageListFallbackRender],
	)
	const value = useMemo<MessageListContextState>(() => {
		return {
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: true,
			allowMessageTooltip: true,
			// single-topic Chat 不允许从消息卡片复制出兄弟话题，避免出现多话题能力穿透。
			allowConversationCopy: capabilities.canCreateSiblingTopic,
			onTopicSwitch: switchToProjectTopic,
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
	}, [capabilities.canCreateSiblingTopic, switchToProjectTopic, topicModeConfig])

	const setUserSelectDetail = useMemoizedFn((detail: PreviewDetail | null) => {
		if (!detail) return
		previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
	})

	// Topic list actions
	const { openActionsPopup, openShareModal, topicActionComponents } = useTopicListActions()

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)

	// 移动端统一订阅消息节点中的文件预览 / 路径打开事件
	useMobileFilePreviewPubSub({
		attachmentList,
		setUserSelectDetail,
		onFileClick,
	})
	const knowledgeBasePreviewState = useMobileKnowledgeBasePreview()

	return (
		<div className={cn(styles.container, className)} data-testid="topic-page-root">
			{projectTopicMorePortalTarget &&
				createPortal(
					<Button
						variant="ghost"
						className="h-12 w-12 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent active:opacity-70"
						onClick={openProjectTopicActionSheet}
						aria-label={t("topic.moreAria")}
						data-testid="project-topic-header-more-button"
					>
						<Ellipsis className="h-[22px] w-[22px]" />
					</Button>,
					projectTopicMorePortalTarget,
				)}
			{shouldRenderInlineHeader && (
				<ChatHeader
					selectedTopic={selectedTopic}
					openActionsPopup={(topic: Topic) => {
						openActionsPopup(topic, selectedProject)
					}}
					onNewTopicClick={
						capabilities.canCreateSiblingTopic ? onNewTopicClick : undefined
					}
					onHistoryClick={onHistoryClick}
					onFilesClick={handleOpenFilesPopup}
					onShareClick={onShareClick}
				/>
			)}
			<div className={cn(styles.body, bodyClassName)}>
				<MessageListProvider value={value}>
					<MessageList
						data={messages as any}
						setSelectedDetail={setUserSelectDetail}
						selectedTopic={selectedTopic}
						className={cx(messageListClassName)}
						viewportRef={nodesPanelRef}
						handlePullMoreMessage={handlePullMoreMessage}
						showLoading={showLoading}
						onFileClick={onFileClick}
						isMessagesLoading={isMessagesInitialLoading}
						fallbackRender={resolvedMessageListFallbackRender}
					/>
				</MessageListProvider>
			</div>
			<div ref={footerRef} className={cn(styles.footer, footerClassName)}>
				<div className={cn("flex flex-col gap-2", footerInnerClassName)}>
					{!hideChatActions && (
						<ChatActions
							onNewTopicClick={
								capabilities.canCreateSiblingTopic ? onNewTopicClick : undefined
							}
							onHistoryTopicsClick={onHistoryClick}
						/>
					)}
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
						onSendComplete={handleEditorSendComplete}
						topicModeLogic={{
							topicMode,
							setTopicMode,
						}}
					/>
				</div>
			</div>
			{!hideTopicActions &&
				(isStandaloneProjectTopicPage
					? projectTopicActionComponents
					: topicActionComponents)}
			{isStandaloneProjectTopicPage ? (
				<ConversationActionsPopup
					visible={projectTopicActionSheetVisible}
					title={projectTopicActionPopupTitle}
					subtitle={projectTopicActionPopupSubtitle}
					actionGroups={projectTopicActionGroups}
					onClose={closeProjectTopicActionSheet}
				/>
			) : null}
			{isStandaloneProjectTopicPage ? (
				<MobileSettingsFeedbackSheet
					open={projectTopicFeedbackSheetOpen}
					onClose={closeProjectTopicConversationFeedback}
					prefill={projectTopicFeedbackPrefill}
				/>
			) : null}
			{isStandaloneProjectTopicPage ? (
				<TopicFilesPopup
					open={projectTopicFilesDrawerOpen}
					onOpenChange={setProjectTopicFilesDrawerOpen}
					attachments={attachments}
					attachmentList={attachmentList}
					selectedProject={selectedProject}
					selectedTopic={selectedTopic}
					selectedWorkspace={selectedWorkspace}
					projects={projectStore.projects}
					workspaces={workspaceStore.workspaces}
					projectId={selectedProject?.id}
					refreshAttachments={refreshTopicFiles}
				/>
			) : null}
			{!isStandaloneProjectTopicPage ? (
				<TopicFilesPopup
					open={filesPopupOpen}
					onOpenChange={setFilesPopupOpen}
					attachments={attachments}
					attachmentList={attachmentList}
					selectedProject={selectedProject}
					selectedTopic={selectedTopic}
					selectedWorkspace={selectedWorkspace}
					projects={projectStore.projects}
					workspaces={workspaceStore.workspaces}
					projectId={selectedProject?.id}
					refreshAttachments={refreshTopicFiles}
				/>
			) : null}
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
			<KnowledgeBasePreviewPopup state={knowledgeBasePreviewState} />
		</div>
	)
}

export default observer(TopicPage)
