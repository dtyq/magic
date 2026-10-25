import { SimpleModeGuide } from "./components/SimpleModeGuide"
import { SimpleModeSetting } from "./components/SimpleModeSetting"
import type { FileSidebarControl } from "../Detail/components/FilesViewer/types"
import {
	useState,
	useCallback,
	useRef,
	useEffect,
	useMemo,
	type ReactNode,
	type RefObject,
} from "react"
import { useTranslation } from "react-i18next"
import { type Topic, TaskStatus, ProjectListItem } from "../../pages/Workspace/types"
import TopicSharePopover from "../TopicSharePopover"
import { useMemoizedFn } from "ahooks"
import MagicModal from "@/components/base/MagicModal"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "../../stores"
import { computed } from "mobx"
import { MagicTooltip } from "@/components/base"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	MessageCirclePlus,
	PanelRightClose,
	FolderTree,
	PanelRightOpen,
	Ellipsis,
	PenLine,
	RefreshCw,
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
import { cn } from "@/utils/cn"
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
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import {
	resolveMessageHeaderEditableTitle,
	resolveMessageHeaderTitle,
} from "@/pages/superMagic/utils/resolve-chat-conversation-display-name"
import { isTopicShareAllowed } from "@/pages/superMagic/utils/is-topic-share-allowed"
import { isMagicApp } from "@/utils/devices"
import { classifyRestartSandboxError } from "./restartSandboxError"
import { type MessageHeaderBuiltinAction, type MessageHeaderTitlePresentation } from "./headerSlots"
interface TopicMutationSuccessOptions {
	onSuccess?: () => Promise<void> | void
}

interface MessageHeaderProps {
	enableSimpleMode?: boolean
	/** 普通项目无预览时，标题与操作跟随正文居中；其它页面由原布局控制。 */
	alignWithContent?: boolean
	/** Replaces the single-line topic title. Omitted callers keep the normal title and rename flow. */
	titlePresentation?: MessageHeaderTitlePresentation
	/** Hides a built-in action when the callback returns false. Omitted means every action stays visible. */
	isBuiltinActionVisible?: (action: MessageHeaderBuiltinAction) => boolean
	/** Notified after a built-in action completes. It cannot cancel that action. */
	onBuiltinAction?: (action: MessageHeaderBuiltinAction) => Promise<void> | void
	/** Host-owned buttons placed before the topic actions, such as fullscreen and pin. */
	addonActionsBefore?: ReactNode
	/** Host-owned buttons placed after the overflow menu, such as close. */
	addonActionsAfter?: ReactNode
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	/** Some shells render the panel toggle in an outer header. */
	hideConversationPanelToggle?: boolean
	/** Closes the layout history panel only when the user is collapsing the conversation pane. */
	onCloseHistoryPanelWhenCollapsing?: () => void
	detailPanelVisible?: boolean
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
	topicActions: MessageHeaderTopicActions
	/** Hide mode tag in topic history list rows */
	hideTopicListModeIcon?: boolean
	hideTopicTypeFilter?: boolean
	historyTriggerMode?: "dropdown" | "layout"
	isHistoryPanelOpen?: boolean
	onToggleHistoryPanel?: () => void
	historyTriggerRef?: RefObject<HTMLButtonElement>
	fileSidebarControl?: FileSidebarControl
	showTopicHistory?: boolean
	/** Chat detail injects conversation-level overflow actions (share/rename/save/delete). */
	trailingActions?: ReactNode
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
	restartSandbox?: (topicId: string) => Promise<void> | void
}

interface MessageHeaderTopicHistoryPanelProps {
	onCollapse?: () => void
	isPanelVisible?: boolean
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
	topicActions: MessageHeaderTopicActions
	isConversationPanelCollapsed?: boolean
	onExpandConversationPanel?: () => void
	/** Hide mode tag in topic history list rows */
	hideTopicListModeIcon?: boolean
	hideTopicTypeFilter?: boolean
	onClose?: () => void
	closeButtonRef?: RefObject<HTMLButtonElement | null>
}

const headerIconButtonClassName =
	"!size-[var(--conversation-header-button-size,24px)] !min-h-6 !min-w-6 !rounded-md !p-0"
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
	const {
		options: { createNewTopic },
	} = useFileAccess()
	const shouldHideTopicEntry = !createNewTopic
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

	/** Creates a topic and reports whether that creation finished. */
	const handleCreateTopic = useMemoizedFn(async () => {
		if (shouldHideTopicEntry) return false
		if (isConversationPanelCollapsed) {
			onExpandConversationPanel?.()
		}
		try {
			await topicActions.createTopic()
		} catch {
			// Topic creation reports its own failure. Skip the host callback.
			return false
		}
		return true
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
	hideTopicTypeFilter = false,
	onClose,
	onCollapse,
	isPanelVisible,
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
			onCollapse={onCollapse}
			isPanelVisible={isPanelVisible}
			topics={topics}
			projectId={selectedProject?.id || ""}
			selectedTopicId={selectedTopic?.id}
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			onExpandConversationPanel={onExpandConversationPanel}
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
			hideTopicTypeFilter={hideTopicTypeFilter}
			hideCreateTopicButton={shouldHideTopicEntry}
			hideDeleteTopicButton={shouldHideTopicEntry}
			onClose={onClose}
			closeButtonRef={closeButtonRef}
		/>
	)
})

function MessageHeader({
	alignWithContent = false,
	titlePresentation,
	isBuiltinActionVisible,
	onBuiltinAction,
	addonActionsBefore,
	addonActionsAfter,
	historyTriggerRef,
	fileSidebarControl,
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	onExpandConversationPanel,
	hideConversationPanelToggle = false,
	onCloseHistoryPanelWhenCollapsing,
	detailPanelVisible = true,
	selectedProject,
	topicStore,
	topicActions,
	hideTopicListModeIcon = false,
	hideTopicTypeFilter = false,
	historyTriggerMode = "dropdown",
	isHistoryPanelOpen = false,
	onToggleHistoryPanel,
	showTopicHistory = true,
	trailingActions,
	enableSimpleMode = false,
}: MessageHeaderProps) {
	const { t } = useTranslation("super")
	const {
		options: { shareTopic },
	} = useFileAccess()
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

	/** Chat workspace projects use conversation naming; regular projects keep topic naming. */
	const headerTitle = useMemo(
		() =>
			resolveMessageHeaderTitle({
				topic: selectedTopic,
				project: selectedProject,
				t,
			}),
		[selectedProject, selectedTopic, t],
	)
	const renameEnabled = titlePresentation?.renameEnabled !== false
	const presentedSecondary =
		titlePresentation?.secondaryMode === "fixed"
			? (titlePresentation.secondaryText ?? "")
			: titlePresentation
				? headerTitle
				: ""
	/** Built-in actions stay visible unless a caller, such as the widget adapter, hides them. */
	const isActionVisible = (action: MessageHeaderBuiltinAction) =>
		isBuiltinActionVisible?.(action) !== false
	const showNewTopicAction = !shouldHideTopicEntry && isActionVisible("newTopic")
	// Read-only projects keep the history button on the collapsed rail. The expanded
	// header still follows showTopicHistory. A caller can hide the collapsed button
	// by returning false from isBuiltinActionVisible.
	const showHistoryAction =
		!shouldHideTopicEntry &&
		isActionVisible("history") &&
		(isConversationPanelCollapsed || showTopicHistory)
	const headerEditableTitle = useMemo(
		() =>
			resolveMessageHeaderEditableTitle({
				topic: selectedTopic,
				project: selectedProject,
				t,
			}),
		[selectedProject, selectedTopic, t],
	)

	const [isRenaming, setIsRenaming] = useState(false)
	const [renamingValue, setRenamingValue] = useState("")
	const [sharePopoverVisible, setSharePopoverVisible] = useState(false)
	const [topicMenuOpen, setTopicMenuOpen] = useState(false)
	const [isRestartingSandbox, setIsRestartingSandbox] = useState(false)
	const [topicHistoryOpen, setTopicHistoryOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const simpleModeAnchorRef = useRef<HTMLSpanElement>(null)
	const isLayoutHistoryTrigger = historyTriggerMode === "layout"
	const isHistoryButtonActive = isLayoutHistoryTrigger ? isHistoryPanelOpen : topicHistoryOpen

	const handleRename = useCallback(() => {
		if (!renameEnabled || !selectedTopic) return
		setIsRenaming(true)
		setRenamingValue(headerEditableTitle)
	}, [headerEditableTitle, renameEnabled, selectedTopic])

	const handleRenameSubmit = useMemoizedFn(async () => {
		if (!selectedTopic || !renamingValue.trim()) {
			setIsRenaming(false)
			return
		}

		const trimmedName = renamingValue.trim()

		if (trimmedName === headerEditableTitle) {
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

	const handleRestartSandbox = useMemoizedFn(async () => {
		if (!selectedTopic || !topicActions.restartSandbox || isRestartingSandbox) return

		setIsRestartingSandbox(true)
		const loadingToast = magicToast.loading({
			content: t("messageHeader.restartSandboxLoading"),
			duration: 0,
		})
		try {
			await topicActions.restartSandbox(selectedTopic.id)
			magicToast.destroy(loadingToast)
			magicToast.success(t("messageHeader.restartSandboxSuccess"))
		} catch (error) {
			magicToast.destroy(loadingToast)
			console.error("Failed to restart sandbox:", error)
			const errorType = classifyRestartSandboxError(error)
			switch (errorType) {
				case "notFound":
					magicToast.error(t("messageHeader.restartSandboxNotFound"))
					break
				case "permissionDenied":
					magicToast.error(t("messageHeader.restartSandboxPermissionDenied"))
					break
				case "busy":
					magicToast.error(t("messageHeader.restartSandboxBusy"))
					break
				case "network":
					magicToast.error(t("messageHeader.restartSandboxNetworkError"))
					break
				default:
					magicToast.error(t("messageHeader.restartSandboxFailed"))
			}
		} finally {
			setIsRestartingSandbox(false)
		}
	})

	const handleRenameCancel = useCallback(() => {
		setIsRenaming(false)
		setRenamingValue("")
	}, [])

	const isAllowShare = useMemo(() => isTopicShareAllowed(messages), [messages])

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

	// Closing the history panel only applies to the collapse action; expanding the
	// conversation pane should not mutate the persisted history-panel preference.
	const handleToggleConversationPanel = useMemoizedFn(() => {
		if (!detailPanelVisible && !isConversationPanelCollapsed) return
		if (!isConversationPanelCollapsed) {
			onCloseHistoryPanelWhenCollapsing?.()
		}
		onToggleConversationPanel?.()
	})

	const handleTopicHistoryDropdownOpenChange = useMemoizedFn((open: boolean) => {
		setTopicHistoryOpen(open)
		if (!open) {
			setTopicHistoryOpen(false)
		}
	})

	/** Tells the host about a built-in action after that action has already completed. */
	const notifyBuiltinAction = useMemoizedFn((action: MessageHeaderBuiltinAction) => {
		if (!onBuiltinAction) return
		void Promise.resolve(onBuiltinAction(action)).catch(() => {
			// A host callback failure must not undo the action that already completed.
		})
	})

	/** Runs one built-in action immediately, then notifies the host only when it completes. */
	const runBuiltinAction = useMemoizedFn(
		(
			action: MessageHeaderBuiltinAction,
			run: () => Promise<boolean | void> | boolean | void,
		) => {
			let result: Promise<boolean | void> | boolean | void
			try {
				result = run()
			} catch {
				return
			}
			void Promise.resolve(result)
				.then((completed) => {
					if (completed === false) return
					notifyBuiltinAction(action)
				})
				.catch(() => {
					// A failed built-in action does not notify the host.
				})
		},
	)

	/** Opens sharing, then notifies the host that the share entry was triggered. */
	const handleShareOpenChange = useMemoizedFn((open: boolean) => {
		if (!open) {
			setSharePopoverVisible(false)
			return
		}
		if (!isAllowShare) return
		setSharePopoverVisible(true)
		notifyBuiltinAction("share")
	})

	/** Opens the overflow menu, then notifies the host. */
	const handleMoreOpenChange = useMemoizedFn((open: boolean) => {
		if (!open) {
			setTopicMenuOpen(false)
			return
		}
		setTopicMenuOpen(true)
		notifyBuiltinAction("more")
	})

	function renderHistoryTrigger(placement: "bottomRight" | "leftBottom") {
		return (
			<MessageHeaderHistoryControl
				triggerRef={historyTriggerRef}
				historyTriggerMode={historyTriggerMode}
				isHistoryButtonActive={isHistoryButtonActive}
				tooltipTitle={t("messageHeader.historyTopics")}
				onToggleHistoryPanel={onToggleHistoryPanel}
				onTriggerAction={onBuiltinAction ? () => notifyBuiltinAction("history") : undefined}
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
					isConversationPanelCollapsed,
					onExpandConversationPanel,
					canDeleteTopic: topics.length > 1,
					onCreateTopic: handleCreateTopic,
					onPinTopic: topicActions.pinTopic,
					onUnpinTopic: topicActions.unpinTopic,
					onArchiveTopic: topicActions.archiveTopic,
					onUnarchiveTopic: topicActions.unarchiveTopic,
					placement,
					onDropdownOpenChange: handleTopicHistoryDropdownOpenChange,
					hideTopicListModeIcon,
					hideTopicTypeFilter,
					hideCreateTopicButton: shouldHideTopicEntry,
					hideDeleteTopicButton: shouldHideTopicEntry,
				}}
			/>
		)
	}

	// Magic App on iPad runs the desktop header on a touch surface, so the share
	// trigger avoids nesting Tooltip and Popover trigger layers on the same tap.
	const shareButton = (
		<Button
			variant="ghost"
			size="icon-sm"
			disabled={!isAllowShare}
			data-testid="message-header-share-button"
			className={cn(headerIconButtonClassName, sharePopoverVisible && "bg-accent")}
		>
			<IconShare3 size={16} className="shrink-0 text-foreground" />
		</Button>
	)

	return (
		<>
			<div
				className={cn(
					// Expanded headers own their height; message viewports begin below them.
					"relative z-[30] flex h-10 w-full shrink-0 items-center justify-between gap-2 px-1.5 py-2",
					"bg-sidebar",
					// 两侧各预留一个恢复按钮和原有间距，内容列保持居中且不会与入口重叠。
					alignWithContent &&
						"grid grid-cols-[theme(spacing.6)_minmax(0,1fr)_theme(spacing.6)]",
					// 预览可见时与 44px 文件标签栏等高，保证两侧按钮的中心线一致。
					detailPanelVisible && !isConversationPanelCollapsed && "h-11",
					isConversationPanelCollapsed &&
						"absolute h-full flex-col px-0 py-[var(--conversation-header-padding,6px)]",
				)}
				data-testid="message-header-container"
			>
				{isConversationPanelCollapsed ? (
					<div
						className="flex w-full flex-col items-center gap-[var(--conversation-header-gap,16px)]"
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

								{showNewTopicAction || showHistoryAction ? (
									<div className="w-6 border-t border-border" />
								) : null}
							</>
						)}

						{showNewTopicAction || showHistoryAction ? (
							<>
								{showNewTopicAction ? (
									<MagicTooltip title={t("messageHeader.newTopic")}>
										<span>
											<Button
												variant="ghost"
												size="icon-sm"
												className={headerIconButtonClassName}
												data-testid="message-header-new-topic-button"
												onClick={() =>
													runBuiltinAction("newTopic", handleCreateTopic)
												}
											>
												<MessageCirclePlus
													size={16}
													className="shrink-0 text-foreground"
												/>
											</Button>
										</span>
									</MagicTooltip>
								) : null}

								{showHistoryAction ? renderHistoryTrigger("bottomRight") : null}
							</>
						) : null}
						{trailingActions ? (
							<div
								className="flex flex-col items-center"
								data-testid="message-header-trailing-actions-collapsed"
							>
								{trailingActions}
							</div>
						) : null}
					</div>
				) : (
					<>
						{fileSidebarControl?.isCollapsed && (
							<MagicTooltip title={t("sidebarPanels.expandFiles")}>
								<Button
									ref={fileSidebarControl.triggerRef}
									variant="ghost"
									size="icon-sm"
									className={cn(
										headerIconButtonClassName,
										"!ml-3 !size-7 !min-h-7 !min-w-7 !rounded-full !bg-background shadow-md",
										alignWithContent && "col-start-1 row-start-1",
									)}
									onClick={fileSidebarControl.onToggle}
									aria-label={t("sidebarPanels.expandFiles")}
									data-testid="message-header-expand-files"
								>
									<FolderTree size={16} />
								</Button>
							</MagicTooltip>
						)}
						{detailPanelVisible && !hideConversationPanelToggle && (
							<MagicTooltip title={t("messageHeader.collapseConversationPanel")}>
								<span className="flex">
									<Button
										variant="ghost"
										size="icon-sm"
										className={headerIconButtonClassName}
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
							className={cn(
								"flex min-w-0 flex-1 items-center gap-2",
								// 始终保留同一个容器，仅改排版，切换预览不会重建重命名输入或菜单。
								alignWithContent &&
									"col-start-2 row-start-1 mx-auto w-full max-w-3xl",
							)}
						>
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
								) : titlePresentation ? (
									<div
										className={cn(
											"min-w-0 flex-1 text-sm font-normal leading-[1.43] text-foreground",
											renameEnabled &&
												"cursor-pointer transition-colors hover:text-primary",
										)}
										onClick={renameEnabled ? handleRename : undefined}
										data-testid="message-header-topic-name"
										data-topic-name={headerTitle}
									>
										{/* Block layout stays on a div so the two lines are valid HTML. */}
										<div className="flex min-w-0 flex-col">
											{titlePresentation.primaryVisible === false ? null : (
												<span
													className="truncate text-sm font-semibold"
													data-testid="message-header-primary-title"
												>
													{titlePresentation.primary}
												</span>
											)}
											{presentedSecondary ? (
												<span className="truncate text-xs text-muted-foreground">
													{presentedSecondary}
												</span>
											) : null}
										</div>
									</div>
								) : (
									<span
										className="min-w-0 flex-1 cursor-pointer truncate text-sm font-normal leading-[1.43] text-foreground transition-colors hover:text-primary"
										onClick={handleRename}
										data-testid="message-header-topic-name"
										data-topic-name={headerTitle}
									>
										{headerTitle}
									</span>
								)}
							</div>

							<div
								className="flex shrink-0 items-center gap-1"
								data-testid="message-header-action-buttons"
							>
								{addonActionsBefore}
								{showNewTopicAction || showHistoryAction ? (
									<div
										className="flex items-center gap-1"
										data-testid="message-header-topic-group"
										data-guide-anchor="message-header-topic-group"
									>
										{showNewTopicAction ? (
											<MagicTooltip title={t("messageHeader.newTopic")}>
												<span>
													<Button
														variant="ghost"
														size="icon-sm"
														data-testid="message-header-new-topic-button"
														onClick={() =>
															runBuiltinAction(
																"newTopic",
																handleCreateTopic,
															)
														}
														className={headerIconButtonClassName}
													>
														<MessageCirclePlus
															size={16}
															className="shrink-0 text-foreground"
														/>
													</Button>
												</span>
											</MagicTooltip>
										) : null}

										{showHistoryAction
											? renderHistoryTrigger(
													isConversationPanelCollapsed
														? "leftBottom"
														: "bottomRight",
												)
											: null}
									</div>
								) : null}

								{shareTopic && isActionVisible("share") ? (
									<TopicSharePopover
										open={sharePopoverVisible}
										onOpenChange={(open) => void handleShareOpenChange(open)}
										topicId={selectedTopic?.id || ""}
										topicTitle={selectedTopic?.topic_name}
									>
										<span>
											{isMagicApp ? (
												shareButton
											) : (
												<MagicTooltip title={t("messageHeader.share")}>
													<span>{shareButton}</span>
												</MagicTooltip>
											)}
										</span>
									</TopicSharePopover>
								) : null}

								{/* Chat single-topic view hides the entire topic overflow menu (rename / AI rename / delete). */}
								{!shouldHideTopicEntry && isActionVisible("more") ? (
									<>
										<DropdownMenu
											open={topicMenuOpen}
											onOpenChange={(open) => void handleMoreOpenChange(open)}
										>
											<DropdownMenuTrigger asChild>
												<span>
													<MagicTooltip
														title={t("messageHeader.topicMenu")}
													>
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
																<span
																	ref={simpleModeAnchorRef}
																	className="inline-flex size-4"
																>
																	<Ellipsis
																		size={16}
																		className="shrink-0 text-foreground"
																	/>
																</span>
															</Button>
														</span>
													</MagicTooltip>
												</span>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-60">
												{enableSimpleMode && (
													<>
														<SimpleModeSetting inMenu />
														<DropdownMenuSeparator />
													</>
												)}
												{renameEnabled ? (
													<>
														<DropdownMenuItem onClick={handleRename}>
															<PenLine
																size={16}
																className="text-muted-foreground"
															/>
															{t("messageHeader.rename")}
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => handleAiRename()}
														>
															<WandSparkles
																size={16}
																className="text-muted-foreground"
															/>
															{t("messageHeader.aiRename")}
														</DropdownMenuItem>
													</>
												) : null}
												{topicActions.restartSandbox ? (
													<DropdownMenuItem
														disabled={isRestartingSandbox}
														onClick={() => void handleRestartSandbox()}
													>
														<RefreshCw
															size={16}
															className={cn(
																"text-muted-foreground",
																isRestartingSandbox &&
																	"animate-spin",
															)}
														/>
														{t("messageHeader.restartSandbox")}
													</DropdownMenuItem>
												) : null}
												{renameEnabled ? <DropdownMenuSeparator /> : null}
												<DropdownMenuItem
													variant="destructive"
													onClick={() =>
														selectedTopic &&
														handleDeleteTopic(
															selectedTopic.id,
															headerTitle,
														)
													}
												>
													<Trash2 size={16} />
													{t("messageHeader.deleteTopic")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
										<SimpleModeGuide
											anchorRef={simpleModeAnchorRef}
											available={
												enableSimpleMode &&
												Boolean(selectedTopic) &&
												!isConversationPanelCollapsed
											}
											menuOpen={topicMenuOpen}
										/>
									</>
								) : null}
								{addonActionsAfter}
								{trailingActions ? (
									<div data-testid="message-header-trailing-actions">
										{trailingActions}
									</div>
								) : null}
							</div>
						</div>
					</>
				)}
			</div>
		</>
	)
}

export default observer(MessageHeader)
