import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { TaskData } from "@/pages/superMagic/pages/Workspace/types"
import { useStyles } from "./styles"
import StatusIcon from "@/pages/superMagic/components/MessageHeader/components/StatusIcon"
import TaskStatusIcon from "./components/TaskStatusIcon"
import { Divider, Flex } from "antd"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import SuperTooltip from "@/pages/superMagic/components/SuperTooltip"
import { useTheme } from "antd-style"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicIcon from "@/components/base/MagicIcon"

interface TaskListProps {
	taskData: TaskData | null
	className?: string
	style?: React.CSSProperties
	onToggle?: () => void
	mode?: "view" | "default"
}

function TaskList({ taskData, className, style, onToggle, mode }: TaskListProps) {
	const { t } = useTranslation("super")
	const [popupVisible, setPopupVisible] = useState(false)
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const [expanded, setExpanded] = useState(mode === "view")

	// 计算任务完成进度
	const completedTasks = taskData?.process?.filter((task) => task.status === "finished").length

	const totalTasks = taskData?.process?.length
	const { safeAreaInsetBottom } = useTheme()

	// 获取当前任务
	const getCurrentTask = () => {
		if (!taskData?.process?.length) return null

		// 优先查找正在进行中的任务
		const runningTask = taskData.process.find((task) => task.status === "running")
		if (runningTask) return runningTask

		// 查找第一个待处理的任务
		const todoTask = taskData.process.find((task) => task.status === "waiting")
		if (todoTask)
			return {
				...todoTask,
				status: "running",
			}

		// 返回最后一个已完成的任务
		const doneTasks = taskData.process.filter((task) => task.status === "finished")
		if (doneTasks.length > 0) return doneTasks[doneTasks.length - 1]

		return taskData.process[0]
	}

	const currentTask = getCurrentTask()

	const toggleExpanded = () => {
		if (isMobile) {
			setPopupVisible(!popupVisible)
		} else {
			setExpanded(!expanded)
		}
	}

	const handlePopupClose = () => {
		setPopupVisible(false)
	}

	// 任务列表内容
	const TaskListContent = () => (
		<div className={styles.taskListContent}>
			{taskData?.process?.map((task, index) => (
				<>
					<div key={index} className={cx(styles.taskItem, styles.taskListItem)}>
						<div className={styles.taskIconContainer}>
							<TaskStatusIcon status={task.status} size={20} />
						</div>
						<div className={styles.taskContent}>
							<div className={cx(styles.taskTitle, styles.taskListTitle)}>
								{task.title}
							</div>
							{task.content && (
								<div className={styles.taskDescription}>{task.content}</div>
							)}
						</div>
					</div>
					{index !== taskData.process.length - 1 && <Divider />}
				</>
			))}
		</div>
	)

	return (
		<>
			<div className={cx(styles.container, className)} style={style} onClick={toggleExpanded}>
				<div className={styles.taskInfo}>
					<StatusIcon status={currentTask?.status as any} />
					<SuperTooltip title={currentTask?.title}>
						<div className={styles.taskTitle}>{currentTask?.title}</div>
					</SuperTooltip>
				</div>

				<div className={styles.progressInfo}>
					<span className={styles.progressText}>
						{completedTasks}/{totalTasks}
					</span>
				</div>

				<div className={styles.toggleButton} onClick={onToggle}>
					<IconChevronDown size={16} className={styles.chevronIcon} />
				</div>

				{expanded && !isMobile && (
					<Flex vertical className={styles.taskListWrapper}>
						<div
							className={cx(styles.header, expanded && styles.headerExpanded)}
							onClick={toggleExpanded}
						>
							<div
								className={cx(
									styles.headerLeft,
									!expanded && styles.headerLeftCollapsed,
								)}
							>
								<div className={styles.title}>{t("common.taskList")}</div>
							</div>
							{mode === "view" ? null : (
								<div className={styles.headerRight}>
									<div className={styles.progressWrapper}>
										<span className={styles.progressText}>
											{completedTasks} / {totalTasks}
										</span>
									</div>
									<MagicIcon
										size={18}
										component={expanded ? IconChevronDown : IconChevronUp}
									/>
								</div>
							)}
						</div>
						<div className={styles.taskList}>
							{taskData?.process?.map((task) => (
								<div key={task.id} className={styles.taskItem}>
									<StatusIcon status={task.status as any} />
									<SuperTooltip title={task.title}>
										<div className={styles.taskTitle}>{task.title}</div>
									</SuperTooltip>
								</div>
							))}
						</div>
					</Flex>
				)}
			</div>

			<CommonPopup
				title={t("common.taskList")}
				headerExtra={
					<Flex className={styles.progressTitleRight} align="center" gap={4}>
						<span>{completedTasks}</span>
						<span>/</span>
						<span>{totalTasks}</span>
					</Flex>
				}
				popupProps={{
					visible: popupVisible,
					onClose: handlePopupClose,
					onMaskClick: handlePopupClose,

					bodyStyle: {
						height: "auto",
						maxHeight: `calc(100% - ${safeAreaInsetBottom} - 44px)`,
					},
				}}
			>
				<TaskListContent />
			</CommonPopup>
		</>
	)
}

export default TaskList
