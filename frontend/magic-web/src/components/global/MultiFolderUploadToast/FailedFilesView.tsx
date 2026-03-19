import React, { useState, useEffect, useMemo } from "react"
import { Button, Tooltip } from "antd"
import { IconX, IconChevronLeft } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import type { FolderUploadTask, FailedFileInfo } from "@/stores/folderUpload/types"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import { FailedFileItem } from "./FailedFileItem"

// 扩展的失败文件信息，包含任务上下文
interface FailedFileItemData extends FailedFileInfo {
	taskId: string
	taskName: string
	projectId: string
	projectName: string
}

interface FailedFilesViewProps {
	// 包含失败文件的任务列表
	failedTasks: FolderUploadTask[]
	// 返回主视图的回调
	onBack: () => void
	// 重试单个失败文件的回调
	onRetryFile: (taskId: string, fileName: string, filePath: string) => Promise<void>
	// 导航到项目的回调
	onNavigateToProject: (projectId: string, workspaceId?: string) => void
	// 从主组件传递的props
	containerProps: React.HTMLAttributes<HTMLDivElement>
	dragHandleProps: React.HTMLAttributes<HTMLDivElement>
	isDragging: boolean
	isEnglish: boolean
	styles: Record<string, string>
	cx: (...args: (string | boolean | undefined)[]) => string
	handleClose: () => void
}

export const FailedFilesView: React.FC<FailedFilesViewProps> = ({
	failedTasks,
	onBack,
	onRetryFile,
	containerProps,
	dragHandleProps,
	isDragging,
	isEnglish,
	styles,
	cx,
	handleClose,
}) => {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const [mobileVisible, setMobileVisible] = useState(false)
	const [retryingFiles, setRetryingFiles] = useState<Set<string>>(new Set())

	// 移动端显示状态管理
	useEffect(() => {
		if (isMobile) {
			setMobileVisible(true)
		}
	}, [isMobile])

	// 提取所有失败文件并附加任务信息
	const failedFilesList = useMemo((): FailedFileItemData[] => {
		const allFailedFiles: FailedFileItemData[] = []

		for (const task of failedTasks) {
			// 获取任务的失败文件列表
			const taskFailedFiles = multiFolderUploadStore.getTaskFailedFiles(task.id)

			// 为每个失败文件附加任务信息
			const filesWithTaskInfo = taskFailedFiles.map((file) => ({
				...file,
				taskId: task.id,
				taskName: task.projectName, // 使用项目名称作为任务名称
				projectId: task.projectId,
				projectName: task.projectName,
			}))

			allFailedFiles.push(...filesWithTaskInfo)
		}

		// 按失败时间倒序排列（最新的失败在前）
		return allFailedFiles.sort((a, b) => b.failedAt - a.failedAt)
	}, [failedTasks])

	// 处理关闭 - 移动端需要先关闭弹窗动画
	const handleMobileClose = () => {
		if (isMobile) {
			setMobileVisible(false)
			// 等待动画完成后再执行真正的关闭逻辑
			setTimeout(() => {
				handleClose()
			}, 300) // 300ms 动画时间
		} else {
			handleClose()
		}
	}

	// 处理返回 - 移动端也需要动画
	const handleMobileBack = () => {
		if (isMobile) {
			setMobileVisible(false)
			// 等待动画完成后再执行返回逻辑
			setTimeout(() => {
				onBack()
			}, 300)
		} else {
			onBack()
		}
	}

	// 处理单文件重试
	const handleRetryFile = async (
		taskId: string,
		fileName: string,
		filePath: string,
	): Promise<void> => {
		const fileKey = `${taskId}_${filePath}_${fileName}`
		setRetryingFiles((prev) => new Set(prev).add(fileKey))

		try {
			await onRetryFile(taskId, fileName, filePath)
		} finally {
			setRetryingFiles((prev) => {
				const next = new Set(prev)
				next.delete(fileKey)
				return next
			})
		}
	}

	// 计算总的失败文件数
	const totalFailedFiles = failedFilesList.length

	// 构建标题内容
	const titleContent = (
		<>
			{/* 返回按钮 */}
			<Button
				type="text"
				size="small"
				icon={<IconChevronLeft size={24} />}
				onClick={handleMobileBack}
				className={styles.backButton}
			>
				{t("common.back")}
			</Button>
			<span>{t("folderUpload.failedFiles.title")}</span>
			<span className={styles.progressCount}>
				{t("folderUpload.failedFiles.fileCount", { count: totalFailedFiles })}
			</span>
		</>
	)

	// 构建头部操作按钮
	const headerActions = (
		<Tooltip title={t("folderUpload.tooltips.closePanel")}>
			<Button
				type="text"
				size="small"
				icon={<IconX size={24} />}
				onClick={handleMobileClose}
			/>
		</Tooltip>
	)

	// 构建失败文件列表内容
	const failedFilesContent = (
		<div className={styles.tasksContainer}>
			{failedFilesList.map((failedFile) => {
				const fileKey = `${failedFile.taskId}_${failedFile.filePath}_${failedFile.fileName}`
				const isRetrying = retryingFiles.has(fileKey)

				return (
					<FailedFileItem
						key={fileKey}
						failedFile={failedFile}
						taskId={failedFile.taskId}
						taskName={failedFile.taskName}
						projectId={failedFile.projectId}
						projectName={failedFile.projectName}
						onRetry={() =>
							handleRetryFile(
								failedFile.taskId,
								failedFile.fileName,
								failedFile.filePath,
							)
						}
						isRetrying={isRetrying}
					/>
				)
			})}
		</div>
	)

	// 移动端使用 CommonPopup
	if (isMobile) {
		return (
			<CommonPopup
				title={<div className={styles.headerTitle}>{titleContent}</div>}
				headerExtra={<div className={styles.headerActions}>{headerActions}</div>}
				popupProps={{
					visible: mobileVisible,
					onClose: handleMobileClose,
					showCloseButton: false,
					bodyStyle: {
						height: "auto",
					},
				}}
			>
				{failedFilesContent}
			</CommonPopup>
		)
	}

	// 桌面端使用原有布局
	return (
		<div
			{...containerProps}
			className={cx(
				styles.container,
				isEnglish && styles.englishLayout,
				isDragging && styles.dragging,
			)}
		>
			{/* 头部汇总 */}
			<div className={styles.header} {...dragHandleProps}>
				<div className={styles.headerTitle}>{titleContent}</div>
				<div className={styles.headerActions}>{headerActions}</div>
			</div>

			{/* 失败文件列表 */}
			{failedFilesContent}
		</div>
	)
}
