import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import {
	Archive,
	ArchiveRestore,
	ChevronDown,
	ChevronRight,
	Ellipsis,
	Loader2,
	MessageCirclePlus,
	Pencil,
	Pin,
	PinOff,
	Search,
	Trash2,
	WandSparkles,
	X,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { cn } from "@/lib/utils"
import usePaginatedTopics from "@/pages/superMagic/hooks/usePaginatedTopics"
import type TopicServiceClass from "@/pages/superMagic/services/topicService"
import SuperMagicService from "@/pages/superMagic/services"
import recordSummaryStore from "@/stores/recordingSummary"
import ModeTag from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/components/ModeTag"
import type { Topic } from "../../../pages/Workspace/types"
import { TopicMode } from "../../../pages/Workspace/types"
import StatusIcon from "./StatusIcon"
import { useTopicHistoryGroupedViewModel } from "./useTopicHistoryGroupedViewModel"
import { resolveTopicTaskStatus } from "@/pages/superMagic/utils/topicHistory"
import statusPollingService from "@/pages/superMagic/services/statusPollingService"
import type { SuperAgentTopicStatusItem } from "@/apis/modules/superMagic"

export interface TopicHistoryPanelContentProps {
	topics: Topic[]
	projectId: string
	selectedTopicId?: string
	editingTopicId: string | null
	editingValue: string
	onEditingValueChange: (value: string) => void
	onEditSubmit: (topicId: string) => Promise<void> | void
	onEditCancel: () => void
	onEditTopic: (topic: Topic) => void
	onAiRenameTopic: (topic: Topic) => Promise<void> | void
	onDeleteTopic: (
		topicId: string,
		topicName: string,
		options?: { onSuccess?: () => Promise<void> | void },
	) => void
	onSelectTopic: (topic: Topic) => void
	canDeleteTopic: boolean
	onCreateTopic: () => void
	onPinTopic: (topicId: string) => Promise<void> | void
	onUnpinTopic: (topicId: string) => Promise<void> | void
	onArchiveTopic: (topicId: string) => Promise<void> | void
	onUnarchiveTopic: (topicId: string) => Promise<void> | void
	topicService?: TopicServiceClass
	hideTopicListModeIcon?: boolean
	hideCreateTopicButton?: boolean
	hideDeleteTopicButton?: boolean
	panelClassName?: string
	/** When set, shows the panel header close control and invokes it on click (layout / fixed panel). Dropdown is now only a legacy compatibility path. */
	onClose?: () => void
	closeButtonRef?: RefObject<HTMLButtonElement | null>
	searchInputRef?: RefObject<HTMLInputElement | null>
}

function TopicHistoryPanelContentInner({
	topics,
	projectId,
	selectedTopicId,
	editingTopicId,
	editingValue,
	onEditingValueChange,
	onEditSubmit,
	onEditCancel,
	onEditTopic,
	onAiRenameTopic,
	onDeleteTopic,
	onSelectTopic,
	canDeleteTopic,
	onCreateTopic,
	onPinTopic,
	onUnpinTopic,
	onArchiveTopic,
	onUnarchiveTopic,
	topicService,
	hideTopicListModeIcon = false,
	hideCreateTopicButton = false,
	hideDeleteTopicButton = false,
	panelClassName,
	onClose,
	closeButtonRef,
	searchInputRef,
}: TopicHistoryPanelContentProps) {
	const { t } = useTranslation("super")
	const [searchKeyword, setSearchKeyword] = useState("")
	const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState("")
	const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null)
	const [openMenuTopicId, setOpenMenuTopicId] = useState<string | null>(null)
	const [topicStatusPatches, setTopicStatusPatches] = useState<
		Record<string, Pick<Topic, "task_status" | "status" | "has_unread">>
	>({})
	const topicStatusPollerIdRef = useRef(
		`topic-history-panel-${Math.random().toString(36).slice(2)}`,
	)

	const editInputRef = useRef<HTMLInputElement>(null)

	const {
		displayTopics,
		total: topicsTotalFromServer,
		isLoading: isLoadingTopics,
		reload: reloadTopics,
		reset: resetTopics,
	} = usePaginatedTopics({
		projectId,
		selectedTopicId,
		storeTopics: topics,
		topicService,
		searchKeyword: debouncedSearchKeyword,
	})
	const { groups, onToggleGroup, onLoadMoreInGroup } = useTopicHistoryGroupedViewModel({
		topics: displayTopics,
	})
	const visibleTopicIds = useMemo(
		() =>
			groups.flatMap((group) =>
				group.isCollapsed ? [] : group.visibleTopics.map((topic) => topic.id),
			),
		[groups],
	)

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setDebouncedSearchKeyword(searchKeyword.trim())
		}, 300)

		return () => {
			window.clearTimeout(timer)
		}
	}, [searchKeyword])

	useEffect(() => {
		if (!editingTopicId || !editInputRef.current) return

		editInputRef.current.focus()
		editInputRef.current.select()
	}, [editingTopicId])

	useEffect(() => resetTopics, [resetTopics])

	useEffect(() => {
		setTopicStatusPatches({})
	}, [projectId])

	useEffect(() => {
		const topicIds = new Set(displayTopics.map((topic) => topic.id))
		setTopicStatusPatches((previousValue) => {
			const nextEntries = Object.entries(previousValue).filter(([topicId]) =>
				topicIds.has(topicId),
			)
			if (nextEntries.length === Object.keys(previousValue).length) return previousValue
			return Object.fromEntries(nextEntries)
		})
	}, [displayTopics])

	useEffect(() => {
		if (!projectId) return

		const pollerId = topicStatusPollerIdRef.current
		statusPollingService.startTopicStatusPolling({
			pollerId,
			getTopicIds: () => visibleTopicIds,
			onResult: (items) => {
				setTopicStatusPatches((previousValue) => {
					const nextValue = { ...previousValue }
					items.forEach((item: SuperAgentTopicStatusItem) => {
						nextValue[item.id] = {
							task_status: item.status,
							status: item.status,
							has_unread: item.has_unread,
						}
					})
					return nextValue
				})
			},
		})

		return () => {
			statusPollingService.stopTopicStatusPolling(pollerId)
		}
	}, [projectId, visibleTopicIds])

	function getTopicWithStatusPatch(topic: Topic): Topic {
		const patch = topicStatusPatches[topic.id]
		if (!patch) return topic
		return { ...topic, ...patch }
	}

	async function handleTopicSelect(topic: Topic) {
		if (editingTopicId === topic.id) return

		let resolvedTopic = topic

		// 历史话题侧栏接口返回的条目有时只够列表展示；切换前补一次详情，避免缺失会话字段导致回切报错。
		if ((!topic.chat_conversation_id || !topic.chat_topic_id) && topic.id) {
			try {
				const topicDetail = await (topicService || SuperMagicService.topic).getTopicDetail(
					topic.id,
					{
						enableErrorMessagePrompt: false,
					},
				)
				if (topicDetail) {
					resolvedTopic = topicDetail
				}
			} catch {
				// 详情兜底失败时仍回退使用列表对象，避免点击无响应。
			}
		}

		onSelectTopic(resolvedTopic)
		setHoveredTopicId(null)
		setOpenMenuTopicId(null)
	}

	function handleCreateTopicClick(event: MouseEvent<HTMLButtonElement>) {
		event.stopPropagation()
		onCreateTopic()
	}

	async function handleEditSubmitAndRefresh(topicId: string) {
		await onEditSubmit(topicId)
		reloadTopics()
	}

	async function handleAiRenameAndRefresh(topic: Topic) {
		await onAiRenameTopic(topic)
		reloadTopics()
	}

	/**
	 * 切换置顶状态并在成功后刷新侧栏列表，保证「置顶」分组与排序、session 缓存与后端一致。
	 */
	async function handlePinToggle(topic: Topic) {
		try {
			if (topic.is_pinned) {
				await onUnpinTopic(topic.id)
			} else {
				await onPinTopic(topic.id)
			}
			reloadTopics()
		} catch {
			// 错误由上层 API / toast 处理，此处不重复提示
		}
	}

	/**
	 * 切换归档状态并在成功后刷新侧栏列表，保证分组与 session 缓存与后端一致。
	 */
	async function handleArchiveToggle(topic: Topic) {
		try {
			if (topic.is_archived) {
				await onUnarchiveTopic(topic.id)
			} else {
				await onArchiveTopic(topic.id)
			}
			reloadTopics()
		} catch {
			// 错误由上层 API / toast 处理，此处不重复提示
		}
	}

	function renderTopicActions(topic: Topic, isActionVisible: boolean) {
		const patchedTopic = getTopicWithStatusPatch(topic)
		const isDeleteDisabled = !canDeleteTopic || recordSummaryStore.isRecordingTopic(topic.id)

		return (
			<div
				className={cn(
					"flex shrink-0 items-center justify-end gap-2 pr-0.5",
					// 仅在展开操作区时预留双按钮宽度；否则不占位，避免标题过早省略、右侧大块空白
					isActionVisible && "min-w-[48px]",
				)}
				data-testid={`message-header-history-item-actions-${topic.id}`}
			>
				{patchedTopic.has_unread && !isActionVisible ? (
					<span
						className="size-1.5 rounded-full bg-primary"
						data-testid={`message-header-history-item-unread-${topic.id}`}
					/>
				) : null}

				{isActionVisible ? (
					<>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-4 rounded-none p-0 shadow-none hover:bg-transparent"
							onClick={(event) => {
								event.stopPropagation()
								void handleArchiveToggle(topic)
							}}
							aria-label={
								topic.is_archived
									? t("messageHeader.unarchive")
									: t("messageHeader.archive")
							}
							data-testid={`message-header-history-item-archive-button-${topic.id}`}
						>
							{topic.is_archived ? (
								<ArchiveRestore className="size-4" />
							) : (
								<Archive className="size-4" />
							)}
						</Button>

						<DropdownMenu
							open={openMenuTopicId === topic.id}
							onOpenChange={(nextOpen) => {
								setOpenMenuTopicId(nextOpen ? topic.id : null)
							}}
						>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-4 rounded-none p-0 shadow-none hover:bg-transparent"
									onClick={(event) => event.stopPropagation()}
									data-testid={`message-header-history-item-menu-button-${topic.id}`}
								>
									<Ellipsis className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-56"
								onClick={(event) => event.stopPropagation()}
							>
								<DropdownMenuItem
									onClick={(event) => {
										event.stopPropagation()
										onEditTopic(topic)
									}}
									data-testid="message-header-history-item-rename"
								>
									<Pencil className="size-4 text-muted-foreground" />
									{t("messageHeader.rename")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={(event) => {
										event.stopPropagation()
										void handleAiRenameAndRefresh(topic)
									}}
									data-testid="message-header-history-item-ai-rename"
								>
									<WandSparkles className="size-4 text-muted-foreground" />
									{t("messageHeader.aiRename")}
								</DropdownMenuItem>
								{!hideDeleteTopicButton ? (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											disabled={isDeleteDisabled}
											onClick={(event) => {
												event.stopPropagation()
												onDeleteTopic(
													topic.id,
													topic.topic_name ||
														t("messageHeader.untitledTopic"),
													{
														onSuccess: reloadTopics,
													},
												)
											}}
											data-testid="message-header-history-item-delete"
										>
											<Trash2 className="size-4" />
											{t("button.delete", {
												ns: "interface",
											})}
										</DropdownMenuItem>
									</>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				) : null}
			</div>
		)
	}

	function renderTopicRow(topic: Topic) {
		const patchedTopic = getTopicWithStatusPatch(topic)
		const isSelected = topic.id === selectedTopicId
		const isMenuOpen = openMenuTopicId === topic.id
		// 已归档话题不开放置顶入口，避免用户对归档数据执行排序类操作。
		const canShowPinAction = !topic.is_archived
		const isActionVisible =
			hoveredTopicId === topic.id ||
			openMenuTopicId === topic.id ||
			editingTopicId === topic.id

		return (
			<div
				key={topic.id}
				className={cn(
					"group flex min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2.5 py-2 text-sm transition-colors",
					isSelected && "bg-primary/10 hover:bg-primary/10",
					!isSelected && isMenuOpen && "bg-sidebar-accent",
					!isSelected && !isMenuOpen && "hover:bg-sidebar-accent",
				)}
				onClick={() => {
					void handleTopicSelect(topic)
				}}
				onMouseEnter={() => setHoveredTopicId(topic.id)}
				onMouseLeave={() => {
					if (openMenuTopicId !== topic.id) {
						setHoveredTopicId(null)
					}
				}}
				data-testid={`message-header-history-item-${topic.id}`}
				data-selected={topic.id === selectedTopicId}
			>
				<div className="flex size-4 shrink-0 items-center justify-center">
					{canShowPinAction && isActionVisible && editingTopicId !== topic.id ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-4 rounded-none p-0 shadow-none hover:bg-transparent"
							onClick={(event) => {
								event.stopPropagation()
								void handlePinToggle(topic)
							}}
							aria-label={
								topic.is_pinned ? t("messageHeader.unpin") : t("messageHeader.pin")
							}
							data-testid={`message-header-history-item-pin-button-${topic.id}`}
						>
							{topic.is_pinned ? (
								<PinOff className="size-4" />
							) : (
								<Pin className="size-4" />
							)}
						</Button>
					) : (
						<StatusIcon status={resolveTopicTaskStatus(patchedTopic)} size={16} />
					)}
				</div>

				<div className="min-w-0 flex-1">
					{editingTopicId === topic.id ? (
						<Input
							ref={editInputRef}
							className="h-7 min-w-0 rounded-lg border border-border bg-background px-3 text-sm leading-5 shadow-xs focus:border-border focus:outline-none focus:ring-0"
							value={editingValue}
							onChange={(event) => onEditingValueChange(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									void handleEditSubmitAndRefresh(topic.id)
								}

								if (event.key === "Escape") {
									event.preventDefault()
									event.stopPropagation()
									onEditCancel()
								}
							}}
							onBlur={() => {
								void handleEditSubmitAndRefresh(topic.id)
							}}
							onClick={(event) => event.stopPropagation()}
							data-testid={`message-header-history-item-edit-input-${topic.id}`}
						/>
					) : (
						<div className="flex min-w-0 items-center gap-2">
							{!hideTopicListModeIcon ? (
								<ModeTag
									mode={topic.topic_mode || TopicMode.General}
									agentCode={topic.agent_code}
								/>
							) : null}
							<MagicEllipseWithTooltip
								text={topic.topic_name || t("messageHeader.untitledTopic")}
								data-testid={`message-header-history-item-name-${topic.id}`}
								placement="left"
								className={cn(
									"min-w-0 flex-1 truncate text-sm leading-5",
									isSelected ? "text-foreground" : "text-sidebar-foreground",
								)}
							/>
						</div>
					)}
				</div>

				{editingTopicId === topic.id ? null : renderTopicActions(topic, isActionVisible)}
			</div>
		)
	}

	function renderListContent() {
		if (isLoadingTopics) {
			return (
				<div
					className="flex flex-1 items-center justify-center p-5"
					data-testid="message-header-history-loading"
				>
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
				</div>
			)
		}

		if (groups.length === 0) {
			return (
				<div
					className="flex flex-1 items-center justify-center p-5 text-sm text-muted-foreground"
					data-testid="message-header-history-empty"
				>
					{debouncedSearchKeyword
						? t("messageHeader.noMatchingTopics")
						: t("messageHeader.noTopics")}
				</div>
			)
		}

		return (
			<div className="flex flex-col gap-3">
				{groups.map((group) => (
					<section key={group.id} className="flex flex-col gap-1">
						<button
							type="button"
							className="flex h-4 w-fit items-center gap-2.5 px-0 text-xs font-normal text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
							onClick={() => onToggleGroup(group.id)}
							data-testid={`message-header-history-group-toggle-${group.id}`}
						>
							<span className="truncate leading-4">{group.title}</span>
							{group.isCollapsed ? (
								<ChevronRight className="size-4 shrink-0" />
							) : (
								<ChevronDown className="size-4 shrink-0" />
							)}
						</button>

						{group.isCollapsed ? null : (
							<div className="flex flex-col gap-1">
								{group.visibleTopics.map(renderTopicRow)}
								{group.hasMore ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-8 justify-start gap-2 rounded-md px-3 text-xs font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
										onClick={(event) => {
											event.stopPropagation()
											onLoadMoreInGroup(group.id)
										}}
										data-testid={`message-header-history-group-more-${group.id}`}
									>
										<Ellipsis className="size-4 shrink-0" />
										{t("messageHeader.more")}
									</Button>
								) : null}
							</div>
						)}
					</section>
				))}
			</div>
		)
	}

	return (
		<div
			className={cn("flex h-full min-h-0 flex-col overflow-hidden", panelClassName)}
			data-testid="message-header-history-panel-container"
		>
			<div
				className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-2.5 backdrop-blur-lg"
				data-testid="message-header-history-toolbar"
			>
				<div
					className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-foreground"
					data-testid="message-header-history-panel-title"
				>
					{t("messageHeader.topicPanelTitle", {
						count: topicsTotalFromServer,
					})}
				</div>
				{onClose ? (
					<Button
						ref={closeButtonRef}
						type="button"
						variant="ghost"
						size="icon"
						className="size-7 shrink-0 rounded-md"
						onClick={() => onClose()}
						aria-label={t("button.close", { ns: "interface" })}
						data-testid="message-header-history-close-button"
					>
						<X className="size-4" />
					</Button>
				) : null}
			</div>

			<div
				className="flex min-h-0 flex-1 flex-col overflow-hidden"
				data-testid="message-header-history-panel"
			>
				<div className="flex shrink-0 flex-col gap-2 p-2.5 pb-3">
					<div className="relative min-w-0 shrink-0">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							ref={searchInputRef}
							className="h-8 rounded-md border border-input bg-background py-1 pl-9 pr-8 text-sm leading-5 shadow-xs focus:border-border focus:outline-none focus:ring-0"
							placeholder={t("messageHeader.searchHistoryTopics")}
							value={searchKeyword}
							onChange={(event) => {
								setSearchKeyword(event.target.value)
							}}
							data-testid="message-header-history-search-input"
						/>
						{searchKeyword.trim() ? (
							<button
								type="button"
								className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								onClick={() => {
									setSearchKeyword("")
								}}
								aria-label={t("button.close", { ns: "interface" })}
								data-testid="message-header-history-search-clear"
							>
								<X className="size-3.5" />
							</button>
						) : null}
					</div>
					{!hideCreateTopicButton ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 w-full shrink-0 justify-center gap-2 rounded-md border-border bg-background px-3 text-xs font-medium shadow-xs"
							onClick={handleCreateTopicClick}
							data-testid="message-header-history-add-topic-button"
						>
							<MessageCirclePlus className="size-4 shrink-0" />
							<span>{t("messageHeader.createNewTopic")}</span>
						</Button>
					) : null}
				</div>

				<div
					className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-2.5 [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1"
					data-testid="message-header-history-list"
				>
					{renderListContent()}
				</div>
			</div>
		</div>
	)
}

const TopicHistoryPanelContent = observer(TopicHistoryPanelContentInner)

export default TopicHistoryPanelContent
