import { useCallback, useMemo, useRef, useState } from "react"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { RecycleBinApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import {
	buildRestoreCheckPlan,
	extractSuccessResourceIds,
	getCategoryLabel,
	getDeleteModalDescription,
	getDeleteModalTitle,
	getMoveProjectIds,
	getRestoreModalTitle,
	getRestoreResourceIds,
	resolveNeedMove,
	resolvePendingRestore,
	RESOURCE_TYPE,
	type DeleteTarget,
	type ResourceType,
	type RestoreTarget,
	type SelectPathTarget,
} from "@/pages/recycleBin/components/recycle-bin-domain"
import type { RecycleBinItemData } from "../components/RecycleBinItem"
import { mobileItemDataToDomain } from "./mobileRecycleBinMappers"

export interface SelectPathSubmitPayload {
	targetProjectId: string
	targetPath: AttachmentItem[]
	targetAttachments: AttachmentItem[]
	sourceAttachments: AttachmentItem[]
}

function toResourceIds(list: Array<{ resource_id: string }>): string[] {
	return list.map((x) => String(x.resource_id))
}

export function useMobileRecycleBinRestoreFlow(props: {
	items: RecycleBinItemData[]
	setItems: React.Dispatch<React.SetStateAction<RecycleBinItemData[]>>
	selectedIds: string[]
	setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
	queryParams: { keyword?: string; order: "desc" | "asc"; page: number; page_size: number }
	run: (params: typeof props.queryParams) => void
}) {
	const { items, setItems, selectedIds, setSelectedIds, queryParams, run } = props
	const { t } = useTranslation("super")

	const domainItems = useMemo(() => items.map(mobileItemDataToDomain), [items])

	const [moveProjectModalOpen, setMoveProjectModalOpen] = useState(false)
	const [moveProjectTarget, setMoveProjectTarget] = useState<RestoreTarget | null>(null)
	const [isMoveProjectLoading, setIsMoveProjectLoading] = useState(false)
	const [selectPathModalOpen, setSelectPathModalOpen] = useState(false)
	const [selectPathTarget, setSelectPathTarget] = useState<SelectPathTarget | null>(null)
	const [selectPathWorkspaceId, setSelectPathWorkspaceId] = useState("")
	const [selectPathProjectId, setSelectPathProjectId] = useState("")
	const [pendingRestoreAfterMove, setPendingRestoreAfterMove] = useState<{
		resourceIds: string[]
		resourceType: ResourceType
	} | null>(null)

	const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

	const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
	const [restoreConfirmItemId, setRestoreConfirmItemId] = useState<string | null>(null)

	const [orphanMixedOpen, setOrphanMixedOpen] = useState(false)
	const orphanMixedContextRef = useRef<{
		resourceType: ResourceType
		needMoveItemIds: string[]
		noNeedMoveResourceIds: string[]
	} | null>(null)

	const handleRestoreSuccess = useCallback(
		(count: number) => {
			if (count <= 0) return
			magicToast.success(t("recycleBin.restoreSuccess.content", { count }))
			run(queryParams)
			SuperMagicService.workspace
				.fetchWorkspaces({
					page: 1,
					isAutoSelect: false,
					isSelectLast: false,
				})
				.catch((error) => console.error(error))
		},
		[t, queryParams, run],
	)

	const runPendingRestoreAfterMove = useCallback(async () => {
		const pending = pendingRestoreAfterMove
		setPendingRestoreAfterMove(null)
		if (!pending?.resourceIds.length) return
		try {
			const data = await RecycleBinApi.restoreRecycleBinResources({
				resource_ids: pending.resourceIds,
				resource_type: pending.resourceType,
			})
			const successIds = extractSuccessResourceIds(data.results)
				.map((rid) => items.find((i) => i.resourceId === rid)?.id)
				.filter(Boolean) as string[]
			setItems((prev) => prev.filter((item) => !successIds.includes(item.id)))
			setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)))
			if (data.success_count > 0) handleRestoreSuccess(data.success_count)
			if (data.failed_count > 0) magicToast.error(t("operationFailed"))
		} catch {
			magicToast.error(t("operationFailed"))
		}
	}, [pendingRestoreAfterMove, items, handleRestoreSuccess, t, setItems, setSelectedIds])

	const removeItemsByProjectIds = useCallback(
		(projectIds: string[]) => {
			if (projectIds.length === 0) return
			setItems((prev) => prev.filter((item) => !projectIds.includes(item.resourceId)))
			setSelectedIds((prev) =>
				prev.filter((id) => {
					const item = items.find((i) => i.id === id)
					return !item || !projectIds.includes(item.resourceId)
				}),
			)
		},
		[items, setItems, setSelectedIds],
	)

	const removeItemsByResourceIds = useCallback(
		(resourceIds: string[]) => {
			if (resourceIds.length === 0) return
			setItems((prev) => prev.filter((item) => !resourceIds.includes(item.resourceId)))
			setSelectedIds((prev) =>
				prev.filter((id) => {
					const item = items.find((i) => i.id === id)
					return !item || !resourceIds.includes(item.resourceId)
				}),
			)
		},
		[items, setItems, setSelectedIds],
	)

	const openMoveAfterCheck = useCallback(
		(
			resourceType: ResourceType,
			needMoveItemIds: string[],
			noNeedMoveResourceIds: string[],
			itemsSnapshot: RecycleBinItemData[],
		) => {
			if (
				noNeedMoveResourceIds.length > 0 &&
				(resourceType === RESOURCE_TYPE.WORKSPACE ||
					resourceType === RESOURCE_TYPE.PROJECT ||
					resourceType === RESOURCE_TYPE.TOPIC)
			) {
				setPendingRestoreAfterMove(
					resolvePendingRestore(resourceType, noNeedMoveResourceIds),
				)
			}
			const singleItem =
				needMoveItemIds.length === 1
					? itemsSnapshot.find((i) => i.id === needMoveItemIds[0])
					: undefined
			const moveTarget: RestoreTarget =
				singleItem != null
					? { kind: "item", item: mobileItemDataToDomain(singleItem) }
					: {
							kind: "selection",
							itemIds: needMoveItemIds,
						}
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
				return
			}
			if (resourceType === RESOURCE_TYPE.FILE) {
				setSelectPathTarget({ type: "file", target: moveTarget })
				setSelectPathWorkspaceId("")
				setSelectPathProjectId("")
				setSelectPathModalOpen(true)
			}
		},
		[],
	)

	const runRestoreDirect = useCallback(
		async (resourceType: ResourceType, resourceIds: string[]) => {
			if (resourceIds.length === 0) return
			try {
				const data = await RecycleBinApi.restoreRecycleBinResources({
					resource_ids: resourceIds,
					resource_type: resourceType,
				})
				const successIds = extractSuccessResourceIds(data.results)
					.map((rid) => items.find((i) => i.resourceId === rid)?.id)
					.filter(Boolean) as string[]
				setItems((prev) => prev.filter((item) => !successIds.includes(item.id)))
				setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)))
				if (data.success_count > 0) handleRestoreSuccess(data.success_count)
				if (data.failed_count > 0) magicToast.error(t("operationFailed"))
			} catch {
				magicToast.error(t("operationFailed"))
			}
		},
		[items, handleRestoreSuccess, t, setItems, setSelectedIds],
	)

	const executeCheckAndRestore = useCallback(
		async (target: RestoreTarget) => {
			const plan = buildRestoreCheckPlan({ target, items: domainItems })
			if (plan.status === "invalid") {
				magicToast.error(t(plan.messageKey))
				return
			}
			if (plan.status === "skip") {
				magicToast.info(t("mobile.recycleBin.restoreFileTip"))
				return
			}
			if (plan.status !== "ready") return

			try {
				const check = await RecycleBinApi.checkRecycleBinParent(plan.payload)
				const rawNeedMove = Array.isArray(check?.items_need_move)
					? check.items_need_move
					: []
				const rawNoNeedMove = Array.isArray(check?.items_no_need_move)
					? check.items_no_need_move
					: []
				const needMoveResourceIds = toResourceIds(rawNeedMove)
				const noNeedMoveResourceIds = toResourceIds(rawNoNeedMove)
				const { needMoveItemIds } = resolveNeedMove(needMoveResourceIds, domainItems)
				const hasNeedMove = needMoveItemIds.length > 0
				const resourceType = plan.payload.resource_type

				if (
					hasNeedMove &&
					noNeedMoveResourceIds.length > 0 &&
					(resourceType === RESOURCE_TYPE.WORKSPACE ||
						resourceType === RESOURCE_TYPE.PROJECT ||
						resourceType === RESOURCE_TYPE.TOPIC)
				) {
					orphanMixedContextRef.current = {
						resourceType,
						needMoveItemIds,
						noNeedMoveResourceIds,
					}
					setOrphanMixedOpen(true)
					return
				}

				if (hasNeedMove) {
					openMoveAfterCheck(resourceType, needMoveItemIds, noNeedMoveResourceIds, items)
					return
				}

				if (noNeedMoveResourceIds.length === 0) return
				await runRestoreDirect(resourceType, noNeedMoveResourceIds)
			} catch {
				magicToast.error(t("operationFailed"))
			}
		},
		[domainItems, items, openMoveAfterCheck, runRestoreDirect, t],
	)

	const requestRestoreSelection = useCallback(() => {
		if (selectedIds.length === 0) return
		setRestoreConfirmItemId(null)
		setRestoreConfirmOpen(true)
	}, [selectedIds.length])

	const requestRestoreSingle = useCallback((itemId: string) => {
		setRestoreConfirmItemId(itemId)
		setRestoreConfirmOpen(true)
	}, [])

	const confirmRestore = useCallback(async () => {
		const itemId = restoreConfirmItemId
		setRestoreConfirmOpen(false)
		setRestoreConfirmItemId(null)

		const target: RestoreTarget | null =
			itemId != null
				? (() => {
						const row = domainItems.find((i) => i.id === itemId)
						return row ? { kind: "item" as const, item: row } : null
					})()
				: { kind: "selection" as const, itemIds: selectedIds }

		if (!target) return
		await executeCheckAndRestore(target)
	}, [restoreConfirmItemId, selectedIds, domainItems, executeCheckAndRestore])

	const handleOrphanContinueToMove = useCallback(() => {
		const ctx = orphanMixedContextRef.current
		setOrphanMixedOpen(false)
		if (!ctx) return
		const { resourceType, needMoveItemIds, noNeedMoveResourceIds } = ctx
		orphanMixedContextRef.current = null
		openMoveAfterCheck(resourceType, needMoveItemIds, noNeedMoveResourceIds, items)
	}, [items, openMoveAfterCheck])

	const handleOrphanRestoreDirectOnly = useCallback(async () => {
		const ctx = orphanMixedContextRef.current
		setOrphanMixedOpen(false)
		orphanMixedContextRef.current = null
		if (!ctx) return
		const { resourceType, noNeedMoveResourceIds } = ctx
		await runRestoreDirect(resourceType, noNeedMoveResourceIds)
	}, [runRestoreDirect])

	const requestPermanentDelete = useCallback(() => {
		if (selectedIds.length === 0) return
		if (selectedIds.length === 1) {
			const only = domainItems.find((i) => i.id === selectedIds[0])
			if (only) setDeleteTarget({ kind: "item", item: only })
		} else {
			setDeleteTarget({ kind: "selection", itemIds: selectedIds })
		}
		setPurgeConfirmOpen(true)
	}, [selectedIds, domainItems])

	const requestPermanentDeleteSingle = useCallback(
		(itemId: string) => {
			const row = domainItems.find((i) => i.id === itemId)
			if (!row) return
			setDeleteTarget({ kind: "item", item: row })
			setPurgeConfirmOpen(true)
		},
		[domainItems],
	)

	const confirmPermanentDelete = useCallback(async () => {
		setPurgeConfirmOpen(false)
		if (!deleteTarget) return
		const ids = deleteTarget.kind === "item" ? [deleteTarget.item.id] : deleteTarget.itemIds
		if (ids.length === 0) {
			setDeleteTarget(null)
			return
		}
		try {
			const data = await RecycleBinApi.permanentDeleteRecycleBin({ ids })
			const failedSet = new Set(data.failed.map((f) => String(f.id)))
			const successIds = ids.filter((id) => !failedSet.has(id))
			setItems((prev) => prev.filter((item) => !successIds.includes(item.id)))
			setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)))
			if (successIds.length > 0) {
				magicToast.success(
					t("recycleBin.deleteSuccess.content", { count: successIds.length }),
				)
				run(queryParams)
			}
			if (data.failed.length > 0) magicToast.error(t("operationFailed"))
		} catch {
			magicToast.error(t("operationFailed"))
		} finally {
			setDeleteTarget(null)
		}
	}, [deleteTarget, queryParams, run, t, setItems, setSelectedIds])

	const handleMoveProject = useCallback(
		async (workspaceId: string) => {
			if (!moveProjectTarget) return
			const projectIds = getMoveProjectIds({ target: moveProjectTarget, items: domainItems })
			if (projectIds.length === 0) {
				setMoveProjectModalOpen(false)
				setMoveProjectTarget(null)
				return
			}
			try {
				setIsMoveProjectLoading(true)
				if (projectIds.length === 1) {
					const data = await RecycleBinApi.moveRecycleBinProject({
						source_project_id: projectIds[0],
						target_workspace_id: workspaceId,
					})
					if (!data?.success) {
						magicToast.error(t("operationFailed"))
						return
					}
					removeItemsByProjectIds(projectIds)
					handleRestoreSuccess(projectIds.length)
				} else {
					const data = await RecycleBinApi.batchMoveRecycleBinProject({
						project_ids: projectIds,
						target_workspace_id: workspaceId,
					})
					const successProjectIds = (data.results || [])
						.filter((r) => r.success)
						.map((r) => r.project_id)
					removeItemsByProjectIds(successProjectIds)
					handleRestoreSuccess(successProjectIds.length)
					if ((data.failed ?? 0) > 0) magicToast.error(t("operationFailed"))
				}
				await runPendingRestoreAfterMove()
				setMoveProjectModalOpen(false)
				setMoveProjectTarget(null)
			} catch {
				magicToast.error(t("operationFailed"))
			} finally {
				setIsMoveProjectLoading(false)
			}
		},
		[
			moveProjectTarget,
			domainItems,
			t,
			removeItemsByProjectIds,
			handleRestoreSuccess,
			runPendingRestoreAfterMove,
		],
	)

	const handleMoveTopic = useCallback(
		async (targetProjectId: string) => {
			if (!selectPathTarget || selectPathTarget.type !== "topic") return
			const topicIds = getRestoreResourceIds({
				target: selectPathTarget.target,
				items: domainItems,
			})
			if (topicIds.length === 0) return
			try {
				if (topicIds.length === 1) {
					const data = await RecycleBinApi.moveRecycleBinTopic({
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
					const data = await RecycleBinApi.batchMoveRecycleBinTopic({
						topic_ids: topicIds,
						target_project_id: targetProjectId,
					})
					const successTopicIds = (data.results || [])
						.filter((r) => r.success)
						.map((r) => r.topic_id)
					removeItemsByResourceIds(successTopicIds)
					handleRestoreSuccess(successTopicIds.length)
					if ((data.failed ?? 0) > 0) magicToast.error(t("operationFailed"))
				}
				await runPendingRestoreAfterMove()
				setSelectPathModalOpen(false)
				setSelectPathTarget(null)
				setSelectPathWorkspaceId("")
				setSelectPathProjectId("")
			} catch {
				magicToast.error(t("operationFailed"))
			}
		},
		[
			selectPathTarget,
			domainItems,
			t,
			removeItemsByResourceIds,
			handleRestoreSuccess,
			runPendingRestoreAfterMove,
		],
	)

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
		if (selectPathTarget?.type === "file") {
			magicToast.info(t("mobile.recycleBin.restoreFileTip"))
			handleSelectPathClose()
			return
		}
		handleSelectPathClose()
	}

	const selectPathSelectedWorkspace: Workspace | undefined = selectPathWorkspaceId
		? workspaceStore.workspaces.find((w) => w.id === selectPathWorkspaceId)
		: undefined
	const selectPathSelectedProject: ProjectListItem | undefined =
		selectPathWorkspaceId && selectPathProjectId
			? projectStore
					.getProjectsByWorkspace(selectPathWorkspaceId)
					.find((p) => p.id === selectPathProjectId)
			: undefined

	const restoreConfirmTitle = useMemo(() => {
		if (!restoreConfirmOpen) return ""
		if (restoreConfirmItemId) {
			const row = domainItems.find((i) => i.id === restoreConfirmItemId)
			return row ? getRestoreModalTitle({ kind: "item", item: row }, t as TFunction) : ""
		}
		return getRestoreModalTitle({ kind: "selection", itemIds: selectedIds }, t as TFunction)
	}, [restoreConfirmOpen, restoreConfirmItemId, domainItems, selectedIds, t])

	const purgeConfirmTitle = useMemo(() => {
		if (!deleteTarget) return ""
		return getDeleteModalTitle(deleteTarget, t as TFunction)
	}, [deleteTarget, t])

	const purgeConfirmDescription = useMemo(() => {
		if (!deleteTarget) return ""
		return getDeleteModalDescription(deleteTarget, t as TFunction, (c) =>
			getCategoryLabel(c, t as TFunction),
		)
	}, [deleteTarget, t])

	const closeOrphanMixed = useCallback(() => {
		orphanMixedContextRef.current = null
		setOrphanMixedOpen(false)
	}, [])

	const closePurgeConfirm = useCallback(() => {
		setPurgeConfirmOpen(false)
		setDeleteTarget(null)
	}, [])

	const closeRestoreConfirm = useCallback(() => {
		setRestoreConfirmOpen(false)
		setRestoreConfirmItemId(null)
	}, [])

	return {
		moveProjectModalOpen,
		moveProjectTarget,
		isMoveProjectLoading,
		selectPathModalOpen,
		selectPathTarget,
		selectPathWorkspaceId,
		setSelectPathWorkspaceId,
		selectPathProjectId,
		setSelectPathProjectId,
		selectPathSelectedWorkspace,
		selectPathSelectedProject,
		purgeConfirmOpen,
		setPurgeConfirmOpen,
		deleteTarget,
		restoreConfirmOpen,
		setRestoreConfirmOpen,
		restoreConfirmTitle,
		restoreConfirmItemId,
		orphanMixedOpen,
		setOrphanMixedOpen,
		requestRestoreSelection,
		requestRestoreSingle,
		confirmRestore,
		requestPermanentDelete,
		requestPermanentDeleteSingle,
		confirmPermanentDelete,
		handleMoveProject,
		handleMoveProjectClose: () => {
			setMoveProjectModalOpen(false)
			setMoveProjectTarget(null)
			setPendingRestoreAfterMove(null)
		},
		handleSelectPathClose,
		handleSelectPathSubmit,
		purgeConfirmTitle,
		purgeConfirmDescription,
		handleOrphanContinueToMove,
		handleOrphanRestoreDirectOnly,
		closeOrphanMixed,
		closePurgeConfirm,
		closeRestoreConfirm,
	}
}
