import { CalendarClock, Clock3, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { Switch } from "@/components/shadcn-ui/switch"
import type { DropdownDelegateProps } from "@/pages/superMagic/components/SuperMagicDropdown"
import { formatTaskSchedule } from "@/pages/superMagic/components/ScheduledTasks/utils"
import type { ScheduledTask } from "@/types/scheduledTask"

interface MobileScheduledTaskCardProps extends DropdownDelegateProps<ScheduledTask.Task> {
	data: ScheduledTask.Task
	onSwitchChange: (enabled: boolean) => void
	onClick: () => void
}

/** Renders one project-scoped scheduled task with mobile-friendly event boundaries. */
export default function MobileScheduledTaskCard({
	data,
	onSwitchChange,
	onClick,
	onDropdownActionClick,
	onDropdownContextMenuClick,
}: MobileScheduledTaskCardProps) {
	const { t } = useTranslation("super")
	const scheduleText = formatTaskSchedule(data.time_config, t)

	/** Opens task editing when the card body is activated by mouse or keyboard. */
	const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return

		event.preventDefault()
		onClick()
	}

	/** Prevents nested controls from opening the card editor. */
	const stopCardActivation = (event: React.SyntheticEvent) => {
		event.stopPropagation()
	}

	return (
		<div
			className="w-full cursor-pointer rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/30"
			onClick={onClick}
			onKeyDown={handleCardKeyDown}
			onContextMenu={(event) => onDropdownContextMenuClick?.(event, data)}
			role="button"
			tabIndex={0}
			data-testid="mobile-scheduled-task-card"
		>
			<div className="flex min-w-0 items-center gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<CalendarClock className="size-5" aria-hidden="true" />
				</div>
				<div className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-6 text-foreground">
					{data.task_name || "-"}
				</div>
				<span
					className={
						data.enabled === 1
							? "shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs leading-5 text-emerald-600"
							: "shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs leading-5 text-muted-foreground"
					}
				>
					{data.enabled === 1 ? t("scheduleTask.enabled") : t("scheduleTask.disabled")}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="shrink-0 rounded-full"
					title={t("scheduleTask.moreActions")}
					aria-label={t("scheduleTask.moreActions")}
					onClick={(event) => {
						stopCardActivation(event)
						onDropdownActionClick?.(event, data)
					}}
				>
					<MoreHorizontal className="size-5" aria-hidden="true" />
				</Button>
			</div>

			<div className="mt-3 flex min-h-10 items-center gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm leading-5 text-muted-foreground">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<Clock3 className="size-4 shrink-0" aria-hidden="true" />
					<span className="truncate">{scheduleText}</span>
				</div>
				<div
					className="shrink-0"
					onClick={stopCardActivation}
					onKeyDown={stopCardActivation}
				>
					<Switch
						checked={data.enabled === 1}
						onCheckedChange={onSwitchChange}
						aria-label={t("scheduleTask.toggleTask", { name: data.task_name || "-" })}
					/>
				</div>
			</div>
		</div>
	)
}
