import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { loadProjectAttachments } from "@/pages/superMagic/services/projectAttachmentsLoader"
import projectStore from "@/pages/superMagic/stores/core/project"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { SHARE_WORKSPACE_ID, MY_CLAW_WORKSPACE_ID } from "@/pages/superMagic/constants"
import { detectDuplicateFilesForMove } from "@/pages/superMagic/components/TopicFilesButton/utils/moveOrCopyDuplicateHandler"
import { detectFolderConflictsForMove } from "@/pages/superMagic/components/TopicFilesButton/utils/folderConflictHandler"
import { useMoveOrCopyDuplicateHandler } from "@/pages/superMagic/components/TopicFilesButton/hooks/useMoveOrCopyDuplicateHandler"
import { useFolderConflictHandler } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFolderConflictHandler"
import type { AudioProjectListItem } from "@/types/audioProject"
import { resolveRecordingDisplayName } from "../utils/audio-recordings-utils"
import { canCopyAudioProject } from "../utils/copy-availability"
import { resolveAudioCopyRootFileIds } from "../utils/resolve-audio-copy-files"
import { analyticsService } from "@/services/analytics"

const BATCH_OPERATION_POLL_INTERVAL_MS = 2000
const PROGRESS_RESET_DELAY_MS = 500
const EXCLUDED_WORKSPACE_IDS = new Set([SHARE_WORKSPACE_ID, MY_CLAW_WORKSPACE_ID])

interface CrossProjectCopySubmitData {
	targetProjectId: string
	targetWorkspaceId?: string
	targetProject?: ProjectListItem
	targetPath: AttachmentItem[]
	targetAttachments: AttachmentItem[]
	sourceAttachments: AttachmentItem[]
}

interface UseAudioRecordingCopyToProjectOptions {
	onSuccess?: (data: {
		targetWorkspaceId?: string
		targetProjectId: string
	}) => void | Promise<void>
}

/**
 * Coordinates recording project copy without coupling the list/detail shells to
 * Super Magic file-tree conflict handling or batch-operation polling.
 */
export function useAudioRecordingCopyToProject(
	options: UseAudioRecordingCopyToProjectOptions = {},
) {
	const { t } = useTranslation(["audioRecordings", "super"])
	const { onSuccess } = options
	const [visible, setVisible] = useState(false)
	const [copyTarget, setCopyTarget] = useState<AudioProjectListItem | null>(null)
	const [workspaces, setWorkspaces] = useState<Workspace[]>([])
	const [sourceAttachments, setSourceAttachments] = useState<AttachmentItem[]>([])
	const [sourceFileIds, setSourceFileIds] = useState<string[]>([])
	const [isPreparing, setIsPreparing] = useState(false)
	const [isOperating, setIsOperating] = useState(false)
	const [operationProgress, setOperationProgress] = useState(0)
	const submitInFlightRef = useRef(false)

	const duplicateHandler = useMoveOrCopyDuplicateHandler()
	const folderConflictHandler = useFolderConflictHandler()

	const defaultProjectName = useMemo(() => {
		if (!copyTarget) return ""
		return resolveRecordingDisplayName(copyTarget.project_name, copyTarget.created_at)
	}, [copyTarget])

	/** Keeps the modal target list scoped to normal workspaces only. */
	const loadNormalWorkspaces = useCallback(async () => {
		const response = await SuperMagicApi.getWorkspaces({ page: 1, page_size: 999 })
		const normalWorkspaces = (response?.list || []).filter(
			(workspace: Workspace) => !EXCLUDED_WORKSPACE_IDS.has(workspace.id),
		)
		setWorkspaces(normalWorkspaces)
		return normalWorkspaces
	}, [])

	/** Opens the target picker only for stable recording states. */
	const openCopyToProject = useCallback(
		async (item: AudioProjectListItem) => {
			const availability = canCopyAudioProject(item)
			if (!availability.canCopy) {
				magicToast.info(t("audioRecordings:copy.unavailable"))
				return
			}

			setCopyTarget(item)
			setSourceAttachments([])
			setSourceFileIds([])
			setOperationProgress(0)
			setVisible(true)

			try {
				await loadNormalWorkspaces()
			} catch (error) {
				console.error("Failed to load normal workspaces for recording copy:", error)
				magicToast.error(t("audioRecordings:copy.loadTargetsFailed"))
			}
		},
		[loadNormalWorkspaces, t],
	)

	/** Closes the picker while preserving in-flight progress until the operation finishes. */
	const closeCopyDialog = useCallback(() => {
		if (isOperating) return
		submitInFlightRef.current = false
		setVisible(false)
		setCopyTarget(null)
		setSourceAttachments([])
		setSourceFileIds([])
		setOperationProgress(0)
	}, [isOperating])

	/** Loads attachments through the optimized project loader to avoid full-tree hot-path work in render. */
	const loadCopyAttachments = useCallback(async (projectId: string) => {
		const result = await loadProjectAttachments({
			projectId,
		})
		return result?.tree || []
	}, [])

	/** Creates a normal target project when users save directly from a workspace. */
	const createNormalTargetProject = useCallback(
		async (workspaceId: string) => {
			analyticsService.report("project_create_attempted", {
				workspaceId,
				sceneOverride: "ai_recording",
			})
			const response = await SuperMagicApi.createProject({
				workspace_id: workspaceId,
				project_name:
					defaultProjectName.trim() || t("super:selectPathModal.defaultProjectName"),
				project_description: "",
				project_mode: "",
			})
			return response?.project
		},
		[defaultProjectName, t],
	)

	/** Finalizes a successful copy and refreshes the target workspace project cache for the sidebar. */
	const finishSuccess = useCallback(
		async (target: { targetWorkspaceId?: string; targetProjectId: string }) => {
			setOperationProgress(100)
			magicToast.success(t("audioRecordings:copy.success"))
			if (target.targetWorkspaceId) {
				try {
					await projectStore.loadProjectsForWorkspace(
						target.targetWorkspaceId,
						true,
						true,
					)
				} catch (error) {
					// Sidebar refresh is best-effort after the copy has succeeded.
					console.error("Failed to refresh target workspace after recording copy:", error)
				}
			}
			try {
				await onSuccess?.(target)
			} catch (error) {
				// Recording list refresh should not turn a completed copy into a failed copy.
				console.error("Failed to run recording copy success callback:", error)
			}
			window.setTimeout(() => {
				setIsOperating(false)
				setOperationProgress(0)
				setVisible(false)
				setCopyTarget(null)
				setSourceAttachments([])
				setSourceFileIds([])
				submitInFlightRef.current = false
			}, PROGRESS_RESET_DELAY_MS)
		},
		[onSuccess, t],
	)

	/** Polls backend batch-copy progress with the same terminal-state behavior as file copy. */
	const pollBatchOperation = useCallback(
		(batchKey: string, target: { targetWorkspaceId?: string; targetProjectId: string }) => {
			const timer = window.setInterval(async () => {
				try {
					const checkData = await SuperMagicApi.checkBatchOperationStatus(batchKey)
					if (checkData.status === "processing") {
						const progress = checkData.progress ? parseInt(checkData.progress, 10) : 0
						setOperationProgress(Number.isFinite(progress) ? progress : 0)
						return
					}

					if (checkData.status === "success" || checkData.status === "completed") {
						window.clearInterval(timer)
						await finishSuccess(target)
						return
					}

					window.clearInterval(timer)
					magicToast.error(t("audioRecordings:copy.failed"))
					setIsOperating(false)
					setOperationProgress(0)
				} catch (error) {
					console.error("Failed to poll recording copy batch operation:", error)
					window.clearInterval(timer)
					magicToast.error(t("audioRecordings:copy.failed"))
					setIsOperating(false)
					setOperationProgress(0)
				}
			}, BATCH_OPERATION_POLL_INTERVAL_MS)
		},
		[finishSuccess, t],
	)

	/** Executes root-level recording file copy after resolving conflicts against the target project. */
	const submitCopy = useCallback(
		async (data: CrossProjectCopySubmitData) => {
			if (!copyTarget?.id || isOperating || isPreparing || submitInFlightRef.current) return

			submitInFlightRef.current = true
			let keepSubmitGuardUntilClose = false
			setIsPreparing(true)
			try {
				const sourceTree = sourceAttachments.length
					? sourceAttachments
					: await loadCopyAttachments(copyTarget.id)
				const rootFileIds = sourceFileIds.length
					? sourceFileIds
					: resolveAudioCopyRootFileIds(sourceTree)
				if (rootFileIds.length === 0) {
					magicToast.error(t("audioRecordings:copy.noFiles"))
					return
				}

				setSourceAttachments(sourceTree)
				setSourceFileIds(rootFileIds)

				let targetProjectId = data.targetProjectId
				let targetWorkspaceId = data.targetWorkspaceId
				let targetTree: AttachmentItem[] = []
				let shouldCheckConflicts = true

				if (!targetProjectId) {
					if (!targetWorkspaceId) {
						magicToast.error(t("audioRecordings:copy.loadTargetsFailed"))
						return
					}

					const createdProject = await createNormalTargetProject(targetWorkspaceId)
					if (!createdProject?.id) {
						magicToast.error(t("audioRecordings:copy.failed"))
						return
					}

					targetProjectId = createdProject.id
					targetWorkspaceId = createdProject.workspace_id || targetWorkspaceId
					// A brand-new normal project has no target files, so conflict checks are unnecessary.
					shouldCheckConflicts = false
				} else {
					targetTree =
						data.targetAttachments.length > 0
							? data.targetAttachments
							: await loadCopyAttachments(targetProjectId)
				}
				let keepBothIds: string[] = []

				if (shouldCheckConflicts) {
					const folderConflicts = detectFolderConflictsForMove(
						rootFileIds,
						sourceTree,
						targetTree,
						data.targetPath,
					)
					if (folderConflicts.size > 0) {
						const folderChoice =
							await folderConflictHandler.checkConflicts(folderConflicts)
						if (!folderChoice.shouldProceed) return
						keepBothIds = [...keepBothIds, ...folderChoice.keepBothIds]
					}

					const duplicateDetectionIds = rootFileIds.filter(
						(id) => !keepBothIds.includes(id),
					)
					const duplicates =
						duplicateDetectionIds.length > 0
							? detectDuplicateFilesForMove(
									duplicateDetectionIds,
									sourceTree,
									targetTree,
									data.targetPath,
								)
							: new Map()
					if (duplicates.size > 0) {
						const duplicateChoice = await duplicateHandler.checkDuplicates(duplicates)
						if (!duplicateChoice.shouldProceed) return
						keepBothIds = [...keepBothIds, ...duplicateChoice.keepBothIds]
					}
				}

				setIsOperating(true)
				setOperationProgress(0)
				const targetParentId =
					data.targetPath.length > 0
						? data.targetPath[data.targetPath.length - 1].file_id || ""
						: ""
				const result = await SuperMagicApi.copyFiles({
					file_ids: rootFileIds,
					project_id: copyTarget.id,
					target_project_id: targetProjectId,
					target_parent_id: targetParentId,
					pre_file_id: "",
					keep_both_file_ids: keepBothIds,
				})

				if (result.status === "success") {
					keepSubmitGuardUntilClose = true
					await finishSuccess({ targetWorkspaceId, targetProjectId })
					return
				}

				if (result.status === "processing" && result.batch_key) {
					pollBatchOperation(result.batch_key, { targetWorkspaceId, targetProjectId })
					return
				}

				magicToast.error(t("audioRecordings:copy.failed"))
				setIsOperating(false)
				setOperationProgress(0)
			} catch (error) {
				console.error("Failed to copy audio recording project:", error)
				magicToast.error(t("audioRecordings:copy.failed"))
				setIsOperating(false)
				setOperationProgress(0)
			} finally {
				setIsPreparing(false)
				if (!keepSubmitGuardUntilClose) {
					submitInFlightRef.current = false
				}
			}
		},
		[
			copyTarget,
			createNormalTargetProject,
			duplicateHandler,
			finishSuccess,
			folderConflictHandler,
			isOperating,
			isPreparing,
			loadCopyAttachments,
			pollBatchOperation,
			sourceAttachments,
			sourceFileIds,
			t,
		],
	)

	return {
		visible,
		copyTarget,
		workspaces,
		sourceAttachments,
		sourceFileIds,
		defaultProjectName,
		isPreparing,
		isOperating,
		operationProgress,
		openCopyToProject,
		closeCopyDialog,
		submitCopy,
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

export type AudioRecordingCopyToProjectController = ReturnType<
	typeof useAudioRecordingCopyToProject
>
