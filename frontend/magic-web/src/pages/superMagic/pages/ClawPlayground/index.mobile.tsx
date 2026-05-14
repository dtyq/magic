import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { JSONContent } from "@tiptap/react"
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
import { useTopicDetailPanelController } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicDetailPanelController"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { type TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
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
	CLAW_MOBILE_VIEWPORT_MIN_HEIGHT_CLASS,
} from "./claw-playground-layout"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { useTaskInterrupt } from "@/pages/superMagic/hooks/useTaskInterrupt"
import { collectMentionItemsFromContent } from "@/pages/superMagic/components/MessageEditor/services/uploadMentionService"
import { transformMentions } from "@/pages/superMagic/components/MessageEditor/utils/mention"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks"
import { toast } from "sonner"
import { MagicClawApi } from "@/apis"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { ClawMobileMoreSheet } from "./components/ClawMobileMoreSheet"
import { MagiClawEditDialog } from "../MagiClawPage/MagiClawEditDialog"
import type { MagiClawEditPayload } from "../MagiClawPage/useMagiClawMobilePage"

interface ClawMobileConversationPanelRef {
	sendSkillInstallPrompt: (content: JSONContent) => void
}

interface ClawMobileConversationPanelProps {
	clawCode?: string
	detailPanelVisible: boolean
	onOpenFilesDrawer: () => void
	onOpenSkillsDrawer: () => void
}

const ClawMobileConversationPanel = observer(
	forwardRef<ClawMobileConversationPanelRef, ClawMobileConversationPanelProps>(
		function ClawMobileConversationPanel(
			{ clawCode, detailPanelVisible, onOpenFilesDrawer, onOpenSkillsDrawer },
			ref,
		) {
			const { t } = useTranslation("sidebar")
			const { t: tSuper } = useTranslation("super")
			const clawBrandValues = getClawBrandTranslationValues()
			const store = useClawPlaygroundStore()
			const selectedProject = store.selectedProject
			const selectedTopic = store.selectedTopic
			const topicStore = store.topicStore
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
					if (currentTopic?.id && lastMessageNode?.status) {
						store.updateTopicStatus(currentTopic.id, lastMessageNode?.status)
					}
				},
			})

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
				isTaskRunning: showLoading,
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
				canInterrupt: showLoading,
			})

			const mobileEditorNodes = useMemo<SceneEditorNodes>(() => {
				const messageQueueNode =
					messageQueue.queue.length > 0 ? (
						<div className="mb-2">
							<MessageQueue
								queue={messageQueue.queue}
								queueStats={messageQueue.queueStats}
								editingQueueItem={messageQueue.editingQueueItem}
								onRemoveMessage={messageQueue.removeFromQueue}
								onSendMessage={messageQueue.sendQueuedMessage}
								onStartEdit={messageQueue.startEditQueueItem}
								onCancelEdit={messageQueue.cancelEditQueueItem}
							/>
						</div>
					) : null

				return { messageQueueNode }
			}, [
				messageQueue.queue,
				messageQueue.queueStats,
				messageQueue.editingQueueItem,
				messageQueue.removeFromQueue,
				messageQueue.sendQueuedMessage,
				messageQueue.startEditQueueItem,
				messageQueue.cancelEditQueueItem,
			])

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
					isTaskRunning: showLoading,
					stopEventLoading,
					handleInterrupt,
					mentionPanelStore: store.mentionPanelStore,
					projectFilesStore: store.projectFilesStore,
					topicModelStore,
					enableMessageSendByContent: true,
					mergeSendParams: ({ defaultParams }) => {
						const mergedParams = merge(defaultParams, {
							topicMode: TopicMode.MagiClaw,
							extra: { agent_code: clawCode },
						})
						return mergedParams
					},
					queueContext: {
						editingQueueItem: messageQueue.editingQueueItem,
						addToQueue: messageQueue.addToQueue,
						finishEditQueueItem: messageQueue.finishEditQueueItem,
					},
				}
			}, [
				clawCode,
				selectedProject,
				selectedTopic,
				showLoading,
				tSuper,
				stopEventLoading,
				handleInterrupt,
				store.mentionPanelStore,
				store.projectFilesStore,
				store.projectStore.setSelectedProject,
				store.selectedWorkspace,
				store.workspaceStore.setSelectedWorkspace,
				topicModelStore,
				topicStore,
				messageQueue.editingQueueItem,
				messageQueue.addToQueue,
				messageQueue.finishEditQueueItem,
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
							isTaskRunning={showLoading}
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
					stickyMessageClassName="top-0 pt-2"
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
	const clawBrandValues = getClawBrandTranslationValues()
	const navigate = useNavigate()
	const { code, store, selectedProject, attachments, attachmentList } = useClawPlaygroundCore()
	const { dialog, handleConfirmUpgradeSandbox } = useClawSandboxUpgradeAction({ store })

	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const conversationPanelRef = useRef<ClawMobileConversationPanelRef>(null)

	const [filesDrawerOpen, setFilesDrawerOpen] = useState(false)
	const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false)
	const [moreSheetOpen, setMoreSheetOpen] = useState(false)
	const [editDialogOpen, setEditDialogOpen] = useState(false)
	const [isUpdating, setIsUpdating] = useState(false)

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
			toast.success(tSuper("superLobster.editDialog.updateSuccess", clawBrandValues))
			setEditDialogOpen(false)
			store.setMagicClaw(updatedClaw)
		} catch {
			toast.error(tSuper("superLobster.editDialog.updateFailed", clawBrandValues))
		} finally {
			setIsUpdating(false)
		}
	})

	const handleRestart = useMemoizedFn(async () => {
		const topicId = selectedTopic?.id
		if (!topicId || !store.magicClaw) return

		try {
			await MagicClawApi.restartMagicClawSandbox({ topic_id: topicId })
			toast.success(t("superLobster.created.restartSuccess", clawBrandValues))
		} catch (error) {
			toast.error(t("superLobster.created.restartFailed", clawBrandValues))
		}
	})

	const handleToggleRun = useMemoizedFn(async () => {
		const topicId = selectedTopic?.id
		if (!topicId || !store.magicClaw) return

		const isRunning = store.magicClaw.status === MAGIC_CLAW_STATUS.RUNNING
		try {
			if (isRunning) {
				await MagicClawApi.stopMagicClawSandbox({ topic_id: topicId })
				toast.success(t("superLobster.created.stopSuccess", clawBrandValues))
			} else {
				await MagicClawApi.startMagicClawSandbox(
					{ topic_id: topicId },
					{ enableErrorMessagePrompt: false },
				)
			}
		} catch (error) {
			if (isRunning) {
				toast.error(t("superLobster.created.stopFailed", clawBrandValues))
			} else {
				toast.error(t("superLobster.created.startFailed", clawBrandValues))
			}
		}
	})

	const selectedWorkspace = store.selectedWorkspace
	const selectedTopic = store.selectedTopic
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)
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
	})

	const resolveTopicFileRowDecoration = useMemoizedFn(
		createClawPlaygroundFileRowDecorationResolver({
			t: tSuper,
		}),
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
				className={`flex h-full w-full items-center justify-center ${CLAW_MOBILE_VIEWPORT_MIN_HEIGHT_CLASS}`}
				data-testid="claw-playground-loading"
			>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (store.error || !selectedProject) {
		return (
			<div
				className={`flex h-full w-full flex-col items-center justify-center gap-4 bg-background ${CLAW_MOBILE_VIEWPORT_MIN_HEIGHT_CLASS}`}
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

	return (
		<div
			className={`flex h-full min-h-0 w-full flex-col bg-sidebar ${CLAW_MOBILE_VIEWPORT_MIN_HEIGHT_CLASS}`}
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
				/>
			</div>

			<ClawMobileFilesDrawer
				open={filesDrawerOpen}
				onClose={() => setFilesDrawerOpen(false)}
				clawName={store.magicClaw?.name}
				topicFilesProps={topicFilesPropsWithPanel}
				resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
			/>

			<ClawMobileMoreSheet
				magicClaw={store.magicClaw}
				open={moreSheetOpen}
				isUpgradingSandbox={store.isUpgradingSandbox}
				onOpenChange={setMoreSheetOpen}
				onViewFiles={() => setFilesDrawerOpen(true)}
				onEditInfo={() => setEditDialogOpen(true)}
				onRestart={handleRestart}
				onToggleRun={handleToggleRun}
				onUpgradeSandbox={() => {
					if (store.magicClaw) {
						handleConfirmUpgradeSandbox(store.magicClaw)
					}
				}}
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
		</div>
	)
}

export default observer(ClawPlaygroundMobile)
