import { useEffect, useRef, useState, type ReactNode } from "react"
import { MagicDropdown } from "@/components/base"
import type { Topic } from "../../../pages/Workspace/types"
import { observer } from "mobx-react-lite"
import type TopicServiceClass from "@/pages/superMagic/services/topicService"
import TopicHistoryPanelContent from "./TopicHistoryPanelContent"

interface TopicHistoryDropdownProps {
	topics: Topic[]
	projectId: string
	selectedTopicId?: string
	/** Expands the conversation panel before switching topics when the sliver-only layout is active. */
	isConversationPanelCollapsed?: boolean
	/** Restores the conversation panel so the selected topic becomes immediately visible. */
	onExpandConversationPanel?: () => void
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
	placement?: string
	onDropdownOpenChange?: (open: boolean) => void
	/** Notified after the history menu has already opened. */
	onTriggerAction?: () => Promise<void> | void
	/** Hide mode tag icon in each topic list row */
	hideTopicListModeIcon?: boolean
	hideTopicTypeFilter?: boolean
	hideCreateTopicButton?: boolean
	hideDeleteTopicButton?: boolean
	children: ReactNode
}

function TopicHistoryDropdown({
	topics,
	projectId,
	selectedTopicId,
	isConversationPanelCollapsed = false,
	onExpandConversationPanel,
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
	placement = "bottomRight",
	onDropdownOpenChange,
	onTriggerAction,
	hideTopicListModeIcon = false,
	hideTopicTypeFilter = false,
	hideCreateTopicButton = false,
	hideDeleteTopicButton = false,
	children,
}: TopicHistoryDropdownProps) {
	// 该组件保留给尚未迁移完成的旧入口。
	// 大部分桌面端场景都会切到新的历史话题交互面板，不再继续扩展 dropdown 交互。
	const [open, setOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const suppressImmediateCloseRef = useRef(false)
	const suppressImmediateCloseTimerRef = useRef<number | null>(null)

	function clearImmediateCloseProtection() {
		if (suppressImmediateCloseTimerRef.current !== null) {
			window.clearTimeout(suppressImmediateCloseTimerRef.current)
			suppressImmediateCloseTimerRef.current = null
		}

		suppressImmediateCloseRef.current = false
	}

	function protectDropdownFromImmediateClose() {
		clearImmediateCloseProtection()
		suppressImmediateCloseRef.current = true
		suppressImmediateCloseTimerRef.current = window.setTimeout(() => {
			suppressImmediateCloseRef.current = false
			suppressImmediateCloseTimerRef.current = null
		}, 0)
	}

	/** Applies an open-state change after the immediate-close guard has been checked. */
	const applyOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && suppressImmediateCloseRef.current) {
			clearImmediateCloseProtection()
			return
		}

		clearImmediateCloseProtection()
		setOpen(nextOpen)
		onDropdownOpenChange?.(nextOpen)
	}

	/** Opens the legacy menu first, then notifies the host. */
	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			applyOpenChange(false)
			return
		}

		applyOpenChange(true)
		if (!onTriggerAction) return
		void Promise.resolve(onTriggerAction()).catch(() => {
			// A host callback failure must not close a history menu that already opened.
		})
	}

	useEffect(() => {
		if (!open) return

		const focusTimer = window.setTimeout(() => {
			searchInputRef.current?.focus()
		}, 100)

		return () => {
			window.clearTimeout(focusTimer)
		}
	}, [open])

	useEffect(() => {
		return () => {
			clearImmediateCloseProtection()
		}
	}, [])

	return (
		<MagicDropdown
			popupRender={() =>
				open ? (
					<TopicHistoryPanelContent
						topics={topics}
						projectId={projectId}
						selectedTopicId={selectedTopicId}
						isConversationPanelCollapsed={isConversationPanelCollapsed}
						onExpandConversationPanel={onExpandConversationPanel}
						editingTopicId={editingTopicId}
						editingValue={editingValue}
						onEditingValueChange={onEditingValueChange}
						onEditSubmit={onEditSubmit}
						onEditCancel={onEditCancel}
						onEditTopic={(topic) => {
							protectDropdownFromImmediateClose()
							onEditTopic(topic)
						}}
						onAiRenameTopic={(topic) => {
							protectDropdownFromImmediateClose()
							onAiRenameTopic(topic)
						}}
						onDeleteTopic={(topicId, topicName) => {
							protectDropdownFromImmediateClose()
							onDeleteTopic(topicId, topicName)
						}}
						onSelectTopic={(topic) => {
							onSelectTopic(topic)
							handleOpenChange(false)
						}}
						canDeleteTopic={canDeleteTopic}
						onCreateTopic={() => {
							onCreateTopic()
							handleOpenChange(false)
						}}
						onPinTopic={onPinTopic}
						onUnpinTopic={onUnpinTopic}
						onArchiveTopic={onArchiveTopic}
						onUnarchiveTopic={onUnarchiveTopic}
						topicService={topicService}
						hideTopicListModeIcon={hideTopicListModeIcon}
						hideTopicTypeFilter={hideTopicTypeFilter}
						hideCreateTopicButton={hideCreateTopicButton}
						hideDeleteTopicButton={hideDeleteTopicButton}
						searchInputRef={searchInputRef}
						panelClassName="w-64 max-h-[60vh] rounded-md border border-border bg-popover shadow-xs"
					/>
				) : null
			}
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
