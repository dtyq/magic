import React from "react"
import { Button, Tooltip, Flex, Progress } from "antd"
import { IconCircleCheck, IconAlertTriangle, IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useSafeArea } from "@/providers/AppearanceProvider/hooks/useSafeArea"
import { useCollapsedHeaderStyles } from "./CollapsedHeader.styles"
import { MagicLoadingIcon } from "@/components/base/MagicLoadingIcon"
import { useMultiFolderUploadActions } from "./useMultiFolderUploadActions"

interface UploadInfo {
	totalFiles: number
	totalProcessedFiles: number
}

interface CollapsedHeaderProps {
	globalProgress: number
	uploadInfo: UploadInfo
	onExpand: () => void
	dragHandleProps: React.HTMLAttributes<HTMLDivElement>
	containerProps: React.HTMLAttributes<HTMLDivElement>
	isDragging: boolean
	isEnglish: boolean
	resetComponentState: () => void
}

export const CollapsedHeader: React.FC<CollapsedHeaderProps> = observer(
	({
		globalProgress,
		uploadInfo,
		onExpand,
		dragHandleProps,
		containerProps,
		isDragging,
		isEnglish,
		resetComponentState,
	}) => {
		const { styles, cx } = useCollapsedHeaderStyles()
		const { t } = useTranslation("super")
		const isMobile = useIsMobile()
		const { safeAreaInsetTop } = useSafeArea()

		// 使用共用的操作hooks
		const { handleClose, handleRetry, getSharedState } = useMultiFolderUploadActions({
			resetComponentState,
		})

		// 获取共用的状态信息
		const { hasActiveTasks, allActiveTasksPaused, hasErrors, totalErrorFiles } =
			getSharedState()

		// 获取状态图标和文本
		const getStatusContent = () => {
			if (hasActiveTasks) {
				if (allActiveTasksPaused) {
					// 已暂停状态
					return {
						icon: <MagicLoadingIcon size={20} paused={true} />,
						text: t("folderUpload.collapsed.paused"),
						progress: `${uploadInfo.totalProcessedFiles}/${uploadInfo.totalFiles}`,
					}
				} else {
					// 上传中状态
					return {
						icon: <MagicLoadingIcon size={20} />,
						text: t("folderUpload.collapsed.uploading"),
						progress: (
							<Flex align="center" gap={10}>
								<Progress
									percent={globalProgress}
									showInfo={false}
									strokeColor="#315CEC"
									trailColor="rgba(46, 47, 56, 0.13)"
									className={styles.progressBar}
								/>
								<span>{globalProgress}%</span>
							</Flex>
						),
					}
				}
			} else if (hasErrors) {
				// 上传完成但有失败
				return {
					icon: <IconAlertTriangle size={20} className={styles.warningIcon} />,
					text: t("folderUpload.collapsed.completedWithErrors", {
						count: totalErrorFiles,
					}),
					progress: `${uploadInfo.totalProcessedFiles}/${uploadInfo.totalFiles}`,
				}
			} else {
				// 上传完成
				return {
					icon: <IconCircleCheck size={20} className={styles.successIcon} />,
					text: t("folderUpload.collapsed.completed"),
					progress: `${uploadInfo.totalProcessedFiles}/${uploadInfo.totalFiles}`,
				}
			}
		}

		const statusContent = getStatusContent()

		// 计算移动端安全区域偏移
		const getMobileStyle = () => {
			if (!isMobile) return {}

			// 在移动端添加安全区域顶部偏移并水平居中
			return {
				top: `calc(${safeAreaInsetTop} + 40px)`,
				left: "50%",
				transform: "translateX(-50%)",
			}
		}

		return (
			<div
				{...containerProps}
				onMouseDown={dragHandleProps.onMouseDown}
				className={cx(
					styles.collapsedHeader,
					isEnglish && styles.englishLayout,
					isDragging && styles.dragging,
				)}
				style={{
					...containerProps.style,
					...dragHandleProps.style,
					...getMobileStyle(),
					zIndex: 1002,
				}}
			>
				{/* 状态文本和进度 */}
				<Flex className={styles.statusContent} gap={10} align="center">
					{/* 状态图标 */}
					<div className={styles.statusIcon}>{statusContent.icon}</div>
					<div className={styles.statusText}>{statusContent.text}</div>
					<div className={styles.progressText}>{statusContent.progress}</div>

					{/* 重试按钮 - 只在有失败文件且没有活跃任务时显示 */}
					{!hasActiveTasks && hasErrors && (
						<Tooltip title={t("folderUpload.actions.retryFailed")}>
							<Button
								type="text"
								size="small"
								className={styles.retryButton}
								onClick={(e) => {
									e.stopPropagation()
									handleRetry()
								}}
							>
								{t("folderUpload.actions.retry")}
							</Button>
						</Tooltip>
					)}
					{/* 分隔线 */}
					<svg width="1" height="20" viewBox="0 0 1 20">
						<line x1="0.5" y1="0" x2="0.5" y2="20" stroke="#e5e7eb" strokeWidth="1" />
					</svg>
				</Flex>

				{/* 右侧操作按钮 */}
				<div className={styles.actions}>
					{/* 展开按钮 */}
					<Tooltip title={t("folderUpload.tooltips.expandPanel")}>
						<Button
							type="text"
							size="small"
							icon={
								<svg
									width="20"
									height="20"
									viewBox="0 0 20 20"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M8.33203 16.668H3.33203L3.33203 11.668"
										stroke="#1C1D23"
										strokeOpacity="0.8"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M11.668 3.33203L16.668 3.33203V8.33203"
										stroke="#1C1D23"
										strokeOpacity="0.8"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							}
							onClick={(e) => {
								e.stopPropagation()
								onExpand()
							}}
							className={styles.actionButton}
						/>
					</Tooltip>

					{/* 关闭按钮 */}
					<Tooltip title={t("folderUpload.tooltips.closePanel")}>
						<Button
							type="text"
							size="small"
							icon={<IconX size={20} />}
							onClick={(e) => {
								e.stopPropagation()
								handleClose()
							}}
							className={styles.actionButton}
						/>
					</Tooltip>
				</div>
			</div>
		)
	},
)

export default CollapsedHeader
