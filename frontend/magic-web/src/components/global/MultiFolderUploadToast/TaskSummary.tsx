import React from "react"
import { Button } from "antd"
import { useTranslation } from "react-i18next"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import { formatUploadSpeed } from "@/stores/folderUpload/i18nHelpers"
import type { FolderUploadTask } from "@/stores/folderUpload/types"
import { useTaskSummaryStyles } from "./TaskSummary.styles"
import { useMultiFolderUploadActions } from "./useMultiFolderUploadActions"

interface TaskSummaryProps {
	activeTasks: FolderUploadTask[]
	globalProgress: number
	onViewFailedFiles: () => void
	hasFailedFiles: boolean
	resetComponentState: () => void
}

export const TaskSummary: React.FC<TaskSummaryProps> = ({
	activeTasks,
	globalProgress,
	onViewFailedFiles,
	hasFailedFiles,
	resetComponentState,
}) => {
	const { styles, cx } = useTaskSummaryStyles()
	const { t, i18n } = useTranslation("super")

	// 使用共用的操作hooks
	const { handlePauseAll, handleContinueUpload } = useMultiFolderUploadActions({
		resetComponentState,
	})

	// 检测是否为英文环境
	const isEnglish = i18n.language === "en_US" || i18n.language === "en"

	// 计算平均上传速度
	const totalUploadSpeed = activeTasks.reduce((sum, task) => {
		return sum + (task.state.uploadSpeed || 0)
	}, 0)
	const averageSpeed = activeTasks.length > 0 ? totalUploadSpeed / activeTasks.length : 0

	// 统计失败文件数
	const totalErrorFiles = activeTasks.reduce((sum, task) => sum + task.state.errorFiles, 0)
	const completedTasks = multiFolderUploadStore.completedTasks
	const completedErrorFiles = completedTasks.reduce((sum, task) => sum + task.state.errorFiles, 0)
	const totalFailedFiles = totalErrorFiles + completedErrorFiles

	// 统计暂停和上传中的任务
	const pausedTasks = activeTasks.filter((task) => task.state.isPaused).length
	const uploadingTasks = activeTasks.filter(
		(task) => task.state.isUploading && !task.state.isPaused,
	).length

	return (
		<div className={cx(styles.summary, isEnglish && styles.englishLayout)}>
			{/* 进度条覆盖层 */}
			<div
				className={styles.progressOverlay}
				style={{
					width: `${globalProgress}%`,
				}}
			/>

			{/* 左侧：上传速度 */}
			<div className={styles.speedText}>
				{t("folderUpload.stats.uploadSpeed", {
					speed: formatUploadSpeed(averageSpeed),
				})}
			</div>

			{/* 右侧：操作按钮 */}
			<div className={styles.actionButtons}>
				{/* 查看失败文件按钮 - 只有在有失败文件时显示 */}
				{hasFailedFiles && totalFailedFiles > 0 && (
					<Button className={styles.actionButton} onClick={onViewFailedFiles}>
						{t("folderUpload.actions.viewFailedFiles")}
					</Button>
				)}

				{/* 全部暂停按钮 - 只有在有上传中任务时显示 */}
				{uploadingTasks > 0 && (
					<Button className={styles.actionButton} onClick={handlePauseAll}>
						{t("folderUpload.actions.pauseAllTasks")}
					</Button>
				)}

				{/* 继续上传按钮 - 只有在有暂停任务时显示 */}
				{pausedTasks > 0 && (
					<Button className={styles.actionButton} onClick={handleContinueUpload}>
						{t("folderUpload.actions.continueUpload")}
					</Button>
				)}
			</div>
		</div>
	)
}
