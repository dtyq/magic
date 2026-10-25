import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { Button } from "@/components/shadcn-ui/button"
import ConversationEmptyState from "@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState"
import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import MessageQueue from "@/pages/superMagic/components/MessagePanel/components/MessageQueue"
import useMessageQueue from "@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import type { DetailRef } from "@/pages/superMagic/components/Detail"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import { shouldCheckAttachmentsOnTaskStatus } from "@/pages/superMagic/services/topicStatusSyncService"
import { useTopicDetailPanelController } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicDetailPanelController"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	isTopicTaskRunning,
	isTopicWaitingForUser,
	TaskStatus,
} from "@/pages/superMagic/pages/Workspace/types"
import useTopicModel from "@/pages/superMagic/components/MessageEditor/hooks/useTopicModel"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { userStore } from "@/models/user"
import useNavigate from "@/routes/hooks/useNavigate"
import { ViewTransitionPresets } from "@/types/viewTransition"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { ClawHeroIcon } from "./components/ClawHeroIcon"
import { useClawPlaygroundStore } from "./context"
import { MOBILE_LAYOUT_CONFIG } from "../../components/MainInputContainer/components/editors/constant"
import { createClawPlaygroundFileRowDecorationResolver } from "./claw-playground-file-tree-decorations"
import { merge } from "lodash-es"
import { useClawPlaygroundCore } from "./hooks/useClawPlaygroundCore"
import {
	type AutoSendInitialClawMessagePayload,
	useAutoSendInitialClawMessage,
} from "./hooks/useAutoSendInitialClawMessage"
import { useClawPlaygroundMessageListContextValue } from "./hooks/useClawPlaygroundMessageListContextValue"
import { dispatchClawNewChatSlash } from "./utils/dispatchClawNewChatSlash"
import { useClawSandboxUpgradeAction } from "./hooks/useClawSandboxUpgradeAction"
import { ClawMobileHeader } from "./components/ClawMobileHeader"
import { ClawMobileFilesDrawer } from "./components/ClawMobileFilesDrawer"
import { ClawMobileSkillsDrawer } from "./components/ClawMobileSkillsDrawer"
import ClawMobileInputContainer from "./components/ClawMobileInputContainer"
import PreviewDetailPopup, {
	type PreviewDetail,
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import {
	CLAW_MOBILE_BACK_TO_LATEST_BUTTON_CLASS,
	CLAW_MOBILE_MESSAGE_LIST_RESERVE_PX,
} from "./claw-playground-layout"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { useTaskInterrupt } from "@/pages/superMagic/hooks/useTaskInterrupt"
import { collectMentionItemsFromContent } from "@/pages/superMagic/components/MessageEditor/services/uploadMentionService"
import { transformMentions } from "@/pages/superMagic/components/MessageEditor/utils/mention"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"
import { toast } from "sonner"
import { MagicClawApi } from "@/apis"
import { MobileSettingsFeedbackSheet } from "@/layouts/BaseLayoutMobile/components/MobileSettings/components/FeedbackSheet"
import { useClawFeedbackSheet } from "@/pages/superMagic/hooks/useClawFeedbackSheet"
import { ClawMobileMoreSheet } from "./components/ClawMobileMoreSheet"
import { MagiClawEditDialog } from "../MagiClawPage/MagiClawEditDialog"
import type { MagiClawEditPayload } from "../MagiClawPage/useMagiClawMobilePage"
import {
	SuperMobileShellRouteLayout,
	useOptionalSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"
import { useMobileKnowledgeBasePreview } from "@/pages/superMagic/hooks/useMobileKnowledgeBasePreview"
import { useMobileMicroAppPreview } from "@/pages/superMagic/hooks/useMobileMicroAppPreview"
import KnowledgeBasePreviewPopup from "@/pages/superMagic/components/KnowledgeBasePreviewPopup"
import MicroAppPreviewPopup from "@/pages/superMagic/components/MicroAppPreviewPopup"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import { useClawConversationAnalytics } from "./hooks/useClawConversationAnalytics"

interface ClawMobileConversationPanelRef {
	sendSkillInstallPrompt: (content: JSONContent) => void
}

interface ClawMobileConversationPanelProps {
	clawCode?: string
	detailPanelVisible: boolean
	onOpenFilesDrawer: () => void
	onOpenSkillsDrawer: () => void
	onTerminalTopicStatusChange?: () => void
}

const ClawMobileConversationPanel = observer(
	forwardRef<ClawMobileConversationPanelRef, ClawMobileConversationPanelProps>(
		function ClawMobileConversationPanel(
			{
				clawCode,
				detailPanelVisible,
				onOpenFilesDrawer,
				onOpenSkillsDrawer,
				onTerminalTopicStatusChange,
			},
			ref,
		) {
			const { t } = useTranslation("sidebar")
			const { t: tSuper } = useTranslation("super")
			const clawBrandValues = getClawBrandTranslationValues()
			const store = useClawPlaygroundStore()
			const selectedProject = store.selectedProject
			const selectedTopic = store.selectedTopic
			useClawConversationAnalytics(selectedTopic?.id)
			const topicStore = store.topicStore
			const attachments = store.projectFilesStore.workspaceFileTree
			const [stopEventLoading, setStopEventLoading] = useState(false)
			const sharedTopicModelStore = useMemo(() => createSuperMagicTopicModelStore(), [])
			const scopedMessageSendService = useMemo(
				() =>
					createMessageSendService({
						mentionPanelStore: store.mentionPanelStore,
					}),
				[store.mentionPanelStore],
			)

			const { messages, showLoading } = useTopicConversationLoading<TaskStatus>({
				selectedTopic,
				onConversationGeneratingChange: store.setConversationGenerating,
				onTopicMessagesChange: ({ lastMessageNode, selectedTopic: currentTopic }) => {
					const nextStatus = lastMessageNode?.status as TaskStatus | undefined
					if (currentTopic?.id && nextStatus) {
						const hasStatusChanged = nextStatus !== currentTopic.task_status
						store.updateTopicStatus(currentTopic.id, nextStatus)
						if (hasStatusChanged && shouldCheckAttachmentsOnTaskStatus(nextStatus)) {
							onTerminalTopicStatusChange?.()
						}
					}
				},
			})
			const isTaskRunning = showLoading || isTopicTaskRunning(selectedTopic)
			const canInterruptTask =
				isTaskRunning || selectedTopic?.task_status === TaskStatus.WAITING_FOR_USER

			const {
				handlePullMoreMessage,
				isMessagesInitialLoading,
				isSelectedTopicMessagesReady,
			} = useTopicMessages({
				selectedTopic,
			})

			const messageQueue = useMessageQueue({
				projectId: selectedProject?.id,
				topicId: selectedTopic?.id,
				agentCode: clawCode,
				isTaskRunning,
				isWaitingForUser: isTopicWaitingForUser(selectedTopic),
				isEmptyStatus: false,
				isShowLoadingInit: isMessagesInitialLoading,
			})

			const { topicModelStore } = useTopicModel({
				selectedTopic,
				selectedProject,
				topicMode: TopicMode.Default,
				topicModelStore: sharedTopicModelStore,
			})

			const handleSendMsg = useMemoizedFn(
				(content: JSONContent | string, options?: SendMessageOptions) => {
					scopedMessageSendService.sendContent({
						content,
						options,
						showLoading: messages.length > 1 && showLoading,
						context: resolveMessageSendContext({
							selectedProject,
							selectedTopic,
							selectedWorkspace: store.selectedWorkspace,
							setSelectedProject: store.projectStore.setSelectedProject,
							setSelectedTopic: topicStore.setSelectedTopic,
							setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
							topicStore,
						}),
					})

					pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
				},
			)

			const handleClawNewChatSlash = useMemoizedFn(() => {
				dispatchClawNewChatSlash({
					scopedMessageSendService,
					store,
					topicStore,
					topicModelStore,
					selectedProject,
					selectedTopic,
					messagesLength: messages.length,
					showLoading,
					clawCode,
				})
			})

			const handleSendSkillInstallPrompt = useMemoizedFn((content: JSONContent) => {
				if (!selectedProject || !selectedTopic) return

				const selectedModel = topicModelStore.selectedLanguageModel
				const selectedImageModel = topicModelStore.selectedImageModel
				const mentionItems = transformMentions(collectMentionItemsFromContent(content))

				scopedMessageSendService.dispatchMessage({
					jsonContent: content,
					showLoading: messages.length > 1 && showLoading,
					selectedProject,
					selectedTopic,
					context: resolveMessageSendContext({
						selectedProject,
						selectedTopic,
						selectedWorkspace: store.selectedWorkspace,
						setSelectedProject: store.projectStore.setSelectedProject,
						setSelectedTopic: topicStore.setSelectedTopic,
						setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
						topicStore,
					}),
					options: {
						extra: {
							super_agent: {
								mentions: mentionItems,
								chat_mode: "normal",
								topic_pattern: TopicMode.MagiClaw,
								enable_web_search: false,
								...(clawCode && { agent_code: clawCode }),
								...(selectedModel && {
									model: {
										model_id: selectedModel.model_id,
									},
								}),
								...(selectedImageModel?.model_id && {
									image_model: {
										model_id: selectedImageModel.model_id,
									},
								}),
							},
						},
					},
				})

				pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
			})

			const handleAutoSendInitialClawMessage = useMemoizedFn(
				({ jsonContent, options }: AutoSendInitialClawMessagePayload) => {
					if (!selectedProject || !selectedTopic) return

					scopedMessageSendService.dispatchMessage({
						jsonContent,
						options,
						showLoading: messages.length > 1 && showLoading,
						selectedProject,
						selectedTopic,
						context: resolveMessageSendContext({
							selectedProject,
							selectedTopic,
							selectedWorkspace: store.selectedWorkspace,
							setSelectedProject: store.projectStore.setSelectedProject,
							setSelectedTopic: topicStore.setSelectedTopic,
							setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
							topicStore,
						}),
					})

					pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
				},
			)

			useImperativeHandle(
				ref,
				() => ({
					sendSkillInstallPrompt: handleSendSkillInstallPrompt,
				}),
				[handleSendSkillInstallPrompt],
			)

			useInterruptAndUndoMessage({
				selectedTopic,
				messages,
				userInfo: userStore.user.userInfo,
			})

			useAutoSendInitialClawMessage({
				selectedTopicId: selectedTopic?.id,
				agentCode: clawCode,
				isMessagesReady: isSelectedTopicMessagesReady,
				isModelLoading: topicModelStore.isLoading,
				messageCount: messages.length,
				selectedModel: topicModelStore.selectedLanguageModel,
				onAutoSend: handleAutoSendInitialClawMessage,
			})

			const { handleInterrupt } = useTaskInterrupt({
				selectedTopic: selectedTopic ?? null,
				userId: userStore.user.userInfo?.user_id,
				isStopping: stopEventLoading,
				setIsStopping: setStopEventLoading,
				canInterrupt: canInterruptTask,
			})

			const mobileEditorNodes = useMemo<SceneEditorNodes>(() => {
				const messageQueueNode =
					messageQueue.queue.length > 0 ? (
						<div className="mb-2">
							<MessageQueue
								queue={messageQueue.queue}
								editorRef={messageQueue.editorRef}
								queueStats={messageQueue.queueStats}
								onRemoveMessage={messageQueue.removeFromQueue}
								onSendMessage={messageQueue.sendQueuedMessage}
								onStartEdit={messageQueue.startEditQueueItem}
								onWithdraw={messageQueue.withdrawQueueItem}
								onMove={messageQueue.moveQueueItem}
								isOperationPending={messageQueue.isQueueOperationPending}
								variant="mobile"
							/>
						</div>
					) : null

				return { messageQueueNode }
			}, [messageQueue])

			const editorContext = useMemo<SceneEditorContext>(() => {
				return {
					draftKey: createMessageEditorDraftKey({
						selectedProject,
						selectedTopic,
					}),
					selectedTopic,
					selectedProject,
					selectedWorkspace: store.selectedWorkspace,
					setSelectedTopic: topicStore.setSelectedTopic,
					setSelectedProject: store.projectStore.setSelectedProject,
					setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
					topicMode: TopicMode.Default,
					topicStore,
					layoutConfig: MOBILE_LAYOUT_CONFIG,
					placeholder: tSuper("messageEditor.placeholderLoading"),
					showLoading,
					isTaskRunning: canInterruptTask,
					stopEventLoading,
					handleInterrupt,
					mentionPanelStore: store.mentionPanelStore,
					projectFilesStore: store.projectFilesStore,
					attachments,
					topicModelStore,
					enableMessageSendByContent: true,
					mergeSendParams: ({ defaultParams }) => {
						const mergedParams = merge(defaultParams, {
							topicMode: TopicMode.MagiClaw,
							extra: { agent_code: clawCode },
						})
						return mergedParams
					},
					editorRef: messageQueue.editorRef,
					queueContext: messageQueue,
				}
			}, [
				clawCode,
				selectedProject,
				selectedTopic,
				showLoading,
				canInterruptTask,
				tSuper,
				stopEventLoading,
				handleInterrupt,
				store.mentionPanelStore,
				store.projectFilesStore,
				attachments,
				store.projectStore.setSelectedProject,
				store.selectedWorkspace,
				store.workspaceStore.setSelectedWorkspace,
				topicModelStore,
				topicStore,
				messageQueue,
			])

			const messageListProviderValue = useClawPlaygroundMessageListContextValue({
				setSelectedTopic: topicStore.setSelectedTopic,
				magicClaw: store.magicClaw,
				projectFilesStore: store.projectFilesStore,
			})
			const emptyStateSubtitle = t(
				"superLobster.workspace.emptyHeroSubtitle",
				clawBrandValues,
			)

			function renderEmptyStateTitle() {
				return (
					<div className="flex items-center justify-center gap-[2px] leading-none tracking-[-0.02em]">
						<span className="font-semibold text-foreground">
							{t("superLobster.workspace.emptyHeroLead", clawBrandValues)}
						</span>
						<span className="font-black text-red-500">
							{t("superLobster.workspace.emptyHeroAccent", clawBrandValues)}
						</span>
					</div>
				)
			}

			return (
				<ConversationPanelScaffold
					scope="claw-playground-conversation-mobile"
					rootTestId="claw-playground-conversation-panel-mobile"
					editorTestId="claw-playground-conversation-editor-mobile"
					isConversationPanelCollapsed={false}
					detailPanelVisible={detailPanelVisible}
					emptyHero={
						<ConversationEmptyState
							className="w-full"
							icon={<ClawHeroIcon testId="claw-playground-mobile-empty-hero-icon" />}
							iconSoundEnabled={false}
							title={renderEmptyStateTitle()}
							subtitle={emptyStateSubtitle}
							variant="hero"
							testId="claw-playground-mobile-conversation-empty"
						/>
					}
					emptyCompact={
						<ConversationEmptyState
							icon={
								<ClawHeroIcon
									className="scale-75"
									testId="claw-playground-mobile-empty-compact-icon"
								/>
							}
							iconSoundEnabled={false}
							title={renderEmptyStateTitle()}
							subtitle={emptyStateSubtitle}
							variant="compact"
							testId="claw-playground-mobile-conversation-empty-compact"
						/>
					}
					editor={
						<ClawMobileInputContainer
							editorContext={editorContext}
							editorNodes={mobileEditorNodes}
							isTaskRunning={canInterruptTask}
							onNewChat={handleClawNewChatSlash}
							onOpenFilesDrawer={onOpenFilesDrawer}
							onOpenSkillsDrawer={onOpenSkillsDrawer}
						/>
					}
					messageListProviderValue={messageListProviderValue}
					messages={messages as SuperMagicMessageItem[]}
					selectedTopic={selectedTopic}
					handlePullMoreMessage={handlePullMoreMessage}
					showLoading={showLoading}
					currentTopicStatus={selectedTopic?.task_status}
					handleSendMsg={handleSendMsg}
					isMessagesLoading={isMessagesInitialLoading}
					messageLayoutPaddingBottomPx={CLAW_MOBILE_MESSAGE_LIST_RESERVE_PX}
					messageListBottomFade
					backToLatestButtonClassName={CLAW_MOBILE_BACK_TO_LATEST_BUTTON_CLASS}
				/>
			)
		},
	),
)

function ClawPlaygroundMobile() {
	const { t } = useTranslation("sidebar")
	const { t: tSuper } = useTranslation("super")
	const shellOutlet = useOptionalSuperMobileShellOutlet()
	const clawBrandValues = getClawBrandTranslationValues()
	const navigate = useNavigate()
	const {
		code,
		store,
		selectedProject,
		attachments,
		attachmentList,
		checkAttachmentsNowDebounced,
	} = useClawPlaygroundCore()
	const { dialog, handleConfirmUpgradeSandbox } = useClawSandboxUpgradeAction({ store })

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const conversationPanelRef = useRef<ClawMobileConversationPanelRef>(null)

	const [filesDrawerOpen, setFilesDrawerOpen] = useState(false)
	const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false)
	const [moreSheetOpen, setMoreSheetOpen] = useState(false)
	const [editDialogOpen, setEditDialogOpen] = useState(false)
	const [isUpdating, setIsUpdating] = useState(false)
	const [isSandboxActionLoading, setIsSandboxActionLoading] = useState(false)

	const handleUpdateClaw = useMemoizedFn(async (payload: MagiClawEditPayload) => {
		const editingClaw = store.magicClaw
		if (!editingClaw?.code) return

		setIsUpdating(true)
		try {
			const updatedClaw = await MagicClawApi.updateMagicClaw(
				{
					code: editingClaw.code,
					name: payload.name.trim(),
					icon: payload.icon ?? null,
				},
				{ enableErrorMessagePrompt: false },
			)
			toast.success(t("superLobster.editDialog.updateSuccess", clawBrandValues))
			setEditDialogOpen(false)
			store.setMagicClaw(updatedClaw)
		} catch {
			toast.error(t("superLobster.editDialog.updateFailed", clawBrandValues))
		} finally {
			setIsUpdating(false)
		}
	})

	/** Refreshes magicClaw.status from sandbox API so the more sheet reflects the latest lifecycle state. */
	const refreshMagicClawSandboxStatus = useMemoizedFn(async (topicId: string) => {
		if (!store.magicClaw) return

		try {
			const statusData = await MagicClawApi.getMagicClawSandboxStatus(
				{ topic_id: topicId },
				{ enableErrorMessagePrompt: false },
			)
			const nextStatus = statusData?.status
			if (!nextStatus || store.magicClaw.status === nextStatus) return

			store.setMagicClaw({
				...store.magicClaw,
				status: nextStatus,
			})
		} catch {
			// Polling will eventually reconcile; ignore one-off refresh failures.
		}
	})

	const handleRestart = useMemoizedFn(async () => {
		const topicId = selectedTopic?.id
		if (!topicId || !store.magicClaw) return

		setIsSandboxActionLoading(true)
		try {
			await MagicClawApi.restartMagicClawSandbox({ topic_id: topicId })
			toast.success(t("superLobster.created.restartSuccess", clawBrandValues))
			await refreshMagicClawSandboxStatus(topicId)
		} catch {
			toast.error(t("superLobster.created.restartFailed", clawBrandValues))
		} finally {
			setIsSandboxActionLoading(false)
		}
	})

	/** Explicit start handler — stops the ambiguity in ClawMobileMoreSheet's onStart prop. */
	const handleStart = useMemoizedFn(async () => {
		const topicId = selectedTopic?.id
		if (!topicId || !store.magicClaw) return

		setIsSandboxActionLoading(true)
		try {
			await MagicClawApi.startMagicClawSandbox(
				{ topic_id: topicId },
				{ enableErrorMessagePrompt: false },
			)
			await refreshMagicClawSandboxStatus(topicId)
		} catch {
			toast.error(t("superLobster.created.startFailed", clawBrandValues))
		} finally {
			setIsSandboxActionLoading(false)
		}
	})

	/** Explicit stop handler — stops the ambiguity in ClawMobileMoreSheet's onStop prop. */
	const handleStop = useMemoizedFn(async () => {
		const topicId = selectedTopic?.id
		if (!topicId || !store.magicClaw) return

		setIsSandboxActionLoading(true)
		try {
			await MagicClawApi.stopMagicClawSandbox({ topic_id: topicId })
			toast.success(t("superLobster.created.stopSuccess", clawBrandValues))
			await refreshMagicClawSandboxStatus(topicId)
		} catch {
			toast.error(t("superLobster.created.stopFailed", clawBrandValues))
		} finally {
			setIsSandboxActionLoading(false)
		}
	})

	const selectedWorkspace = store.selectedWorkspace
	const selectedTopic = store.selectedTopic
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)

	const clawDisplayName =
		store.magicClaw?.name?.trim() ||
		t("superLobster.workspace.untitledProject", clawBrandValues)

	const { feedbackSheetOpen, feedbackPrefill, openClawFeedback, closeClawFeedback } =
		useClawFeedbackSheet({
			magicClaw: store.magicClaw,
			clawDisplayName,
		})

	const handleOpenClawFeedback = useMemoizedFn(() => {
		setMoreSheetOpen(false)
		openClawFeedback()
	})
	useNamedPageTitle({
		entityName: store.magicClaw?.name,
		fallbackName: t("superLobster.workspace.untitledProject", clawBrandValues),
		isReady: !store.loading && !store.error && !!selectedProject,
	})
	useDefaultModeModelListRefreshOnMount()

	const { handleNodeFile } = useFileOpen({
		setUserSelectDetail: (detail) => {
			previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
		},
		attachments,
	})

	const setUserSelectDetail = useMemoizedFn((detail: PreviewDetail | null) => {
		if (!detail) return
		previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
	})

	const mobileDetailRef = useRef<DetailRef>({
		scrollToFile: () => {
			void 0
		},
		openFileTab: () => {
			void 0
		},
		closeFileTab: () => {
			void 0
		},
		switchToTab: () => {
			void 0
		},
		openPlaybackTab: () => {
			void 0
		},
		closePlaybackTab: () => {
			void 0
		},
		openKnowledgeBaseTab: () => {
			void 0
		},
		openMicroAppTab: () => {
			void 0
		},
		enterPreviewFullscreen: () => {
			void 0
		},
		exitPreviewFullscreen: () => {
			void 0
		},
	})

	const syncMobileDetailRef = useMemoizedFn(() => {
		mobileDetailRef.current.openFileTab = (fileItem?: unknown) => {
			setTimeout(() => {
				const item = fileItem as Record<string, any> | undefined
				if (!item) return

				// 支持两种格式：
				// 1. detail-like: { type, data: { file_id, file_name, ... }, currentFileId }（来自消息附件点击）
				// 2. file item: { file_id, file_name, ... }（来自附件列表点击）
				const fileId = item.file_id || item.data?.file_id || item.currentFileId
				if (!fileId) return

				// 如果是 detail-like 对象且已包含 type，直接打开预览
				if (item.type && item.data && item.currentFileId) {
					previewDetailPopupRef.current?.open(
						item as PreviewDetail,
						attachments,
						attachmentList,
					)
					return
				}

				const fileAttachment = attachmentList.find((f) => f.file_id === fileId)
				if (!fileAttachment) return
				const fileExtension = fileAttachment.file_extension ?? ""
				const type = getFileType(fileExtension)
				previewDetailPopupRef.current?.open(
					{
						type,
						data: {
							file_id: fileId,
							file_name:
								(item as { file_name?: string })?.file_name ||
								fileAttachment.file_name,
						},
						currentFileId: fileId,
					} as PreviewDetail,
					attachments,
					attachmentList,
				)
			}, 100)
		}
		mobileDetailRef.current.openPlaybackTab = (options) => {
			if (!options?.toolData) return

			setTimeout(() => {
				handleNodeFile(options.toolData)
			}, 100)
		}
	})

	useEffect(() => {
		syncMobileDetailRef()
	}, [syncMobileDetailRef, attachments, attachmentList])

	const { activeFileId, handleFileClick, topicFilesProps, setActiveFileId } = useTopicFiles({
		selectedProject,
		selectedWorkspace,
		selectedTopic,
		projects: store.projectStore.projects,
		workspaces: store.workspaceStore.workspaces,
		attachments,
		setAttachments: store.projectFilesStore.setWorkspaceFileTree,
		setUserSelectDetail,
		detailRef: mobileDetailRef,
		isReadOnly,
	})

	const { topicFilesPropsWithPanel, clearActiveDetailTabType } = useTopicDetailPanelController({
		detailRef: mobileDetailRef,
		isReadOnly: false,
		activeFileId,
		setActiveFileId,
		handleFileClick,
		topicFilesProps,
		attachmentList,
		subscribeMicroAppTab: false,
	})
	const knowledgeBasePreviewState = useMobileKnowledgeBasePreview()
	const microAppPreviewState = useMobileMicroAppPreview()

	const resolveTopicFileRowDecoration = useMemoizedFn(
		createClawPlaygroundFileRowDecorationResolver(selectedProject?.id),
	)

	useEffect(() => {
		setActiveFileId(null)
		clearActiveDetailTabType()
		setFilesDrawerOpen(false)
		setSkillsDrawerOpen(false)
	}, [clearActiveDetailTabType, selectedProject?.id, setActiveFileId])

	function handleBack() {
		navigate({
			delta: -1,
			viewTransition: ViewTransitionPresets.slideRight,
		})
	}

	if (store.loading) {
		return (
			<div
				className="flex h-full w-full items-center justify-center"
				data-testid="claw-playground-loading"
			>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (store.error || !selectedProject) {
		return (
			<div
				className="flex h-full w-full flex-col items-center justify-center gap-4 bg-mobile-background"
				data-testid="claw-playground-error"
			>
				<p className="text-sm text-muted-foreground">
					{t("superLobster.workspace.loadFailed", clawBrandValues)}
				</p>
				<Button
					type="button"
					variant="outline"
					data-testid="claw-playground-error-back-button"
					onClick={handleBack}
				>
					{t("superLobster.workspace.back", clawBrandValues)}
				</Button>
			</div>
		)
	}

	const content = (
		<HostConversationProvider selectedProject={selectedProject} topicStore={store.topicStore}>
			<div
				className="flex h-full min-h-0 w-full flex-col bg-mobile-background"
				data-testid="claw-playground-mobile-root"
			>
				{dialog}
				<ClawMobileHeader
					magicClaw={store.magicClaw}
					onBack={handleBack}
					onOpenMoreSheet={() => setMoreSheetOpen(true)}
				/>

				<div className="min-h-0 flex-1 overflow-hidden">
					<ClawMobileConversationPanel
						ref={conversationPanelRef}
						clawCode={code}
						detailPanelVisible={false}
						onOpenFilesDrawer={() => setFilesDrawerOpen(true)}
						onOpenSkillsDrawer={() => setSkillsDrawerOpen(true)}
						onTerminalTopicStatusChange={checkAttachmentsNowDebounced}
					/>
				</div>

				<ClawMobileFilesDrawer
					open={filesDrawerOpen}
					onClose={() => setFilesDrawerOpen(false)}
					clawName={store.magicClaw?.name}
					topicFilesProps={{
						...topicFilesPropsWithPanel,
						fileHelpContext: selectedProject?.id
							? { kind: "claw", projectId: String(selectedProject.id) }
							: { kind: "unknown" },
					}}
					resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
				/>

				<ClawMobileMoreSheet
					magicClaw={store.magicClaw}
					open={moreSheetOpen}
					displayStatus={store.magicClaw?.status}
					isSandboxActionLoading={isSandboxActionLoading}
					isUpgradingSandbox={store.isUpgradingSandbox}
					onOpenChange={setMoreSheetOpen}
					onViewFiles={() => setFilesDrawerOpen(true)}
					onEditInfo={() => setEditDialogOpen(true)}
					onRestart={handleRestart}
					onStart={handleStart}
					onStop={handleStop}
					onUpgradeSandbox={() => {
						if (store.magicClaw) {
							handleConfirmUpgradeSandbox(store.magicClaw)
						}
					}}
					onFeedback={handleOpenClawFeedback}
				/>

				<MobileSettingsFeedbackSheet
					open={feedbackSheetOpen}
					onClose={closeClawFeedback}
					prefill={feedbackPrefill}
				/>

				<MagiClawEditDialog
					claw={store.magicClaw}
					open={editDialogOpen}
					onOpenChange={setEditDialogOpen}
					isSubmitting={isUpdating}
					onSubmit={handleUpdateClaw}
				/>

				<ClawMobileSkillsDrawer
					open={skillsDrawerOpen}
					onClose={() => setSkillsDrawerOpen(false)}
					headerSubtitle={clawDisplayName}
					overrideInstall={async ({ content }) => {
						conversationPanelRef.current?.sendSkillInstallPrompt(content)
					}}
				/>

				<PreviewDetailPopup
					ref={previewDetailPopupRef}
					setUserSelectDetail={setUserSelectDetail}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					projectId={selectedProject.id}
					onOpenNewPopup={(detail, tree, list) => {
						linkPreviewPopupRef.current?.open(detail, tree, list)
					}}
				/>
				<PreviewDetailPopup
					ref={linkPreviewPopupRef}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					projectId={selectedProject.id}
					setUserSelectDetail={(detail: PreviewDetail | null) => {
						if (!detail) return
						linkPreviewPopupRef.current?.open(detail, attachments, attachmentList)
					}}
					onClose={() => {
						void 0
					}}
				/>
				<KnowledgeBasePreviewPopup state={knowledgeBasePreviewState} />
				<MicroAppPreviewPopup state={microAppPreviewState} />
			</div>
		</HostConversationProvider>
	)

	// ClawPlayground can render under standalone routes; wrap with mobile shell there so swipe gestures stay available.
	if (!shellOutlet) {
		return (
			<SuperMobileShellRouteLayout
				activeView="magiClaw"
				testIdPrefix="magi-claw-shell"
				closeSidebarAriaLabel={tSuper("mobile.shell.closeSidebar")}
			>
				{content}
			</SuperMobileShellRouteLayout>
		)
	}

	return content
}

export default observer(ClawPlaygroundMobile)
