import MagicIcon from "@/components/base/MagicIcon"
import { cn } from "@/lib/utils"
import {
	IconChevronDown,
	IconChevronUp,
	IconCircleCheck,
	IconCircleXFilled,
	IconHourglassEmpty,
} from "@tabler/icons-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { TaskStatus, type TaskData } from "../../pages/Workspace/types"
import StatusIcon from "../MessageHeader/components/StatusIcon"
import CollapsibleText from "../MessagePanel/components/MessageQueue/components/CollapsibleText"

// Custom animated icon for running status
const AnimatedDoingIcon = () => {
	return <StatusIcon status={TaskStatus.RUNNING} />
}

// Custom default icon for waiting status
const DefaultTaskIcon = () => (
	<IconHourglassEmpty
		className="flex size-4 shrink-0 items-start justify-center text-foreground/35"
		size={16}
	/>
)

// Status icon classes for done/error states
const statusIconBase = "size-[13.5px]"
const statusDone = "size-4 text-green-500 dark:text-green-400"
const statusError = "text-destructive"

const taskTitleBase = cn(
	"min-w-0 flex-1 text-xs font-normal leading-4 text-foreground/80",
	"[&>div]:leading-[1.4]",
	"[&_p]:mb-0 [&_p]:break-words [&_p]:!text-xs [&_p]:!leading-4 [&_p]:!text-foreground/80",
	"[&_.magic-mention]:!text-[10px]",
)

interface TaskListProps {
	taskData: TaskData | null
	isInChat?: boolean
	className?: string
	style?: React.CSSProperties
	mode?: "view" | "default"
}

function TaskList({ taskData, className, style, mode }: TaskListProps) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(mode === "view")

	const completedTasks = taskData?.process?.filter((task) => task.status === "finished").length
	const totalTasks = taskData?.process?.length

	const getCurrentTask = () => {
		const runningTask = taskData?.process?.find((task) => task.status === "running")
		if (runningTask) return runningTask

		const todoTask = taskData?.process?.find((task) => task.status === "waiting")
		if (todoTask) return todoTask

		const doneTasks = taskData?.process?.filter((task) => task.status === "finished") || []
		if (doneTasks.length > 0) return doneTasks[doneTasks.length - 1]

		return taskData?.process?.[0]
	}

	const getTaskIcon = (status: string, taskId?: string) => {
		const hasDoingTask = taskData?.process?.some((task) => task.status === "running")
		const firstTodoTask = !hasDoingTask
			? taskData?.process?.find((task) => task.status === "waiting")
			: null

		if (
			!hasDoingTask &&
			firstTodoTask &&
			taskId &&
			taskId === firstTodoTask.id &&
			status === "waiting"
		) {
			return <AnimatedDoingIcon />
		}

		switch (status) {
			case "finished":
				return (
					<IconCircleCheck
						className={cn(statusIconBase, statusDone)}
						stroke={1.5}
						size={16}
					/>
				)
			case "running":
				return <AnimatedDoingIcon />
			case "error":
				return (
					<IconCircleXFilled
						className={cn(statusIconBase, statusError)}
						size={16}
						stroke={1.5}
					/>
				)
			default:
				return <DefaultTaskIcon />
		}
	}

	const toggleExpanded = () => {
		if (mode === "view") return
		setExpanded(!expanded)
	}

	const currentTask = getCurrentTask()

	return (
		<div
			className={cn(
				"mb-0 w-full flex-none select-none",
				!expanded && "flex items-center gap-2.5 p-2.5",
				className,
			)}
			style={style}
		>
			{!expanded && (
				<>
					{getTaskIcon(currentTask?.status || "waiting", currentTask?.id)}
					<div className={cn(taskTitleBase, "-ml-1.5")}>
						<CollapsibleText content={currentTask?.title || ""} maxLines={2} />
					</div>
				</>
			)}
			<div
				className={cn(
					"rounded-t-lg p-0",
					"bg-gray-50 dark:bg-white/5",
					!expanded && "h-4 bg-transparent p-0",
					mode === "view" && "bg-background",
				)}
			>
				<div
					className={cn(
						"mb-0 flex cursor-pointer items-center justify-between rounded-[4px] border-b-0",
						expanded && "px-2.5 pb-1.5 pt-2.5",
					)}
					onClick={toggleExpanded}
				>
					<div
						className={cn(
							"flex items-center gap-2",
							!expanded && "min-w-0 flex-1 overflow-hidden pl-0",
						)}
					>
						{expanded && (
							<div className="h-[18px] text-xs font-semibold text-foreground/80">
								{t("common.taskList")}
							</div>
						)}
					</div>
					{mode === "view" ? null : (
						<div className="flex shrink-0 items-center gap-2.5 text-sm text-muted-foreground">
							<div className="flex items-center gap-2">
								<span className="text-[10px] leading-[10px] text-muted-foreground">
									{completedTasks} / {totalTasks}
								</span>
							</div>
							<MagicIcon
								size={18}
								className="shrink-0"
								component={expanded ? IconChevronDown : IconChevronUp}
							/>
						</div>
					)}
				</div>
				{expanded && (
					<div
						className="flex flex-col gap-2.5 overflow-auto p-2.5 pt-1.5"
						style={{ maxHeight: mode === "view" ? "335px" : "240px" }}
					>
						{taskData?.process?.map((task) => (
							<div
								key={task.id}
								className="flex items-start justify-between gap-1 rounded-[4px] leading-4"
							>
								<div className="flex size-4 shrink-0 items-center justify-center">
									{getTaskIcon(task.status, task.id)}
								</div>
								<div className={cn(taskTitleBase, "min-w-0")}>
									<CollapsibleText content={task.title} maxLines={2} />
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default TaskList
