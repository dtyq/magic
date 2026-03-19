import { memo, useState, useMemo, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { CheckLine } from "lucide-react"
import { useRequest } from "ahooks"
import { Separator } from "@/components/shadcn-ui/separator"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { RecycleBinApi } from "@/apis"
import type { RecycleBin } from "@/apis/modules/recycle-bin"
import magicToast from "@/components/base/MagicToaster/utils"
import ActionSheet from "@/pages/superMagicMobile/components/ActionSheet"
import CrossProjectFileOperationModal from "@/pages/superMagic/components/SelectPathModal/components/CrossProjectFileOperationModal"
import MoveProjectModal from "@/pages/superMagic/components/EmptyWorkspacePanel/components/MoveProjectModal"
import { projectStore, workspaceStore } from "@/pages/superMagic/stores/core"
import SuperMagicService from "@/pages/superMagic/services"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type {
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import RecycleBinItem, { type RecycleBinItemData } from "./RecycleBinItem"
import BulkActions from "./BulkActions"
import emptyStateIcon from "../assets/svg/empty-state-icon.svg"

const RESOURCE_TYPE = {
	WORKSPACE: 1,
	PROJECT: 2,
	TOPIC: 3,
	FILE: 4,
} as const

type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE]

interface ItemTarget {
	kind: "item"
	item: RecycleBinItemData
}

interface SelectionTarget {
	kind: "selection"
	itemIds: string[]
}

type ActionTarget = ItemTarget | SelectionTarget

type RestoreTarget = ActionTarget

type SelectPathTarget =
	| { type: "topic"; target: RestoreTarget }
	| { type: "file"; target: RestoreTarget }

interface SelectPathSubmitPayload {
	targetProjectId: string
	targetPath: AttachmentItem[]
	targetAttachments: AttachmentItem[]
	sourceAttachments: AttachmentItem[]
}

function getRestoreResourceIds(target: RestoreTarget, items: RecycleBinItemData[]): string[] {
	if (target.kind === "item") return [target.item.resourceId]
	return Array.from(
		new Set(items.filter((i) => target.itemIds.includes(i.id)).map((i) => i.resourceId)),
	)
}

function getMoveProjectIds(target: RestoreTarget, items: RecycleBinItemData[]): string[] {
	return getRestoreResourceIds(target, items)
}

/** 从 check 接口返回的 CheckItem[] 提取 resource_id 列表 */
function toResourceIds(list: Array<{ resource_id: string }>): string[] {
	return list.map((x) => String(x.resource_id))
}

/** 从需移动的 resource_id 列表解析出本地 item.id 列表（用于弹窗只操作需移动项） */
function resolveNeedMoveItemIds(
	needMoveResourceIds: string[],
	items: RecycleBinItemData[],
): string[] {
	if (needMoveResourceIds.length === 0) return []
	const set = new Set(needMoveResourceIds)
	return items.filter((i) => set.has(i.resourceId)).map((i) => i.id)
}

const RESOURCE_TYPE_TO_TAB: Record<ResourceType, string> = {
	[RESOURCE_TYPE.WORKSPACE]: "workspaces",
	[RESOURCE_TYPE.PROJECT]: "projects",
	[RESOURCE_TYPE.TOPIC]: "topics",
	[RESOURCE_TYPE.FILE]: "files",
}

const TAB_TO_RESOURCE_TYPE: Record<string, ResourceType> = {
	workspaces: RESOURCE_TYPE.WORKSPACE,
	projects: RESOURCE_TYPE.PROJECT,
	topics: RESOURCE_TYPE.TOPIC,
	files: RESOURCE_TYPE.FILE,
}

const TAB_KEY_TO_TYPE: Record<string, RecycleBinItemData["type"]> = {
	workspaces: "workspace",
	projects: "project",
	topics: "topic",
	files: "file",
}

function mapListItemToItemData(item: RecycleBin.ListItem): RecycleBinItemData {
	const resourceType = item.resource_type as ResourceType
	const tabKey = RESOURCE_TYPE_TO_TAB[resourceType] ?? "files"
	const type = TAB_KEY_TO_TYPE[tabKey] ?? "file"
	const deletedBy =
		item.deleted_by_user?.nickname ?? item.deleted_by_name ?? item.deleted_by ?? ""
	const deletedByUser = item.deleted_by_user
		? { nickname: item.deleted_by_user.nickname, avatar: item.deleted_by_user.avatar }
		: undefined
	return {
		id: item.id,
		type,
		title: item.resource_name,
		deletedBy,
		deletedByUser,
		validDays: item.remaining_days ?? 0,
		resourceId: item.resource_id,
		resourceType,
		selected: false,
	}
}

function updateTabCounts(
	items: RecycleBinItemData[],
	onTabCountChange?: (tabId: string, count: number) => void,
) {
	if (!onTabCountChange) return
	const counts: Record<string, number> = {
		all: items.length,
		workspaces: 0,
		projects: 0,
		topics: 0,
		files: 0,
	}
	items.forEach((item) => {
		const tab = RESOURCE_TYPE_TO_TAB[item.resourceType as ResourceType]
		if (tab) counts[tab] = (counts[tab] ?? 0) + 1
	})
	onTabCountChange("all", counts.all)
	onTabCountChange("workspaces", counts.workspaces)
	onTabCountChange("projects", counts.projects)
	onTabCountChange("topics", counts.topics)
	onTabCountChange("files", counts.files)
}

interface RecycleBinContentProps {
	activeTab?: string
	searchValue?: string
	onTabCountChange?: (tabId: string, count: number) => void
}

function RecycleBinContent(props: RecycleBinContentProps) {
	const { activeTab = "all", searchValue = "", onTabCountChange } = props
	const { t } = useTranslation("super")

	const [items, setItems] = useState<RecycleBinItemData[]>([])
	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const [hasError, setHasError] = useState(false)
	const [moreItemId, setMoreItemId] = useState<string | null>(null)
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

	const queryParams = useMemo(
		() => ({
			keyword: searchValue.trim() || undefined,
			order: "desc" as const,
			page: 1,
			page_size: 100,
		}),
		[searchValue],
	)

	const { run, loading } = useRequest(RecycleBinApi.getRecycleBinList, {
		manual: true,
		onBefore: () => setHasError(false),
		onSuccess: (data) => {
			const nextItems = data.list.map(mapListItemToItemData)
			setItems(nextItems)
			setSelectedIds((prev) => prev.filter((id) => nextItems.some((item) => item.id === id)))
			updateTabCounts(nextItems, onTabCountChange)
		},
		onError: () => setHasError(true),
	})

	useEffect(() => {
		run(queryParams)
	}, [queryParams, run])

	// 打开选择路径/移动项目弹窗时拉取工作区列表（与 PC 一致）
	useEffect(() => {
		if (!selectPathModalOpen && !moveProjectModalOpen) return
		SuperMagicService.workspace
			.fetchWorkspaces({
				page: 1,
				isAutoSelect: false,
				isSelectLast: false,
			})
			.catch((error) => console.error(error))
	}, [selectPathModalOpen, moveProjectModalOpen])

	useEffect(() => {
		if (selectPathTarget?.type !== "topic" || !selectPathWorkspaceId) return
		projectStore
			.loadProjectsForWorkspace(selectPathWorkspaceId)
			.catch((error) => console.error(error))
	}, [selectPathTarget?.type, selectPathWorkspaceId])

	const filteredItems = useMemo(() => {
		if (activeTab === "all") return items
		const targetType = TAB_TO_RESOURCE_TYPE[activeTab]
		if (!targetType) return items
		return items.filter((item) => item.resourceType === targetType)
	}, [items, activeTab])

	const selectedCount = selectedIds.length
	const hasItems = filteredItems.length > 0

	const handleSelectionChange = useCallback((id: string, selected: boolean) => {
		setSelectedIds((prev) =>
			selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
		)
	}, [])

	const handleSelectAll = useCallback(() => {
		setSelectedIds(filteredItems.map((item) => item.id))
	}, [filteredItems])

	const handleDeselectAll = useCallback(() => {
		setSelectedIds([])
	}, [])

	const handleMoreClick = useCallback((id: string) => {
		setMoreItemId(id)
	}, [])

	/** 恢复成功后的统一刷新：回收站列表 + 工作区列表（与 PC 端一致，保证弹窗/侧边栏工作区列表为最新） */
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

	/** 选择路径确认后：恢复「无需移动」的项（与 PC 端一致） */
	const runPendingRestoreAfterMove = useCallback(async () => {
		const pending = pendingRestoreAfterMove
		setPendingRestoreAfterMove(null)
		if (!pending?.resourceIds.length) return
		try {
			const data = await RecycleBinApi.restoreRecycleBinResources({
				resource_ids: pending.resourceIds,
				resource_type: pending.resourceType,
			})
			const successIds = data.results
				.filter((r) => r.success)
				.map((r) => items.find((i) => i.resourceId === r.resource_id)?.id)
				.filter(Boolean) as string[]
			setItems((prev) => prev.filter((item) => !successIds.includes(item.id)))
			setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)))
			if (data.success_count > 0) handleRestoreSuccess(data.success_count)
			if (data.failed_count > 0) magicToast.error(t("operationFailed"))
		} catch {
			magicToast.error(t("operationFailed"))
		}
	}, [pendingRestoreAfterMove, items, handleRestoreSuccess, t])

	const handleRestore = useCallback(async () => {
		if (selectedIds.length === 0) return
		const selectedItems = items.filter((item) => selectedIds.includes(item.id))
		if (selectedItems.length === 0) return
		const resourceType = selectedItems[0].resourceType
		const hasMixed = selectedItems.some((item) => item.resourceType !== resourceType)
		if (hasMixed) {
			magicToast.error(t("recycleBin.restoreCheck.mixedTypes"))
			return
		}
		if (resourceType === RESOURCE_TYPE.FILE) {
			magicToast.info(t("mobile.recycleBin.restoreFileTip"))
			return
		}
		try {
			const check = await RecycleBinApi.checkRecycleBinParent({
				resource_ids: selectedItems.map((i) => i.resourceId),
				resource_type: resourceType,
			})
			const rawNeedMove = Array.isArray(check?.items_need_move) ? check.items_need_move : []
			const rawNoNeedMove = Array.isArray(check?.items_no_need_move)
				? check.items_no_need_move
				: []
			const needMoveResourceIds = toResourceIds(rawNeedMove)
			const noNeedMoveResourceIds = toResourceIds(rawNoNeedMove)
			const needMoveItemIds = resolveNeedMoveItemIds(needMoveResourceIds, items)
			const hasNeedMove = needMoveItemIds.length > 0

			if (hasNeedMove) {
				if (
					noNeedMoveResourceIds.length > 0 &&
					(resourceType === RESOURCE_TYPE.WORKSPACE ||
						resourceType === RESOURCE_TYPE.PROJECT ||
						resourceType === RESOURCE_TYPE.TOPIC)
				) {
					setPendingRestoreAfterMove({
						resourceIds: noNeedMoveResourceIds,
						resourceType,
					})
				}
				const singleItem =
					needMoveItemIds.length === 1
						? items.find((i) => i.id === needMoveItemIds[0])
						: undefined
				const moveTarget: RestoreTarget =
					singleItem != null
						? { kind: "item", item: singleItem }
						: { kind: "selection", itemIds: needMoveItemIds }
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
					return
				}
				return
			}
			if (noNeedMoveResourceIds.length === 0) return
			const data = await RecycleBinApi.restoreRecycleBinResources({
				resource_ids: noNeedMoveResourceIds,
				resource_type: resourceType,
			})
			const successIds = data.results
				.filter((r) => r.success)
				.map((r) => items.find((i) => i.resourceId === r.resource_id)?.id)
				.filter(Boolean) as string[]
			setItems((prev) => prev.filter((item) => !successIds.includes(item.id)))
			setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)))
			if (data.success_count > 0) handleRestoreSuccess(data.success_count)
			if (data.failed_count > 0) magicToast.error(t("operationFailed"))
		} catch {
			magicToast.error(t("operationFailed"))
		}
	}, [selectedIds, items, handleRestoreSuccess, t])

	const handlePermanentDelete = useCallback(async () => {
		if (selectedIds.length === 0) return
		try {
			const data = await RecycleBinApi.permanentDeleteRecycleBin({ ids: selectedIds })
			const failedSet = new Set(data.failed.map((f) => String(f.id)))
			const successIds = selectedIds.filter((id) => !failedSet.has(id))
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
		}
	}, [selectedIds, queryParams, run, t])

	const handleRestoreSingle = useCallback(
		async (itemId: string) => {
			const selectedItems = items.filter((item) => item.id === itemId)
			if (selectedItems.length === 0) return
			const item = selectedItems[0]
			if (item.resourceType === RESOURCE_TYPE.FILE) {
				magicToast.info(t("mobile.recycleBin.restoreFileTip"))
				return
			}
			try {
				const check = await RecycleBinApi.checkRecycleBinParent({
					resource_ids: [item.resourceId],
					resource_type: item.resourceType,
				})
				const rawNeedMove = Array.isArray(check?.items_need_move)
					? check.items_need_move
					: []
				const rawNoNeedMove = Array.isArray(check?.items_no_need_move)
					? check.items_no_need_move
					: []
				const needMoveResourceIds = toResourceIds(rawNeedMove)
				const noNeedMoveResourceIds = toResourceIds(rawNoNeedMove)
				const needMove = needMoveResourceIds.includes(item.resourceId)
				if (needMove) {
					const restoreTarget: RestoreTarget = { kind: "item", item }
					if (item.resourceType === RESOURCE_TYPE.PROJECT) {
						setMoveProjectTarget(restoreTarget)
						setMoveProjectModalOpen(true)
						return
					}
					if (item.resourceType === RESOURCE_TYPE.TOPIC) {
						setSelectPathTarget({ type: "topic", target: restoreTarget })
						setSelectPathWorkspaceId("")
						setSelectPathProjectId("")
						setSelectPathModalOpen(true)
						return
					}
					if (item.resourceType === RESOURCE_TYPE.FILE) {
						setSelectPathTarget({ type: "file", target: restoreTarget })
						setSelectPathWorkspaceId("")
						setSelectPathProjectId("")
						setSelectPathModalOpen(true)
						return
					}
					return
				}
				if (noNeedMoveResourceIds.length === 0) return
				const data = await RecycleBinApi.restoreRecycleBinResources({
					resource_ids: noNeedMoveResourceIds,
					resource_type: item.resourceType,
				})
				const success = data.results.some(
					(r) => r.success && r.resource_id === item.resourceId,
				)
				if (success) {
					setItems((prev) => prev.filter((i) => i.id !== itemId))
					setSelectedIds((prev) => prev.filter((id) => id !== itemId))
					handleRestoreSuccess(1)
				} else magicToast.error(t("operationFailed"))
			} catch {
				magicToast.error(t("operationFailed"))
			}
		},
		[items, handleRestoreSuccess, t],
	)

	const handlePermanentDeleteSingle = useCallback(
		async (itemId: string) => {
			try {
				const data = await RecycleBinApi.permanentDeleteRecycleBin({ ids: [itemId] })
				const failedSet = new Set(data.failed.map((f) => String(f.id)))
				if (!failedSet.has(itemId)) {
					setItems((prev) => prev.filter((item) => item.id !== itemId))
					setSelectedIds((prev) => prev.filter((id) => id !== itemId))
					magicToast.success(t("recycleBin.deleteSuccess.content", { count: 1 }))
					run(queryParams)
				} else magicToast.error(t("operationFailed"))
			} catch {
				magicToast.error(t("operationFailed"))
			}
		},
		[queryParams, run, t],
	)

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
		[items],
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
		[items],
	)

	const handleMoveProject = useCallback(
		async (workspaceId: string) => {
			if (!moveProjectTarget) return
			const projectIds = getMoveProjectIds(moveProjectTarget, items)
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
			items,
			t,
			removeItemsByProjectIds,
			handleRestoreSuccess,
			runPendingRestoreAfterMove,
		],
	)

	const handleMoveTopic = useCallback(
		async (targetProjectId: string) => {
			if (!selectPathTarget || selectPathTarget.type !== "topic") return
			const topicIds = getRestoreResourceIds(selectPathTarget.target, items)
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
			items,
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

	function handleSelectPathSubmit(data: SelectPathSubmitPayload) {
		if (selectPathTarget?.type === "topic") {
			handleMoveTopic(data.targetProjectId)
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

	// 加载中
	if (loading && items.length === 0) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2 py-6"
				data-testid="mobile-recycle-bin-content"
			>
				<Spinner className="text-muted-foreground" />
				<span className="text-sm text-[#737373]">{t("common.loading")}</span>
			</div>
		)
	}

	// 加载失败
	if (hasError && items.length === 0) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-2 py-6"
				data-testid="mobile-recycle-bin-content"
			>
				<div className="text-sm text-[#737373]">{t("recycleBin.error.loadFailed")}</div>
				<Button variant="outline" size="sm" onClick={() => run(queryParams)}>
					{t("recycleBin.error.retry")}
				</Button>
			</div>
		)
	}

	// 空状态
	if (!hasItems) {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col gap-2.5 px-2 pb-0 pt-2"
				data-testid="mobile-recycle-bin-content"
			>
				<div
					className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 rounded-[10px] bg-background p-6 text-center"
					data-testid="mobile-recycle-bin-empty"
				>
					<img
						className="empty-state-icon h-12 w-12"
						alt=""
						aria-hidden
						src={emptyStateIcon}
					/>
					<div className="flex w-full flex-col items-center gap-2">
						<div className="text-lg font-medium leading-7 text-foreground">
							{t("mobile.recycleBin.empty.title")}
						</div>
						<div className="text-sm font-normal leading-5 text-[#737373]">
							{t("mobile.recycleBin.empty.description")}
						</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="mobile-recycle-bin-content">
			<div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-0 pt-2">
				<div className="flex min-h-0 flex-1 flex-col gap-2 rounded-[10px] bg-background">
					{filteredItems.map((item, index) => (
						<div key={item.id}>
							<RecycleBinItem
								item={{
									...item,
									selected: selectedIds.includes(item.id),
								}}
								onSelectionChange={handleSelectionChange}
								onMoreClick={handleMoreClick}
							/>
							{index < filteredItems.length - 1 && (
								<div className="px-2.5">
									<Separator className="bg-[#E5E5E5]" />
								</div>
							)}
						</div>
					))}

					<div
						className="flex items-center justify-center gap-1 py-4 opacity-30"
						data-testid="mobile-recycle-bin-loader"
					>
						<CheckLine className="size-4 text-foreground" />
						<span className="text-xs font-normal leading-4 text-foreground">
							{t("mobile.recycleBin.loader.noMoreData")}
						</span>
					</div>
				</div>
			</div>

			<BulkActions
				selectedCount={selectedCount}
				totalCount={filteredItems.length}
				onSelectAll={handleSelectAll}
				onDeselectAll={handleDeselectAll}
				onRestore={handleRestore}
				onPermanentDelete={handlePermanentDelete}
			/>

			<ActionSheet
				visible={moreItemId !== null}
				title={t("recycleBin.item.more")}
				actionGroups={[
					{
						actions: [
							{
								key: "restore",
								label: t("recycleBin.bulkActions.restore"),
								onClick: () => {
									if (moreItemId) {
										setMoreItemId(null)
										handleRestoreSingle(moreItemId)
									}
								},
							},
							{
								key: "permanentDelete",
								label: t("recycleBin.bulkActions.permanentDelete"),
								variant: "danger",
								onClick: () => {
									if (moreItemId) {
										setMoreItemId(null)
										handlePermanentDeleteSingle(moreItemId)
									}
								},
							},
						],
					},
				]}
				showCancel
				cancelText={t("common.cancel")}
				onClose={() => setMoreItemId(null)}
			/>

			<MoveProjectModal
				workspaces={workspaceStore.workspaces}
				selectedWorkspace={workspaceStore.selectedWorkspace ?? undefined}
				isMoveProjectLoading={isMoveProjectLoading}
				fetchWorkspaces={(params) => SuperMagicService.workspace.fetchWorkspaces(params)}
				open={moveProjectModalOpen}
				onClose={() => {
					setMoveProjectModalOpen(false)
					setMoveProjectTarget(null)
					setPendingRestoreAfterMove(null)
				}}
				onConfirm={handleMoveProject}
			/>

			{selectPathTarget && (
				<CrossProjectFileOperationModal
					visible={selectPathModalOpen}
					title={t("recycleBin.selectPath.title")}
					operationType="move"
					selectedWorkspace={selectPathSelectedWorkspace}
					selectedProject={selectPathSelectedProject}
					workspaces={workspaceStore.workspaces}
					fileIds={[]}
					sourceAttachments={[]}
					selectProjectOnly={selectPathTarget.type === "topic"}
					onClose={handleSelectPathClose}
					onSubmit={handleSelectPathSubmit}
				/>
			)}
		</div>
	)
}

export default memo(RecycleBinContent)
