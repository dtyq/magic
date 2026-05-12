import { Ellipsis, Timer } from "lucide-react"
import { Switch } from "@/components/shadcn-ui/switch"
import { cn } from "@/lib/utils"
import type { DropdownDelegateProps } from "@/pages/superMagic/components/SuperMagicDropdown"
import type { ClawCronTaskRecord } from "./claw-cron-task-file"

interface ClawScheduledTaskItemProps extends DropdownDelegateProps<ClawCronTaskRecord> {
	task: ClawCronTaskRecord
	isActive?: boolean
	isStatusUpdating?: boolean
	onSwitchChange?: (enabled: boolean) => void
}

export function ClawScheduledTaskItem({
	task,
	isActive = false,
	isStatusUpdating = false,
	onSwitchChange,
	onDropdownActionClick,
	onDropdownContextMenuClick,
}: ClawScheduledTaskItemProps) {
	function handleContextMenuClick(event: React.MouseEvent<HTMLDivElement>) {
		onDropdownContextMenuClick?.(event, task)
	}

	function handleActionClick(event: React.MouseEvent<HTMLButtonElement>) {
		onDropdownActionClick?.(event as unknown as React.MouseEvent<HTMLDivElement>, task)
	}

	function handleSwitchChange(checked: boolean) {
		onSwitchChange?.(checked)
	}

	return (
		<div
			className={cn(
				"group flex items-center gap-2 rounded-md p-2 transition-colors",
				isActive && "bg-sidebar-accent",
			)}
			onContextMenu={handleContextMenuClick}
			data-testid="claw-scheduled-task-item"
		>
			<Switch
				checked={task.enabled}
				disabled={isStatusUpdating}
				onCheckedChange={handleSwitchChange}
				data-testid="claw-scheduled-task-item-switch"
			/>
			<Timer className="size-4 shrink-0 text-sidebar-foreground" aria-hidden />
			<div
				className="min-w-0 flex-1 truncate text-sm font-normal leading-none text-sidebar-foreground"
				title={task.taskName}
			>
				{task.taskName}
			</div>
			<button
				type="button"
				className={cn(
					"flex size-4 items-center justify-center rounded-sm text-sidebar-foreground transition-opacity",
					isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
				)}
				disabled={isStatusUpdating}
				onClick={handleActionClick}
				aria-label={task.taskName}
				aria-busy={isStatusUpdating}
				data-testid="claw-scheduled-task-item-more"
			>
				<Ellipsis className="size-4" aria-hidden />
			</button>
		</div>
	)
}
