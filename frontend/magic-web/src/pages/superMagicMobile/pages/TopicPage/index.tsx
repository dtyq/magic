import { SimpleModeGuide } from "@/pages/superMagic/components/MessageHeader/components/SimpleModeGuide"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
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
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import { topicStore, projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { useTaskData } from "@/pages/superMagic/hooks/useTaskData"
import SuperMagicService, { loadProjectAttachments } from "@/pages/superMagic/services"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	measureAttachmentFetch,
	recordAttachmentsStaleResponseDropped,
} from "@/pages/superMagic/utils/attachmentPerf"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import projectFilesStore from "@/stores/projectFiles"
import {
	normalizeUpdateAttachmentsPayload,
	releaseAttachmentsRefreshWaitersWithoutFetch,
	resolveAttachmentsRefreshWaitersForProject,
	type SuperMagicUpdateAttachmentsRequest,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { isCollaborationWorkspace } from "@/pages/superMagic/constants"
import { useNoPermissionCollaborationProject } from "@/pages/superMagic/hooks/useNoPermissionCollaborationProject"
import { useScopedTopicReadProgress } from "@/pages/superMagic/hooks/useScopedTopicReadProgress"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"
import ChatHeader from "./components/ChatHeader"
import { TopicFilesPopup } from "./components/TopicFilesPopup"
import { useTopicListActions } from "../ProjectPage/ProjectPageMain/hooks"
import PreviewDetailPopup, {
	PreviewDetail,
	PreviewDetailPopupRef,
} from "../../components/PreviewDetailPopup"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { useMobileFilePreviewPubSub } from "@/pages/superMagic/hooks/useMobileFilePreviewPubSub"
import { useMobileKnowledgeBasePreview } from "@/pages/superMagic/hooks/useMobileKnowledgeBasePreview"
import { useMobileMicroAppPreview } from "@/pages/superMagic/hooks/useMobileMicroAppPreview"
import { cn } from "@/utils/cn"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import ProjectPageInputContainer from "@/pages/superMagic/components/ProjectPageInputContainer"
import ChatActions from "../ProjectPage/ProjectPageMain/components/ChatActions"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import { useModelErrorRecovery } from "@/pages/superMagic/hooks/useModelErrorRecovery"
import type { HandleSendParams } from "@/pages/superMagic/services/messageSendFlowService"
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
import { isAiCanvasProject } from "@/pages/superMagic/utils/isAiCanvasProject"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { useAiCanvasDocument } from "@/pages/superMagic/pages/TopicPage/hooks/useAiCanvasDocument"
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
import {
	isAbortError,
	useLatestAbortableRequest,
} from "@/pages/superMagic/hooks/useLatestAbortableRequest"
import { useProjectFirstAttachmentRender } from "@/pages/superMagic/hooks/useProjectFirstAttachmentRender"
import { resolveTopicPageMessageListFallback } from "./components/TopicPageMessageListFallback"
import KnowledgeBasePreviewPopup from "@/pages/superMagic/components/KnowledgeBasePreviewPopup"
import MicroAppPreviewPopup from "@/pages/superMagic/components/MicroAppPreviewPopup"
import { buildMobileFilePreviewDetail } from "./mobileFilePreview"

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

const noopOpenCanvas = () => undefined

/** AI canvas topics always talk to the design employee: the mode cannot be switched. */
const AI_CANVAS_TOPIC_MODE_LOGIC = {
	topicMode: TopicMode.Design,
	setTopicMode: () => undefined,
	recoverTopicMode: () => undefined,
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
	const { t: tMainInput } = useTranslation("super/mainInput")
	// AI canvas composers share the AI canvas home's prompt hint.
	const { t: tAiCanvas } = useTranslation("aiCanvas")
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const location = useLocation()
	const routeName = routesMatch(location.pathname)?.route.name as RouteName | undefined
	const resolvedPageKind = pageKind ?? resolveMobileTopicPageKind(routeName)
	const isSingleTopicChat = resolvedPageKind === MobileTopicPageKind.SingleTopicChat
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
	const isAiCanvas = isAiCanvasProject(selectedProject)
	// Same canvas binding as the desktop topic page: ensures the project's canvas exists and
	// renames it whenever the project is renamed (including the automatic rename after the first
	// message). The canvas is shown on the project page, so nothing is opened here.
	const aiCanvasDocument = useAiCanvasDocument({
		enabled: isAiCanvas,
		projectId: selectedProject?.id,
		projectName: selectedProject?.project_name,
		isReadOnly: isReadOnlyProject(selectedProject?.user_role),
		attachments: projectFilesStore.workspaceFileTree,
		attachmentLoadState: projectFilesStore.attachmentLoadState,
		projectFilesStore,
		openCanvas: noopOpenCanvas,
	})
	// AI canvas topics bind the project's canvas to every send, as on desktop. Read at send time
	// so a canvas created after the page opened is found too.
	const getAiCanvasMentionItems = useMemoizedFn(() => aiCanvasDocument.canvasMentionItems)
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
	const simpleModeAnchorRef = useRef<HTMLSpanElement>(null)
	const { shouldRenderProjectFirstRequest, resetProjectFirstRequestRender } =
		useProjectFirstAttachmentRender()
	const { startRequest: startAttachmentsRequest, cancelCurrent: cancelAttachmentsRequest } =
		useLatestAbortableRequest()
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
		autoStart: false,
		onAttachmentsChange: useCallback(({ tree, list }: { tree: any[]; list: any[] }) => {
			const processedData = AttachmentDataProcessor.processAttachmentData(
				{ tree, list },
				{ preserveList: true },
			)
			projectFilesStore.setWorkspaceFileTree(processedData.tree, {
				list: processedData.list,
				source: "MobileTopicPage.polling",
			})
		}, []),
		onError: useMemoizedFn((error: any) => {
			if (isCollaborationWorkspace(selectedWorkspace)) {
				handleNoPermissionCollaborationProject(error)
				return
			}
		}),
	})

	useProjectAttachmentsChangeRealtime({
		projectId: selectedProject?.id,
		onFallbackError: useMemoizedFn((error: unknown) => {
			if (isCollaborationWorkspace(selectedWorkspace)) {
				handleNoPermissionCollaborationProject(error)
				return
			}
			console.error("Failed to refresh realtime attachments:", error)
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
			cancelAttachmentsRequest()
			resetProjectFirstRequestRender()
			projectFilesStore.setWorkspaceFileTree([])
			releaseAttachmentsRefreshWaitersWithoutFetch()
			return
		}
		const request = startAttachmentsRequest()
		let didCommitFinalSnapshot = false

		try {
			const shouldRenderIncrementally = shouldRenderProjectFirstRequest(projectId)

			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			withAttachmentsRefreshWaitersResolved(
				projectId,
				measureAttachmentFetch("MobileTopicPage.updateAttachments", () =>
					loadProjectAttachments({
						projectId,
						signal: request.signal,
						onBatchSnapshot: shouldRenderIncrementally
							? ({ tree, list, phase, isFinal }) => {
									if (!request.isCurrent()) {
										recordAttachmentsStaleResponseDropped(
											"MobileTopicPage.updateAttachments",
											{ stage: "batch_snapshot", phase },
										)
										return
									}
									const processedData =
										AttachmentDataProcessor.processAttachmentData(
											{ tree, list },
											{ preserveList: true },
										)
									projectFilesStore.setWorkspaceFileTree(processedData.tree, {
										list: processedData.list,
										source: `MobileTopicPage.batch.${phase}`,
									})
									if (isFinal) {
										didCommitFinalSnapshot = true
									}
								}
							: undefined,
					}),
				)
					.then((res: Awaited<ReturnType<typeof loadProjectAttachments>>) => {
						if (!request.isCurrent()) {
							recordAttachmentsStaleResponseDropped(
								"MobileTopicPage.updateAttachments",
								{ stage: "load_result" },
							)
							return
						}
						if (!didCommitFinalSnapshot) {
							projectFilesStore.setWorkspaceFileTree(res.tree, {
								list: res.list,
								source: "MobileTopicPage.load_result",
							})
						}
						GlobalMentionPanelStore.finishLoadAttachmentsPromise(projectId)
					})
					.catch((error: unknown) => {
						if (isAbortError(error)) return
						if (!request.isCurrent()) {
							recordAttachmentsStaleResponseDropped(
								"MobileTopicPage.updateAttachments",
								{ stage: "load_error" },
							)
							return
						}
						console.error("Failed to fetch attachments:", error)
						projectFilesStore.setWorkspaceFileTree([])
					})
					.finally(() => {
						if (request.isCurrent()) {
							pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
						}
						request.release()
						callback?.()
					}),
			)
		} catch (error) {
			if (isAbortError(error)) return
			console.error("Failed to fetch attachments:", error)
			projectFilesStore.setWorkspaceFileTree([])
			resolveAttachmentsRefreshWaitersForProject(projectId)
			callback?.()
		}
	})

	const handleUpdateAttachments = useMemoizedFn(
		(payloadOrCallback?: SuperMagicUpdateAttachmentsRequest) => {
			const payload = normalizeUpdateAttachmentsPayload(payloadOrCallback)

			if (selectedProject && selectedTopic) {
				updateAttachments(selectedProject, payload?.callback)
				return
			}
			payload?.callback?.()
			releaseAttachmentsRefreshWaitersWithoutFetch()
		},
	)

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		}
	}, [handleUpdateAttachments])

	// Update attachments when project changes
	useUpdateEffect(() => {
		const projectId = selectedProject?.id
		if (selectedProject) {
			GlobalMentionPanelStore.initLoadAttachments(selectedProject?.id)
			updateAttachments(selectedProject)
		}
		return () => {
			cancelAttachmentsRequest()
			if (projectId) {
				GlobalMentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
			}
		}
	}, [selectedProject?.id])

	const refreshTopicFiles = useMemoizedFn(() => {
		return updateAttachments(selectedProject)
	})

	// Callback functions
	const onFileClick = useMemoizedFn((fileItem?: unknown) => {
		// Open immediately from message metadata; project metadata is merged when available.
		const previewDetail = buildMobileFilePreviewDetail(fileItem, attachmentList)
		if (previewDetail) setUserSelectDetail(previewDetail)
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

	// Handle interrupt and undo message functionality
	useInterruptAndUndoMessage({
		selectedTopic,
		messages,
		userInfo,
	})

	const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])
	const { topicMode, setTopicMode, recoverTopicMode } = useTopicMode({
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
	const recoverySendMessageRef = useRef<
		((params: HandleSendParams) => Promise<boolean>) | undefined
	>()
	const modelErrorRecovery = useModelErrorRecovery({
		selectedProject,
		selectedTopic,
		topicModelStore: sharedTopicModelStore,
		sendMessageRef: recoverySendMessageRef,
		showLoading,
		isMessagesLoading: isMessagesInitialLoading,
	})
	const value = useMemo<MessageListContextState>(() => {
		return {
			modelErrorRecovery,
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: true,
			allowMessageTooltip: true,
			// single-topic Chat 不允许从消息卡片复制出兄弟话题，避免出现多话题能力穿透。
			allowConversationCopy: capabilities.canCreateSiblingTopic,
			onTopicSwitch: switchToProjectTopic,
			projectFilesStore,
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
	}, [
		capabilities.canCreateSiblingTopic,
		projectFilesStore,
		switchToProjectTopic,
		topicModeConfig,
		modelErrorRecovery,
	])

	const setUserSelectDetail = useMemoizedFn((detail: PreviewDetail | null) => {
		if (!detail) return
		previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
	})

	// Topic list actions
	const isReadonly = isReadOnlyProject(selectedProject?.user_role)
	const simpleModeAvailable = pageKind === MobileTopicPageKind.ProjectTopic && !isReadonly
	const { openActionsPopup, openShareModal, topicActionComponents } = useTopicListActions({
		enableSimpleMode: simpleModeAvailable,
	})

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)

	useEffect(() => {
		// A direct message click may open before the project tree arrives; enrich it afterwards.
		previewDetailPopupRef.current?.updateAttachments(attachments, attachmentList)
	}, [attachments, attachmentList])

	// 移动端统一订阅消息节点中的文件预览 / 路径打开事件
	useMobileFilePreviewPubSub({
		attachmentList,
		setUserSelectDetail,
		onFileClick,
	})
	const knowledgeBasePreviewState = useMobileKnowledgeBasePreview()
	const microAppPreviewState = useMobileMicroAppPreview()

	return (
		<HostConversationProvider selectedProject={selectedProject} topicStore={topicStore}>
			<div className={cn(styles.container, className)} data-testid="topic-page-root">
				{projectTopicMorePortalTarget &&
					createPortal(
						<>
							<Button
								variant="ghost"
								className="h-12 w-12 shrink-0 rounded-full p-0 text-foreground hover:bg-transparent active:opacity-70"
								onClick={openProjectTopicActionSheet}
								aria-label={t("topic.moreAria")}
								data-testid="project-topic-header-more-button"
							>
								{/* Ghost Button shrinks SVGs whose class lacks "size-" to 16px.
								    size-[22px] keeps this ellipsis on the same 22px stroke scale
								    as the other mobile header more icons, and the anchor centers it. */}
								<span
									ref={simpleModeAnchorRef}
									className="flex size-[22px] items-center justify-center"
								>
									<Ellipsis className="size-[22px]" />
								</span>
							</Button>
							<SimpleModeGuide
								anchorRef={simpleModeAnchorRef}
								available={simpleModeAvailable && Boolean(selectedTopic)}
								menuOpen={projectTopicActionSheetVisible}
							/>
						</>,
						projectTopicMorePortalTarget,
					)}
				{shouldRenderInlineHeader && (
					<ChatHeader
						enableSimpleMode={simpleModeAvailable}
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
				<div
					className={cn(styles.body, bodyClassName)}
					data-testid="topic-page-message-panel"
				>
					<MessageListProvider value={value}>
						{/* MessageList owns pagination, anchor restoration, and auto-follow for this viewport. */}
						<MessageList
							enableSimpleMode={simpleModeAvailable}
							data={messages as any}
							setSelectedDetail={setUserSelectDetail}
							selectedTopic={selectedTopic}
							className={cx(
								"[--message-list-surface:rgb(var(--mobile-background-rgb))] [--message-list-sticky-fade-height:0px]",
								messageListClassName,
							)}
							classNames={{ content: "px-4 pt-[10px]" }}
							scrollEdgeFade
							handlePullMoreMessage={handlePullMoreMessage}
							showLoading={showLoading}
							onFileClick={onFileClick}
							isMessagesLoading={isMessagesInitialLoading}
							fallbackRender={resolvedMessageListFallbackRender}
						/>
					</MessageListProvider>
				</div>
				<div
					ref={footerRef}
					className={cn(styles.footer, footerClassName)}
					data-testid="topic-page-footer"
				>
					<div
						className={cn("flex flex-col gap-2", footerInnerClassName)}
						data-testid="topic-page-input-panel"
					>
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
							// Chat details use the same model-only selector as the chat home.
							// AI canvas topics are locked to the design employee, as on desktop: no mode
							// switch, only the model selector.
							showModeToggle={isSingleTopicChat || isAiCanvas ? false : undefined}
							showModelSelector={isSingleTopicChat || isAiCanvas ? true : undefined}
							agentCode={isAiCanvas ? null : undefined}
							getImplicitMentionItems={
								isAiCanvas ? getAiCanvasMentionItems : undefined
							}
							placeholder={
								isSingleTopicChat
									? tMainInput("mobileHome.chatPlaceholder")
									: isAiCanvas
										? tAiCanvas("home.placeholder")
										: undefined
							}
							attachments={attachments}
							isShowLoadingInit={isShowLoadingInit}
							enableReEditMessageFromPubSub
							onMessageSendReady={modelErrorRecovery.onMessageSendReady}
							onSendComplete={handleEditorSendComplete}
							topicModeLogic={
								isAiCanvas
									? AI_CANVAS_TOPIC_MODE_LOGIC
									: {
											topicMode,
											setTopicMode,
											recoverTopicMode,
										}
							}
						/>
					</div>
				</div>
				{!hideTopicActions &&
					(isStandaloneProjectTopicPage
						? projectTopicActionComponents
						: topicActionComponents)}
				{isStandaloneProjectTopicPage ? (
					<ConversationActionsPopup
						enableSimpleMode={simpleModeAvailable}
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
					allowEdit={!isReadonly}
					onOpenNewPopup={(detail, attachmentTree, attachmentList) => {
						linkPreviewPopupRef.current?.open(detail, attachmentTree, attachmentList)
					}}
				/>
				{/* 用于打开链接的新弹层 */}
				<PreviewDetailPopup
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					ref={linkPreviewPopupRef}
					allowEdit={!isReadonly}
					setUserSelectDetail={(detail: PreviewDetail | null) => {
						if (!detail) return
						linkPreviewPopupRef.current?.open(detail, attachments, attachmentList)
					}}
					onClose={() => {
						// 关闭链接弹层时不做任何操作
					}}
				/>
				<KnowledgeBasePreviewPopup state={knowledgeBasePreviewState} />
				<MicroAppPreviewPopup state={microAppPreviewState} />
			</div>
		</HostConversationProvider>
	)
}

export default observer(TopicPage)
