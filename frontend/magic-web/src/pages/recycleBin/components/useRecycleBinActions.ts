import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRequest } from "ahooks"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { RecycleBinApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import type {
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import {
	buildRestoreCheckPlan,
	extractSuccessResourceIds,
	getMoveProjectIds,
	getRestoreResourceIds,
	getRestoreTargetResourceType,
	isRestorableResourceType,
	resolveNeedMove,
	resolvePendingRestore,
	type DeleteTarget,
	type RecycleBinItem,
	type RestoreCheckResult,
	type RestoreTarget,
	type SelectPathTarget,
	type ResourceType,
	updateTabCounts,
	RESOURCE_TYPE,
} from "./recycle-bin-domain"

interface SelectPathSubmitPayload {
	targetProjectId: string
	targetPath: AttachmentItem[]
	targetAttachments: AttachmentItem[]
	sourceAttachments: AttachmentItem[]
}

interface UseRecycleBinActionsParams {
	items: RecycleBinItem[]
	setItems: React.Dispatch<React.SetStateAction<RecycleBinItem[]>>
	selectedIds: string[]
	hasMixedSelectionTypes: boolean
	onTabCountChange?: (tabId: string, count: number) => void
	onRefresh: () => void
}

export function useRecycleBinActions({
	items,
	setItems,
	selectedIds,
	hasMixedSelectionTypes,
	onTabCountChange,
	onRefresh,
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
	const [pendingRestoreAfterMove, setPendingRestoreAfterMove] = useState<{
		resourceIds: string[]
		resourceType: ResourceType
	} | null>(null)

	const { runAsync: checkRecycleBinParent } = useRequest(RecycleBinApi.checkRecycleBinParent, {
		manual: true,
	})

	const { runAsync: restoreRecycleBinResources } = useRequest(
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

	function handleRestoreSuccess(count: number) {
		if (count <= 0) return
		magicToast.success(
			t("recycleBin.restoreSuccess.content", {
				count,
			}),
		)
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
			if (data.failed_count > 0) magicToast.error(t("operationFailed"))
			if (data.success_count > 0) handleRestoreSuccess(data.success_count)
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
			return
		}
		if (resourceType === RESOURCE_TYPE.FILE) {
			setSelectPathTarget({ type: "file", target: moveTarget })
			setSelectPathModalOpen(true)
		}
	}

	async function restoreResources({
		resourceType,
		resourceIds,
	}: {
		resourceType: ResourceType
		resourceIds: string[]
	}) {
		try {
			const data = await restoreRecycleBinResources({
				resource_ids: resourceIds,
				resource_type: resourceType,
			})
			const successResourceIds = extractSuccessResourceIds(data.results)
			removeItemsByResourceIds(successResourceIds)
			if (data.failed_count > 0) magicToast.error(t("operationFailed"))
			handleRestoreSuccess(data.success_count)
			setRestoreTarget(null)
			setRestoreCheckResult(null)
		} catch {
			magicToast.error(t("operationFailed"))
		}
	}

	async function handleRestoreSelected() {
		if (selectedIds.length === 0) return
		if (hasMixedSelectionTypes) return

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
		const allResourceIds = getRestoreResourceIds({ target: restoreTarget, items })
		const canRestoreResourceIds = restoreCheckResult?.itemsNoNeedMove ?? []
		const { needMoveItemIds } = resolveNeedMove(restoreCheckResult?.itemsNeedMove ?? [], items)
		const hasNeedMove = needMoveItemIds.length > 0

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

			setItems((prev) => {
				const nextItems = prev.filter((item) => !successIdStrings.includes(item.id))
				if (successIdStrings.length > 0) {
					updateTabCounts({
						items: nextItems,
						onTabCountChange,
					})
				}
				return nextItems
			})
			if (data.failed.length > 0) {
				magicToast.error(t("operationFailed"))
			}
			if (successIdStrings.length > 0) {
				magicToast.success(
					t("recycleBin.deleteSuccess.content", { count: successIdStrings.length }),
				)
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

		if (plan.status === "skip") {
			setRestoreCheckResult({
				itemsNeedMove: [],
				itemsNoNeedMove: [],
				shouldBlockRestore: false,
				status: "skipped",
			})
			setRestoreTarget(target)
			return
		}

		try {
			const data = await checkRecycleBinParent(plan.payload)
			const rawNeedMove = Array.isArray(data?.items_need_move) ? data.items_need_move : []
			const rawNoNeedMove = Array.isArray(data?.items_no_need_move)
				? data.items_no_need_move
				: []
			const toResourceIds = (list: Array<{ resource_id: string }>) =>
				list.map((x) => String(x.resource_id))
			setRestoreCheckResult({
				itemsNeedMove: toResourceIds(rawNeedMove),
				itemsNoNeedMove: toResourceIds(rawNoNeedMove),
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

	function handleDeleteModalOpenChange(open: boolean) {
		if (open) return
		setDeleteTarget(null)
	}

	return {
		restoreTarget,
		restoreCheckResult,
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
		openRestoreModal,
		setDeleteTarget,
		handleRestoreModalOpenChange,
		handleDeleteModalOpenChange,
		setSelectPathWorkspaceId,
		setSelectPathProjectId,
	}
}
