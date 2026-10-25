import { useTranslation } from "react-i18next"
import { useCallback, useEffect, useRef, useState } from "react"
import { multiFolderUploadStore } from "@/stores/folderUpload"
import MagicModal from "../../base/MagicModal"
import { useParams } from "react-router"
import superMagicService from "@/pages/superMagic/services"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import { UploadSource } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import { reaction } from "mobx"
import type { FolderUploadTask } from "@/stores/folderUpload/types"
import projectFilesStore from "@/stores/projectFiles"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import {
	registerWaitForNextAttachmentsRefreshForProject,
	waitForNextFullAttachmentsRefreshForProject,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { addFileToCurrentChat, canAddFileToCurrentChat } from "@/pages/superMagic/utils/topics"
import type { FileMentionTargetScope } from "@/pages/superMagic/events/message"
import magicToast from "@/components/base/MagicToaster/utils"

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
	const [pendingAction, setPendingAction] = useState<{
		taskId: string
		action: "locate" | "mention"
	} | null>(null)
	const actionRef = useRef<{ key: string; controller: AbortController } | null>(null)
	const cancelFileAction = useCallback(() => {
		actionRef.current?.controller.abort()
		actionRef.current = null
		setPendingAction(null)
	}, [])
	useEffect(() => {
		const dispose = reaction(
			() => [
				getFileReferenceIdentityKey(),
				projectStore.selectedProject?.id,
				topicStore.selectedTopic?.id,
			],
			cancelFileAction,
		)
		return () => {
			dispose()
			actionRef.current?.controller.abort()
		}
	}, [cancelFileAction])

	const canOperateUploadedTarget = (task: FolderUploadTask) =>
		Boolean(
			task.state.isCompleted &&
			!task.state.isError &&
			task.state.errorFiles === 0 &&
			task.uploadedTarget &&
			task.uploadIdentityKey &&
			task.uploadIdentityKey === getFileReferenceIdentityKey() &&
			!task.options.onlyUpload &&
			!task.options.fileScope &&
			!task.options.silent &&
			task.options.source === UploadSource.ProjectFile,
		)
	const getMentionScope = (task: FolderUploadTask): FileMentionTargetScope | null => {
		if (
			!task.uploadIdentityKey ||
			!canOperateUploadedTarget(task) ||
			task.uploadedTarget?.isDirectory ||
			params.projectId !== task.projectId ||
			projectStore.selectedProject?.id !== task.projectId
		)
			return null
		return {
			projectId: task.projectId,
			topicId: topicStore.selectedTopic?.id || null,
			identityKey: task.uploadIdentityKey,
		}
	}
	const getMentionDisabledReason = (task: FolderUploadTask): string | undefined => {
		if (task.projectId !== params.projectId) return t("folderUpload.actions.switchProjectFirst")
		const scope = getMentionScope(task)
		if (!scope || !canAddFileToCurrentChat(scope))
			return t("folderUpload.actions.noEditableChat")
		return undefined
	}

	const prepareUploadedFile = async (task: FolderUploadTask, signal: AbortSignal) => {
		const isCurrent = () =>
			!signal.aborted &&
			canOperateUploadedTarget(task) &&
			projectStore.selectedProject?.id === task.projectId
		if (!isCurrent()) throw new DOMException("Cancelled", "AbortError")
		const fileId = task.uploadedTarget?.fileId
		if (!fileId) throw new Error("Uploaded target unavailable")
		let item = projectFilesStore.filePresentationIndex.attachments.getItemById(fileId)
		if (!item) {
			const options = { signal }
			if (projectFilesStore.attachmentLoadState?.status === "loading") {
				await registerWaitForNextAttachmentsRefreshForProject(task.projectId, options)
			} else {
				await waitForNextFullAttachmentsRefreshForProject(task.projectId, options)
			}
			if (!isCurrent()) throw new DOMException("Cancelled", "AbortError")
			if (projectFilesStore.attachmentLoadState?.status !== "ready")
				throw new Error("Attachment load failed")
			item = projectFilesStore.filePresentationIndex.attachments.getItemById(fileId)
		}
		if (!item) throw new Error("Uploaded target unavailable")
		return item
	}

	const runFileAction = async (task: FolderUploadTask, action: "locate" | "mention") => {
		const target = task.uploadedTarget
		const identityKey = task.uploadIdentityKey
		if (!target || !identityKey || !canOperateUploadedTarget(task)) return
		const key = `${task.id}:${action}`
		if (actionRef.current?.key === key) return
		cancelFileAction()
		const controller = new AbortController()
		actionRef.current = { key, controller }
		setPendingAction({ taskId: task.id, action })
		try {
			if (action === "locate" && params.projectId !== task.projectId) {
				await superMagicService.switchProjectById(
					task.projectId,
					{ enableErrorMessagePrompt: false },
					undefined,
					{
						uploadedFileTarget: {
							projectId: task.projectId,
							fileId: target.fileId,
							identityKey,
						},
					},
				)
				return
			}
			const scope = action === "mention" ? getMentionScope(task) : null
			if (action === "mention" && (!scope || !canAddFileToCurrentChat(scope))) {
				magicToast.info(t("folderUpload.actions.noEditableChat"))
				return
			}
			const fileItem = await prepareUploadedFile(task, controller.signal)
			if (action === "mention" && scope) {
				await addFileToCurrentChat({ fileItem, autoFocus: true, targetScope: scope })
				return
			}
			await new Promise<void>((resolve, reject) => {
				const finish = (status: "located" | "unavailable" | "cancelled") => {
					clearTimeout(timeoutId)
					controller.signal.removeEventListener("abort", onAbort)
					if (status === "located") resolve()
					else if (status === "cancelled")
						reject(new DOMException("Cancelled", "AbortError"))
					else reject(new Error("Target unavailable in file tree"))
				}
				const onAbort = () => finish("cancelled")
				const timeoutId = setTimeout(() => {
					finish("unavailable")
					controller.abort()
				}, 15_000)
				controller.signal.addEventListener("abort", onAbort, { once: true })
				pubsub.publish(PubSubEvents.Locate_File_In_Tree, target.fileId, {
					projectId: task.projectId,
					exact: true,
					signal: controller.signal,
					onResult: finish,
				})
			})
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError")) {
				magicToast.error(t("folderUpload.actions.targetUnavailable"))
			}
		} finally {
			if (actionRef.current?.controller === controller) {
				actionRef.current = null
				setPendingAction(null)
			}
		}
	}

	/**
	 * 统一的关闭逻辑
	 * - 如果有活跃任务，显示确认对话框
	 * - 用户确认后取消所有活跃任务并清理数据
	 * - 没有活跃任务时直接清理数据
	 */
	const handleClose = useCallback(
		(onConfirmedClose?: () => void) => {
			cancelFileAction()
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
		[resetComponentState, t, cancelFileAction],
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
		const {
			activeTasks: allActiveTasks,
			completedTasks: allCompletedTasks,
			pendingTasks: allPendingTasks,
		} = multiFolderUploadStore

		// 过滤掉静默任务
		const activeTasks = allActiveTasks.filter((task) => !task.options?.silent)
		const completedTasks = allCompletedTasks.filter((task) => !task.options?.silent)
		const pendingTasks = allPendingTasks.filter((task) => !task.options?.silent)

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
		pendingAction,
		canOperateUploadedTarget,
		getMentionDisabledReason,
		handleLocateUploadedTarget: (task: FolderUploadTask) => runFileAction(task, "locate"),
		handleMentionUploadedFile: (task: FolderUploadTask) => runFileAction(task, "mention"),
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
