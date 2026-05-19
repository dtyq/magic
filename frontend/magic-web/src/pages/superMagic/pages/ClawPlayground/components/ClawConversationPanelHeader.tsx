import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MagicTooltip } from "@/components/base"
import { cn } from "@/lib/utils"
import StatusIcon from "@/pages/superMagic/components/MessageHeader/components/StatusIcon"
import type { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"

const toggleButtonClassName = "!size-6 !min-h-6 !min-w-6 !rounded-md !p-0"

export interface ClawConversationPanelHeaderProps {
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	detailPanelVisible?: boolean
	taskStatus?: TaskStatus
}

function ClawConversationPanelHeaderComponent({
	isConversationPanelCollapsed = false,
	onToggleConversationPanel,
	detailPanelVisible = true,
	taskStatus,
}: ClawConversationPanelHeaderProps) {
	const { t } = useTranslation("sidebar")
	const { t: tSuper } = useTranslation("super")

	const fixedTitle = t("superLobster.workspace.conversationPanelTitle")

	const handleToggleConversationPanel = useMemoizedFn(() => {
		onToggleConversationPanel?.()
	})

	const titleNode = (
		<p
			className={cn(
				"min-h-px min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal leading-5 text-foreground",
				isConversationPanelCollapsed &&
					"writing-vertical-rl max-h-[120px] flex-none text-center text-xs leading-4",
			)}
			data-testid="claw-playground-conversation-panel-header-title"
		>
			{fixedTitle}
		</p>
	)

	const statusAndTitle = (
		<div
			className={cn(
				"flex min-h-6 min-w-0 flex-1 items-center gap-1",
				isConversationPanelCollapsed && "w-full flex-none flex-col justify-start gap-3",
			)}
			data-testid="claw-playground-conversation-panel-header-topic-group"
		>
			<StatusIcon status={taskStatus} />
			{titleNode}
		</div>
	)

	return (
		<div
			className={cn(
				"absolute z-30 mb-2.5 flex h-10 w-full items-center gap-2 px-2 py-1.5",
				"bg-sidebar/95 backdrop-blur-lg",
				isConversationPanelCollapsed && "h-full flex-col px-0 py-1.5",
			)}
			data-testid="claw-playground-conversation-panel-header"
		>
			{isConversationPanelCollapsed ? (
				<div className="flex w-full flex-col items-center gap-4">
					{detailPanelVisible ? (
						<MagicTooltip title={tSuper("messageHeader.expandConversationPanel")}>
							<span>
								<Button
									variant="ghost"
									size="icon-sm"
									className={toggleButtonClassName}
									onClick={handleToggleConversationPanel}
									data-testid="claw-playground-conversation-panel-header-toggle"
								>
									<PanelRightOpen
										size={16}
										className="shrink-0 text-foreground"
									/>
								</Button>
							</span>
						</MagicTooltip>
					) : null}
					{statusAndTitle}
				</div>
			) : (
				<>
					{detailPanelVisible ? (
						<MagicTooltip title={tSuper("messageHeader.collapseConversationPanel")}>
							<span>
								<Button
									variant="ghost"
									size="icon-sm"
									className={toggleButtonClassName}
									onClick={handleToggleConversationPanel}
									data-testid="claw-playground-conversation-panel-header-toggle"
								>
									<PanelRightClose
										size={16}
										className="shrink-0 text-foreground"
									/>
								</Button>
							</span>
						</MagicTooltip>
					) : null}
					{statusAndTitle}
				</>
			)}
		</div>
	)
}

export const ClawConversationPanelHeader = memo(ClawConversationPanelHeaderComponent)
