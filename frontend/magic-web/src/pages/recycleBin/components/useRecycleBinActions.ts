import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRequest } from "ahooks"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { RecycleBinApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import {
	buildRestoreCheckPlan,
	excludeRestoreResourceIds,
	extractSuccessResourceIds,
	getMoveProjectIds,
	getRestoreFailureMessage,
	getRestoreResourceIds,
	getRestoreTargetResourceType,
	isRestorableResourceType,
	resolveNeedMove,
	resolvePendingRestore,
	shouldRestoreMicroAppWithoutMove,
	type DeleteTarget,
	type RecycleBinItem,
	type RestoreCheckResult,
	type RestoreTarget,
	type SelectPathTarget,
	type ResourceType,
	RESOURCE_TYPE,
} from "./recycle-bin-domain"

interface SelectPathSubmitPayload {
	targetProjectId: string
	targetPath: AttachmentItem[]
	targetAttachments: AttachmentItem[]
	sourceAttachments: AttachmentItem[]
}

type ConflictType =
	"parent_missing" | "name_conflict" | "project_missing" | "duplicate_restore_target"

type ConflictResolution = {
	parent_missing?: "restore_to_root"
	name_conflict?: "overwrite" | "skip"
}

type ConflictResolutions = Record<string, ConflictResolution>

type PendingNameConflictItem = {
	resourceId: string
	fileName: string
}

type PendingNameConflictRestore = {
	resourceType: ResourceType
	conflictResolutions?: ConflictResolutions
	items: PendingNameConflictItem[]
	currentIndex: number
}

type RestoreResourcesOptions = {
	showSuccessToast?: boolean
	showFailedToast?: boolean
	showSkippedToast?: boolean
	clearRestoreState?: boolean
}

type RestoreResourcesResult = {
	ok: boolean
	successCount: number
	failedCount: number
}

function parseRestoreCheckResponse(data: {
	items_need_move?: Array<{ resource_id: string }>
	items_no_need_move?: Array<{ resource_id: string }>
	items_with_conflict?: Array<{
		resource_id: string
		resource_name?: string
		space_type?: "user" | "project"
		conflict?: {
			type?: string
		}
	}>
	items_no_conflict?: Array<{ resource_id: string }>
}) {
	const oldNeedMove = Array.isArray(data?.items_need_move) ? data.items_need_move : []
	const oldNoNeedMove = Array.isArray(data?.items_no_need_move) ? data.items_no_need_move : []
	const withConflict = Array.isArray(data?.items_with_conflict) ? data.items_with_conflict : []
	const noConflict = Array.isArray(data?.items_no_conflict) ? data.items_no_conflict : []
	const toResourceIds = (list: Array<{ resource_id: string }>) =>
		list.map((item) => String(item.resource_id))

	const conflictResolutions: ConflictResolutions = {}
	const needMoveFromConflict = withConflict
		.filter((item) => item?.conflict?.type === "parent_missing")
		.map((item) => String(item.resource_id))
	const directResourceIds: string[] = []
	const skippedNameConflictNames: string[] = []
	const pendingNameConflictItems: PendingNameConflictItem[] = []
	let projectMissingCount = 0
	const projectMissingFileNames: string[] = []
	let duplicateRestoreTargetCount = 0
	const mustSkipResourceIds: string[] = []

	withConflict.forEach((item) => {
		const resourceId = String(item.resource_id)
		const conflictType = item?.conflict?.type as ConflictType | undefined
		if (conflictType === "parent_missing") {
			// 父级不存在：直接恢复到根目录
			conflictResolutions[resourceId] = {
				parent_missing: "restore_to_root",
			}
			directResourceIds.push(resourceId)
		}
		if (conflictType === "name_conflict") {
			const resourceName = item.resource_name?.trim()
			if (resourceName) skippedNameConflictNames.push(resourceName)
			pendingNameConflictItems.push({
				resourceId,
				fileName: resourceName || "",
			})
		}
		if (conflictType === "project_missing") {
			projectMissingCount += 1
			mustSkipResourceIds.push(resourceId)
			const resourceName = item.resource_name?.trim()
			if (resourceName) projectMissingFileNames.push(resourceName)
		}
		if (conflictType === "duplicate_restore_target") {
			duplicateRestoreTargetCount += 1
			mustSkipResourceIds.push(resourceId)
		}
	})

	const pendingNameConflictResourceIds = pendingNameConflictItems.map((item) => item.resourceId)
	const pendingNameConflictResourceIdSet = new Set(pendingNameConflictResourceIds)

	// 兼容老版 check 结构：items_need_move 也视为 parent_missing
	oldNeedMove.forEach((item) => {
		const resourceId = String(item.resource_id)
		if (pendingNameConflictResourceIdSet.has(resourceId)) return
		conflictResolutions[resourceId] = {
			...(conflictResolutions[resourceId] ?? {}),
			parent_missing: "restore_to_root",
		}
		directResourceIds.push(resourceId)
	})

	const noConflictResourceIds =
		oldNoNeedMove.length > 0 ? toResourceIds(oldNoNeedMove) : toResourceIds(noConflict)
	directResourceIds.push(...noConflictResourceIds)
	const rootSpaceTypes = Array.from(
		new Set(
			withConflict
				.filter((item) => item.conflict?.type === "parent_missing")
				.map((item) => item.space_type ?? "project"),
		),
	)
	const uniqueDirectResourceIds = Array.from(new Set(directResourceIds))
	const uniqueMustSkipResourceIds = Array.from(new Set(mustSkipResourceIds))

	return {
		itemsNeedMove:
			oldNeedMove.length > 0
				? excludeRestoreResourceIds(
						toResourceIds(oldNeedMove),
						pendingNameConflictResourceIds,
					)
				: excludeRestoreResourceIds(needMoveFromConflict, pendingNameConflictResourceIds),
		itemsNoNeedMove: excludeRestoreResourceIds(
			oldNoNeedMove.length > 0 ? toResourceIds(oldNoNeedMove) : toResourceIds(noConflict),
			pendingNameConflictResourceIds,
		),
		directResourceIds: uniqueDirectResourceIds,
		conflictResolutions,
		pendingNameConflictItems,
		mustSkipResourceIds: uniqueMustSkipResourceIds,
		rootSpaceTypes,
		skippedNameConflictCount: pendingNameConflictItems.length,
		skippedNameConflictNames,
		skippedNameConflictResourceIds: pendingNameConflictResourceIds,
		skippedNameConflictItems: pendingNameConflictItems,
		projectMissingCount,
		projectMissingFileNames,
		duplicateRestoreTargetCount,
	}
}

interface UseRecycleBinActionsParams {
	onRecordsChanged?: (result: {
		kind: "restore" | "permanent-delete"
		recordIds: string[]
	}) => void
	onMutationComplete?: () => void
	items: RecycleBinItem[]
	setItems: React.Dispatch<React.SetStateAction<RecycleBinItem[]>>
	selectedIds: string[]
	hasMixedSelectionTypes: boolean
	onRefresh: () => void
}

export function useRecycleBinActions({
	items,
	setItems,
	selectedIds,
	hasMixedSelectionTypes,
	onRefresh,
	onMutationComplete,
	onRecordsChanged,
}: UseRecycleBinActionsParams) {
	const { t } = useTranslation("super")
	const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
	const [moveProjectTarget, setMoveProjectTarget] = useState<RestoreTarget | null>(null)
	const [restoreCheckResult, setRestoreCheckResult] = useState<RestoreCheckResult | null>(null)
	const [moveProjectModalOpen, setMoveProjectModalOpen] = useState(false)
	const [selectPathModalOpen, setSelectPathModalOpen] = useState(false)
	const [selectPathTarget, setSelectPathTarget] = useState<SelectPathTarget | null>(null)
	const [selectPathWorkspaceId, setSelectPathWorkspaceId] = useState("")
	const [selectPathProjectId, setSelectPathProjectId] = useState("")
	const [pendingNameConflictRestore, setPendingNameConflictRestore] =
		useState<PendingNameConflictRestore | null>(null)
	const [isResolvingAllNameConflicts, setIsResolvingAllNameConflicts] = useState(false)
	const [pendingRestoreAfterMove, setPendingRestoreAfterMove] = useState<{
		resourceIds: string[]
		resourceType: ResourceType
	} | null>(null)

	const { runAsync: checkRecycleBinParent, loading: isCheckingRestore } = useRequest(
		RecycleBinApi.checkRecycleBinParent,
		{
			manual: true,
		},
	)

	const { runAsync: restoreRecycleBinResources, loading: isRestoring } = useRequest(
		RecycleBinApi.restoreRecycleBinResources,
		{
			manual: true,
		},
	)

	const { runAsync: moveRecycleBinProject, loading: isMoveProjectLoading } = useRequest(
		RecycleBinApi.moveRecycleBinProject,
		{
			manual: true,
		},
	)

	const { runAsync: batchMoveRecycleBinProject, loading: isBatchMoveProjectLoading } = useRequest(
		RecycleBinApi.batchMoveRecycleBinProject,
		{
			manual: true,
		},
	)

	const { runAsync: moveRecycleBinTopic } = useRequest(RecycleBinApi.moveRecycleBinTopic, {
		manual: true,
	})

	const { runAsync: batchMoveRecycleBinTopic } = useRequest(
		RecycleBinApi.batchMoveRecycleBinTopic,
		{
			manual: true,
		},
	)

	const { runAsync: permanentDeleteRecycleBin, loading: isPermanentDeleteLoading } = useRequest(
		RecycleBinApi.permanentDeleteRecycleBin,
		{
			manual: true,
		},
	)

	const isMoveProjectLoadingCombined = isMoveProjectLoading || isBatchMoveProjectLoading

	// 打开「选择路径」弹窗时拉取工作区列表
	useEffect(() => {
		if (!selectPathModalOpen || !selectPathTarget) return
		SuperMagicService.workspace
			.fetchWorkspaces({
				page: 1,
				isAutoSelect: false,
				isSelectLast: false,
			})
			.catch((error) => console.error(error))
	}, [selectPathModalOpen, selectPathTarget])

	// 选择工作区后拉取该项目列表
	useEffect(() => {
		if (selectPathTarget?.type !== "topic" || !selectPathWorkspaceId) return
		projectStore
			.loadProjectsForWorkspace(selectPathWorkspaceId)
			.catch((error) => console.error(error))
	}, [selectPathTarget?.type, selectPathWorkspaceId])

	const selectPathSelectedWorkspace: Workspace | undefined = selectPathWorkspaceId
		? workspaceStore.workspaces.find((w) => w.id === selectPathWorkspaceId)
		: undefined
	const selectPathSelectedProject: ProjectListItem | undefined =
		selectPathWorkspaceId && selectPathProjectId
			? projectStore
					.getProjectsByWorkspace(selectPathWorkspaceId)
					.find((p) => p.id === selectPathProjectId)
			: undefined

	function removeItemsByProjectIds(projectIds: string[]) {
		if (projectIds.length === 0) return
		setItems((prev) => prev.filter((item) => !projectIds.includes(item.resourceId)))
	}

	function removeItemsByResourceIds(resourceIds: string[]) {
		if (resourceIds.length === 0) return
		onRecordsChanged?.({
			kind: "restore",
			recordIds: items
				.filter((item) => resourceIds.includes(item.resourceId))
				.map((item) => item.id),
		})
		setItems((prev) => prev.filter((item) => !resourceIds.includes(item.resourceId)))
	}

	function refreshSidebarAfterRestore() {
		SuperMagicService.workspace
			.fetchWorkspaces({
				page: 1,
				isAutoSelect: false,
				isSelectLast: false,
			})
			.catch((error) => console.error(error))
		const selectedWorkspace = workspaceStore.selectedWorkspace
		if (selectedWorkspace?.id) {
			SuperMagicService.project
				.fetchProjects(
					{ workspaceId: selectedWorkspace.id, page: 1 },
					{ enableErrorMessagePrompt: false },
				)
				.catch((error) => console.error(error))
		}
	}

	function handleRestoreSuccess(count: number, showToast = true) {
		if (count <= 0) return
		if (showToast)
			magicToast.success(
				t("recycleBin.restoreSuccess.content", {
					count,
				}),
			)
		onMutationComplete?.()
		refreshSidebarAfterRestore()
		onRefresh()
	}

	async function runPendingRestoreAfterMove() {
		const pending = pendingRestoreAfterMove
		setPendingRestoreAfterMove(null)
		if (!pending?.resourceIds.length) return
		try {
			const data = await restoreRecycleBinResources({
				resource_ids: pending.resourceIds,
				resource_type: pending.resourceType,
			})
			const successResourceIds = extractSuccessResourceIds(data.results)
			removeItemsByResourceIds(successResourceIds)
			if (data.success_count > 0)
				handleRestoreSuccess(data.success_count, data.failed_count === 0)
			if (data.failed_count > 0) {
				const message = getRestoreFailureMessage(data, t)
				if (data.success_count > 0) magicToast.warning(message)
				else magicToast.error(message)
			}
		} catch {
			magicToast.error(t("operationFailed"))
		}
	}

	function openMoveDialog(resourceType: ResourceType | undefined, moveTarget: RestoreTarget) {
		if (!resourceType) return
		if (resourceType === RESOURCE_TYPE.PROJECT) {
			setMoveProjectTarget(moveTarget)
			setMoveProjectModalOpen(true)
			return
		}
		if (resourceType === RESOURCE_TYPE.TOPIC) {
			setSelectPathTarget({ type: "topic", target: moveTarget })
			setSelectPathWorkspaceId("")
			setSelectPathProjectId("")
			setSelectPathModalOpen(true)
		}
	}

	async function restoreResources({
		resourceType,
		resourceIds,
		conflictResolutions,
		skippedNameConflictCount = 0,
		options,
	}: {
		resourceType: ResourceType
		resourceIds: string[]
		conflictResolutions?: ConflictResolutions
		skippedNameConflictCount?: number
		options?: RestoreResourcesOptions
	}) {
		const {
			showSuccessToast = true,
			showFailedToast = true,
			showSkippedToast = true,
			clearRestoreState = true,
		} = options ?? {}
		try {
			const hasConflictResolutions =
				conflictResolutions && Object.keys(conflictResolutions).length > 0
			const data = await restoreRecycleBinResources({
				resource_ids: resourceIds,
				resource_type: resourceType,
				...(hasConflictResolutions ? { conflict_resolutions: conflictResolutions } : {}),
			})
			const successResourceIds = extractSuccessResourceIds(data.results)
			removeItemsByResourceIds(successResourceIds)
			if (data.success_count > 0 && showSuccessToast)
				handleRestoreSuccess(data.success_count, data.failed_count === 0)
			if (data.failed_count > 0 && showFailedToast) {
				const message = getRestoreFailureMessage(data, t)
				if (data.success_count > 0) magicToast.warning(message)
				else magicToast.error(message)
			}
			if (skippedNameConflictCount > 0 && showSkippedToast)
				magicToast.info(
					t("recycleBin.restoreCheck.nameConflictSkipped", {
						count: skippedNameConflictCount,
					}),
				)
			if (clearRestoreState) {
				setRestoreTarget(null)
				setRestoreCheckResult(null)
			}
			return {
				ok: true,
				successCount: data.success_count,
				failedCount: data.failed_count,
			} satisfies RestoreResourcesResult
		} catch {
			if (showFailedToast) magicToast.error(t("operationFailed"))
			return {
				ok: false,
				successCount: 0,
				failedCount: resourceIds.length,
			} satisfies RestoreResourcesResult
		}
	}

	function getCurrentPendingNameConflict() {
		if (!pendingNameConflictRestore) return null
		return pendingNameConflictRestore.items[pendingNameConflictRestore.currentIndex] ?? null
	}

	function advancePendingNameConflictQueue() {
		setPendingNameConflictRestore((prev) => {
			if (!prev) return null
			const nextIndex = prev.currentIndex + 1
			if (nextIndex >= prev.items.length) return null
			return {
				...prev,
				currentIndex: nextIndex,
			}
		})
	}

	async function restoreSingleNameConflict(strategy: "overwrite" | "skip") {
		const currentConflict = getCurrentPendingNameConflict()
		if (!currentConflict) return

		if (strategy === "skip") {
			advancePendingNameConflictQueue()
			return
		}
		if (!pendingNameConflictRestore) return

		const { resourceType, conflictResolutions } = pendingNameConflictRestore
		const restored = await restoreResources({
			resourceType,
			resourceIds: [currentConflict.resourceId],
			conflictResolutions: {
				...(conflictResolutions ?? {}),
				[currentConflict.resourceId]: {
					...(conflictResolutions?.[currentConflict.resourceId] ?? {}),
					name_conflict: strategy,
				},
			},
		})
		if (restored.ok) advancePendingNameConflictQueue()
	}

	async function handleNameConflictChoice(
		strategy: "overwrite" | "skip",
		applyToRemaining: boolean,
	) {
		if (applyToRemaining) {
			if (strategy === "skip") {
				skipAllNameConflicts()
				return
			}
			await restoreAllNameConflicts()
			return
		}

		await restoreSingleNameConflict(strategy)
	}

	async function restoreAllNameConflicts() {
		if (!pendingNameConflictRestore || isResolvingAllNameConflicts) return
		const remainingItems = pendingNameConflictRestore.items.slice(
			pendingNameConflictRestore.currentIndex,
		)
		if (remainingItems.length === 0) return

		setIsResolvingAllNameConflicts(true)
		const { resourceType, conflictResolutions } = pendingNameConflictRestore

		try {
			const overwriteConflictResolutions = Object.fromEntries(
				remainingItems.map((item) => [
					item.resourceId,
					{
						...(conflictResolutions?.[item.resourceId] ?? {}),
						name_conflict: "overwrite" as const,
					},
				]),
			)
			const result = await restoreResources({
				resourceType,
				resourceIds: remainingItems.map((item) => item.resourceId),
				conflictResolutions: {
					...(conflictResolutions ?? {}),
					...overwriteConflictResolutions,
				},
				options: {
					showSuccessToast: false,
					showFailedToast: false,
					showSkippedToast: false,
					clearRestoreState: false,
				},
			})

			if (result.successCount > 0) {
				handleRestoreSuccess(result.successCount, result.failedCount === 0)
			}
			if (result.failedCount > 0) {
				if (result.successCount > 0)
					magicToast.warning(
						t("recycleBin.restoreResult.failed", {
							failedCount: result.failedCount,
						}),
					)
				else magicToast.error(t("operationFailed"))
			}
		} finally {
			setPendingNameConflictRestore(null)
			setIsResolvingAllNameConflicts(false)
		}
	}

	function skipAllNameConflicts() {
		if (!pendingNameConflictRestore || isResolvingAllNameConflicts) return
		const remainingCount =
			pendingNameConflictRestore.items.length - pendingNameConflictRestore.currentIndex
		setPendingNameConflictRestore(null)
		if (remainingCount > 0) {
			magicToast.info(
				t("recycleBin.restoreCheck.nameConflictSkipped", { count: remainingCount }),
			)
		}
	}

	async function handleRestoreSelected() {
		if (selectedIds.length === 0) return
		if (hasMixedSelectionTypes) {
			magicToast.error(t("recycleBin.restoreCheck.mixedTypes"))
			return
		}

		if (selectedIds.length === 1) {
			const onlyId = selectedIds[0]
			const item = items.find((x) => x.id === onlyId)
			if (!item) return
			await openRestoreModal({ kind: "item", item })
			return
		}

		await openRestoreModal({ kind: "selection", itemIds: selectedIds })
	}

	function handleDeleteSelected() {
		if (selectedIds.length === 0) return

		if (selectedIds.length === 1) {
			const onlyId = selectedIds[0]
			const item = items.find((x) => x.id === onlyId)
			if (!item) return
			setDeleteTarget({ kind: "item", item })
			return
		}

		setDeleteTarget({ kind: "selection", itemIds: selectedIds })
	}

	async function handleConfirmRestore() {
		if (!restoreTarget) return

		if (restoreCheckResult?.status === "invalid" || restoreCheckResult?.status === "error")
			return
		const resourceType = getRestoreTargetResourceType({ target: restoreTarget, items })
		const canRestoreResourceIds = restoreCheckResult?.itemsNoNeedMove ?? []
		const directResourceIds = restoreCheckResult?.directResourceIds ?? canRestoreResourceIds
		const conflictResolutions = restoreCheckResult?.conflictResolutions ?? {}
		const nameConflictItems =
			restoreCheckResult?.pendingNameConflictItems ??
			restoreCheckResult?.skippedNameConflictItems ??
			[]
		const { needMoveItemIds } = resolveNeedMove(restoreCheckResult?.itemsNeedMove ?? [], items)
		const hasNeedMove = needMoveItemIds.length > 0
		const isFileRestore = resourceType === RESOURCE_TYPE.FILE

		if (isFileRestore && isRestorableResourceType(resourceType)) {
			setRestoreTarget(null)
			setRestoreCheckResult(null)
			if (directResourceIds.length > 0) {
				await restoreResources({
					resourceType,
					resourceIds: directResourceIds,
					conflictResolutions,
				})
			}
			if (nameConflictItems.length > 0) {
				setPendingNameConflictRestore({
					resourceType,
					conflictResolutions,
					items: nameConflictItems.map((item) => ({
						resourceId: item.resourceId,
						fileName: item.fileName || t("common.untitledFile"),
					})),
					currentIndex: 0,
				})
			}
			return
		}

		if (
			shouldRestoreMicroAppWithoutMove(resourceType, restoreCheckResult?.itemsNeedMove ?? [])
		) {
			await restoreResources({
				resourceType,
				resourceIds: directResourceIds,
			})
			return
		}

		// 有需移动的：先只打开选择路径弹窗，恢复接口等用户选完路径并确认后再调
		if (hasNeedMove) {
			setRestoreTarget(null)
			setRestoreCheckResult(null)
			setPendingRestoreAfterMove(resolvePendingRestore(resourceType, canRestoreResourceIds))
			const moveTarget: RestoreTarget = { kind: "selection", itemIds: needMoveItemIds }
			openMoveDialog(resourceType, moveTarget)
			return
		}

		// 无需移动的：直接调恢复接口
		if (canRestoreResourceIds.length > 0 && isRestorableResourceType(resourceType)) {
			await restoreResources({
				resourceType,
				resourceIds: canRestoreResourceIds,
			})
			return
		}

		if (isRestorableResourceType(resourceType)) {
			if (allResourceIds.length === 0) return
			await restoreResources({
				resourceType,
				resourceIds: allResourceIds,
			})
			return
		}

		if (restoreTarget.kind === "item") {
			setItems((prev) => prev.filter((item) => item.id !== restoreTarget.item.id))
			setRestoreTarget(null)
			setRestoreCheckResult(null)
			onRefresh()
			return
		}

		setItems((prev) => prev.filter((item) => !restoreTarget.itemIds.includes(item.id)))
		setRestoreTarget(null)
		setRestoreCheckResult(null)
		onRefresh()
	}

	async function handleConfirmDelete() {
		if (!deleteTarget) return

		const ids: string[] =
			deleteTarget.kind === "item" ? [deleteTarget.item.id] : deleteTarget.itemIds
		if (ids.length === 0) {
			setDeleteTarget(null)
			return
		}

		try {
			const data = await permanentDeleteRecycleBin({ ids })
			const failedIdSet = new Set(data.failed.map((f) => String(f.id)))
			const successIdStrings = ids.filter((id) => !failedIdSet.has(id))
			onRecordsChanged?.({ kind: "permanent-delete", recordIds: successIdStrings })

			setItems((prev) => {
				const nextItems = prev.filter((item) => !successIdStrings.includes(item.id))
				return nextItems
			})
			if (data.failed.length > 0) {
				magicToast.error(t("operationFailed"))
			}
			if (successIdStrings.length > 0) {
				onMutationComplete?.()
				magicToast.success(
					t("recycleBin.deleteSuccess.content", { count: successIdStrings.length }),
				)
				onRefresh()
			}
		} catch {
			magicToast.error(t("operationFailed"))
		} finally {
			setDeleteTarget(null)
		}
	}

	async function handleMoveProject(workspaceId: string) {
		if (!moveProjectTarget) return
		const projectIds = getMoveProjectIds({
			target: moveProjectTarget,
			items,
		})
		if (projectIds.length === 0) {
			setMoveProjectModalOpen(false)
			setMoveProjectTarget(null)
			return
		}

		try {
			if (projectIds.length === 1) {
				const [projectId] = projectIds
				const data = await moveRecycleBinProject({
					source_project_id: projectId,
					target_workspace_id: workspaceId,
				})
				if (!data?.success) {
					magicToast.error(t("operationFailed"))
					return
				}
				removeItemsByProjectIds(projectIds)
				handleRestoreSuccess(projectIds.length)
				await runPendingRestoreAfterMove()
				setMoveProjectModalOpen(false)
				setMoveProjectTarget(null)
				return
			}

			const data = await batchMoveRecycleBinProject({
				project_ids: projectIds,
				target_workspace_id: workspaceId,
			})
			const successProjectIds = data.results
				.filter((result) => result.success)
				.map((result) => result.project_id)
			removeItemsByProjectIds(successProjectIds)
			if (data.failed > 0) {
				const firstFailedMessage = data.results.find((result) => !result.success)?.message
				if (firstFailedMessage) magicToast.error(firstFailedMessage)
				else magicToast.error(t("operationFailed"))
			}
			handleRestoreSuccess(successProjectIds.length)
			await runPendingRestoreAfterMove()
			setMoveProjectModalOpen(false)
			setMoveProjectTarget(null)
		} catch {
			magicToast.error(t("operationFailed"))
		}
	}

	async function handleMoveTopic(targetProjectId: string) {
		if (!selectPathTarget || selectPathTarget.type !== "topic") return
		const topicIds = getRestoreResourceIds({ target: selectPathTarget.target, items })
		if (topicIds.length === 0) return
		try {
			if (topicIds.length === 1) {
				const data = await moveRecycleBinTopic({
					source_topic_id: topicIds[0],
					target_project_id: targetProjectId,
				})
				if (!data?.success) {
					magicToast.error(t("operationFailed"))
					return
				}
				removeItemsByResourceIds([data.topic_id])
				handleRestoreSuccess(1)
			} else {
				const data = await batchMoveRecycleBinTopic({
					topic_ids: topicIds,
					target_project_id: targetProjectId,
				})
				const successTopicIds = data.results
					.filter((result) => result.success)
					.map((result) => result.topic_id)
				removeItemsByResourceIds(successTopicIds)
				if (data.failed > 0) {
					const firstFailedMessage = data.results.find(
						(result) => !result.success,
					)?.message
					if (firstFailedMessage) magicToast.error(firstFailedMessage)
					else magicToast.error(t("operationFailed"))
				}
				handleRestoreSuccess(data.success)
			}
			await runPendingRestoreAfterMove()
			setSelectPathModalOpen(false)
			setSelectPathTarget(null)
			setSelectPathWorkspaceId("")
			setSelectPathProjectId("")
		} catch {
			magicToast.error(t("operationFailed"))
		}
	}

	function handleMoveProjectClose() {
		setMoveProjectModalOpen(false)
		setMoveProjectTarget(null)
		setPendingRestoreAfterMove(null)
	}

	function handleSelectPathClose() {
		setSelectPathModalOpen(false)
		setSelectPathTarget(null)
		setSelectPathWorkspaceId("")
		setSelectPathProjectId("")
		setPendingRestoreAfterMove(null)
	}

	async function handleSelectPathSubmit(data: SelectPathSubmitPayload) {
		if (selectPathTarget?.type === "topic") {
			await handleMoveTopic(data.targetProjectId)
			return
		}
		handleSelectPathClose()
	}

	async function openRestoreModal(target: RestoreTarget) {
		const plan = buildRestoreCheckPlan({ target, items })
		if (plan.status === "invalid") {
			setRestoreCheckResult({
				itemsNeedMove: [],
				itemsNoNeedMove: [],
				messageKey: plan.messageKey,
				shouldBlockRestore: true,
				status: "invalid",
			})
			setRestoreTarget(target)
			return
		}

		try {
			const data = await checkRecycleBinParent(plan.payload)
			const {
				itemsNeedMove,
				itemsNoNeedMove,
				directResourceIds,
				conflictResolutions,
				skippedNameConflictCount,
				skippedNameConflictNames,
				skippedNameConflictResourceIds,
				pendingNameConflictItems,
				mustSkipResourceIds,
				projectMissingCount,
				projectMissingFileNames,
				duplicateRestoreTargetCount,
				rootSpaceTypes,
			} = parseRestoreCheckResponse(data)

			if (
				target.kind === "item" &&
				plan.payload.resource_type === RESOURCE_TYPE.FILE &&
				skippedNameConflictResourceIds.length === 1 &&
				skippedNameConflictResourceIds[0] === target.item.resourceId
			) {
				setPendingNameConflictRestore({
					resourceType: target.item.resourceType,
					conflictResolutions,
					items: [
						{
							resourceId: target.item.resourceId,
							fileName: skippedNameConflictNames[0] || target.item.title,
						},
					],
					currentIndex: 0,
				})
				setRestoreTarget(null)
				setRestoreCheckResult(null)
				return
			}

			setRestoreCheckResult({
				itemsNeedMove,
				itemsNoNeedMove,
				directResourceIds,
				conflictResolutions,
				pendingNameConflictItems,
				mustSkipResourceIds,
				skippedNameConflictCount,
				skippedNameConflictNames,
				skippedNameConflictResourceIds,
				projectMissingCount,
				projectMissingFileNames,
				duplicateRestoreTargetCount,
				rootSpaceTypes,
				shouldBlockRestore: false,
				status: "success",
			})
		} catch {
			setRestoreCheckResult({
				itemsNeedMove: [],
				itemsNoNeedMove: [],
				messageKey: "recycleBin.restoreCheck.errorMessage",
				shouldBlockRestore: true,
				status: "error",
			})
		}

		setRestoreTarget(target)
	}

	function handleRestoreModalOpenChange(open: boolean) {
		if (open) return
		setRestoreTarget(null)
		setRestoreCheckResult(null)
	}

	function handleNameConflictRestoreCancel() {
		if (isResolvingAllNameConflicts) return
		setPendingNameConflictRestore(null)
	}

	function handleDeleteModalOpenChange(open: boolean) {
		if (open) return
		setDeleteTarget(null)
	}

	const currentPendingNameConflict = getCurrentPendingNameConflict()
	const pendingNameConflictCount = pendingNameConflictRestore
		? pendingNameConflictRestore.items.length - pendingNameConflictRestore.currentIndex
		: 0

	return {
		restoreTarget,
		isActionPending:
			isCheckingRestore ||
			isRestoring ||
			isPermanentDeleteLoading ||
			isResolvingAllNameConflicts,
		restoreCheckResult,
		pendingNameConflictRestore: currentPendingNameConflict
			? {
					fileName: currentPendingNameConflict.fileName,
					pendingCount: pendingNameConflictCount,
				}
			: null,
		isResolvingAllNameConflicts,
		deleteTarget,
		moveProjectModalOpen,
		selectPathModalOpen,
		selectPathTarget,
		selectPathSelectedWorkspace,
		selectPathSelectedProject,
		workspaces: workspaceStore.workspaces,
		isMoveProjectLoadingCombined,
		isPermanentDeleteLoading,
		handleRestoreSelected,
		handleDeleteSelected,
		handleConfirmRestore,
		handleConfirmDelete,
		handleMoveProject,
		handleMoveProjectClose,
		handleSelectPathClose,
		handleSelectPathSubmit,
		handleNameConflictRestoreCancel,
		handleNameConflictRestoreReplace: (applyToRemaining: boolean) =>
			handleNameConflictChoice("overwrite", applyToRemaining),
		handleNameConflictRestoreSkip: (applyToRemaining: boolean) =>
			handleNameConflictChoice("skip", applyToRemaining),
		openRestoreModal,
		setDeleteTarget,
		handleRestoreModalOpenChange,
		handleDeleteModalOpenChange,
		setSelectPathWorkspaceId,
		setSelectPathProjectId,
	}
}
