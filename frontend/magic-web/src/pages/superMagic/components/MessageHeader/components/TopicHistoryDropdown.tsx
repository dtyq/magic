import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
	Ellipsis,
	Loader2,
	MessageCirclePlus,
	Pencil,
	Search,
	Trash2,
	WandSparkles,
	X,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { MagicDropdown } from "@/components/base"
import { cn } from "@/lib/utils"
import recordSummaryStore from "@/stores/recordingSummary"
import type { Topic } from "../../../pages/Workspace/types"
import { TopicMode } from "../../../pages/Workspace/types"
import ModeTag from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/components/ModeTag"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import StatusIcon from "./StatusIcon"
import { observer } from "mobx-react-lite"
import usePaginatedTopics from "@/pages/superMagic/hooks/usePaginatedTopics"
import type TopicServiceClass from "@/pages/superMagic/services/topicService"

interface TopicHistoryDropdownProps {
	topics: Topic[]
	projectId: string
	selectedTopicId?: string
	editingTopicId: string | null
	editingValue: string
	onEditingValueChange: (value: string) => void
	onEditSubmit: (topicId: string) => void
	onEditCancel: () => void
	onEditTopic: (topic: Topic) => void
	onAiRenameTopic: (topicId: string) => void
	onDeleteTopic: (topicId: string, topicName: string) => void
	onSelectTopic: (topic: Topic) => void
	canDeleteTopic: boolean
	onCreateTopic: () => void
	topicService?: TopicServiceClass
	placement?: string
	onDropdownOpenChange?: (open: boolean) => void
	/** Hide mode tag icon in each topic list row */
	hideTopicListModeIcon?: boolean
	children: ReactNode
}

function TopicHistoryDropdown({
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
	topicService,
	placement = "bottomRight",
	onDropdownOpenChange,
	hideTopicListModeIcon = false,
	children,
}: TopicHistoryDropdownProps) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const [searchKeyword, setSearchKeyword] = useState("")
	const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null)
	const [openMenuTopicId, setOpenMenuTopicId] = useState<string | null>(null)

	const searchInputRef = useRef<HTMLInputElement>(null)
	const editInputRef = useRef<HTMLInputElement>(null)
	const suppressNextCloseRef = useRef(false)

	const {
		displayTopics,
		isLoading: isLoadingTopics,
		currentPage,
		onScroll: handleListScroll,
		reload: reloadTopics,
		reset: resetTopics,
	} = usePaginatedTopics({
		projectId,
		selectedTopicId,
		storeTopics: topics,
		topicService,
	})

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && suppressNextCloseRef.current) {
			suppressNextCloseRef.current = false
			return
		}
		setOpen(nextOpen)
		onDropdownOpenChange?.(nextOpen)
	}

	useEffect(() => {
		if (open && projectId) {
			reloadTopics()
		}
		if (!open) {
			setSearchKeyword("")
			setOpenMenuTopicId(null)
			resetTopics()
		}
	}, [open, projectId, reloadTopics, resetTopics])

	useEffect(() => {
		if (open && searchInputRef.current) {
			setTimeout(() => {
				searchInputRef.current?.focus()
			}, 100)
		}
	}, [open])

	useEffect(() => {
		if (open && editingTopicId && editInputRef.current) {
			editInputRef.current.focus()
			editInputRef.current.select()
		}
	}, [editingTopicId, open])

	const filteredTopics = useMemo(() => {
		if (!displayTopics.length) return []
		if (!searchKeyword.trim()) return displayTopics

		const keyword = searchKeyword.toLowerCase().trim()
		return displayTopics.filter((topic) => {
			const topicName = topic.topic_name || t("messageHeader.untitledTopic")
			return topicName.toLowerCase().includes(keyword)
		})
	}, [searchKeyword, t, displayTopics])

	const historyDropdownContent = (
		<div
			className="w-[300px] rounded-md border border-border bg-popover p-2.5 shadow-xs"
			data-testid="message-header-history-panel"
		>
			<div className="mb-[10px]" data-testid="message-header-history-header">
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						ref={searchInputRef}
						className="h-7 rounded-lg border border-border bg-background pl-9 pr-8 text-sm leading-[20px] shadow-xs focus:border-border focus:outline-none focus:ring-0"
						placeholder={t("messageHeader.searchHistoryTopics")}
						value={searchKeyword}
						onChange={(event) => {
							setSearchKeyword(event.target.value)
						}}
						data-testid="message-header-history-search-input"
					/>
					{searchKeyword.trim() && (
						<button
							type="button"
							className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							onClick={() => {
								setSearchKeyword("")
							}}
							aria-label={t("button.close", { ns: "interface" })}
							data-testid="message-header-history-search-clear"
						>
							<X className="size-3.5" />
						</button>
					)}
				</div>
			</div>

			<div
				className="mb-[10px] flex max-h-[226px] flex-col gap-0.5 overflow-y-auto [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1"
				data-testid="message-header-history-list"
				onScroll={(e) => {
					if (!searchKeyword.trim()) {
						handleListScroll(e.currentTarget)
					}
				}}
			>
				{filteredTopics.length === 0 && !isLoadingTopics && searchKeyword.trim() && (
					<div
						className="flex items-center justify-center p-5 text-sm text-muted-foreground"
						data-testid="message-header-history-empty"
					>
						{t("messageHeader.noMatchingTopics")}
					</div>
				)}

				{filteredTopics.length === 0 && isLoadingTopics && currentPage === 1 && (
					<div
						className="flex items-center justify-center p-5"
						data-testid="message-header-history-loading"
					>
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				)}

				{filteredTopics.map((topic) => (
					<div
						key={topic.id}
						className={cn(
							"group flex h-8 cursor-pointer items-center gap-2 rounded-lg p-2 text-sm leading-5 transition-colors",
							topic.id === selectedTopicId
								? "bg-accent"
								: openMenuTopicId === topic.id
									? "bg-accent"
									: "hover:bg-accent",
						)}
						onClick={() => {
							if (editingTopicId !== topic.id) {
								onSelectTopic(topic)
								setOpen(false)
								setHoveredTopicId(null)
								setOpenMenuTopicId(null)
							}
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
						<StatusIcon status={topic.task_status} size={16} />

						{editingTopicId === topic.id ? (
							<Input
								ref={editInputRef}
								className="h-6 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm leading-[20px] shadow-xs focus:border-border focus:outline-none focus:ring-0"
								value={editingValue}
								onChange={(e) => onEditingValueChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										onEditSubmit(topic.id)
									}
									if (e.key === "Escape") {
										e.preventDefault()
										e.stopPropagation()
										onEditCancel()
									}
								}}
								onBlur={() => onEditSubmit(topic.id)}
								onClick={(e) => e.stopPropagation()}
								data-testid={`message-header-history-item-edit-input-${topic.id}`}
							/>
						) : (
							<>
								{!hideTopicListModeIcon ? (
									<ModeTag mode={topic.topic_mode || TopicMode.General} />
								) : null}
								<MagicEllipseWithTooltip
									text={topic.topic_name || t("messageHeader.untitledTopic")}
									data-testid={`message-header-history-item-name-${topic.id}`}
									placement="left"
									className="min-w-0 flex-1 truncate text-sm font-normal leading-5 text-sidebar-foreground"
								/>
							</>
						)}

						{(hoveredTopicId === topic.id || openMenuTopicId === topic.id) &&
							editingTopicId !== topic.id && (
								<div
									className="relative flex shrink-0 items-center"
									data-testid={`message-header-history-item-actions-${topic.id}`}
								>
									<PopoverPrimitive.Root
										open={openMenuTopicId === topic.id}
										onOpenChange={(nextOpen) => {
											setOpenMenuTopicId(nextOpen ? topic.id : null)
										}}
									>
										<PopoverPrimitive.Trigger asChild>
											<button
												type="button"
												className={cn(
													"flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
													openMenuTopicId === topic.id && "bg-accent",
												)}
												onClick={(event) => {
													event.stopPropagation()
												}}
												data-testid={`message-header-history-item-menu-button-${topic.id}`}
												data-open={openMenuTopicId === topic.id}
											>
												<Ellipsis className="size-4 text-foreground" />
											</button>
										</PopoverPrimitive.Trigger>
										<PopoverPrimitive.Content
											align="end"
											side="bottom"
											sideOffset={4}
											data-testid={`message-header-history-item-menu-${topic.id}`}
											className={cn(
												"z-[100] w-60 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
												"data-[state=open]:animate-in data-[state=closed]:animate-out",
												"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
												"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
												"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
												"data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
											)}
											onClick={(e) => {
												e.stopPropagation()
											}}
											onMouseEnter={(e) => {
												e.stopPropagation()
											}}
											onMouseLeave={(e) => {
												e.stopPropagation()
											}}
											onInteractOutside={(e) => {
												e.preventDefault()
											}}
										>
											<div
												className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
												onClick={(e) => {
													e.stopPropagation()
													suppressNextCloseRef.current = true
													onEditTopic(topic)
													setOpenMenuTopicId(null)
												}}
												data-testid="message-header-history-item-rename"
											>
												<Pencil
													size={16}
													className="text-muted-foreground"
												/>
												{t("messageHeader.rename")}
											</div>
											<div
												className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
												onClick={(e) => {
													e.stopPropagation()
													suppressNextCloseRef.current = true
													onAiRenameTopic(topic.id)
													setOpenMenuTopicId(null)
												}}
												data-testid="message-header-history-item-ai-rename"
											>
												<WandSparkles
													size={16}
													className="text-muted-foreground"
												/>
												{t("messageHeader.aiRename")}
											</div>
											<div className="my-1 h-px bg-border" />
											<div
												className={cn(
													"flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 hover:text-destructive",
													(!canDeleteTopic ||
														recordSummaryStore.isRecordingTopic(
															topic.id,
														)) &&
														"pointer-events-none opacity-50",
												)}
												data-testid="message-header-history-item-delete"
												onClick={(e) => {
													e.stopPropagation()
													suppressNextCloseRef.current = true
													onDeleteTopic(
														topic.id,
														topic.topic_name ||
															t("messageHeader.untitledTopic"),
													)
													setOpenMenuTopicId(null)
												}}
											>
												<Trash2 size={16} />
												{t("button.delete", { ns: "interface" })}
											</div>
										</PopoverPrimitive.Content>
									</PopoverPrimitive.Root>
								</div>
							)}
					</div>
				))}

				{isLoadingTopics && currentPage > 1 && (
					<div className="flex items-center justify-center py-2">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				)}
			</div>

			<Button
				variant="outline"
				size="sm"
				className="h-6 w-full justify-center gap-1.5 rounded-lg border-border bg-background px-3 text-xs font-normal shadow-xs"
				onClick={(e) => {
					e.stopPropagation()
					onCreateTopic()
					setOpen(false)
				}}
				data-testid="message-header-history-add-topic-button"
			>
				<MessageCirclePlus className="size-4" />
				<span>{t("messageHeader.createNewTopic")}</span>
			</Button>
		</div>
	)

	return (
		<MagicDropdown
			popupRender={() => historyDropdownContent}
			trigger={["click"]}
			placement={placement}
			onOpenChange={handleOpenChange}
			open={open}
			onEscapeKeyDown={(event) => {
				if (editingTopicId) {
					event.preventDefault()
				}
			}}
			overlayClassName="!p-0"
		>
			{children}
		</MagicDropdown>
	)
}

export default observer(TopicHistoryDropdown)
