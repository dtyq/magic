import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { type Topic, TaskStatus, MessageStatus, ProjectListItem } from "../../pages/Workspace/types"
import TopicSharePopover from "../TopicSharePopover"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMemoizedFn, useMount } from "ahooks"
import MagicModal from "@/components/base/MagicModal"
import routeManageService from "../../services/routeManageService"
import { GuideTourElementId } from "../../components/LazyGuideTour"
import { SuperMagicApi } from "@/apis"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "../../stores"
import SuperMagicService from "../../services"
import { computed } from "mobx"
import { MagicTooltip } from "@/components/base"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	MessageCirclePlus,
	History,
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
import TopicHistoryDropdown from "./components/TopicHistoryDropdown"
import { IconShare3 } from "@tabler/icons-react"
import { TopicStore } from "../../stores/core/topic"
import { smartRenameTopic } from "../../services/topicRename"

interface MessageHeaderProps {
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
}

const headerIconButtonClassName = "!size-6 !min-h-6 !min-w-6 !rounded-md !p-0"
const renameInputClassName =
	"h-6 min-w-0 flex-1 rounded-lg border-border bg-background px-3 text-sm leading-5 text-foreground placeholder:text-muted-foreground"

function MessageHeader({
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	detailPanelVisible = true,
	selectedProject,
	topicStore,
}: MessageHeaderProps) {
	const { t } = useTranslation("super")

	// Get data from stores
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

	const currentTopicStatus = selectedTopic?.task_status

	const [isRenaming, setIsRenaming] = useState(false)
	const [renamingValue, setRenamingValue] = useState("")
	const [sharePopoverVisible, setSharePopoverVisible] = useState(false)
	const [topicMenuOpen, setTopicMenuOpen] = useState(false)
	const [topicHistoryOpen, setTopicHistoryOpen] = useState(false)
	const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
	const [editingValue, setEditingValue] = useState("")
	const inputRef = useRef<HTMLInputElement>(null)

	const handleRename = useCallback(() => {
		if (!selectedTopic) return
		setIsRenaming(true)
		setRenamingValue(selectedTopic.topic_name || "")
	}, [selectedTopic])

	const handleRenameSubmit = useMemoizedFn(() => {
		if (!selectedTopic || !renamingValue.trim()) {
			setIsRenaming(false)
			return
		}

		const trimmedName = renamingValue.trim()

		if (trimmedName === selectedTopic.topic_name) {
			setIsRenaming(false)
			return
		}

		// Call API to update topic name
		if (selectedProject?.id) {
			SuperMagicApi.editTopic({
				topic_name: trimmedName,
				id: selectedTopic.id,
				project_id: selectedProject.id,
			})
				.then(() => {
					// Update store after successful API call
					SuperMagicService.topic.updateTopicName(selectedTopic.id, trimmedName)
					setIsRenaming(false)
					magicToast.success(t("messageHeader.renameTopicSuccess"))
				})
				.catch((err: unknown) => {
					console.error("Failed to rename topic:", err)
					// Reset editing state on error
					setIsRenaming(false)
				})
		} else {
			setIsRenaming(false)
			magicToast.error(t("messageHeader.renameTopicFailed"))
		}
	})

	const handleRenameCancel = useCallback(() => {
		setIsRenaming(false)
		setRenamingValue("")
	}, [])

	const handleAiRename = useMemoizedFn((topicId?: string) => {
		const targetTopic = topicId ? topics.find((t) => t.id === topicId) : selectedTopic
		if (!targetTopic || !selectedProject?.id) return

		const userMessage = messages.find((msg) => msg.is_self)
		const userQuestion = userMessage?.content || targetTopic.topic_name || ""

		void smartRenameTopic({
			topicId: targetTopic.id,
			userQuestion,
			updateTopicName: topicStore.updateTopicName,
		})
			.then((topicName) => {
				if (!topicName) return
				magicToast.success(t("messageHeader.renameTopicSuccess"))
			})
			.catch((err: unknown) => {
				console.error("Failed to AI rename topic:", err)
			})
	})

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

	// Handle delete topic with confirmation
	const handleDeleteTopic = useCallback(
		(topicId: string, topicName: string) => {
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
				onOk: () => {
					SuperMagicService.deleteTopic(topicId).catch((err) => {
						console.error(t("messageHeader.deleteTopicFailed"), err)
					})
				},
			})
		},
		[t, topics],
	)

	// Handle edit topic in history list
	const handleEditTopic = useCallback((topic: Topic) => {
		setEditingTopicId(topic.id)
		setEditingValue(topic.topic_name || "")
	}, [])

	const handleEditSubmit = useCallback(
		(topicId: string) => {
			if (!editingValue.trim()) {
				setEditingTopicId(null)
				return
			}

			const trimmedName = editingValue.trim()
			const topic = topics.find((t) => t.id === topicId)

			if (trimmedName === topic?.topic_name) {
				setEditingTopicId(null)
				return
			}

			// Call API to update topic name
			if (selectedProject?.id) {
				SuperMagicApi.editTopic({
					id: topicId,
					topic_name: trimmedName,
					project_id: selectedProject.id,
				})
					.then(() => {
						// Update store after successful API call
						SuperMagicService.topic.updateTopicName(topicId, trimmedName)
						setEditingTopicId(null)
						setEditingValue("")
						magicToast.success(t("messageHeader.editTopicSuccess"))
					})
					.catch((err: unknown) => {
						console.error("Failed to rename topic:", err)
						// Reset editing state on error
						setEditingTopicId(null)
						setEditingValue("")
					})
			} else {
				setEditingTopicId(null)
				setEditingValue("")
				magicToast.error(t("messageHeader.editTopicFailed"))
			}
		},
		[editingValue, selectedProject?.id, topics, t],
	)

	const handleEditCancel = useCallback(() => {
		setEditingTopicId(null)
		setEditingValue("")
	}, [])

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

	const handleCreateTopic = useMemoizedFn(() => {
		if (isConversationPanelCollapsed) {
			onExpandConversationPanel?.()
		}
		SuperMagicService.handleCreateTopic({
			selectedProject,
		})
	})

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

	return (
		<>
			<div
				className={cn(
					"absolute z-[30] mb-2.5 flex h-10 w-full items-center justify-between gap-2 px-1.5 py-2",
					"bg-sidebar",
					isConversationPanelCollapsed && "h-full flex-col py-1.5 pl-0 pr-2",
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

								<div className="w-6 border-t border-border" />
							</>
						)}

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

						<TopicHistoryDropdown
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
								topicStore.setSelectedTopic(topic)
								routeManageService.navigateToState({
									topicId: topic.id,
								})
							}}
							canDeleteTopic={topics.length > 1}
							onCreateTopic={handleCreateTopic}
							placement="bottomRight"
							onDropdownOpenChange={handleTopicHistoryDropdownOpenChange}
						>
							<span>
								<MagicTooltip title={t("messageHeader.historyTopics")}>
									<span>
										<Button
											variant="ghost"
											size="icon-sm"
											className={cn(
												headerIconButtonClassName,
												topicHistoryOpen && "bg-accent",
											)}
											data-testid="message-header-history-button"
										>
											<History
												size={16}
												className="shrink-0 text-foreground"
											/>
										</Button>
									</span>
								</MagicTooltip>
							</span>
						</TopicHistoryDropdown>
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
							<StatusIcon status={currentTopicStatus as TaskStatus} />
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

								<TopicHistoryDropdown
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
										topicStore.setSelectedTopic(topic)
										routeManageService.navigateToState({
											topicId: topic.id,
										})
									}}
									canDeleteTopic={topics.length > 1}
									onCreateTopic={handleCreateTopic}
									placement={
										isConversationPanelCollapsed ? "leftBottom" : "bottomRight"
									}
									onDropdownOpenChange={handleTopicHistoryDropdownOpenChange}
								>
									<span>
										<MagicTooltip title={t("messageHeader.historyTopics")}>
											<span>
												<Button
													variant="ghost"
													size="icon-sm"
													data-testid="message-header-history-button"
													className={cn(
														headerIconButtonClassName,
														topicHistoryOpen && "bg-accent",
													)}
												>
													<History
														size={16}
														className="shrink-0 text-foreground"
													/>
												</Button>
											</span>
										</MagicTooltip>
									</span>
								</TopicHistoryDropdown>
							</div>

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
