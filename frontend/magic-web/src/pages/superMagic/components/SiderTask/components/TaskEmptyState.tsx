import { Timer } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"

interface TaskEmptyStateProps {
	onCreateTask: () => void
}

export default function TaskEmptyState({ onCreateTask }: TaskEmptyStateProps) {
	const { t } = useTranslation("super")

	return (
		<div className="scrollbar-y-thin scrollbar-thumb-border scrollbar-track-transparent flex h-full w-full flex-col items-center justify-center gap-6 overflow-auto rounded-lg border border-dashed border-border p-6">
			{/* Icon container */}
			<div className="flex size-12 items-center justify-center rounded-lg border border-border bg-background p-2 shadow-sm">
				<Timer className="size-6 text-foreground" />
			</div>

			{/* Message container */}
			<div className="flex flex-col items-center gap-2 text-center">
				<h3 className="text-lg font-medium leading-7 text-foreground">
					{t("scheduleTask.emptyTitle")}
				</h3>
				<p className="text-sm leading-5 text-muted-foreground">
					{t("scheduleTask.emptyDescription")}
				</p>
			</div>

			{/* Action button */}
			<Button
				onClick={onCreateTask}
				className="bg-foreground text-background hover:bg-foreground/90"
			>
				{t("scheduleTask.createTask")}
			</Button>
		</div>
	)
}
