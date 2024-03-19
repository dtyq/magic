import { memo } from "react"
import { Popup } from "antd-mobile"
import { IconX } from "@tabler/icons-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { cn } from "@/opensource/lib/utils"

export interface ActionItem {
	key: string
	label: string
	onClick?: () => void
	variant?: "default" | "danger"
	disabled?: boolean
}

export interface ActionGroup {
	actions: ActionItem[]
}

interface ActionSheetProps {
	visible: boolean
	title?: string
	actionGroups: ActionGroup[]
	showCancel?: boolean
	cancelText?: string
	onClose: () => void
}

function ActionSheet({
	visible,
	title = "更多",
	actionGroups,
	showCancel = true,
	cancelText = "取消",
	onClose,
}: ActionSheetProps) {
	return (
		<Popup
			visible={visible}
			position="bottom"
			onClose={onClose}
			onMaskClick={onClose}
			showCloseButton={false}
			bodyStyle={{
				borderRadius: "14px 14px 0 0",
				background: "#F5F5F5",
				padding: "0",
			}}
			style={{
				zIndex: 1001,
			}}
		>
			<div className="flex w-full flex-col">
				{/* Header */}
				<div className="flex h-12 items-center gap-1.5 px-3">
					<h3 className="flex-1 text-sm font-medium leading-none text-foreground">
						{title}
					</h3>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-8 w-8 rounded-lg"
					>
						<IconX className="h-4 w-4" />
					</Button>
				</div>

				{/* Content */}
				<div className="flex flex-col gap-3 px-3 pb-3">
					{actionGroups.map((group, groupIndex) => (
						<div
							key={groupIndex}
							className="flex flex-col overflow-hidden rounded-lg bg-background"
						>
							{group.actions.map((action, actionIndex) => {
								const isLast = actionIndex === group.actions.length - 1

								return (
									<button
										key={action.key}
										onClick={() => {
											if (!action.disabled) {
												action.onClick?.()
											}
										}}
										disabled={action.disabled}
										className={cn(
											"flex h-11 items-center gap-2 px-2 text-sm font-normal leading-[1.4285] transition-colors",
											!isLast && "border-b border-border",
											action.variant === "danger"
												? "text-destructive hover:bg-destructive/5 active:bg-destructive/10"
												: "text-foreground hover:bg-muted active:bg-muted/80",
											action.disabled &&
												"cursor-not-allowed opacity-50 hover:bg-transparent",
										)}
									>
										{action.label}
									</button>
								)
							})}
						</div>
					))}

					{/* Cancel Button */}
					{showCancel && (
						<Button
							variant="outline"
							onClick={onClose}
							className="h-9 w-full justify-center rounded-lg border-border text-sm font-normal leading-[1.4285] text-foreground"
						>
							{cancelText}
						</Button>
					)}
				</div>
			</div>
		</Popup>
	)
}

export default memo(ActionSheet)
