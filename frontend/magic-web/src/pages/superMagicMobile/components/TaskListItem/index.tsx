import { memo } from "react"
import { createStyles, cx, keyframes } from "antd-style"
import type { TaskProcess } from "@/pages/superMagic/pages/Workspace/types"
import { IconChecks, IconCircleCheck, IconCircleXFilled } from "@tabler/icons-react"

interface TaskListItemProps {
	process?: TaskProcess[]
	data: TaskProcess
	className?: string
	style?: React.CSSProperties
}

// 创建一个更加明显的脉冲动画
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.6);
    opacity: 0.4;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
`

const useStyles = createStyles(({ token }) => {
	return {
		taskListItem: {
			display: "flex",
			alignItems: "center",
		},
		icon: {
			flex: "none",
		},
		name: {
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			marginLeft: 10,
		},
		doingIconContainer: {
			position: "relative",
			width: "14px",
			height: "14px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},
		doingIconOuter: {
			position: "absolute",
			width: "14px",
			height: "14px",
			borderRadius: "50%",
			backgroundColor: "rgba(255, 236, 204, 1)",
		},
		doingIconInner: {
			position: "absolute",
			width: "8px",
			height: "8px",
			borderRadius: "50%",
			backgroundColor: "rgba(255, 125, 0, 1)",
			zIndex: 1,
		},
		doingIconPulse: {
			position: "absolute",
			width: "14px",
			height: "14px",
			borderRadius: "50%",
			backgroundColor: "rgba(255, 180, 100, 0.8)",
			animation: `${pulseAnimation} 1.5s infinite`,
			zIndex: 0,
		},
		defaultIconContainer: {
			position: "relative",
			width: "18px",
			height: "18px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},
		defaultIcon: {
			width: "14px",
			height: "14px",
			borderRadius: "50%",
			backgroundColor: "rgba(46, 47, 56, 0.05)",
		},
		statusIcon: {
			width: "13.5px",
			height: "13.5px",
			fontSize: "16px",
		},
		statusError: {
			color: token.colorError,
		},
		statusDone: {
			width: "18px",
			height: "18px",
			color: token.colorSuccess,
		},
	}
})

export default memo(function TaskListItem(props: TaskListItemProps) {
	const { process, data, className, style } = props
	const { styles } = useStyles()

	const getAnimatedDoingIcon = () => {
		return (
			<div className={cx(styles.doingIconContainer)}>
				<div className={cx(styles.doingIconOuter)} />
				<div className={cx(styles.doingIconPulse)} />
				<div className={cx(styles.doingIconInner)} />
			</div>
		)
	}

	// 获取任务图标
	const getTaskIcon = (status: string, taskId?: string) => {
		// 检查是否有正在进行中的任务
		const hasDoingTask = process?.some((task) => task.status === "waiting")

		// 如果没有正在进行中的任务，查找第一个待处理任务
		const firstTodoTask = !hasDoingTask
			? process?.find((task) => task.status === "waiting")
			: null

		// 如果当前任务是第一个待处理任务，且没有进行中的任务，显示 waiting 图标
		if (
			!hasDoingTask &&
			firstTodoTask &&
			taskId &&
			taskId === firstTodoTask.id &&
			status === "waiting"
		) {
			return getAnimatedDoingIcon()
		}

		const expanded = false

		// 原有的逻辑处理
		switch (status) {
			case "finished":
				return expanded ? (
					<IconCircleCheck
						className={cx(styles.statusIcon, styles.statusDone)}
						stroke={1.5}
					/>
				) : (
					<IconChecks className={cx(styles.statusDone)} stroke={1.5} />
				)
			case "waiting":
				return getAnimatedDoingIcon()
			case "error":
				return (
					<IconCircleXFilled
						size={16}
						className={cx(styles.statusIcon, styles.statusError)}
					/>
				)
			default:
				return (
					<div className={cx(styles.defaultIconContainer)}>
						<div className={cx(styles.defaultIcon)} />
					</div>
				)
		}
	}

	return (
		<div className={cx(styles.taskListItem, className)} style={style}>
			<div className={styles.icon}>{getTaskIcon(data.status, data.id)}</div>
			<div className={styles.name}>{data.title}</div>
		</div>
	)
})
