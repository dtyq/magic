import { useState, useCallback, useRef, useEffect, useMemo, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { type Topic, TaskStatus, MessageStatus, ProjectListItem } from "../../pages/Workspace/types"
import TopicSharePopover from "../TopicSharePopover"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMemoizedFn, useMount } from "ahooks"
import MagicModal from "@/components/base/MagicModal"
import { GuideTourElementId } from "../../components/LazyGuideTour"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "../../stores"
import { computed } from "mobx"
import { MagicTooltip } from "@/components/base"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	MessageCirclePlus,
	PanelRightClose,
	PanelRightOpen,
	Ellipsis,
	PenLine,
	WandSparkles,
	Trash2,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import recordSummaryStore from "@/stores/recordingSummary"
import { cn } from "@/lib/utils"
import StatusIcon from "./components/StatusIcon"
import TopicHistoryPanelContent from "./components/TopicHistoryPanelContent"
import { MessageHeaderHistoryControl } from "./components/MessageHeaderHistoryControl"
import { IconShare3 } from "@tabler/icons-react"
import type { TopicStore } from "../../stores/core/topic"
import { smartRenameTopic } from "../../services/topicRename"
import {
	shouldSyncChatConversationName,
	syncChatProjectNameOnly,
} from "../../services/chatConversationNameSync"
import { useFileActionVisibility } from "@/pages/superMagic/providers/file-action-visibility-provider"
interface TopicMutationSuccessOptions {
	onSuccess?: () => Promise<void> | void
}

interface MessageHeaderProps {
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
	topicActions: MessageHeaderTopicActions
	/** Hide mode tag in topic history list rows */
	hideTopicListModeIcon?: boolean
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
}

export interface MessageHeaderTopicActions {
	createTopic: () => Promise<void> | void
	selectTopic: (topic: Topic) => Promise<void> | void
	renameTopic: (params: { topicId: string; topicName: string }) => Promise<void> | void
	deleteTopic: (topicId: string) => Promise<void> | void
	updateTopicName: (topicId: string, topicName: string) => Promise<void> | void
	pinTopic: (topicId: string) => Promise<void> | void
	unpinTopic: (topicId: string) => Promise<void> | void
	archiveTopic: (topicId: string) => Promise<void> | void
	unarchiveTopic: (topicId: string) => Promise<void> | void
}

interface MessageHeaderTopicHistoryPanelProps {
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
	topicActions: MessageHeaderTopicActions
	isConversationPanelCollapsed?: boolean
	onExpandConversationPanel?: () => void
	/** Hide mode tag in topic history list rows */
	hideTopicListModeIcon?: boolean
	onClose?: () => void
	closeButtonRef?: RefObject<HTMLButtonElement | null>
}

const headerIconButtonClassName = "!size-6 !min-h-6 !min-w-6 !rounded-md !p-0"
const renameInputClassName =
	"h-6 min-w-0 flex-1 rounded-lg border-border bg-background px-3 text-sm leading-5 text-foreground placeholder:text-muted-foreground"

function useTopicHistoryPanelController({
	selectedProject,
	topicStore,
	topicActions,
	isConversationPanelCollapsed = false,
	onExpandConversationPanel,
}: MessageHeaderTopicHistoryPanelProps) {
	const { t } = useTranslation("super")
	const { hideCreateNewTopic } = useFileActionVisibility()
	const shouldHideTopicEntry = hideCreateNewTopic
	const topics = topicStore.topics
	const selectedTopic = topicStore.selectedTopic
	const messages = useMemo(
		() =>
			computed(() =>
				selectedTopic?.chat_topic_id
					? superMagicStore.messages?.get(selectedTopic.chat_topic_id) || []
					: [],
			),
		[selectedTopic?.chat_topic_id],
	).get()
	const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
	const [editingValue, setEditingValue] = useState("")

	const handleAiRename = useMemoizedFn(async (topic?: Topic) => {
		const targetTopic = topic ?? selectedTopic
		if (!targetTopic || !selectedProject?.id) return

		const userMessage = messages.find((message) => message.is_self)
		const userQuestion =
			typeof userMessage?.content === "string"
				? userMessage.content
				: targetTopic.topic_name || ""

		const topicName = await smartRenameTopic({
			topicId: targetTopic.id,
			userQuestion,
			updateTopicName: topicActions.updateTopicName,
		})
		if (!topicName) return

		if (selectedProject && shouldSyncChatConversationName(selectedProject)) {
			await syncChatProjectNameOnly({
				projectId: selectedProject.id,
				name: topicName,
			})
		}

		magicToast.success(t("messageHeader.renameTopicSuccess"))
	})

	const handleDeleteTopic = useCallback(
		(topicId: string, topicName: string, options?: TopicMutationSuccessOptions) => {
			if (recordSummaryStore.isRecordingTopic(topicId)) {
				magicToast.error(t("messageHeader.cannotDeleteCurrentTopicInRecording"))
				return
			}

			if (topics.length === 1) {
				magicToast.error(t("messageHeader.cannotDeleteLastTopic"))
				return
			}

			MagicModal.confirm({
				title: t("messageHeader.confirmDeleteTopic"),
				content: t("messageHeader.confirmDeleteTopicContent", { name: topicName }),
				variant: "destructive",
				showIcon: true,
				okText: t("button.confirm", { ns: "interface" }),
				onOk: async () => {
					try {
						await topicActions.deleteTopic(topicId)
						await options?.onSuccess?.()
					} catch (err) {
						console.error(t("messageHeader.deleteTopicFailed"), err)
						throw err
					}
				},
			})
		},
		[t, topicActions, topics],
	)

	const handleEditTopic = useCallback((topic: Topic) => {
		setEditingTopicId(topic.id)
		setEditingValue(topic.topic_name || "")
	}, [])

	const handleEditSubmit = useCallback(
		async (topicId: string) => {
			if (!editingValue.trim()) {
				setEditingTopicId(null)
				return
			}

			const trimmedName = editingValue.trim()
			const topic = topics.find((item) => item.id === topicId)

			if (trimmedName === topic?.topic_name) {
				setEditingTopicId(null)
				return
			}

			if (!selectedProject?.id) {
				setEditingTopicId(null)
				setEditingValue("")
				magicToast.error(t("messageHeader.editTopicFailed"))
				return
			}

			try {
				await topicActions.renameTopic({
					topicId,
					topicName: trimmedName,
				})
				setEditingTopicId(null)
				setEditingValue("")
				magicToast.success(t("messageHeader.editTopicSuccess"))
			} catch (err: unknown) {
				console.error("Failed to rename topic:", err)
				setEditingTopicId(null)
				setEditingValue("")
			}
		},
		[editingValue, selectedProject?.id, topicActions, topics, t],
	)

	const handleEditCancel = useCallback(() => {
		setEditingTopicId(null)
		setEditingValue("")
	}, [])

	const handleCreateTopic = useMemoizedFn(() => {
		if (shouldHideTopicEntry) return
		if (isConversationPanelCollapsed) {
			onExpandConversationPanel?.()
		}
		void topicActions.createTopic()
	})

	return {
		messages,
		topics,
		selectedTopic,
		shouldHideTopicEntry,
		editingTopicId,
		editingValue,
		setEditingValue,
		handleEditSubmit,
		handleEditCancel,
		handleEditTopic,
		handleAiRename,
		handleDeleteTopic,
		handleCreateTopic,
	}
}

/** 订阅 topicStore，mergeTopic 后 topics 会立刻传入话题历史（父级 TopicPage 未读 topics 时也不会丢订阅）。 */
export const MessageHeaderTopicHistoryPanel = observer(function MessageHeaderTopicHistoryPanel({
	selectedProject,
	topicStore,
	topicActions,
	isConversationPanelCollapsed = false,
	onExpandConversationPanel,
	hideTopicListModeIcon = false,
	onClose,
	closeButtonRef,
}: MessageHeaderTopicHistoryPanelProps) {
	const {
		topics,
		selectedTopic,
		shouldHideTopicEntry,
		editingTopicId,
		editingValue,
		setEditingValue,
		handleEditSubmit,
		handleEditCancel,
		handleEditTopic,
		handleAiRename,
		handleDeleteTopic,
		handleCreateTopic,
	} = useTopicHistoryPanelController({
		selectedProject,
		topicStore,
		topicActions,
		isConversationPanelCollapsed,
		onExpandConversationPanel,
	})

	return (
		<TopicHistoryPanelContent
			topics={topics}
			projectId={selectedProject?.id || ""}
			selectedTopicId={selectedTopic?.id}
			editingTopicId={editingTopicId}
			editingValue={editingValue}
			onEditingValueChange={setEditingValue}
			onEditSubmit={handleEditSubmit}
			onEditCancel={handleEditCancel}
			onEditTopic={handleEditTopic}
			onAiRenameTopic={handleAiRename}
			onDeleteTopic={handleDeleteTopic}
			onSelectTopic={(topic) => {
				void topicActions.selectTopic(topic)
			}}
			canDeleteTopic={topics.length > 1}
			onCreateTopic={handleCreateTopic}
			onPinTopic={topicActions.pinTopic}
			onUnpinTopic={topicActions.unpinTopic}
			onArchiveTopic={topicActions.archiveTopic}
			onUnarchiveTopic={topicActions.unarchiveTopic}
			hideTopicListModeIcon={hideTopicListModeIcon}
			hideCreateTopicButton={shouldHideTopicEntry}
			hideDeleteTopicButton={shouldHideTopicEntry}
			onClose={onClose}
			closeButtonRef={closeButtonRef}
		/>
	)
})

function MessageHeader({
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	selectedProject,
	topicStore,
	topicActions,
	hideTopicListModeIcon = false,
	historyTriggerMode = "dropdown",
	isHistoryPanelOpen = false,
	onToggleHistoryPanel,
}: MessageHeaderProps) {
	const { t } = useTranslation("super")
	const { hideShareTopic } = useFileActionVisibility()
	const {
		messages,
		topics,
		selectedTopic,
		shouldHideTopicEntry,
		editingTopicId,
		editingValue,
		setEditingValue,
		handleEditSubmit,
		handleEditCancel,
		handleEditTopic,
		handleAiRename,
		handleDeleteTopic,
		handleCreateTopic,
	} = useTopicHistoryPanelController({
		selectedProject,
		topicStore,
		topicActions,
		isConversationPanelCollapsed,
		onExpandConversationPanel,
	})

	const currentTopicStatus = selectedTopic?.task_status

	const [isRenaming, setIsRenaming] = useState(false)
	const [renamingValue, setRenamingValue] = useState("")
	const [sharePopoverVisible, setSharePopoverVisible] = useState(false)
	const [topicMenuOpen, setTopicMenuOpen] = useState(false)
	const [topicHistoryOpen, setTopicHistoryOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const isLayoutHistoryTrigger = historyTriggerMode === "layout"
	const isHistoryButtonActive = isLayoutHistoryTrigger ? isHistoryPanelOpen : topicHistoryOpen

	const handleRename = useCallback(() => {
		if (!selectedTopic) return
		setIsRenaming(true)
		setRenamingValue(selectedTopic.topic_name || "")
	}, [selectedTopic])

	const handleRenameSubmit = useMemoizedFn(async () => {
		if (!selectedTopic || !renamingValue.trim()) {
			setIsRenaming(false)
			return
		}

		const trimmedName = renamingValue.trim()

		if (trimmedName === selectedTopic.topic_name) {
			setIsRenaming(false)
			return
		}

		if (!selectedProject?.id) {
			setIsRenaming(false)
			magicToast.error(t("messageHeader.renameTopicFailed"))
			return
		}

		try {
			await topicActions.renameTopic({
				topicId: selectedTopic.id,
				topicName: trimmedName,
			})
			setIsRenaming(false)
			magicToast.success(t("messageHeader.renameTopicSuccess"))
		} catch (err: unknown) {
			console.error("Failed to rename topic:", err)
			setIsRenaming(false)
		}
	})

	const handleRenameCancel = useCallback(() => {
		setIsRenaming(false)
		setRenamingValue("")
	}, [])

	const isAllowShare = useMemo(() => {
		if (!messages?.length) {
			return false
		}
		const _revokedMessageIndex = messages.findIndex(
			(item: { status?: string }) => item?.status === MessageStatus.REVOKED,
		)
		const revokedMessageIndex =
			_revokedMessageIndex !== -1 ? _revokedMessageIndex : messages.length
		return messages.slice(0, revokedMessageIndex).length > 0
	}, [messages])

	useEffect(() => {
		if (isRenaming && inputRef.current) {
			// Ensure the input is mounted before selecting text.
			setTimeout(() => {
				inputRef.current?.focus()
				inputRef.current?.select()
			}, 0)
		}
	}, [isRenaming])

	// 监听 selectedTopic 变化，重置其他话题按钮的悬浮状态
	useEffect(() => {
		setTopicHistoryOpen(false)
	}, [selectedTopic?.id])

	const handleToggleConversationPanel = useMemoizedFn(() => {
		onToggleConversationPanel?.()
	})

	const handleTopicHistoryDropdownOpenChange = useMemoizedFn((open: boolean) => {
		setTopicHistoryOpen(open)
		if (!open) {
			setTopicHistoryOpen(false)
		}
	})

	useMount(() => {
		pubsub.publish(
			PubSubEvents.GuideTourElementReady,
			GuideTourElementId.MessageHeaderTopicGroup,
		)
	})

	function renderHistoryTrigger(placement: "bottomRight" | "leftBottom") {
		return (
			<MessageHeaderHistoryControl
				historyTriggerMode={historyTriggerMode}
				isHistoryButtonActive={isHistoryButtonActive}
				tooltipTitle={t("messageHeader.historyTopics")}
				onToggleHistoryPanel={onToggleHistoryPanel}
				dropdownProps={{
					topics,
					projectId: selectedProject?.id || "",
					selectedTopicId: selectedTopic?.id,
					editingTopicId,
					editingValue,
					onEditingValueChange: setEditingValue,
					onEditSubmit: handleEditSubmit,
					onEditCancel: handleEditCancel,
					onEditTopic: handleEditTopic,
					onAiRenameTopic: handleAiRename,
					onDeleteTopic: handleDeleteTopic,
					onSelectTopic: (topic) => {
						void topicActions.selectTopic(topic)
					},
					canDeleteTopic: topics.length > 1,
					onCreateTopic: handleCreateTopic,
					onPinTopic: topicActions.pinTopic,
					onUnpinTopic: topicActions.unpinTopic,
					onArchiveTopic: topicActions.archiveTopic,
					onUnarchiveTopic: topicActions.unarchiveTopic,
					placement,
					onDropdownOpenChange: handleTopicHistoryDropdownOpenChange,
					hideTopicListModeIcon,
					hideCreateTopicButton: shouldHideTopicEntry,
					hideDeleteTopicButton: shouldHideTopicEntry,
				}}
			/>
		)
	}

	return (
		<>
			<div
				className={cn(
					"absolute z-[30] mb-2.5 flex h-10 w-full items-center justify-between gap-2 px-1.5 py-2",
					"bg-sidebar",
					isConversationPanelCollapsed && "h-full flex-col px-0 py-1.5",
				)}
				data-testid="message-header-container"
			>
				{isConversationPanelCollapsed ? (
					<div
						className="flex w-full flex-col items-center gap-4"
						data-testid="message-header-collapsed-topic-group"
					>
						{detailPanelVisible && (
							<>
								<MagicTooltip title={t("messageHeader.expandConversationPanel")}>
									<span>
										<Button
											variant="ghost"
											size="icon-sm"
											className={headerIconButtonClassName}
											onClick={handleToggleConversationPanel}
											data-testid="message-header-toggle-conversation-panel-button"
										>
											<PanelRightOpen
												size={16}
												className="shrink-0 text-foreground"
											/>
										</Button>
									</span>
								</MagicTooltip>

								{!shouldHideTopicEntry ? (
									<div className="w-6 border-t border-border" />
								) : null}
							</>
						)}

						{!shouldHideTopicEntry ? (
							<>
								<MagicTooltip title={t("messageHeader.newTopic")}>
									<span>
										<Button
											variant="ghost"
											size="icon-sm"
											className={headerIconButtonClassName}
											data-testid="message-header-new-topic-button"
											onClick={handleCreateTopic}
										>
											<MessageCirclePlus
												size={16}
												className="shrink-0 text-foreground"
											/>
										</Button>
									</span>
								</MagicTooltip>

								{renderHistoryTrigger("bottomRight")}
							</>
						) : null}
					</div>
				) : (
					<>
						{detailPanelVisible && (
							<MagicTooltip title={t("messageHeader.collapseConversationPanel")}>
								<span>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={handleToggleConversationPanel}
										data-testid="message-header-toggle-conversation-panel-button"
									>
										<PanelRightClose
											size={16}
											className="shrink-0 text-foreground"
										/>
									</Button>
								</span>
							</MagicTooltip>
						)}

						<div
							className="flex min-w-0 flex-1 items-center gap-1"
							data-testid="message-header-topic-section"
						>
							<StatusIcon size={14} status={currentTopicStatus as TaskStatus} />
							{isRenaming ? (
								<Input
									ref={inputRef}
									className={renameInputClassName}
									value={renamingValue}
									onChange={(e) => setRenamingValue(e.target.value)}
									onBlur={handleRenameSubmit}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault()
											handleRenameSubmit()
										} else if (e.key === "Escape") {
											handleRenameCancel()
										}
									}}
									data-testid="message-header-rename-input"
								/>
							) : (
								<span
									className="min-w-0 flex-1 cursor-pointer truncate text-sm font-normal leading-[1.43] text-foreground transition-colors hover:text-primary"
									onClick={handleRename}
									data-testid="message-header-topic-name"
									data-topic-name={
										selectedTopic?.topic_name ||
										t("messageHeader.untitledTopic")
									}
								>
									{selectedTopic?.topic_name || t("messageHeader.untitledTopic")}
								</span>
							)}
						</div>

						<div
							className="flex items-center gap-1"
							data-testid="message-header-action-buttons"
						>
							{!shouldHideTopicEntry ? (
								<div
									className="flex items-center gap-1"
									id={GuideTourElementId.MessageHeaderTopicGroup}
									data-testid="message-header-topic-group"
								>
									<MagicTooltip title={t("messageHeader.newTopic")}>
										<span>
											<Button
												variant="ghost"
												size="icon-sm"
												data-testid="message-header-new-topic-button"
												onClick={handleCreateTopic}
												className={headerIconButtonClassName}
											>
												<MessageCirclePlus
													size={16}
													className="shrink-0 text-foreground"
												/>
											</Button>
										</span>
									</MagicTooltip>

									{renderHistoryTrigger(
										isConversationPanelCollapsed ? "leftBottom" : "bottomRight",
									)}
								</div>
							) : null}

							{!hideShareTopic ? (
								<TopicSharePopover
									open={sharePopoverVisible}
									onOpenChange={(open) => {
										// Only allow opening if share is allowed, always allow closing
										if (!open || isAllowShare) {
											setSharePopoverVisible(open)
										}
									}}
									topicId={selectedTopic?.id || ""}
									topicTitle={selectedTopic?.topic_name}
								>
									<span>
										<MagicTooltip title={t("messageHeader.share")}>
											<span>
												<Button
													variant="ghost"
													size="icon-sm"
													disabled={!isAllowShare}
													data-testid="message-header-share-button"
													className={cn(
														headerIconButtonClassName,
														sharePopoverVisible && "bg-accent",
													)}
												>
													<IconShare3
														size={16}
														className="shrink-0 text-foreground"
													/>
												</Button>
											</span>
										</MagicTooltip>
									</span>
								</TopicSharePopover>
							) : null}

							<DropdownMenu onOpenChange={setTopicMenuOpen}>
								<DropdownMenuTrigger asChild>
									<span>
										<MagicTooltip title={t("messageHeader.topicMenu")}>
											<span>
												<Button
													variant="ghost"
													size="icon-sm"
													data-testid="message-header-menu-button"
													className={cn(
														headerIconButtonClassName,
														topicMenuOpen && "bg-accent",
													)}
												>
													<Ellipsis
														size={16}
														className="shrink-0 text-foreground"
													/>
												</Button>
											</span>
										</MagicTooltip>
									</span>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-60">
									<DropdownMenuItem onClick={handleRename}>
										<PenLine size={16} className="text-muted-foreground" />
										{t("messageHeader.rename")}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => handleAiRename()}>
										<WandSparkles size={16} className="text-muted-foreground" />
										{t("messageHeader.aiRename")}
									</DropdownMenuItem>
									{!shouldHideTopicEntry ? (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onClick={() =>
													selectedTopic &&
													handleDeleteTopic(
														selectedTopic.id,
														selectedTopic.topic_name ||
															t("messageHeader.untitledTopic"),
													)
												}
											>
												<Trash2 size={16} />
												{t("messageHeader.deleteTopic")}
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</>
				)}
			</div>
		</>
	)
}

export default observer(MessageHeader)
