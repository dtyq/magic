import type { ComponentProps, RefObject } from "react"
import TopicHistoryDropdown from "./TopicHistoryDropdown"
import { TopicHistoryTrigger } from "./TopicHistoryTrigger"

export interface MessageHeaderHistoryControlProps {
	historyTriggerMode: "dropdown" | "layout"
	isHistoryButtonActive: boolean
	tooltipTitle: string
	onToggleHistoryPanel?: () => void
	/** Notified after the history control has already toggled. */
	onTriggerAction?: () => Promise<void> | void
	triggerRef?: RefObject<HTMLButtonElement>
	dropdownProps?: Omit<
		ComponentProps<typeof TopicHistoryDropdown>,
		"children" | "onTriggerAction"
	>
}

export function MessageHeaderHistoryControl({
	historyTriggerMode,
	isHistoryButtonActive,
	tooltipTitle,
	onToggleHistoryPanel,
	onTriggerAction,
	triggerRef,
	dropdownProps,
}: MessageHeaderHistoryControlProps) {
	// `dropdown` 仅作为少量遗留场景的兼容路径保留。
	// 历史话题的主交互已切到本次桌面端新面板，后续默认应优先接入 `layout` 模式。
	return (
		<TopicHistoryTrigger
			triggerRef={triggerRef}
			mode={historyTriggerMode}
			isActive={isHistoryButtonActive}
			tooltipTitle={tooltipTitle}
			onToggle={onToggleHistoryPanel}
			onTriggerAction={onTriggerAction}
			renderDropdown={
				historyTriggerMode === "dropdown" && dropdownProps
					? (trigger) => (
							<TopicHistoryDropdown
								{...dropdownProps}
								onTriggerAction={onTriggerAction}
							>
								{trigger}
							</TopicHistoryDropdown>
						)
					: undefined
			}
		/>
	)
}
