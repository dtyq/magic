import { startTransition, useState, useCallback, useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import type { AttachmentItem, ConfirmFileOperation, FileOperationPreparation } from "./types"
import { getFileManagerChangedIds } from "../utils/file-manager-transfer"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"
import MagicModal from "@/components/base/MagicModal"
import { IconAlertTriangleFilled } from "@tabler/icons-react"
import { SuperMagicApi } from "@/apis"
import { collectSelectedFolderIds } from "../../SelectPathModal/utils/attachmentUtils"
import { detectDuplicateFilesForMove } from "../utils/moveOrCopyDuplicateHandler"
import {
	collectSameParentOperationIds,
	detectFolderConflictsForMove,
} from "../utils/folderConflictHandler"
import { useMoveOrCopyDuplicateHandler } from "./useMoveOrCopyDuplicateHandler"
import { useFolderConflictHandler } from "./useFolderConflictHandler"
import { getAttachmentPathByLookupKey, type AttachmentIndex } from "../utils/attachmentIndex"
import { collectSelectedItemIds } from "../utils/collectSelectedItemIds"
import {
	canSkipCanvasProjectOperationRiskForMove,
	detectCanvasProjectOperationRisk,
	getCanvasProjectOperationImpact,
	type CanvasProjectOperationRisk,
} from "../utils/canvasProjectOperationRisk"
import { useCanvasFileOperationGuard } from "./useCanvasFileOperationGuard"
import {
	mergeStaticDependencyFileIds,
	resolveSingleDocumentStaticDependencies,
} from "@/pages/superMagic/utils/staticDependencies"
import {
	resolveCanvasOperationConfirmTitleKey,
	type CanvasProjectPathRepairResult,
} from "@/pages/superMagic/components/Detail/contents/Design/utils/canvasProjectPathRepair"
import type { DirectorySource } from "../../SelectPathModal/components/SelectDirectoryModal/types"

export interface FileMoveFailure {
	file: AttachmentItem
	message: string
}

interface UseMoveFileOptions {
	confirmOperation?: ConfirmFileOperation
	onDirectoryMoveSuccess?: (files: AttachmentItem[]) => void
	projectId?: string
	directorySource?: DirectorySource
	isCurrent?: () => boolean
	onDirectoryMoveComplete?: (files: AttachmentItem[], targetId: string) => void
	attachments?: AttachmentItem[]
	attachmentIndex?: AttachmentIndex
	onMoveSuccess?: (fileIds?: string[]) => void
	handleMoveFile?: (
		fileId: string,
		targetParentId: string,
		preFileId?: string,
		keepBothFileIds?: string[],
		showLoadingToast?: boolean,
	) => Promise<boolean>
	// 批量移动相关
	selectedItems?: Set<string>
	setSelectedItems?: (items: Set<string>) => void
	getItemId?: (item: AttachmentItem) => string
	allFiles?: AttachmentItem[]
	onSelectModeChange?: (isSelectMode: boolean) => void
	useDetailedDuplicateConflict?: boolean
}

const MOVE_TASK_TIMEOUT_MS = 120000

export function useMoveFile(options: UseMoveFileOptions = {}) {
	const { t } = useTranslation("super")
	const { runCanvasFileOperationPreflight, commitCanvasFileOperationRepair } =
		useCanvasFileOperationGuard()
	const {
		confirmOperation,
		projectId,
		attachments = [],
		attachmentIndex,
		onMoveSuccess,
		handleMoveFile,
		selectedItems,
		setSelectedItems,
		getItemId,
		allFiles,
		onSelectModeChange,
		useDetailedDuplicateConflict = false,
	} = options

	// 移动弹窗状态
	const [visible, setVisible] = useState(false)
	const [currentMoveItem, setCurrentMoveItem] = useState<AttachmentItem | null>(null)
	const [isBatchMode, setIsBatchMode] = useState(false)
	const [batchFileIds, setBatchFileIds] = useState<string[]>([])
	// 禁用的文件夹ID列表
	const [disabledFolderIds, setDisabledFolderIds] = useState<string[]>([])
	// 移动进度状态
	const [moveProgress, setMoveProgress] = useState(0)
	const [isMoving, setIsMoving] = useState(false)
	const movePollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const moveWatchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const activeMoveTaskIdRef = useRef(0)
	const moveDuplicateHandler = useMoveOrCopyDuplicateHandler()
	const folderConflictHandler = useFolderConflictHandler()
	// 默认路径（被移动文件所在的目录）
	const [defaultPath, setDefaultPath] = useState<AttachmentItem[]>([])
	const [failures, setFailures] = useState<FileMoveFailure[]>([])
	const [successCount, setSuccessCount] = useState(0)
	const directoryMoveRef = useRef<AbortController | null>(null)
	const previousSourceIdentity = useRef(options.directorySource?.identityKey)

	const clearMoveTimers = useCallback(() => {
		if (movePollingTimerRef.current) {
			clearInterval(movePollingTimerRef.current)
			movePollingTimerRef.current = null
		}

		if (moveWatchdogTimerRef.current) {
			clearTimeout(moveWatchdogTimerRef.current)
			moveWatchdogTimerRef.current = null
		}
	}, [])

	const resetMoveTask = useCallback(
		(taskId: number) => {
			if (activeMoveTaskIdRef.current !== taskId) return

			clearMoveTimers()
			setIsMoving(false)
			setMoveProgress(0)
		},
		[clearMoveTimers],
	)

	const beginMoveTask = useCallback(() => {
		clearMoveTimers()
		activeMoveTaskIdRef.current += 1
		const taskId = activeMoveTaskIdRef.current

		startTransition(() => {
			setIsMoving(true)
			setMoveProgress(0)
		})

		moveWatchdogTimerRef.current = setTimeout(() => {
			if (activeMoveTaskIdRef.current !== taskId) return

			console.warn("批量移动超时，自动清理移动状态", { taskId })
			magicToast.error(t("topicFiles.error.moveFileFailed"))
			resetMoveTask(taskId)
		}, MOVE_TASK_TIMEOUT_MS)

		return taskId
	}, [clearMoveTimers, resetMoveTask, t])

	const finishMoveTask = useCallback(
		(taskId: number, delay = 0) => {
			if (activeMoveTaskIdRef.current !== taskId) return

			clearMoveTimers()

			const reset = () => {
				resetMoveTask(taskId)
			}

			if (delay > 0) {
				setTimeout(reset, delay)
				return
			}

			reset()
		},
		[clearMoveTimers, resetMoveTask],
	)

	useEffect(() => clearMoveTimers, [clearMoveTimers])
	useEffect(() => {
		if (
			previousSourceIdentity.current &&
			previousSourceIdentity.current !== options.directorySource?.identityKey
		) {
			setVisible(false)
			setFailures([])
			setIsMovingFn(false)
		}
		previousSourceIdentity.current = options.directorySource?.identityKey
		return () => {
			directoryMoveRef.current?.abort()
			directoryMoveRef.current = null
		}
	}, [options.directorySource?.identityKey])

	// Open the move picker.
	const showMoveSelector = useCallback(
		(item: AttachmentItem) => {
			setCurrentMoveItem(item)
			setIsBatchMode(false)
			// Disable the selected folder as a target.
			const disabled = item.is_directory && item.file_id ? [item.file_id] : []
			setDisabledFolderIds(disabled)
			setDefaultPath(
				item.file_id ? (attachmentIndex?.getParentItemsById(item.file_id) ?? []) : [],
			)
			setVisible(true)
		},
		[attachmentIndex],
	)

	// 显示批量移动选择器
	const showBatchMoveSelector = useCallback(
		(fileIds: string[]) => {
			setBatchFileIds(fileIds)
			setIsBatchMode(true)
			// 收集选中的文件夹ID作为禁用列表
			if (fileIds && attachments) {
				const disabledIds = collectSelectedFolderIds(attachments, fileIds)
				console.log("🔵 disabledIds", disabledIds)
				setDisabledFolderIds(disabledIds)
				setDefaultPath([])
			} else {
				setDisabledFolderIds([])
				setDefaultPath([])
			}

			setVisible(true)
		},
		[attachments],
	)

	// 打开批量移动（内部根据选中项收集 file_ids）
	const openBatchMove = useCallback(() => {
		if (!selectedItems || selectedItems.size === 0 || !allFiles || !getItemId) return
		const ids = collectSelectedItemIds(allFiles, selectedItems, getItemId)
		if (ids.length === 0) return
		showBatchMoveSelector(ids)
	}, [allFiles, getItemId, selectedItems, showBatchMoveSelector])

	/**
	 * 供新移动端 UI 直接复用旧的目录选择器，不重新拼装移动链路。
	 */
	const openBatchMoveByFileIds = useCallback(
		(fileIds: string[]) => {
			if (fileIds.length === 0) return
			showBatchMoveSelector(fileIds)
		},
		[showBatchMoveSelector],
	)

	// 隐藏移动选择器
	const hideMoveSelector = useCallback(() => {
		setVisible(false)
		setCurrentMoveItem(null)
		setBatchFileIds([])
		setIsBatchMode(false)
		setDisabledFolderIds([])
		setDefaultPath([])
	}, [])

	// 获取文件/文件夹的显示名称
	const getItemName = useCallback((item: AttachmentItem): string => {
		return item.name || item.file_name || item.filename || item.display_filename || ""
	}, [])

	// 根据路径构建目标文件夹路径
	const getTargetFolderPath = useCallback(
		(path: AttachmentItem[]): string => {
			if (path.length === 0) return ""
			return "/" + path.map((item) => getItemName(item)).join("/")
		},
		[getItemName],
	)

	// 检查单个文件是否存在同名冲突
	const checkSingleFileConflict = useCallback(
		(item: AttachmentItem, targetFolderPath: string): boolean => {
			const fileName = getItemName(item)
			return checkDuplicateFileName(fileName, attachments, targetFolderPath)
		},
		[attachments, getItemName],
	)

	// 检查批量文件是否存在同名冲突
	const checkBatchFilesConflict = useCallback(
		(
			fileIds: string[],
			targetFolderPath: string,
		): { hasConflict: boolean; conflictItems: AttachmentItem[] } => {
			if (!allFiles || !getItemId) {
				return { hasConflict: false, conflictItems: [] }
			}

			const conflictItems: AttachmentItem[] = []

			// 递归查找文件
			const findItemsById = (items: AttachmentItem[], ids: string[]): AttachmentItem[] => {
				const foundItems: AttachmentItem[] = []

				items.forEach((item) => {
					const itemId = getItemId(item)
					if (ids.includes(itemId)) {
						foundItems.push(item)
					}
					if (item.is_directory && "children" in item && item.children) {
						foundItems.push(...findItemsById(item.children, ids))
					}
				})

				return foundItems
			}

			const itemsToMove = findItemsById(allFiles, fileIds)

			itemsToMove.forEach((item) => {
				if (checkSingleFileConflict(item, targetFolderPath)) {
					conflictItems.push(item)
				}
			})

			return {
				hasConflict: conflictItems.length > 0,
				conflictItems,
			}
		},
		[allFiles, getItemId, checkSingleFileConflict],
	)

	// 显示覆盖确认对话框
	const showOverwriteConfirm = useCallback(
		(conflictItems: AttachmentItem[], onConfirm: () => void | Promise<void>) => {
			const isMultiple = conflictItems.length > 1
			let content: string

			if (!isMultiple) {
				// 单个文件冲突
				const fileName = getItemName(conflictItems[0])
				content = t("topicFiles.moveModal.overwriteSingleContent", { name: fileName })
			} else {
				// 多个文件冲突
				const totalCount = conflictItems.length
				if (totalCount <= 3) {
					// 文件数量较少，显示所有文件名
					const conflictNames = conflictItems.map((item) => getItemName(item)).join("、")
					content = t("topicFiles.moveModal.overwriteMultipleContent", {
						names: conflictNames,
					})
				} else {
					// 文件数量较多，显示前3个 + 总数
					const firstThreeNames = conflictItems
						.slice(0, 3)
						.map((item) => getItemName(item))
						.join("、")
					content = t("topicFiles.moveModal.overwriteManyContent", {
						names: firstThreeNames,
						total: totalCount,
					})
				}
			}

			MagicModal.confirm({
				title: t("topicFiles.moveModal.overwriteTitle"),
				content,
				icon: (
					<IconAlertTriangleFilled
						size={20}
						color="rgba(255,125,0, 1)"
						style={{ marginRight: 6, lineHeight: 20, flexShrink: 0 }}
					/>
				),
				okButtonProps: {
					color: "danger",
					variant: "solid",
				},
				cancelButtonProps: {
					color: "default",
					variant: "filled",
				},
				okText: t("topicFiles.moveModal.overwriteConfirm"),
				cancelText: t("common.cancel"),
				onOk: onConfirm,
			})
		},
		[getItemName, t],
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
				const riskContent = canvasRisk.shouldWarn
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
					icon: (
						<IconAlertTriangleFilled
							size={20}
							color="rgba(255,125,0, 1)"
							style={{ marginRight: 6, lineHeight: 20, flexShrink: 0 }}
						/>
					),
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

	// 批量移动文件处理函数
	const batchMoveFiles = useCallback(
		async ({
			fileIds,
			selectedIds = fileIds,
			projectId,
			targetParentId,
			targetProjectId,
			keepBothFileIds = [],
			preparation,
		}: {
			fileIds: string[]
			selectedIds?: string[]
			projectId: string
			targetParentId: string
			targetProjectId?: string
			keepBothFileIds?: string[]
			preparation?: FileOperationPreparation
		}) => {
			if (fileIds.length === 0 || !projectId) return

			preparation?.signal.throwIfAborted()
			let effectiveFileIds = fileIds
			const skipCanvasGuard = canSkipCanvasProjectOperationRiskForMove(
				fileIds,
				attachmentIndex,
			)

			if (!skipCanvasGuard) {
				try {
					const { dependencyTransferFileIds } =
						await resolveSingleDocumentStaticDependencies({
							fileIds,
							attachments,
							attachmentIndex,
							signal: preparation?.signal,
						})
					effectiveFileIds = mergeStaticDependencyFileIds(
						fileIds,
						dependencyTransferFileIds,
						true,
					)
				} catch (error) {
					preparation?.signal.throwIfAborted()
					console.error(
						"Failed to resolve document static dependencies before moving:",
						error,
					)
				}
			}

			preparation?.signal.throwIfAborted()
			const sameProjectMove = !targetProjectId || targetProjectId === projectId
			if (confirmOperation && sameProjectMove && attachmentIndex) {
				effectiveFileIds = getFileManagerChangedIds(
					effectiveFileIds,
					attachmentIndex,
					"",
					targetParentId,
					"move",
				)
				if (!effectiveFileIds.length) return
			}
			const pathOperationFileIds = effectiveFileIds.filter(
				(fileId) => !keepBothFileIds.includes(fileId),
			)
			let repairPlan: CanvasProjectPathRepairResult | null = null
			if (sameProjectMove && !skipCanvasGuard) {
				const canvasRisk =
					pathOperationFileIds.length > 0
						? await detectCanvasProjectOperationRisk({
								attachments,
								attachmentIndex,
								fileIds: pathOperationFileIds,
								operation: "move",
							})
						: { shouldWarn: false, riskTypes: [], affectedProjectNames: [] }
				preparation?.signal.throwIfAborted()
				const preflightResult = await runCanvasFileOperationPreflight({
					repairOptions: {
						attachments,
						attachmentIndex,
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
				})
				preparation?.signal.throwIfAborted()
				if (!preflightResult.ok) return
				repairPlan = preflightResult.repairPlan
			}

			preparation?.signal.throwIfAborted()
			preparation?.onPhase("awaitingChoice")
			if (
				confirmOperation &&
				!(await confirmOperation({
					operation: "move",
					fileIds: effectiveFileIds,
					selectedIds,
					skippedCount: selectedIds.filter((id) => !effectiveFileIds.includes(id)).length,
					sourceAttachments: attachments,
					targetPath: attachmentIndex
						? getAttachmentPathByLookupKey(attachmentIndex, targetParentId)
						: [],
				}))
			)
				return
			preparation?.signal.throwIfAborted()
			preparation?.onPhase("executing")
			const moveTaskId = beginMoveTask()

			try {
				const data =
					effectiveFileIds.length === 1
						? await SuperMagicApi.moveFile({
								file_id: effectiveFileIds[0],
								target_parent_id: targetParentId,
								project_id: projectId,
								target_project_id: targetProjectId,
								keep_both_file_ids: keepBothFileIds,
							})
						: await SuperMagicApi.moveFiles({
								file_ids: effectiveFileIds,
								project_id: projectId,
								target_project_id: targetProjectId,
								target_parent_id: targetParentId,
								pre_file_id: "",
								keep_both_file_ids: keepBothFileIds,
							})

				// 如果直接完成
				if (data.status === "success") {
					await commitCanvasFileOperationRepair(repairPlan)
					setMoveProgress(100)
					magicToast.success(t("topicFiles.success.fileMoved"))
					hideMoveSelector()
					onMoveSuccess?.(effectiveFileIds)
					finishMoveTask(moveTaskId, 500)
					return
				}

				// 如果需要轮询状态
				if (data.status === "processing" && data.batch_key) {
					// 每2秒轮询批量状态
					const timer = setInterval(async () => {
						try {
							if (activeMoveTaskIdRef.current !== moveTaskId) return

							const checkData = await SuperMagicApi.checkBatchOperationStatus(
								data.batch_key,
							)

							if (activeMoveTaskIdRef.current !== moveTaskId) return

							// 更新进度显示
							if (checkData.status === "processing") {
								const progress = checkData.progress
									? parseInt(checkData.progress)
									: 0
								setMoveProgress(progress)
							} else if (checkData.status === "success") {
								await commitCanvasFileOperationRepair(repairPlan)
								setMoveProgress(100)
								magicToast.success(t("topicFiles.success.fileMoved"))
								hideMoveSelector()
								onMoveSuccess?.(effectiveFileIds)
								finishMoveTask(moveTaskId, 500)
							} else if (checkData.status === "failed") {
								magicToast.error(
									checkData.message || t("topicFiles.error.moveFileFailed"),
								)
								finishMoveTask(moveTaskId)
							} else {
								finishMoveTask(moveTaskId)
							}
						} catch (error) {
							console.error("检查批量移动状态失败:", error)
							magicToast.error(t("topicFiles.error.moveFileFailed"))
							finishMoveTask(moveTaskId)
						}
					}, 2000)
					movePollingTimerRef.current = timer
					return
				}

				magicToast.error(data.message || t("topicFiles.error.moveFileFailed"))
				finishMoveTask(moveTaskId)
			} catch (error) {
				console.error("批量移动失败:", error)
				magicToast.error(t("topicFiles.error.moveFileFailed"))
				finishMoveTask(moveTaskId)
			}
		},
		[
			attachmentIndex,
			attachments,
			beginMoveTask,
			confirmOperation,
			commitCanvasFileOperationRepair,
			confirmCanvasProjectRisk,
			finishMoveTask,
			hideMoveSelector,
			onMoveSuccess,
			runCanvasFileOperationPreflight,
			t,
		],
	)

	const batchMoveFilesWithDuplicateCheck = useCallback(
		async ({
			fileIds,
			projectId,
			targetParentId,
			preparation,
			targetPath,
			targetProjectId,
			sourceAttachments = attachments,
			targetAttachments = attachments,
		}: {
			fileIds: string[]
			projectId: string
			targetParentId: string
			preparation?: FileOperationPreparation
			targetPath?: AttachmentItem[]
			targetProjectId?: string
			sourceAttachments?: AttachmentItem[]
			targetAttachments?: AttachmentItem[]
		}) => {
			if (!projectId || fileIds.length === 0) return
			preparation?.signal.throwIfAborted()
			const selectedIds = fileIds
			if (
				confirmOperation &&
				attachmentIndex &&
				(!targetProjectId || targetProjectId === projectId)
			) {
				fileIds = getFileManagerChangedIds(
					fileIds,
					attachmentIndex,
					"",
					targetParentId,
					"move",
				)
				if (!fileIds.length) return
			}

			const resolvedTargetPath =
				targetPath ??
				(attachmentIndex
					? getAttachmentPathByLookupKey(attachmentIndex, targetParentId)
					: [])
			const sharedSourceIndex =
				sourceAttachments === attachments ? attachmentIndex : undefined
			const sharedTargetIndex =
				targetAttachments === attachments ? attachmentIndex : undefined

			let keepBothFileIds = collectSameParentOperationIds(
				fileIds,
				sourceAttachments,
				resolvedTargetPath,
				sharedSourceIndex,
			)
			const conflictDetectionIds = fileIds.filter(
				(fileId) => !keepBothFileIds.includes(fileId),
			)
			const folderConflicts =
				conflictDetectionIds.length > 0
					? detectFolderConflictsForMove(
							conflictDetectionIds,
							sourceAttachments,
							targetAttachments,
							resolvedTargetPath,
							{
								source: sharedSourceIndex,
								target: sharedTargetIndex,
							},
						)
					: new Map()

			if (folderConflicts.size > 0) {
				preparation?.onPhase("awaitingChoice")
				const folderChoice = await folderConflictHandler.checkConflicts(folderConflicts)
				preparation?.signal.throwIfAborted()
				preparation?.onPhase("checking")
				if (!folderChoice.shouldProceed) return
				keepBothFileIds = [...keepBothFileIds, ...folderChoice.keepBothIds]
			}

			const duplicateDetectionIds = fileIds.filter(
				(fileId) => !keepBothFileIds.includes(fileId),
			)
			const duplicates =
				duplicateDetectionIds.length > 0
					? detectDuplicateFilesForMove(
							duplicateDetectionIds,
							sourceAttachments,
							targetAttachments,
							resolvedTargetPath,
							{
								sourceIndex: sharedSourceIndex,
								targetIndex: sharedTargetIndex,
							},
						)
					: new Map()

			if (duplicates.size > 0) {
				preparation?.onPhase("awaitingChoice")
				const userChoice = await moveDuplicateHandler.checkDuplicates(duplicates)
				preparation?.signal.throwIfAborted()
				preparation?.onPhase("checking")
				if (!userChoice.shouldProceed) return
				keepBothFileIds = [...keepBothFileIds, ...userChoice.keepBothIds]
			}

			await batchMoveFiles({
				fileIds,
				selectedIds,
				projectId,
				targetParentId,
				targetProjectId,
				keepBothFileIds,
				preparation,
			})
		},
		[
			attachmentIndex,
			attachments,
			batchMoveFiles,
			confirmOperation,
			folderConflictHandler,
			moveDuplicateHandler,
		],
	)

	const moveWithinDirectorySource = useMemoizedFn(
		async (
			path: AttachmentItem[],
			fileIds?: string[],
			preparation?: FileOperationPreparation,
		) => {
			preparation?.signal.throwIfAborted()
			const source = options.directorySource
			if (!source || (directoryMoveRef.current && !directoryMoveRef.current.signal.aborted))
				return
			const targetId = path.at(-1)?.file_id ?? source.root.file_id
			if (!targetId) return
			const controller = new AbortController()
			preparation?.signal.addEventListener("abort", () => controller.abort(), { once: true })
			const signal = preparation
				? AbortSignal.any([controller.signal, preparation.signal])
				: controller.signal
			directoryMoveRef.current = controller
			const isCurrent = () => !signal.aborted && (options.isCurrent?.() ?? true)
			const ids =
				fileIds ??
				(isBatchMode
					? batchFileIds
					: currentMoveItem?.file_id
						? [currentMoveItem.file_id]
						: [])
			let items = ids.flatMap((id) => {
				const file =
					attachmentIndex?.getItemById(id) ??
					attachments.find((item) => item.file_id === id)
				return file ? [file] : []
			})
			if (items.length !== ids.length) {
				if (directoryMoveRef.current === controller) directoryMoveRef.current = null
				magicToast.error(t("topicFiles.error.moveFileFailed"))
				return
			}
			const succeeded: AttachmentItem[] = []
			const failed: FileMoveFailure[] = []
			if (options.confirmOperation) {
				const unchanged = items.filter(
					(file) =>
						(attachmentIndex?.getParentItemById(file.file_id)?.file_id ??
							source.root.file_id) === targetId,
				)
				items = items.filter((file) => !unchanged.includes(file))
				if (!items.length) {
					if (directoryMoveRef.current === controller) directoryMoveRef.current = null
					return
				}
				try {
					const children = await source.loadChildren(targetId, signal)
					if (!isCurrent()) {
						if (directoryMoveRef.current === controller) directoryMoveRef.current = null
						return
					}
					const names = new Set(children.map(getItemName))
					items = items.filter((file) => {
						const invalid =
							file.file_id === targetId ||
							path.some((parent) => parent.file_id === file.file_id)
						const duplicate = names.has(getItemName(file))
						if (invalid || duplicate) {
							failed.push({
								file,
								message: t(
									invalid
										? "userSpace.invalidMoveTarget"
										: "userSpace.nameExists",
								),
							})
							return false
						}
						names.add(getItemName(file))
						return true
					})
					setFailures(failed)
					preparation?.onPhase("awaitingChoice")
					if (
						!items.length ||
						!(await options.confirmOperation({
							operation: "move",
							fileIds: items.flatMap((file) => (file.file_id ? [file.file_id] : [])),
							selectedIds: ids,
							sourceAttachments: attachments,
							targetPath: path,
							skippedCount: unchanged.length + failed.length,
						}))
					) {
						if (directoryMoveRef.current === controller) directoryMoveRef.current = null
						return
					}
				} catch (error) {
					if (directoryMoveRef.current === controller) directoryMoveRef.current = null
					if (preparation && isCurrent()) throw error
					if (isCurrent()) magicToast.error(t("topicFiles.error.moveFileFailed"))
					return
				}
				if (!isCurrent()) {
					if (directoryMoveRef.current === controller) directoryMoveRef.current = null
					return
				}
			}
			preparation?.signal.throwIfAborted()
			preparation?.onPhase("executing")
			setIsMovingFn(true)
			try {
				for (const file of items) {
					if (!file?.file_id || !isCurrent()) return
					if (file.parent_id === targetId) {
						succeeded.push(file)
						continue
					}
					if (
						file.file_id === targetId ||
						path.some((parent) => parent.file_id === file.file_id)
					) {
						failed.push({ file, message: t("userSpace.invalidMoveTarget") })
						continue
					}
					try {
						const children = await source.loadChildren(targetId, signal)
						if (!isCurrent()) return
						if (checkDuplicateFileName(getItemName(file), children)) {
							failed.push({ file, message: t("userSpace.nameExists") })
							continue
						}
						await SuperMagicApi.moveFile({
							file_id: file.file_id,
							target_parent_id: targetId,
						})
						if (!isCurrent()) return
						succeeded.push(file)
					} catch {
						if (!isCurrent()) return
						failed.push({ file, message: t("topicFiles.error.moveFileFailed") })
					}
				}
				if (!isCurrent()) return
				hideMoveSelector()
				setFailures(failed)
				setSuccessCount(succeeded.length)
				setSelectedItems?.(
					new Set(failed.flatMap(({ file }) => (file.file_id ? [file.file_id] : []))),
				)
				if (!failed.length && succeeded.length)
					magicToast.success(t("topicFiles.success.fileMoved"))
			} finally {
				// 停止后续移动不代表已提交请求回滚，来源与目标目录都要重新读取。
				options.onDirectoryMoveComplete?.(items, targetId)
				options.onDirectoryMoveSuccess?.(succeeded)
				if (directoryMoveRef.current === controller) {
					directoryMoveRef.current = null
					setIsMovingFn(false)
				}
			}
		},
	)

	// 确认移动文件
	const confirmMove = useCallback(
		async (data: { path: AttachmentItem[]; preparation?: FileOperationPreparation }) => {
			if (options.directorySource) {
				await moveWithinDirectorySource(data.path, undefined, data.preparation)
				return
			}
			const targetParentId =
				data.path.length > 0 ? data.path[data.path.length - 1].file_id || "" : ""
			const targetFolderPath = getTargetFolderPath(data.path)
			if (confirmOperation) {
				await batchMoveFilesWithDuplicateCheck({
					fileIds: isBatchMode
						? batchFileIds
						: currentMoveItem?.file_id
							? [currentMoveItem.file_id]
							: [],
					projectId: projectId ?? "",
					targetParentId,
					targetPath: data.path,
					preparation: data.preparation,
				})
				return
			}

			const executeBatchMove = (keepBothFileIds: string[] = []) => {
				// 立即退出多选模式
				setSelectedItems && setSelectedItems(new Set())
				onSelectModeChange && onSelectModeChange(false)

				batchMoveFiles({
					fileIds: batchFileIds,
					projectId: projectId || "",
					targetParentId: targetParentId,
					keepBothFileIds,
				})
			}

			// 批量模式
			if (isBatchMode) {
				if (!projectId || batchFileIds.length === 0) return

				const sameParentKeepBothIds = collectSameParentOperationIds(
					batchFileIds,
					attachments,
					data.path,
					attachmentIndex,
				)
				if (sameParentKeepBothIds.length === batchFileIds.length) {
					executeBatchMove(sameParentKeepBothIds)
					return
				}
				const conflictCheckIds = batchFileIds.filter(
					(fileId) => !sameParentKeepBothIds.includes(fileId),
				)

				// 检查批量移动是否存在同名冲突
				const { hasConflict, conflictItems } = checkBatchFilesConflict(
					conflictCheckIds,
					targetFolderPath,
				)

				if (hasConflict) {
					// 显示覆盖确认对话框
					showOverwriteConfirm(conflictItems, () => {
						// 用户确认后执行批量移动
						executeBatchMove(sameParentKeepBothIds)
					})
					return
				}

				// 没有冲突，直接执行批量移动
				executeBatchMove(sameParentKeepBothIds)
				return
			}

			const executeSingleMove = async (keepBothFileIds: string[] = []) => {
				if (!currentMoveItem?.file_id) return

				if (!handleMoveFile && projectId) {
					try {
						const { dependencyTransferFileIds } =
							await resolveSingleDocumentStaticDependencies({
								fileIds: [currentMoveItem.file_id],
								attachments,
								attachmentIndex,
							})
						if (dependencyTransferFileIds.length > 0) {
							await batchMoveFiles({
								fileIds: mergeStaticDependencyFileIds(
									[currentMoveItem.file_id],
									dependencyTransferFileIds,
									true,
								),
								projectId,
								targetParentId,
								keepBothFileIds,
							})
							return
						}
					} catch (error) {
						console.error(
							"Failed to resolve document static dependencies before moving:",
							error,
						)
					}
				}

				try {
					const skipCanvasGuard = currentMoveItem.file_id
						? canSkipCanvasProjectOperationRiskForMove(
								[currentMoveItem.file_id],
								attachmentIndex,
							)
						: false
					const canvasRisk = skipCanvasGuard
						? { shouldWarn: false, riskTypes: [], affectedProjectNames: [] }
						: await detectCanvasProjectOperationRisk({
								attachments,
								attachmentIndex,
								items: [currentMoveItem],
								operation: "move",
							})
					const preflightResult = await runCanvasFileOperationPreflight({
						repairOptions:
							!skipCanvasGuard && currentMoveItem.is_directory
								? {
										attachments,
										attachmentIndex,
										items: [currentMoveItem],
										operation: "move",
										projectId,
									}
								: undefined,
						requiresConfirmation: canvasRisk.shouldWarn,
						confirm: (repairPlan) =>
							confirmCanvasProjectRisk(
								canvasRisk,
								repairPlan?.failures.map(
									(failure) =>
										`${failure.projectName} / ${failure.fileName}: ${failure.message}`,
								) ?? [],
							),
					})
					if (!preflightResult.ok) return

					setIsMoving(true)
					setMoveProgress(0)

					let success = false

					if (handleMoveFile) {
						setMoveProgress(50)
						// Use the injected move handler.
						success = await handleMoveFile(
							currentMoveItem.file_id,
							targetParentId,
							undefined,
							keepBothFileIds,
							false,
						)
						if (success) {
							await commitCanvasFileOperationRepair(preflightResult.repairPlan)
							setMoveProgress(100)
							hideMoveSelector()
							// 清空选中状态
							setSelectedItems && setSelectedItems(new Set())
							onMoveSuccess?.()
							setTimeout(() => {
								setIsMoving(false)
								setMoveProgress(0)
							}, 500)
						} else {
							setIsMoving(false)
							setMoveProgress(0)
						}
					} else {
						setMoveProgress(50)
						// Call the API directly.
						await SuperMagicApi.moveFile({
							file_id: currentMoveItem.file_id,
							target_parent_id: targetParentId,
							keep_both_file_ids: keepBothFileIds,
						})
						await commitCanvasFileOperationRepair(preflightResult.repairPlan)
						setMoveProgress(100)
						magicToast.success(t("topicFiles.success.fileMoved"))
						hideMoveSelector()
						// 清空选中状态
						setSelectedItems && setSelectedItems(new Set())
						onMoveSuccess?.()
						setTimeout(() => {
							setIsMoving(false)
							setMoveProgress(0)
						}, 500)
					}
				} catch (error) {
					console.error("移动文件失败:", error)
					magicToast.error(t("topicFiles.error.moveFileFailed"))
					setIsMoving(false)
					setMoveProgress(0)
				}
			}

			if (!currentMoveItem?.file_id) return

			const sameParentKeepBothIds = collectSameParentOperationIds(
				[currentMoveItem.file_id],
				attachments,
				data.path,
				attachmentIndex,
			)
			if (sameParentKeepBothIds.length > 0 && projectId) {
				await batchMoveFiles({
					fileIds: [currentMoveItem.file_id],
					projectId,
					targetParentId,
					keepBothFileIds: sameParentKeepBothIds,
				})
				return
			}

			// 检查单个文件移动是否存在同名冲突
			const hasConflict = checkSingleFileConflict(currentMoveItem, targetFolderPath)

			if (hasConflict) {
				if (useDetailedDuplicateConflict) {
					const duplicates = detectDuplicateFilesForMove(
						[currentMoveItem.file_id],
						attachments,
						attachments,
						data.path,
					)
					const userChoice = await moveDuplicateHandler.checkDuplicates(duplicates)
					if (!userChoice.shouldProceed) return
					await executeSingleMove(userChoice.keepBothIds)
					return
				}
				// 显示覆盖确认对话框
				showOverwriteConfirm([currentMoveItem], () => {
					// 用户确认后执行单个移动
					return executeSingleMove()
				})
				return
			}

			// 没有冲突，直接执行单个移动
			executeSingleMove()
		},
		[
			options.directorySource,
			confirmOperation,
			batchMoveFilesWithDuplicateCheck,
			moveWithinDirectorySource,
			attachmentIndex,
			attachments,
			batchFileIds,
			batchMoveFiles,
			checkBatchFilesConflict,
			checkSingleFileConflict,
			confirmCanvasProjectRisk,
			currentMoveItem,
			commitCanvasFileOperationRepair,
			getTargetFolderPath,
			handleMoveFile,
			hideMoveSelector,
			isBatchMode,
			onMoveSuccess,
			onSelectModeChange,
			projectId,
			runCanvasFileOperationPreflight,
			setSelectedItems,
			showOverwriteConfirm,
			moveDuplicateHandler,
			useDetailedDuplicateConflict,
			t,
		],
	)

	return {
		failures,
		successCount,
		clearFailures: () => setFailures([]),
		// 状态
		visible,
		currentMoveItem,
		projectId: projectId || "",
		attachments,
		isMoving,
		moveProgress,

		// 方法
		showMoveSelector,
		showBatchMoveSelector,
		openBatchMove,
		openBatchMoveByFileIds,
		hideMoveSelector,
		confirmMove,
		batchMoveFiles, // 暴露批量移动方法
		batchMoveFilesWithDuplicateCheck,
		duplicateModalVisible: moveDuplicateHandler.modalVisible,
		currentDuplicateFileName: moveDuplicateHandler.currentFileName,
		totalDuplicates: moveDuplicateHandler.totalDuplicates,
		handleDuplicateReplace: moveDuplicateHandler.handleReplace,
		handleDuplicateKeepBoth: moveDuplicateHandler.handleKeepBoth,
		handleDuplicateCancel: moveDuplicateHandler.handleCancel,
		folderConflictModalVisible: folderConflictHandler.modalVisible,
		currentFolderConflictName: folderConflictHandler.currentFolderName,
		totalFolderConflicts: folderConflictHandler.totalConflicts,
		canMergeFolderConflict: folderConflictHandler.canMerge,
		handleFolderConflictKeepBoth: folderConflictHandler.handleKeepBoth,
		handleFolderConflictMerge: folderConflictHandler.handleMerge,
		handleFolderConflictCancel: folderConflictHandler.handleCancel,

		// 选择器配置
		moveWithinDirectorySource,
		selectorConfig: {
			directorySource: options.directorySource,
			isShowCreateDirectory: options.directorySource ? false : undefined,
			visible,
			title: t("topicFiles.moveModal.title"),
			tips: t("topicFiles.moveModal.tips"),
			projectId: projectId || "",
			attachments,
			pendingMoveFileIds: isBatchMode
				? batchFileIds
				: currentMoveItem?.file_id
					? [currentMoveItem.file_id]
					: [],
			onSubmit: confirmMove,
			onClose: hideMoveSelector,
			okText: t("topicFiles.moveModal.confirm"),
			cancelText: t("common.cancel"),
			disabledFolderIds, // 传递禁用文件夹列表
			confirmLoading: isMoving, // 添加确认按钮加载状态
			defaultPath, // 传递默认路径
		},
	}
}
