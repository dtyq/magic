import { IconChecks, IconCircleXFilled } from "@tabler/icons-react"
import { useStyles } from "./styles"

// 自定义doing状态的图标组件
const AnimatedDoingIcon = () => {
	const { styles, cx } = useStyles()

	return (
		<div className={cx(styles.doingIconContainer)}>
			<div className={cx(styles.doingIconOuter)} />
			<div className={cx(styles.doingIconPulse)} />
			<div className={cx(styles.doingIconInner)} />
		</div>
	)
}

// 自定义默认图标组件
const DefaultTaskIcon = () => {
	const { styles, cx } = useStyles()

	return (
		<div className={cx(styles.defaultIconContainer)}>
			<div className={cx(styles.defaultIcon)} />
		</div>
	)
}

interface TaskItemProps {
	status?: "waiting" | "running" | "finished" | "error"
	title: string
	taskId?: string
	hasDoingTask?: boolean
	isFirstTodo?: boolean
}

const TaskItem = ({
	status = "waiting",
	title,
	taskId,
	hasDoingTask,
	isFirstTodo,
}: TaskItemProps) => {
	const { styles, cx } = useStyles()

	// 获取任务图标
	const getTaskIcon = (
		currentStatus: string,
		currentTaskId?: string,
		currentHasDoingTask?: boolean,
		currentIsFirstTodo?: boolean,
	) => {
		// 如果当前任务是第一个待处理任务，且没有进行中的任务，显示 doing 图标
		if (
			!currentHasDoingTask &&
			currentIsFirstTodo &&
			currentTaskId &&
			currentStatus === "waiting"
		) {
			return <AnimatedDoingIcon />
		}

		// 原有的逻辑处理
		switch (currentStatus) {
			case "done":
				return <IconChecks className={cx(styles.statusIcon, styles.statusDone)} />
			case "doing":
				return <AnimatedDoingIcon />
			case "error":
				return (
					<IconCircleXFilled
						size={16}
						className={cx(styles.statusIcon, styles.statusError)}
					/>
				)
			default:
				return <DefaultTaskIcon />
		}
	}

	// 获取任务状态样式类名
	const getTaskStatusClassName = (currentStatus: string) => {
		switch (currentStatus) {
			case "finished":
				return styles.taskStatusDone
			case "running":
				return styles.taskStatusDoing
			case "error":
				return styles.taskStatusError
			default:
				return styles.taskStatusTodo
		}
	}

	return (
		<div className={styles.progressWrapper}>
			{getTaskIcon(status, taskId, hasDoingTask, isFirstTodo)}
			<span className={cx(styles.currentTaskText, getTaskStatusClassName(status))}>
				{title}
			</span>
		</div>
	)
}

export default TaskItem
