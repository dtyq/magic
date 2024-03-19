import React from "react"
import { Flex, Progress } from "antd"
import {
	IconAlertTriangle,
	IconExternalLink,
	IconCircleCheck,
	IconTrash,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { formatProjectName } from "@/opensource/stores/folderUpload/i18nHelpers"
import { formatFileSize } from "@/opensource/stores/folderUpload/helpers"
import type { FolderUploadTask } from "@/opensource/stores/folderUpload/types"
import FoldIcon from "@/opensource/pages/superMagic/assets/svg/file-folder.svg"
import { useTaskItemStyles } from "./TaskItem.styles"
import MagicButton from "../../base/MagicButton"
import SmartTooltip from "../../other/SmartTooltip"
import MagicFileIcon from "../../base/MagicFileIcon"

interface TaskItemProps {
	task: FolderUploadTask
	isCompleted?: boolean
	onCancel?: () => void
	onRetry?: () => void
	onNavigateToProject?: (projectId: string, workspaceId?: string) => void
}

export const TaskItem: React.FC<TaskItemProps> = ({
	task,
	isCompleted: _isCompleted = false, // eslint-disable-line @typescript-eslint/no-unused-vars
	onCancel: _onCancel,
	onRetry,
	onNavigateToProject,
}) => {
	const { styles, cx } = useTaskItemStyles()
	const { t, i18n } = useTranslation("super")
	const isMobile = useIsMobile()

	// 检测是否为英文环境
	const isEnglish = i18n.language === "en_US" || i18n.language === "en"

	// 判断是否为单个文件任务
	const isSingleFileTask = () => {
		return task.files.length === 1 && !task.files[0].webkitRelativePath
	}

	// 获取任务名称（文件夹名称或文件名称）
	const getTaskName = () => {
		if (isSingleFileTask()) {
			// 单个文件任务显示文件名
			return task.files[0].name
		}

		// 文件夹任务显示文件夹名称
		if (task.files.length > 0) {
			const firstFile = task.files[0]
			const pathParts = firstFile.webkitRelativePath.split("/")
			return pathParts[0] || firstFile.name // 第一层目录名
		}
		// 如果没有文件，从baseSuffixDir中提取
		const pathParts = task.baseSuffixDir.split("/").filter(Boolean)
		return pathParts[pathParts.length - 1] || "文件夹"
	}

	// 获取文件扩展名（用于文件图标）
	const getFileExtension = () => {
		if (isSingleFileTask()) {
			const fileName = task.files[0].name
			const lastDotIndex = fileName.lastIndexOf(".")
			return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ""
		}
		return ""
	}

	// 格式化上传目标路径（项目名称 + 后缀路径）
	const formatUploadTargetPath = () => {
		const projectName = formatProjectName(task.projectName || "")
		if (!task.baseSuffixDir) {
			return projectName
		}
		// 确保路径格式正确，避免双斜杠
		const cleanSuffix = task.baseSuffixDir.startsWith("/")
			? task.baseSuffixDir
			: `/${task.baseSuffixDir}`
		return `${projectName}${cleanSuffix}`
	}

	// 格式化文件大小
	const formatSizeProgress = () => {
		const uploadedSize = formatFileSize(task.state.uploadedBytes || 0)
		const totalSize = formatFileSize(task.state.totalBytes || 0)
		return `${uploadedSize} / ${totalSize}`
	}

	// 处理点击上传目标
	const handleClickUploadTarget = () => {
		if (onNavigateToProject) {
			onNavigateToProject(task.projectId, task.workspaceId)
		}
	}

	// 处理重试点击
	const handleRetryClick = () => {
		if (onRetry) {
			onRetry()
		}
	}

	const isError = task.state.isError || task.state.errorFiles > 0

	// 渲染状态区域
	const renderStatusSection = () => {
		const { state } = task

		// 上传中 / 暂停状态
		if ((state.isUploading || state.isPaused) && !state.isCompleted && !state.isError) {
			return (
				<div className={styles.statusSection}>
					<Flex align="center" gap={5}>
						{/* antd圆形进度条 */}
						<Progress
							type="circle"
							percent={Math.round(state.progress)}
							size={18}
							strokeColor="#315CEC"
							trailColor="rgba(46, 47, 56, 0.13)"
							strokeWidth={20}
							showInfo={false}
						/>
						{/* 进度百分比 */}
						<span className={styles.progressPercentText}>
							{Math.round(state.progress)}%
						</span>
					</Flex>
				</div>
			)
		}

		// 已完成且无错误
		if (state.isCompleted && !state.isError && state.errorFiles === 0) {
			return (
				<div className={styles.statusSection}>
					<Flex align="center" gap={5}>
						{/* 成功图标 */}
						<IconCircleCheck className={styles.successIcon} color="#32C436" size={18} />
						{/* 成功文字 */}
						<span className={styles.successText}>
							{t("folderUpload.status.completed")}
						</span>
					</Flex>
				</div>
			)
		}

		// 已完成但有错误文件
		if (state.isCompleted && (state.isError || state.errorFiles > 0)) {
			const errorCount = state.errorFiles
			const uploadedCount = state.successFiles || state.totalFiles - state.errorFiles

			// 单个文件任务的错误显示
			if (isSingleFileTask()) {
				const errorMessage = t("folderUpload.messages.retryPrompt")

				return (
					<div className={styles.statusSection}>
						{/* 错误信息文本 */}
						<span className={styles.errorText} onClick={handleRetryClick}>
							{errorMessage}
						</span>
						{/* 重试按钮 */}
						{!isMobile && (
							<button className={styles.retryButton} onClick={handleRetryClick}>
								<IconAlertTriangle className={styles.warningIcon} color="#FF7D00" />
								<span className={styles.retryButtonText}>
									{t("folderUpload.actions.retry")}
								</span>
							</button>
						)}
					</div>
				)
			}

			// 文件夹任务的错误显示（包含计数信息）
			const errorMessage =
				errorCount > 0
					? t("folderUpload.messages.partialFailed", {
							uploaded: uploadedCount,
							count: errorCount,
						})
					: t("folderUpload.messages.retryPrompt")

			return (
				<div className={styles.statusSection}>
					{/* 错误信息文本 */}
					<span className={styles.errorText} onClick={handleRetryClick}>
						{errorMessage}
					</span>
					{/* 重试按钮 */}
					{!isMobile && (
						<button className={styles.retryButton} onClick={handleRetryClick}>
							<IconAlertTriangle className={styles.warningIcon} color="#FF7D00" />
							<span className={styles.retryButtonText}>
								{t("folderUpload.actions.retry")}
							</span>
						</button>
					)}
				</div>
			)
		}

		// 默认状态（等待上传）
		return (
			<div className={styles.statusSection}>
				<div className={styles.pendingContainer}>
					<span className={styles.pendingText}>{t("folderUpload.status.pending")}</span>
					<MagicButton
						icon={<IconTrash size={18} />}
						className={styles.removeTaskButton}
						onClick={_onCancel}
					>
						{t("folderUpload.actions.remove")}
					</MagicButton>
				</div>
			</div>
		)
	}

	return (
		<div className={cx(styles.taskItem, isEnglish && styles.englishLayout)}>
			{/* 左侧区域：图标 + 任务信息 */}
			<div className={styles.leftSection}>
				{/* 文件/文件夹图标 */}
				<div className={styles.iconContainer}>
					{isSingleFileTask() ? (
						<MagicFileIcon type={getFileExtension()} size={32} />
					) : (
						<img
							src={FoldIcon as unknown as string}
							alt="folder"
							width={32}
							height={32}
						/>
					)}
				</div>

				{/* 任务信息 */}
				<div className={styles.taskInfo}>
					{/* 任务名称 */}
					<h4 className={cx(styles.taskName, isError && styles.errorTaskName)}>
						{getTaskName()}
					</h4>

					{/* 详细信息行 */}
					<div className={styles.detailsRow}>
						{/* 进度文本 */}
						<SmartTooltip className={styles.progressText}>
							{formatSizeProgress()}
						</SmartTooltip>

						{/* 上传目标 - 移动端不显示 */}
						{!isMobile && (
							<div className={styles.uploadTarget} onClick={handleClickUploadTarget}>
								<SmartTooltip
									className={cx(
										styles.uploadTargetText,
										isError && styles.errorTargetText,
									)}
								>
									{t("folderUpload.labels.uploadTo", {
										path: formatUploadTargetPath(),
									})}
								</SmartTooltip>
								<IconExternalLink className={styles.externalIcon} />
							</div>
						)}
					</div>
				</div>
			</div>

			{/* 右侧状态区域 */}
			{renderStatusSection()}

			{/* 取消按钮 - 只在非完成状态显示 */}
			{/* {!isCompleted && onCancel && (
				<button className={styles.cancelButton} onClick={onCancel}>
					<IconX size={14} />
				</button>
			)} */}
		</div>
	)
}
