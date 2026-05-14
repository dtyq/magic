import { memo } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import type { ActionGroup } from "@/pages/superMagicMobile/components/ActionSheet"
import { cn } from "@/lib/utils"

interface ConversationActionsPopupProps {
	visible: boolean
	title: string
	subtitle?: string
	actionGroups: ActionGroup[]
	onClose: () => void
}

/**
 * 通用会话操作面板：复用 MagicPopup 视觉骨架，承载 chat 与项目话题页的底部 Action Sheet。
 */
function ConversationActionsPopup({
	visible,
	title,
	subtitle,
	actionGroups,
	onClose,
}: ConversationActionsPopupProps) {
	const { t } = useTranslation("super")

	return (
		<MagicPopup
			visible={visible}
			onClose={onClose}
			position="bottom"
			title={title}
			headerVariant="actionHeader"
			headerTitle={title}
			headerSubtitle={subtitle}
			headerLeadingAction={{
				icon: <X className="h-[22px] w-[22px]" strokeWidth={2} />,
				ariaLabel: t("common.close"),
				onClick: onClose,
				testId: "conversation-actions-close-button",
			}}
			className="rounded-t-[14px] border-0 bg-muted"
			bodyClassName="overflow-hidden"
		>
			<div
				className="flex min-h-0 w-full flex-col bg-muted"
				data-testid="conversation-actions-popup-root"
			>
				{/* 操作列表 */}
				<div className="flex flex-col gap-[10px] px-[14px] pb-4 pt-2">
					{actionGroups.map((group, groupIndex) => (
						<div
							key={groupIndex}
							className="w-full shrink-0 overflow-hidden rounded-lg bg-card"
							data-testid="conversation-actions-group"
						>
							{group.actions.map((action, actionIndex) => {
								const isLast = actionIndex === group.actions.length - 1

								return (
									<button
										key={action.key}
										type="button"
										onClick={() => {
											if (!action.disabled) action.onClick?.()
										}}
										disabled={action.disabled}
										className={cn(
											"flex h-12 w-full items-center px-[14px] text-left text-[16px] leading-5 transition-opacity",
											!isLast && "border-b border-border",
											action.variant === "danger"
												? "text-destructive active:opacity-60"
												: "text-foreground active:opacity-60",
											action.disabled &&
												"cursor-not-allowed opacity-40 active:opacity-40",
										)}
										data-testid={`conversation-actions-${action.key}-button`}
									>
										{action.label}
									</button>
								)
							})}
						</div>
					))}
				</div>
			</div>
		</MagicPopup>
	)
}

export default memo(ConversationActionsPopup)
