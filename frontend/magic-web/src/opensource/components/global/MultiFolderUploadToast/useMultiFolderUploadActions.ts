import { useTranslation } from "react-i18next"
import { useCallback } from "react"
import { multiFolderUploadStore } from "@/opensource/stores/folderUpload"
import MagicModal from "../../base/MagicModal"
import { useParams } from "react-router"
import superMagicService from "@/opensource/pages/superMagic/services"
import { projectStore } from "@/opensource/pages/superMagic/stores/core"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

/**
 * 多文件夹上传操作的共用hooks
 * 统一管理展开和折叠状态下的共同操作逻辑
 */
export const useMultiFolderUploadActions = ({
	resetComponentState,
}: {
	resetComponentState: () => void
}) => {
	const { t } = useTranslation("super")
	const params = useParams<{ projectId?: string }>()

	/**
	 * 统一的关闭逻辑
	 * - 如果有活跃任务，显示确认对话框
	 * - 用户确认后取消所有活跃任务并清理数据
	 * - 没有活跃任务时直接清理数据
	 */
	const handleClose = useCallback(
		(onConfirmedClose?: () => void) => {
			const { hasActiveTasks } = multiFolderUploadStore

			setTimeout(() => {
				resetComponentState?.()
			}, 300)

			if (hasActiveTasks) {
				// 如果正在上传，显示确认对话框
				MagicModal.confirm({
					title: t("folderUpload.messages.terminateUpload"),
					content: t("folderUpload.messages.terminateUploadContent"),
					onOk: () => {
						// 先执行移动端关闭动画（如果有）
						onConfirmedClose?.()
						// 然后清理所有数据，包括活跃任务和已完成任务
						multiFolderUploadStore.clearAllTasksManually()
					},
					okText: t("common.confirm"),
					cancelText: t("common.cancel"),
					closable: true,
				})
			} else {
				// 没有活跃任务，直接关闭
				multiFolderUploadStore.clearAllTasksManually()
			}
		},
		[resetComponentState, t],
	)

	/**
	 * 重试失败的任务
	 */
	const handleRetry = useCallback((taskId?: string) => {
		if (taskId) {
			// 重试指定任务
			multiFolderUploadStore.retryTask(taskId)
		} else {
			// 重试所有失败的任务
			const { activeTasks, completedTasks } = multiFolderUploadStore
			const allTasks = [...activeTasks, ...completedTasks]
			const failedTasks = allTasks.filter((task) => task.state.errorFiles > 0)

			failedTasks.forEach((task) => {
				multiFolderUploadStore.retryTask(task.id)
			})
		}
	}, [])

	/**
	 * 重试单个失败文件
	 */
	const handleRetryFile = useCallback(
		async (taskId: string, fileName: string, filePath: string): Promise<void> => {
			try {
				const success = await multiFolderUploadStore.retrySingleFile(
					taskId,
					fileName,
					filePath,
				)

				if (success) {
					magicToast.success(t("folderUpload.messages.fileRetrySuccess"))
				} else {
					magicToast.error(t("folderUpload.messages.fileRetryFailed"))
				}
			} catch (error) {
				console.error("Failed to retry file:", error)
				magicToast.error(t("folderUpload.messages.fileRetryFailed"))
			}
		},
		[t],
	)

	/**
	 * 导航到项目
	 */
	const handleNavigateToProject = useCallback(
		async (projectId: string, workspaceId?: string) => {
			const currentWorkspaceId = projectStore.selectedProject?.workspace_id
			const currentProjectId = params.projectId

			if (
				workspaceId &&
				currentWorkspaceId === workspaceId &&
				currentProjectId === projectId
			) {
				return
			}

			try {
				await superMagicService.switchProjectById(projectId, {
					enableErrorMessagePrompt: false,
				})
			} catch (error) {
				magicToast.error(t("folderUpload.errors.switchProjectFailed"))
			}
		},
		[params.projectId, t],
	)

	/**
	 * 查看失败文件列表
	 */
	const handleViewFailedFiles = useCallback(() => {
		// TODO: 实现查看失败文件的逻辑
		// 可以打开一个模态框显示失败文件列表
		console.log("View failed files")
	}, [])

	/**
	 * 暂停所有上传任务
	 */
	const handlePauseAll = useCallback(() => {
		const { activeTasks } = multiFolderUploadStore
		const uploadingTasks = activeTasks.filter(
			(task) => task.state.isUploading && !task.state.isPaused,
		)

		if (uploadingTasks.length === 0) return

		// 直接暂停所有上传任务，不需要二次确认
		uploadingTasks.forEach((task) => {
			multiFolderUploadStore.pauseTask(task.id)
		})
	}, [])

	/**
	 * 继续所有暂停的任务
	 */
	const handleContinueUpload = useCallback(() => {
		const { activeTasks } = multiFolderUploadStore

		activeTasks.forEach((task) => {
			if (task.state.isPaused) {
				multiFolderUploadStore.resumeTask(task.id)
			}
		})
	}, [])

	/**
	 * 获取共用的状态信息
	 */
	const getSharedState = useCallback(() => {
		const { activeTasks, completedTasks, pendingTasks } = multiFolderUploadStore

		// 是否有正在运行的任务
		const hasActiveTasks = activeTasks.length > 0

		// 检测是否所有活跃任务都是暂停状态
		const allActiveTasksPaused =
			hasActiveTasks && activeTasks.every((task) => task.state.isPaused)

		// 计算总体错误状态
		const hasErrors = [...activeTasks, ...completedTasks].some(
			(task) => task.state.errorFiles > 0,
		)

		// 计算总错误文件数
		const totalErrorFiles = [...activeTasks, ...completedTasks].reduce(
			(sum, task) => sum + task.state.errorFiles,
			0,
		)

		return {
			hasActiveTasks, // 使用store的统一逻辑
			allActiveTasksPaused, // 所有活跃任务都是暂停状态
			hasErrors,
			totalErrorFiles,
			activeTasks,
			completedTasks,
			pendingTasks,
		}
	}, [])

	return {
		handleClose,
		handleRetry,
		handleRetryFile,
		handleNavigateToProject,
		handleViewFailedFiles,
		handlePauseAll,
		handleContinueUpload,
		getSharedState,
	}
}

export default useMultiFolderUploadActions
