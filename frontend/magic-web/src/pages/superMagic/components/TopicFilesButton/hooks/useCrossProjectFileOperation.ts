import { createElement, useState, useCallback, useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "./index"
import type { ProjectListItem, Workspace } from "../../../pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import { detectDuplicateFilesForMove } from "../utils/moveOrCopyDuplicateHandler"
import {
	collectSameParentOperationIds,
	detectFolderConflictsForMove,
} from "../utils/folderConflictHandler"
import { useMoveOrCopyDuplicateHandler } from "./useMoveOrCopyDuplicateHandler"
import { useFolderConflictHandler } from "./useFolderConflictHandler"
import magicToast from "@/components/base/MagicToaster/utils"
import MagicModal from "@/components/base/MagicModal"
import { IconAlertTriangleFilled } from "@tabler/icons-react"
import {
	detectCanvasProjectOperationRisk,
	getCanvasProjectOperationImpact,
	type CanvasProjectOperationRisk,
} from "../utils/canvasProjectOperationRisk"
import {
	mergeStaticDependencyFileIds,
	resolveSingleDocumentStaticDependencies,
} from "@/pages/superMagic/utils/staticDependencies"
import { useCanvasFileOperationGuard } from "./useCanvasFileOperationGuard"
import {
	resolveCanvasOperationConfirmTitleKey,
	type CanvasProjectPathRepairResult,
} from "@/pages/superMagic/components/Detail/contents/Design/utils/canvasProjectPathRepair"
import type { FileScope } from "@/apis/modules/fileScope"
import type { ConfirmFileOperation, FileOperationPreparation } from "./types"
import { buildAttachmentIndex } from "../utils/attachmentIndex"
import { getFileManagerChangedIds, getFileManagerTransferIds } from "../utils/file-manager-transfer"

export interface CrossProjectOperationSuccessResult {
	operationType: "move" | "copy"
	fileIds: string[]
	targetProjectId: string
	targetParentId?: string
	targetWorkspaceId?: string
	targetProjectName?: string
}

interface UseCrossProjectFileOperationOptions {
	confirmOperation?: ConfirmFileOperation
	isCurrent?: () => boolean
	fileScope?: FileScope
	projectId?: string
	shareCode?: string
	sharePassword?: string
	selectedWorkspace: Workspace | null
	selectedProject: ProjectListItem | null
	projects: ProjectListItem[]
	onSuccess?: (result?: CrossProjectOperationSuccessResult) => void
}

interface EffectiveOperationFileIdsResult {
	fileIds: string[]
	dependencyAnalysisFailed: boolean
}

async function resolveEffectiveOperationFileIds({
	fileIds,
	sourceAttachments,
	includeDocumentDependencies = true,
	documentDependencyFileIds,
	signal,
}: {
	fileIds: string[]
	sourceAttachments: AttachmentItem[]
	includeDocumentDependencies?: boolean
	documentDependencyFileIds?: string[]
	signal?: AbortSignal
}): Promise<EffectiveOperationFileIdsResult> {
	signal?.throwIfAborted()
	if (!includeDocumentDependencies) {
		return {
			fileIds: mergeStaticDependencyFileIds(fileIds, [], false),
			dependencyAnalysisFailed: false,
		}
	}

	if (documentDependencyFileIds !== undefined) {
		return {
			fileIds: mergeStaticDependencyFileIds(fileIds, documentDependencyFileIds, true),
			dependencyAnalysisFailed: false,
		}
	}

	try {
		const { dependencyTransferFileIds } = await resolveSingleDocumentStaticDependencies({
			fileIds,
			attachments: sourceAttachments,
			signal,
		})
		return {
			fileIds: mergeStaticDependencyFileIds(fileIds, dependencyTransferFileIds, true),
			dependencyAnalysisFailed: false,
		}
	} catch (error) {
		signal?.throwIfAborted()
		// Dependency enrichment must not turn an existing file operation into a hard failure.
		console.error("Failed to resolve document static dependencies for file operation:", error)
		return {
			fileIds: mergeStaticDependencyFileIds(fileIds, [], false),
			dependencyAnalysisFailed: true,
		}
	}
}

export function useCrossProjectFileOperation(options: UseCrossProjectFileOperationOptions) {
	const { projectId, shareCode, sharePassword, onSuccess, fileScope, confirmOperation } = options
	const { t } = useTranslation("super")
	const { runCanvasFileOperationPreflight, commitCanvasFileOperationRepair } =
		useCanvasFileOperationGuard()

	const mounted = useRef(true)
	const pollingTimers = useRef(new Set<ReturnType<typeof setInterval>>())
	const isCurrent = useMemoizedFn(
		() => (fileScope !== "user" || mounted.current) && (options.isCurrent?.() ?? true),
	)
	const stopPolling = useMemoizedFn((timer: ReturnType<typeof setInterval>) => {
		clearInterval(timer)
		pollingTimers.current.delete(timer)
	})
	// 个人复制关闭页面后停止轮询；项目流程保留原有轮询，以完成 Canvas 等后续处理。
	useEffect(() => {
		mounted.current = true
		const timers = pollingTimers.current
		return () => {
			mounted.current = false
			if (fileScope === "user") {
				for (const timer of timers) clearInterval(timer)
				timers.clear()
			}
		}
	}, [fileScope])

	const [visible, setVisible] = useState(false)
	const [operationType, setOperationType] = useState<"move" | "copy">("move")
	const [fileIds, setFileIds] = useState<string[]>([])
	const [initialPath, setInitialPath] = useState<AttachmentItem[]>([])
	const [isOperating, setIsOperating] = useState(false)
	const [operationProgress, setOperationProgress] = useState(0)

	// 集成同名检测 Hook
	const duplicateHandler = useMoveOrCopyDuplicateHandler()
	const folderConflictHandler = useFolderConflictHandler()

	const openMoveModal = useCallback((ids: string[], path?: AttachmentItem[]) => {
		setFileIds(ids)
		setOperationType("move")
		setInitialPath(path || [])
		setVisible(true)
	}, [])

	const openCopyModal = useCallback((ids: string[], path?: AttachmentItem[]) => {
		setFileIds(ids)
		setOperationType("copy")
		setInitialPath(path || [])
		setVisible(true)
	}, [])

	const closeModal = useCallback(() => {
		setVisible(false)
		setFileIds([])
		setOperationProgress(0)
	}, [])

	const handleOperationPolling = useCallback(
		(
			batchKey: string,
			operationType: "move" | "copy",
			completedFileIds: string[],
			target: {
				targetProjectId: string
				targetParentId?: string
				targetWorkspaceId?: string
				targetProjectName?: string
			},
			repairPlan: CanvasProjectPathRepairResult | null,
		) => {
			const timer = setInterval(async () => {
				if (!isCurrent()) {
					stopPolling(timer)
					return
				}
				try {
					const checkData = await SuperMagicApi.checkBatchOperationStatus(batchKey)
					if (!isCurrent()) {
						stopPolling(timer)
						return
					}

					if (checkData.status === "processing") {
						const progress = checkData.progress ? parseInt(checkData.progress) : 0
						setOperationProgress(progress)
					} else if (checkData.status === "success") {
						await commitCanvasFileOperationRepair(repairPlan)
						setOperationProgress(100)
						if (operationType === "move" || !shareCode) {
							magicToast.success(
								operationType === "move"
									? t("topicFiles.success.fileMoved")
									: t("topicFiles.success.fileCopied"),
							)
						}
						stopPolling(timer)
						setTimeout(() => {
							if (!isCurrent()) return
							setIsOperating(false)
							setOperationProgress(0)
							closeModal()
							onSuccess?.({ operationType, fileIds: completedFileIds, ...target })
						}, 500)
					} else if (checkData.status === "failed") {
						magicToast.error(
							checkData.message ||
								(operationType === "move"
									? t("topicFiles.error.moveFileFailed")
									: t("topicFiles.error.copyFileFailed")),
						)
						stopPolling(timer)
						setIsOperating(false)
						setOperationProgress(0)
					} else {
						stopPolling(timer)
						setIsOperating(false)
						setOperationProgress(0)
					}
				} catch (error) {
					if (!isCurrent()) {
						stopPolling(timer)
						return
					}
					console.error("检查操作状态失败:", error)
					magicToast.error(
						operationType === "move"
							? t("topicFiles.error.moveFileFailed")
							: t("topicFiles.error.copyFileFailed"),
					)
					stopPolling(timer)
					setIsOperating(false)
					setOperationProgress(0)
				}
			}, 2000)
			pollingTimers.current.add(timer)
		},
		[
			closeModal,
			commitCanvasFileOperationRepair,
			onSuccess,
			shareCode,
			t,
			isCurrent,
			stopPolling,
		],
	)

	const confirmCanvasProjectRisk = useCallback(
		(
			canvasRisk: CanvasProjectOperationRisk,
			repairFailures: string[] = [],
			signal?: AbortSignal,
		) =>
			new Promise<boolean>((resolve) => {
				if (signal?.aborted) {
					resolve(false)
					return
				}
				const finish = (accepted: boolean) => {
					signal?.removeEventListener("abort", abort)
					resolve(accepted)
				}
				const abort = () => {
					modal.destroy()
					finish(false)
				}
				const impact = getCanvasProjectOperationImpact(canvasRisk)
				const riskContent =
					canvasRisk.shouldWarn && impact
						? t(
								impact === "open-failure"
									? "topicFiles.canvasOperationRisk.moveOpenFailureContent"
									: impact === "content-loss"
										? "topicFiles.canvasOperationRisk.moveContentLossContent"
										: "topicFiles.canvasOperationRisk.moveMixedContent",
							)
						: ""
				const repairContent = repairFailures.length
					? t("topicFiles.canvasOperationRisk.pathRepairFailureContent", {
							failures: repairFailures.join("\n"),
						})
					: ""
				const modal = MagicModal.confirm({
					title: t(
						resolveCanvasOperationConfirmTitleKey({
							requiresCanvasRisk: canvasRisk.shouldWarn,
							hasPathRepairFailures: repairFailures.length > 0,
						}),
					),
					content: [riskContent, repairContent].filter(Boolean).join("\n\n"),
					icon: createElement(IconAlertTriangleFilled, {
						size: 20,
						color: "rgba(255,125,0, 1)",
						style: { marginRight: 6, lineHeight: 20, flexShrink: 0 },
					}),
					okButtonProps: {
						color: "danger",
						variant: "solid",
					},
					cancelButtonProps: {
						color: "default",
						variant: "filled",
					},
					okText: t("topicFiles.moveModal.confirm"),
					cancelText: t("common.cancel"),
					onOk: () => finish(true),
					onCancel: () => finish(false),
				})
				signal?.addEventListener("abort", abort, { once: true })
			}),
		[t],
	)

	const executeMoveOperation = useCallback(
		async (data: {
			targetProjectId: string
			targetWorkspaceId?: string
			targetProject?: ProjectListItem
			targetPath: AttachmentItem[]
			targetAttachments: AttachmentItem[]
			sourceAttachments: AttachmentItem[]
			fileIds?: string[]
			includeDocumentDependencies?: boolean
			documentDependencyFileIds?: string[]
			preserveParentPath?: boolean
			preparation?: FileOperationPreparation
		}) => {
			const preparation = data.preparation
			preparation?.signal.throwIfAborted()
			const sourceIndex = confirmOperation
				? buildAttachmentIndex(data.sourceAttachments)
				: undefined
			const requestedIds = data.fileIds ?? fileIds
			const selectedIds = sourceIndex
				? getFileManagerTransferIds(requestedIds, sourceIndex)
				: requestedIds
			const changedIds =
				sourceIndex && data.targetProjectId === projectId
					? getFileManagerChangedIds(
							selectedIds,
							sourceIndex,
							"",
							data.targetPath.at(-1)?.file_id ?? "",
							"move",
						)
					: selectedIds
			if (confirmOperation && !changedIds.length) return
			const resolved = await resolveEffectiveOperationFileIds({
				fileIds: changedIds,
				sourceAttachments: data.sourceAttachments,
				includeDocumentDependencies: data.includeDocumentDependencies,
				documentDependencyFileIds: data.documentDependencyFileIds,
				signal: preparation?.signal,
			})
			preparation?.signal.throwIfAborted()
			let effectiveFileIds = resolved.fileIds
			const { dependencyAnalysisFailed } = resolved
			if (dependencyAnalysisFailed) {
				magicToast.warning(t("share.documentDependenciesAnalysisFailed"))
			}
			if (!projectId || effectiveFileIds.length === 0) return
			if (sourceIndex && data.targetProjectId === projectId) {
				effectiveFileIds = getFileManagerChangedIds(
					effectiveFileIds,
					sourceIndex,
					"",
					data.targetPath.at(-1)?.file_id ?? "",
					"move",
				)
				if (!effectiveFileIds.length) return
			}
			const shouldPreserveParentPath =
				data.preserveParentPath === true &&
				data.targetProjectId !== projectId &&
				(data.fileIds || fileIds).length > 1

			let keepBothIds =
				data.targetProjectId === projectId
					? collectSameParentOperationIds(
							effectiveFileIds,
							data.sourceAttachments,
							data.targetPath,
						)
					: []
			const conflictDetectionIds = effectiveFileIds.filter((id) => !keepBothIds.includes(id))
			let canvasRisk: CanvasProjectOperationRisk = {
				shouldWarn: false,
				riskTypes: [],
				affectedProjectNames: [],
			}
			if (conflictDetectionIds.length > 0) {
				canvasRisk = await detectCanvasProjectOperationRisk({
					attachments: data.sourceAttachments,
					fileIds: conflictDetectionIds,
					operation: "move",
				})
			}
			preparation?.signal.throwIfAborted()
			const preflightResult = await runCanvasFileOperationPreflight({
				repairOptions: {
					attachments: data.sourceAttachments,
					fileIds: effectiveFileIds,
					operation: "move",
					projectId,
					signal: preparation?.signal,
				},
				requiresConfirmation: canvasRisk.shouldWarn,
				confirm: (repairPlan) => {
					preparation?.signal.throwIfAborted()
					preparation?.onPhase("awaitingChoice")
					return confirmCanvasProjectRisk(
						canvasRisk,
						repairPlan?.failures.map(
							(failure) =>
								`${failure.projectName} / ${failure.fileName}: ${failure.message}`,
						) ?? [],
						preparation?.signal,
					)
				},
				beforeCommit: async () => {
					preparation?.signal.throwIfAborted()
					const folderConflicts =
						conflictDetectionIds.length > 0
							? detectFolderConflictsForMove(
									conflictDetectionIds,
									data.sourceAttachments,
									data.targetAttachments,
									data.targetPath,
								)
							: new Map()
					if (folderConflicts.size > 0) {
						preparation?.onPhase("awaitingChoice")
						const folderChoice =
							await folderConflictHandler.checkConflicts(folderConflicts)
						preparation?.signal.throwIfAborted()
						preparation?.onPhase("checking")
						if (!folderChoice.shouldProceed) return false
						keepBothIds = [...keepBothIds, ...folderChoice.keepBothIds]
					}

					const duplicateDetectionIds = effectiveFileIds.filter(
						(id) => !keepBothIds.includes(id),
					)
					const duplicates =
						duplicateDetectionIds.length > 0
							? detectDuplicateFilesForMove(
									duplicateDetectionIds,
									data.sourceAttachments,
									data.targetAttachments,
									data.targetPath,
								)
							: new Map()

					if (duplicates.size > 0) {
						preparation?.onPhase("awaitingChoice")
						const userChoice = await duplicateHandler.checkDuplicates(duplicates)
						preparation?.signal.throwIfAborted()
						preparation?.onPhase("checking")
						if (!userChoice.shouldProceed) return false
						keepBothIds = [...keepBothIds, ...userChoice.keepBothIds]
					}

					return true
				},
			})
			preparation?.signal.throwIfAborted()
			if (!preflightResult.ok) return
			preparation?.onPhase("awaitingChoice")
			if (
				confirmOperation &&
				!(await confirmOperation({
					operation: "move",
					fileIds: effectiveFileIds,
					selectedIds: data.fileIds ?? fileIds,
					sourceAttachments: data.sourceAttachments,
					targetPath: data.targetPath,
					targetName: data.targetProject?.project_name,
					skippedCount: selectedIds.length - changedIds.length,
				}))
			)
				return

			// 3. 执行移动操作
			preparation?.signal.throwIfAborted()
			preparation?.onPhase("executing")
			setIsOperating(true)
			setOperationProgress(0)

			try {
				const targetParentId =
					data.targetPath.length > 0
						? data.targetPath[data.targetPath.length - 1].file_id || ""
						: ""

				let result

				// 区分单文件移动和批量移动
				if (effectiveFileIds.length === 1) {
					// 使用单文件移动接口（moveFile）
					result = await SuperMagicApi.moveFile({
						file_id: effectiveFileIds[0],
						target_parent_id: targetParentId,
						project_id: projectId,
						target_project_id: data.targetProjectId,
						keep_both_file_ids: keepBothIds,
					})
				} else {
					// 使用批量移动接口（moveFiles）
					result = await SuperMagicApi.moveFiles({
						file_ids: effectiveFileIds,
						project_id: projectId,
						target_project_id: data.targetProjectId,
						target_parent_id: targetParentId,
						pre_file_id: "",
						keep_both_file_ids: keepBothIds,
						...(shouldPreserveParentPath ? { preserve_parent_path: true } : {}),
					})
				}

				if (result.status === "success") {
					await commitCanvasFileOperationRepair(preflightResult.repairPlan)
					setOperationProgress(100)
					magicToast.success(t("topicFiles.success.fileMoved"))
					setTimeout(() => {
						setIsOperating(false)
						setOperationProgress(0)
						closeModal()
						onSuccess?.({
							operationType: "move",
							fileIds: effectiveFileIds,
							targetProjectId: data.targetProjectId,
							targetWorkspaceId:
								data.targetWorkspaceId || data.targetProject?.workspace_id,
							targetProjectName: data.targetProject?.project_name,
						})
					}, 500)
					return
				}

				if (result.status === "processing" && result.batch_key) {
					handleOperationPolling(
						result.batch_key,
						"move",
						effectiveFileIds,
						{
							targetProjectId: data.targetProjectId,
							targetWorkspaceId:
								data.targetWorkspaceId || data.targetProject?.workspace_id,
							targetProjectName: data.targetProject?.project_name,
						},
						preflightResult.repairPlan,
					)
				}
			} catch (error) {
				console.error("移动文件失败:", error)
				magicToast.error(t("topicFiles.error.moveFileFailed"))
				setIsOperating(false)
				setOperationProgress(0)
			}
		},
		[
			fileIds,
			projectId,
			closeModal,
			onSuccess,
			t,
			handleOperationPolling,
			confirmCanvasProjectRisk,
			duplicateHandler,
			folderConflictHandler,
			commitCanvasFileOperationRepair,
			runCanvasFileOperationPreflight,
			confirmOperation,
		],
	)

	const executeCopyOperation = useCallback(
		async (data: {
			targetProjectId: string
			targetWorkspaceId?: string
			targetProject?: ProjectListItem
			targetPath: AttachmentItem[]
			targetAttachments: AttachmentItem[]
			sourceAttachments: AttachmentItem[]
			fileIds?: string[]
			includeDocumentDependencies?: boolean
			documentDependencyFileIds?: string[]
			preserveParentPath?: boolean
			preparation?: FileOperationPreparation
		}) => {
			const preparation = data.preparation
			preparation?.signal.throwIfAborted()
			const { fileIds: effectiveFileIds, dependencyAnalysisFailed } =
				await resolveEffectiveOperationFileIds({
					fileIds: data.fileIds ?? fileIds,
					sourceAttachments: data.sourceAttachments,
					includeDocumentDependencies:
						fileScope === "user" ? false : data.includeDocumentDependencies,
					documentDependencyFileIds: data.documentDependencyFileIds,
					signal: preparation?.signal,
				})
			preparation?.signal.throwIfAborted()
			if (!isCurrent()) return
			if (dependencyAnalysisFailed) {
				magicToast.warning(t("share.documentDependenciesAnalysisFailed"))
			}
			if ((!projectId && fileScope !== "user") || effectiveFileIds.length === 0) return
			const shouldPreserveParentPath =
				data.preserveParentPath === true &&
				data.targetProjectId !== projectId &&
				(data.fileIds ?? fileIds).length > 1

			let keepBothIds =
				fileScope === "user" || data.targetProjectId === projectId
					? collectSameParentOperationIds(
							effectiveFileIds,
							data.sourceAttachments,
							data.targetPath,
						)
					: []
			const conflictDetectionIds = effectiveFileIds.filter((id) => !keepBothIds.includes(id))

			const folderConflicts =
				conflictDetectionIds.length > 0
					? detectFolderConflictsForMove(
							conflictDetectionIds,
							data.sourceAttachments,
							data.targetAttachments,
							data.targetPath,
						)
					: new Map()

			if (folderConflicts.size > 0) {
				preparation?.onPhase("awaitingChoice")
				const folderChoice = await folderConflictHandler.checkConflicts(folderConflicts)
				preparation?.signal.throwIfAborted()
				preparation?.onPhase("checking")
				if (!folderChoice.shouldProceed) {
					return
				}
				keepBothIds = [...keepBothIds, ...folderChoice.keepBothIds]
			}

			// 1. Check duplicates. "Keep both" renames the top folder, so skip inner paths.
			const duplicateDetectionIds = effectiveFileIds.filter((id) => !keepBothIds.includes(id))
			const duplicates =
				duplicateDetectionIds.length > 0
					? detectDuplicateFilesForMove(
							duplicateDetectionIds,
							data.sourceAttachments,
							data.targetAttachments,
							data.targetPath,
						)
					: new Map()

			// 2. 如果有同名，显示 Modal 并等待用户选择
			if (duplicates.size > 0) {
				preparation?.onPhase("awaitingChoice")
				const userChoice = await duplicateHandler.checkDuplicates(duplicates)
				preparation?.signal.throwIfAborted()
				preparation?.onPhase("checking")
				if (!userChoice.shouldProceed) {
					return // 用户取消
				}
				keepBothIds = [...keepBothIds, ...userChoice.keepBothIds]
			}

			if (!isCurrent()) return

			preparation?.signal.throwIfAborted()
			preparation?.onPhase("awaitingChoice")
			// 4. 执行复制操作
			if (
				confirmOperation &&
				!(await confirmOperation({
					operation: "copy",
					fileIds: effectiveFileIds,
					selectedIds: data.fileIds ?? fileIds,
					sourceAttachments: data.sourceAttachments,
					targetPath: data.targetPath,
					targetName: data.targetProject?.project_name,
				}))
			)
				return
			if (!isCurrent()) return
			preparation?.signal.throwIfAborted()
			preparation?.onPhase("executing")
			setIsOperating(true)
			setOperationProgress(0)

			try {
				const targetParentId =
					data.targetPath.length > 0
						? data.targetPath[data.targetPath.length - 1].file_id || ""
						: ""

				const result = shareCode
					? await SuperMagicApi.copyShareFiles({
							shareCode,
							pwd: sharePassword,
							file_ids: effectiveFileIds,
							target_project_id: data.targetProjectId,
							target_parent_id: targetParentId,
							pre_file_id: "",
							keep_both_file_ids: keepBothIds,
							...(shouldPreserveParentPath ? { preserve_parent_path: true } : {}),
						})
					: await SuperMagicApi.copyFiles({
							file_ids: effectiveFileIds,
							project_id: fileScope === "user" ? "0" : projectId,
							target_project_id:
								fileScope === "user" ? undefined : data.targetProjectId,
							target_parent_id: targetParentId,
							pre_file_id: "",
							keep_both_file_ids: keepBothIds,
							...(shouldPreserveParentPath ? { preserve_parent_path: true } : {}),
						})

				if (!isCurrent()) return
				if (result.status === "success") {
					setOperationProgress(100)
					if (!shareCode) {
						magicToast.success(t("topicFiles.success.fileCopied"))
					}
					setTimeout(() => {
						if (!isCurrent()) return
						setIsOperating(false)
						setOperationProgress(0)
						closeModal()
						onSuccess?.({
							operationType: "copy",
							fileIds: effectiveFileIds,
							targetProjectId: data.targetProjectId,
							targetParentId,
							targetWorkspaceId:
								data.targetWorkspaceId || data.targetProject?.workspace_id,
							targetProjectName: data.targetProject?.project_name,
						})
					}, 500)
					return
				}

				if (result.status === "processing" && result.batch_key) {
					handleOperationPolling(
						result.batch_key,
						"copy",
						effectiveFileIds,
						{
							targetProjectId: data.targetProjectId,
							targetParentId,
							targetWorkspaceId:
								data.targetWorkspaceId || data.targetProject?.workspace_id,
							targetProjectName: data.targetProject?.project_name,
						},
						null,
					)
				}
			} catch (error) {
				if (!isCurrent()) return
				console.error("复制文件失败:", error)
				magicToast.error(t("topicFiles.error.copyFileFailed"))
				setIsOperating(false)
				setOperationProgress(0)
			}
		},
		[
			isCurrent,
			confirmOperation,
			fileIds,
			projectId,
			shareCode,
			fileScope,
			sharePassword,
			closeModal,
			onSuccess,
			t,
			handleOperationPolling,
			duplicateHandler,
			folderConflictHandler,
		],
	)

	return {
		visible,
		operationType,
		fileIds,
		initialPath,
		isOperating,
		operationProgress,
		openMoveModal,
		openCopyModal,
		executeMoveOperation,
		executeCopyOperation,
		closeModal,
		// 导出同名检测 Modal 状态
		duplicateModalVisible: duplicateHandler.modalVisible,
		currentDuplicateFileName: duplicateHandler.currentFileName,
		totalDuplicates: duplicateHandler.totalDuplicates,
		handleDuplicateReplace: duplicateHandler.handleReplace,
		handleDuplicateKeepBoth: duplicateHandler.handleKeepBoth,
		handleDuplicateCancel: duplicateHandler.handleCancel,
		folderConflictModalVisible: folderConflictHandler.modalVisible,
		currentFolderConflictName: folderConflictHandler.currentFolderName,
		totalFolderConflicts: folderConflictHandler.totalConflicts,
		canMergeFolderConflict: folderConflictHandler.canMerge,
		handleFolderConflictKeepBoth: folderConflictHandler.handleKeepBoth,
		handleFolderConflictMerge: folderConflictHandler.handleMerge,
		handleFolderConflictCancel: folderConflictHandler.handleCancel,
	}
}
