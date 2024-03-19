import React, { useState, useEffect, lazy, Suspense } from "react"
import ReactDOM from "react-dom"
import { observer } from "mobx-react-lite"
import { Button, Tooltip } from "antd"
import { IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { multiFolderUploadStore } from "@/opensource/stores/folderUpload"
import { TaskItem } from "./TaskItem"
import { TaskSummary } from "./TaskSummary"
import { CollapsedHeader } from "./CollapsedHeader"
import { MagicLoadingIcon } from "@/opensource/components/base/MagicLoadingIcon"
import { FailedFilesView } from "./FailedFilesView"
import { useStyles } from "./styles"
import { useDraggable } from "./hooks/useDraggable"
import { useMultiFolderUploadActions } from "./useMultiFolderUploadActions"
import successFilled from "@/opensource/pages/superMagic/assets/svg/success-filled.svg"
import editorMiniMizeSvg from "@/opensource/pages/superMagic/assets/svg/editor-minimize.svg"
import { useUpdateEffect } from "ahooks"

const CommonPopup = lazy(() => import("@/opensource/pages/superMagicMobile/components/CommonPopup"))

type ViewType = "main" | "failed"

// 拖拽遮罩层组件 - 防止 iframe 阻塞拖拽事件
const DragOverlay: React.FC<{ isDragging: boolean }> = ({ isDragging }) => {
	if (!isDragging) return null

	const handleOverlayMouseMove = (e: React.MouseEvent) => {
		// 转发 mousemove 事件到 document
		const mouseEvent = new MouseEvent("mousemove", {
			clientX: e.clientX,
			clientY: e.clientY,
			bubbles: true,
			cancelable: true,
		})
		document.dispatchEvent(mouseEvent)
	}

	const handleOverlayMouseUp = (e: React.MouseEvent) => {
		// 转发 mouseup 事件到 document
		const mouseEvent = new MouseEvent("mouseup", {
			clientX: e.clientX,
			clientY: e.clientY,
			bubbles: true,
			cancelable: true,
		})
		document.dispatchEvent(mouseEvent)
	}

	return ReactDOM.createPortal(
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				zIndex: 9999,
				cursor: "grabbing",
				userSelect: "none",
				backgroundColor: "transparent",
			}}
			onMouseMove={handleOverlayMouseMove}
			onMouseUp={handleOverlayMouseUp}
		/>,
		document.body,
	)
}

export const MultiFolderUploadToast: React.FC = observer(() => {
	const { styles, cx } = useStyles()
	const { t, i18n } = useTranslation("super")
	const isMobile = useIsMobile()
	const [collapsed, setCollapsed] = useState(true)
	const [currentView, setCurrentView] = useState<ViewType>("main")
	const [mobileVisible, setMobileVisible] = useState(false)

	const { globalProgress, uploadInfo } = multiFolderUploadStore

	// 重置组件状态的方法
	const resetComponentState = () => {
		setCollapsed(true)
		setCurrentView("main")
		resetToBottomLeft() // 重置位置到左下角
		resetHasBeenDragged()
	}

	// 使用共用的操作hooks
	const {
		handleClose: originalHandleClose,
		handleRetry,
		handleRetryFile,
		handleNavigateToProject,
		getSharedState,
	} = useMultiFolderUploadActions({
		resetComponentState,
	})
	// 获取共用的状态信息
	const { hasActiveTasks, allActiveTasksPaused, activeTasks, completedTasks, pendingTasks } =
		getSharedState()

	// 拖拽功能 - 每次固定在左下角10px
	const {
		containerProps,
		dragHandleProps,
		isDragging,
		adjustPositionToBounds,
		resetToBottomLeft,
		resetHasBeenDragged,
		checkAndAdjustBounds,
	} = useDraggable()

	// 移动端显示状态管理
	useEffect(() => {
		if (isMobile) {
			setMobileVisible(true)
		}
	}, [isMobile])

	// 当有新任务时，确保移动端弹窗显示
	useEffect(() => {
		if (isMobile && (hasActiveTasks || pendingTasks.length > 0)) {
			setMobileVisible(true)
		}
	}, [isMobile, hasActiveTasks, pendingTasks.length])

	// 当总任务数变化时，检查并调整位置边界
	const totalTasks = multiFolderUploadStore.totalTasksCount
	useUpdateEffect(() => {
		if (totalTasks > 0) {
			requestAnimationFrame(() => {
				checkAndAdjustBounds()
			})
		}
	}, [totalTasks])

	// 处理关闭 - 移动端需要先关闭弹窗动画
	const handleClose = () => {
		if (isMobile) {
			// 移动端：如果有活跃任务，需要等待用户确认后再关闭弹窗
			if (hasActiveTasks) {
				// 调用原始关闭逻辑，传入移动端关闭回调
				originalHandleClose(() => {
					// 用户确认关闭后，执行移动端弹窗关闭动画
					setMobileVisible(false)
					// 重置组件状态
					resetComponentState()
				})
			} else {
				// 没有活跃任务，直接关闭弹窗
				setMobileVisible(false)
				setTimeout(() => {
					originalHandleClose()
					// 重置组件状态
					resetComponentState()
				}, 300)
			}
		} else {
			originalHandleClose()
			// 重置组件状态
			resetComponentState()
		}
	}

	// 视图切换处理
	const handleViewFailedFiles = () => {
		setCurrentView("failed")
	}

	const handleBackToMain = () => {
		setCurrentView("main")
	}

	// 处理展开 - 展开时检查边界
	const handleExpand = () => {
		setCollapsed(false)
		// 使用 setTimeout 确保组件完全渲染后再检查边界
		setTimeout(() => {
			adjustPositionToBounds()
		}, 0)
	}

	// 获取包含失败文件的任务
	const failedTasks = [...activeTasks, ...completedTasks].filter(
		(task) => task.state.errorFiles > 0,
	)

	// 检查是否可以关闭（没有活跃任务时才能关闭）
	const canClose = !hasActiveTasks

	// 检测是否为英文环境
	const isEnglish = i18n.language === "en_US" || i18n.language === "en"

	// 动态标题：根据任务状态显示不同标题
	const dynamicTitle = hasActiveTasks
		? allActiveTasksPaused
			? t("folderUpload.titlePaused")
			: t("folderUpload.titleUploading")
		: t("folderUpload.titleCompleted")

	// 过滤任务
	const visibleCompletedTasks = completedTasks
	const totalVisibleTasks =
		activeTasks.length + pendingTasks.length + visibleCompletedTasks.length

	if (!hasActiveTasks && completedTasks.length === 0 && pendingTasks.length === 0) {
		return null
	}

	if (totalVisibleTasks === 0 && collapsed) {
		return (
			<>
				<DragOverlay isDragging={isDragging} />
				<div
					{...containerProps}
					className={cx(
						styles.container,
						isEnglish && styles.englishLayout,
						isDragging && styles.dragging,
					)}
				>
					<div {...dragHandleProps} className={cx(styles.header, styles.collapsed)}>
						<div
							className={styles.headerTitle}
							onClick={() => setCollapsed(!collapsed)}
						>
							{dynamicTitle}
						</div>

						<div className={styles.headerActions}>
							{/* 关闭按钮 - 只有在没有活跃任务时才显示 */}
							{canClose && (
								<Tooltip title={t("folderUpload.tooltips.closePanel")}>
									<Button
										type="text"
										size="small"
										icon={<IconX size={16} />}
										onClick={handleClose}
										className={styles.closeButton}
									/>
								</Tooltip>
							)}
						</div>
					</div>
					<div className={styles.noTasks}>{t("folderUpload.noTasks")}</div>
				</div>
			</>
		)
	}

	const activeTasksCount = activeTasks.length

	// 如果折叠状态，显示专门的折叠头部
	if (collapsed) {
		return (
			<>
				<DragOverlay isDragging={isDragging} />
				<CollapsedHeader
					globalProgress={globalProgress}
					uploadInfo={uploadInfo}
					onExpand={handleExpand}
					dragHandleProps={dragHandleProps}
					containerProps={containerProps}
					isDragging={isDragging}
					isEnglish={isEnglish}
					resetComponentState={resetComponentState}
				/>
			</>
		)
	}

	// 根据当前视图渲染不同内容
	if (currentView === "failed") {
		return (
			<>
				<DragOverlay isDragging={isDragging} />
				<FailedFilesView
					failedTasks={failedTasks}
					onBack={handleBackToMain}
					onRetryFile={handleRetryFile}
					onNavigateToProject={handleNavigateToProject}
					containerProps={containerProps}
					dragHandleProps={dragHandleProps}
					isDragging={isDragging}
					isEnglish={isEnglish}
					styles={styles}
					cx={cx}
					handleClose={handleClose}
				/>
			</>
		)
	}

	// 构建标题内容
	const titleContent = (
		<>
			{/* 状态图标 */}
			{hasActiveTasks ? (
				<MagicLoadingIcon paused={allActiveTasksPaused} />
			) : completedTasks.length > 0 ? (
				<img src={successFilled} alt="" />
			) : null}
			<span>{dynamicTitle}</span>
			<span className={styles.progressCount}>
				{uploadInfo.totalProcessedFiles}/{uploadInfo.totalFiles}
			</span>
			{failedTasks.length > 0 && (
				<div className={styles.viewFailedFilesButton} onClick={handleViewFailedFiles}>
					{t("folderUpload.actions.viewFailedFiles")}
				</div>
			)}
		</>
	)

	// 构建头部操作按钮
	const headerActions = (
		<>
			<Tooltip title={t("folderUpload.tooltips.collapsePanel")}>
				<Button
					type="text"
					size="small"
					icon={<img src={editorMiniMizeSvg} width={24} height={24} alt="" />}
					onClick={() => setCollapsed(true)}
				/>
			</Tooltip>

			<Tooltip title={t("folderUpload.tooltips.closePanel")}>
				<Button type="text" size="small" icon={<IconX size={24} />} onClick={handleClose} />
			</Tooltip>
		</>
	)

	// 构建任务摘要内容（不滚动）
	const taskSummaryContent = activeTasksCount > 0 && (
		<TaskSummary
			activeTasks={activeTasks}
			globalProgress={globalProgress}
			onViewFailedFiles={handleViewFailedFiles}
			hasFailedFiles={failedTasks.length > 0}
			resetComponentState={resetComponentState}
		/>
	)

	// 构建任务列表内容（可滚动）
	const taskItemsContent = (
		<div
			className={cx(
				styles.tasksContainer,
				!taskSummaryContent && styles.tasksContainerWithoutSummary,
			)}
		>
			{/* 活跃任务 */}
			{activeTasks.map((task) => (
				<TaskItem
					key={task.id}
					task={task}
					onCancel={() => multiFolderUploadStore.cancelTask(task.id)}
					onRetry={() => handleRetry(task.id)}
					onNavigateToProject={handleNavigateToProject}
				/>
			))}

			{/* 已完成任务 */}
			{visibleCompletedTasks.map((task) => (
				<TaskItem
					key={task.id}
					task={task}
					isCompleted
					onRetry={() => handleRetry(task.id)}
					onNavigateToProject={handleNavigateToProject}
				/>
			))}

			{/* 等待中任务 */}
			{pendingTasks.map((task) => (
				<TaskItem
					key={task.id}
					task={task}
					onCancel={() => multiFolderUploadStore.cancelTask(task.id)}
					onRetry={() => handleRetry(task.id)}
					onNavigateToProject={handleNavigateToProject}
				/>
			))}
		</div>
	)

	// 移动端使用 CommonPopup
	if (isMobile) {
		return (
			<Suspense fallback={null}>
				<CommonPopup
					title={<div className={styles.headerTitle}>{titleContent}</div>}
					headerExtra={<div className={styles.headerActions}>{headerActions}</div>}
					popupProps={{
						visible: mobileVisible,
						onClose: handleClose,
						showCloseButton: false,
						bodyStyle: {
							height: "auto",
						},
					}}
				>
					{/* 任务摘要（不滚动） */}
					{taskSummaryContent}
					{/* 任务列表（可滚动） */}
					{taskItemsContent}
				</CommonPopup>
			</Suspense>
		)
	}

	// 桌面端使用原有布局
	return (
		<>
			<DragOverlay isDragging={isDragging} />
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

				{/* 任务摘要（不滚动） */}
				{taskSummaryContent}

				{/* 任务列表（可滚动） */}
				{taskItemsContent}
			</div>
		</>
	)
})

export default MultiFolderUploadToast
