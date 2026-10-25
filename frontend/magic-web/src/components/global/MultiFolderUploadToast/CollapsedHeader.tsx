import React, { useEffect, useState, useCallback } from "react"
import { useTheme } from "antd-style"
import { Button, Tooltip, Flex, Progress, Tour, ConfigProvider } from "antd"
import { IconCircleCheck, IconAlertTriangle, IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useSafeArea } from "@/providers/AppearanceProvider/hooks/useSafeArea"
import { useCollapsedHeaderStyles } from "./CollapsedHeader.styles"
import { Upload } from "lucide-react"
import ProgressIndicator from "@/components/base/MagicProgressToast/ProgressIndicator"
import { useMultiFolderUploadActions } from "./useMultiFolderUploadActions"

interface UploadInfo {
	totalFiles: number
	totalProcessedFiles: number
}

interface CollapsedHeaderProps {
	globalProgress: number
	uploadInfo: UploadInfo
	onExpand: () => void
	onClose?: () => void
	dragHandleProps: React.HTMLAttributes<HTMLDivElement>
	containerProps: React.HTMLAttributes<HTMLDivElement>
	isDragging: boolean
	isEnglish: boolean
	resetComponentState: () => void
	completionHint?: {
		open: boolean
		description: string
		onDismiss: () => void
		onDisable: () => void
	}
}

export const CollapsedHeader: React.FC<CollapsedHeaderProps> = observer(
	({
		globalProgress,
		uploadInfo,
		onExpand,
		onClose,
		dragHandleProps,
		containerProps,
		isDragging,
		isEnglish,
		resetComponentState,
		completionHint,
	}) => {
		const { styles, cx } = useCollapsedHeaderStyles()
		const { t } = useTranslation("super")
		const isMobile = useIsMobile()
		const { safeAreaInsetTop } = useSafeArea()
		const theme = useTheme()
		const [expandButton, setExpandButton] = useState<HTMLButtonElement | undefined>()
		const bindExpandButton = useCallback(
			(element: HTMLButtonElement | null) => setExpandButton(element ?? undefined),
			[],
		)
		const [hintHovered, setHintHovered] = useState(false)
		const [hintFocused, setHintFocused] = useState(false)
		useEffect(() => {
			if (!completionHint?.open || hintHovered || hintFocused) return
			const timeoutId = setTimeout(completionHint.onDismiss, 12_000)
			return () => clearTimeout(timeoutId)
		}, [completionHint?.open, completionHint?.onDismiss, hintHovered, hintFocused])

		// 使用共用的操作hooks
		const { handleClose, handleRetry, getSharedState } = useMultiFolderUploadActions({
			resetComponentState,
		})

		// 获取共用的状态信息
		const { hasActiveTasks, allActiveTasksPaused, hasErrors, totalErrorFiles, activeTasks } =
			getSharedState()
		const hasCreatingFolderTasks = activeTasks.some(
			(task) => task.state.currentPhase === "creating_folders",
		)
		// 字节上传已结束但任务仍未完成，说明在等保存/画布消费方处理
		const allActiveUploadsProcessed =
			activeTasks.length > 0 &&
			activeTasks.every((task) => task.state.processedFiles >= task.state.totalFiles)
		const normalizedProgress = Number.isFinite(globalProgress)
			? Math.min(Math.max(globalProgress, 0), 100)
			: 0
		// 文件数量与字节进度各读原统计：一个大文件上传至 66% 时仍是 0/1。
		const fileCount = `${uploadInfo.totalProcessedFiles}/${uploadInfo.totalFiles}`
		const activeProgress = (
			<Flex align="center" gap={10} wrap="wrap">
				<span>{fileCount}</span>
				<Progress
					percent={normalizedProgress}
					showInfo={false}
					className={cx(
						styles.progressBar,
						allActiveTasksPaused && styles.pausedProgress,
					)}
				/>
				<span>{Math.round(normalizedProgress)}%</span>
			</Flex>
		)

		// 获取状态图标和文本
		const getStatusContent = () => {
			if (hasActiveTasks) {
				if (allActiveTasksPaused) {
					// 已暂停状态
					return {
						icon: (
							<span className={styles.pausedIcon}>
								<ProgressIndicator
									value={hasCreatingFolderTasks ? undefined : normalizedProgress}
									icon={<Upload />}
									label={t("folderUpload.collapsed.paused")}
								/>
							</span>
						),
						text: t("folderUpload.collapsed.paused"),
						progress: hasCreatingFolderTasks ? fileCount : activeProgress,
					}
				} else if (hasCreatingFolderTasks) {
					return {
						icon: (
							<span className={styles.progressIcon}>
								<ProgressIndicator
									icon={<Upload />}
									label={t("folderUpload.collapsed.creatingFolders")}
								/>
							</span>
						),
						text: t("folderUpload.collapsed.creatingFolders"),
						progress: `${uploadInfo.totalProcessedFiles}/${uploadInfo.totalFiles}`,
					}
				} else if (allActiveUploadsProcessed) {
					// 上传已结束但任务还在收尾，避免提前显示“上传完成”
					return {
						icon: (
							<span className={styles.progressIcon}>
								<ProgressIndicator
									icon={<Upload />}
									label={t("folderUpload.collapsed.processing")}
								/>
							</span>
						),
						text: t("folderUpload.collapsed.processing"),
						progress: fileCount,
					}
				} else {
					// 上传中状态
					return {
						icon: (
							<span className={styles.progressIcon}>
								<ProgressIndicator
									value={normalizedProgress}
									icon={<Upload />}
									label={t("folderUpload.collapsed.uploading")}
								/>
							</span>
						),
						text: t("folderUpload.collapsed.uploading"),
						progress: activeProgress,
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
			<>
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
							<line
								x1="0.5"
								y1="0"
								x2="0.5"
								y2="20"
								stroke="#e5e7eb"
								strokeWidth="1"
							/>
						</svg>
					</Flex>

					{/* 右侧操作按钮 */}
					<div className={styles.actions}>
						{/* 展开按钮 */}
						<Tooltip title={t("folderUpload.tooltips.expandPanel")}>
							<Button
								ref={bindExpandButton}
								aria-label={t("folderUpload.tooltips.expandPanel")}
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
									const closePanel = onClose ?? handleClose
									closePanel()
								}}
								className={styles.actionButton}
							/>
						</Tooltip>
					</div>
				</div>
				{completionHint?.open && expandButton && (
					<div
						style={{ display: "contents" }}
						onPointerEnter={() => setHintHovered(true)}
						onPointerLeave={() => setHintHovered(false)}
						onFocusCapture={() => setHintFocused(true)}
						onBlurCapture={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget))
								setHintFocused(false)
						}}
						onKeyDownCapture={(event) => {
							if (event.key === "Escape") completionHint.onDismiss()
						}}
					>
						<ConfigProvider
							theme={{
								components: {
									Tour: {
										borderRadiusLG: 12,
										padding: 12,
										boxShadowTertiary: `0 0 0 1px ${theme.colorBorder}, ${theme.boxShadowTertiary}`,
									},
									// 黑色按钮沿用主题交互色；无底部厚阴影，保证文字视觉居中。
									Button: {
										borderRadiusSM: 8,
										controlHeightSM: 28,
										primaryShadow: "none",
										colorPrimaryHover: theme.colorBgSolidHover,
										colorPrimaryActive: theme.colorBgSolidActive,
									},
								},
							}}
						>
							<Tour
								open
								mask={false}
								type="default"
								placement="top"
								arrow={{ pointAtCenter: true }}
								gap={{ offset: 12 }}
								scrollIntoViewOptions={false}
								zIndex={1003}
								closable={{ "aria-label": t("folderUpload.hint.close") }}
								steps={[
									{
										title: t("folderUpload.hint.title"),
										description: completionHint.description,
										target: expandButton,
										style: { width: 260, maxWidth: "calc(100vw - 32px)" },
										nextButtonProps: {
											children: t("folderUpload.hint.expand"),
										},
									},
								]}
								onClose={completionHint.onDismiss}
								onFinish={onExpand}
								actionsRender={(defaultAction) => (
									<>
										<Button
											size="small"
											type="text"
											onClick={completionHint.onDisable}
										>
											{t("folderUpload.hint.disable")}
										</Button>
										{defaultAction}
									</>
								)}
							/>
						</ConfigProvider>
					</div>
				)}
			</>
		)
	},
)

export default CollapsedHeader
