import { useEffect, useMemo, useState } from "react"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { useRequest } from "ahooks"
import { RecycleBinApi } from "@/apis"
import type { RecycleBin } from "@/apis/modules/recycle-bin"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { RecycleBinList } from "./RecycleBinList"
import { RecycleBinModals } from "./RecycleBinModals"
import { RecycleBinToolbar } from "./RecycleBinToolbar"
import {
	mapRecycleBinItem as mapRecycleBinItemFromDomain,
	updateTabCounts as updateTabCountsFromDomain,
} from "./recycle-bin-domain"
import { useRecycleBinActions } from "./useRecycleBinActions"
import { useRecycleBinSelection } from "./useRecycleBinSelection"

export function RecycleBinContent({ activeTab, onTabCountChange }: RecycleBinContentProps) {
	const { t } = useTranslation("super")
	const [searchValue, setSearchValue] = useState("")
	const [items, setItems] = useState<RecycleBinItem[]>([])
	const [hasError, setHasError] = useState(false)

	const trimmedSearchValue = searchValue.trim()
	const queryParams = useMemo(
		() => ({
			keyword: trimmedSearchValue ? trimmedSearchValue : undefined,
			order: "desc" as const,
			page: 1,
			page_size: 100,
		}),
		[trimmedSearchValue],
	)

	const { run, loading } = useRequest(RecycleBinApi.getRecycleBinList, {
		manual: true,
		onBefore: () => {
			setHasError(false)
		},
		onSuccess: (data) => {
			const nextItems = data.list.map(mapRecycleBinItemFromDomain)
			setItems(nextItems)
			updateTabCountsFromDomain({
				items: nextItems,
				onTabCountChange,
			})
		},
		onError: () => {
			setHasError(true)
		},
	})

	useEffect(() => {
		run(queryParams)
	}, [queryParams, run])

	const selection = useRecycleBinSelection({
		items,
		activeTabId: activeTab?.id,
	})
	const actions = useRecycleBinActions({
		items,
		setItems,
		selectedIds: selection.selectedIds,
		hasMixedSelectionTypes: selection.hasMixedSelectionTypes,
		onTabCountChange,
		onRefresh: () => run(queryParams),
	})

	const hasItems = selection.visibleItems.length > 0
	const shouldShowEmpty = !loading && !hasError && !hasItems
	const title = activeTab ? t(activeTab.labelKey, { count: activeTab.count }) : ""

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-3.5" data-testid="recycle-bin-content">
			<RecycleBinToolbar
				title={title}
				searchValue={searchValue}
				hasSelection={selection.hasSelection}
				isAllSelected={selection.isAllSelected}
				isPartiallySelected={selection.isPartiallySelected}
				hasMixedSelectionTypes={selection.hasMixedSelectionTypes}
				onToggleSelectAll={selection.handleToggleSelectAll}
				onCancelSelection={selection.clearSelection}
				onRestoreSelection={actions.handleRestoreSelected}
				onDeleteSelection={actions.handleDeleteSelected}
				onSearchChange={setSearchValue}
				onSearchReset={() => setSearchValue("")}
				t={t}
			/>

			<div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card">
				<RecycleBinList
					items={selection.visibleItems}
					selectedIds={selection.selectedIds}
					loading={loading}
					hasError={hasError}
					shouldShowEmpty={shouldShowEmpty}
					onToggleItem={selection.handleToggleItem}
					onRetry={() => run(queryParams)}
					onOpenRestore={actions.openRestoreModal}
					onOpenDelete={(item) => actions.setDeleteTarget({ kind: "item", item })}
					t={t}
				/>
			</div>

			<RecycleBinModals
				items={items}
				restoreTarget={actions.restoreTarget}
				restoreCheckResult={actions.restoreCheckResult}
				deleteTarget={actions.deleteTarget}
				moveProjectModalOpen={actions.moveProjectModalOpen}
				selectPathModalOpen={actions.selectPathModalOpen}
				selectPathTarget={actions.selectPathTarget}
				selectPathSelectedWorkspace={actions.selectPathSelectedWorkspace}
				selectPathSelectedProject={actions.selectPathSelectedProject}
				workspaces={actions.workspaces}
				isMoveProjectLoading={actions.isMoveProjectLoadingCombined}
				isPermanentDeleteLoading={actions.isPermanentDeleteLoading}
				onRestoreOpenChange={actions.handleRestoreModalOpenChange}
				onDeleteOpenChange={actions.handleDeleteModalOpenChange}
				onConfirmRestore={actions.handleConfirmRestore}
				onConfirmDelete={actions.handleConfirmDelete}
				onMoveProjectClose={actions.handleMoveProjectClose}
				onMoveProjectConfirm={actions.handleMoveProject}
				onSelectPathClose={actions.handleSelectPathClose}
				onSelectPathSubmit={actions.handleSelectPathSubmit}
				t={t}
			/>
		</div>
	)
}

interface RecycleBinContentProps {
	activeTab: RecycleBinTab | undefined
	onTabCountChange?: (tabId: string, count: number) => void
}

interface RecycleBinTab {
	id: string
	labelKey: string
	count: number
}

const CATEGORY_TO_TYPE_KEY: Record<RecycleBinItem["category"], string> = {
	workspaces: "workspace",
	projects: "project",
	topics: "topic",
	files: "file",
}

const RESOURCE_TYPE = {
	WORKSPACE: 1,
	PROJECT: 2,
	TOPIC: 3,
	FILE: 4,
} as const

type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE]

function getCategoryLabel(category: RecycleBinItem["category"], t: TFunction) {
	return t(`recycleBin.item.type.${CATEGORY_TO_TYPE_KEY[category]}`)
}

interface RecycleBinDeletedByUser {
	nickname: string
	avatar: string
}

interface RecycleBinItem {
	id: string
	resourceId: string
	resourceType: ResourceType
	category: "workspaces" | "projects" | "topics" | "files"
	title: string
	deletedBy: string
	deletedByUser?: RecycleBinDeletedByUser
	path: string
	deletedOn: string
	remainingDays: number
}

interface ItemTarget {
	kind: "item"
	item: RecycleBinItem
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

type RecycleBinListItemDto = RecycleBin.ListItem

function getRestoreModalTitle(target: RestoreTarget | null, t: TFunction) {
	if (!target) return ""
	if (target.kind === "item")
		return t("recycleBin.restoreModal.titleItem", { title: target.item.title })
	return t("recycleBin.restoreModal.titleMulti", { count: target.itemIds.length })
}

type DeleteTarget = ActionTarget

function getDeleteModalTitle(target: DeleteTarget | null, t: TFunction) {
	if (!target) return ""
	if (target.kind === "item")
		return t("recycleBin.deleteModal.titleItem", { title: target.item.title })
	return t("recycleBin.deleteModal.titleMulti", { count: target.itemIds.length })
}

function getDeleteModalDescription(
	target: DeleteTarget | null,
	t: TFunction,
	getCategoryLabelFn: (category: RecycleBinItem["category"]) => string,
) {
	if (!target) return ""
	if (target.kind === "item") {
		const category = getCategoryLabelFn(target.item.category).toLowerCase()
		return t("recycleBin.deleteModal.descriptionItem", {
			category,
			title: target.item.title,
		})
	}
	return t("recycleBin.deleteModal.descriptionMulti", { count: target.itemIds.length })
}

function mapRecycleBinItem(item: RecycleBinListItemDto): RecycleBinItem {
	const parentInfo = item.extra_data?.parent_info
	const workspaceName = parentInfo?.workspace_name?.trim() || ""
	const projectName = parentInfo?.project_name?.trim() || ""
	const path = [workspaceName, projectName].filter(Boolean).join("/") || "/"
	const deletedBy =
		item.deleted_by_user?.nickname ?? item.deleted_by_name ?? item.deleted_by ?? ""
	const deletedByUser = item.deleted_by_user
		? { nickname: item.deleted_by_user.nickname, avatar: item.deleted_by_user.avatar }
		: undefined
	const resourceType = toResourceType(item.resource_type)
	return {
		id: item.id,
		resourceId: item.resource_id,
		resourceType,
		category: getCategoryByResourceType(resourceType),
		title: item.resource_name,
		deletedBy,
		deletedByUser,
		path,
		deletedOn: item.deleted_at ?? "",
		remainingDays: item.remaining_days ?? 0,
	}
}

function toResourceType(value?: number): ResourceType {
	if (value === RESOURCE_TYPE.WORKSPACE) return RESOURCE_TYPE.WORKSPACE
	if (value === RESOURCE_TYPE.PROJECT) return RESOURCE_TYPE.PROJECT
	if (value === RESOURCE_TYPE.TOPIC) return RESOURCE_TYPE.TOPIC
	return RESOURCE_TYPE.FILE
}

function getCategoryByResourceType(resourceType?: ResourceType): RecycleBinItem["category"] {
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return "workspaces"
	if (resourceType === RESOURCE_TYPE.PROJECT) return "projects"
	if (resourceType === RESOURCE_TYPE.TOPIC) return "topics"
	return "files"
}

function getResourceTypeByTabId(tabId?: string): ResourceType | undefined {
	if (!tabId || tabId === "all") return undefined
	return RECYCLE_BIN_RESOURCE_TYPE_BY_TAB_ID[tabId]
}

const RECYCLE_BIN_RESOURCE_TYPE_BY_TAB_ID: Record<string, ResourceType> = {
	workspaces: RESOURCE_TYPE.WORKSPACE,
	projects: RESOURCE_TYPE.PROJECT,
	topics: RESOURCE_TYPE.TOPIC,
	files: RESOURCE_TYPE.FILE,
}

const RECYCLE_BIN_TAB_ID_BY_RESOURCE_TYPE: Record<ResourceType, string> = {
	[RESOURCE_TYPE.WORKSPACE]: "workspaces",
	[RESOURCE_TYPE.PROJECT]: "projects",
	[RESOURCE_TYPE.TOPIC]: "topics",
	[RESOURCE_TYPE.FILE]: "files",
}

const RECYCLE_BIN_TAB_ID_BY_CATEGORY: Record<RecycleBinItem["category"], string> = {
	workspaces: "workspaces",
	projects: "projects",
	topics: "topics",
	files: "files",
}

interface RestoreCheckResult {
	/** 需移动的 resource_id（父级不存在） */
	itemsNeedMove: string[]
	/** 无需移动的 resource_id（父级存在可直接恢复） */
	itemsNoNeedMove: string[]
	message?: string
	messageKey?: string
	shouldBlockRestore: boolean
	status: "success" | "error" | "invalid" | "skipped"
}

/**
 * 从 items_need_move 的 resource_id 列表解析出需移动的 item.id 列表（用于弹窗选中）。
 */
function resolveNeedMove(
	resourceIds: string[],
	items: RecycleBinItem[],
): { needMoveResourceIdSet: Set<string>; needMoveItemIds: string[] } {
	if (resourceIds.length === 0) return { needMoveResourceIdSet: new Set(), needMoveItemIds: [] }
	const needMoveResourceIdSet = new Set(resourceIds)
	const needMoveItemIds = items
		.filter((i) => needMoveResourceIdSet.has(i.resourceId))
		.map((i) => i.id)
	return { needMoveResourceIdSet, needMoveItemIds }
}

interface RestoreCheckPlanPayload {
	resource_ids: string[]
	resource_type: ResourceType
}

type RestoreCheckPlan =
	| { status: "ready"; payload: RestoreCheckPlanPayload }
	| { status: "skip" }
	| { status: "invalid"; messageKey: string }

interface UpdateTabCountsPayload {
	items: RecycleBinItem[]
	onTabCountChange?: (tabId: string, count: number) => void
}

function updateTabCounts({ items, onTabCountChange }: UpdateTabCountsPayload) {
	if (!onTabCountChange) return

	const countsByTabId = items.reduce<Record<string, number>>((acc, item) => {
		const tabId = RECYCLE_BIN_TAB_ID_BY_CATEGORY[item.category]
		acc[tabId] = (acc[tabId] ?? 0) + 1
		return acc
	}, {})

	onTabCountChange("all", items.length)
	Object.entries(RECYCLE_BIN_TAB_ID_BY_RESOURCE_TYPE).forEach(([, tabId]) => {
		const count = countsByTabId[tabId] ?? 0
		onTabCountChange(tabId, count)
	})
}

interface FilterItemsByTabPayload {
	items: RecycleBinItem[]
	tabId?: string
}

function filterItemsByTab({ items, tabId }: FilterItemsByTabPayload) {
	if (!tabId || tabId === "all") return items
	const resourceType = getResourceTypeByTabId(tabId)
	if (!resourceType) return items
	return items.filter((item) => getCategoryByResourceType(resourceType) === item.category)
}

function buildRestoreCheckPlan({
	target,
	items,
}: {
	target: RestoreTarget
	items: RecycleBinItem[]
}): RestoreCheckPlan {
	if (target.kind === "item") {
		if (target.item.resourceType === RESOURCE_TYPE.FILE) return { status: "skip" }
		return {
			status: "ready",
			payload: {
				resource_ids: [target.item.resourceId],
				resource_type: target.item.resourceType,
			},
		}
	}

	const selectedItems = items.filter((item) => target.itemIds.includes(item.id))
	if (selectedItems.length === 0)
		return { status: "invalid", messageKey: "recycleBin.restoreCheck.noResourcesFound" }

	const resourceType = selectedItems[0].resourceType
	const hasMixedTypes = selectedItems.some((item) => item.resourceType !== resourceType)
	if (hasMixedTypes)
		return { status: "invalid", messageKey: "recycleBin.restoreCheck.mixedTypes" }
	if (resourceType === RESOURCE_TYPE.FILE) return { status: "skip" }

	return {
		status: "ready",
		payload: {
			resource_ids: selectedItems.map((item) => item.resourceId),
			resource_type: resourceType,
		},
	}
}

function getRestoreStatusMessage(
	result: RestoreCheckResult | null,
	target: RestoreTarget | null,
	t: TFunction,
	items: RecycleBinItem[],
) {
	if (!result) return undefined
	const messageKeyMap: Record<"invalid" | "error", string> = {
		invalid: "recycleBin.restoreCheck.invalidMessage",
		error: "recycleBin.restoreCheck.errorMessage",
	}

	if (result.status === "invalid" || result.status === "error")
		return t(result.messageKey ?? messageKeyMap[result.status])
	if (result.status === "skipped") return t("recycleBin.restoreCheck.skippedMessage")

	if (result.itemsNeedMove.length > 0) {
		if (target?.kind !== "selection") return getMissingParentMessage(target, t)
		const resourceType = getRestoreTargetResourceType({ target, items })
		return getNeedMoveStatusMessage(target, result.itemsNeedMove.length, t, resourceType)
	}

	const typeLabel = getRestoreTargetTypeLabel(target, t, items)
	const name = getRestoreTargetName(target, t)
	return t("recycleBin.restoreCheck.confirmMessage", { type: typeLabel, name })
}

function getRestoreTargetName(target: RestoreTarget | null, t: TFunction) {
	if (!target) return t("recycleBin.restoreCheck.unknownTarget")
	if (target.kind === "item") return target.item.title
	return t("recycleBin.restoreCheck.selectionName", { count: target.itemIds.length })
}

function getRestoreTargetTypeLabel(
	target: RestoreTarget | null,
	t: TFunction,
	items?: RecycleBinItem[],
) {
	const resourceType =
		target?.kind === "item"
			? target.item.resourceType
			: target && items
				? getRestoreTargetResourceType({ target, items })
				: undefined
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return t("recycleBin.item.type.workspace")
	if (resourceType === RESOURCE_TYPE.PROJECT) return t("recycleBin.item.type.project")
	if (resourceType === RESOURCE_TYPE.TOPIC) return t("recycleBin.item.type.topic")
	if (resourceType === RESOURCE_TYPE.FILE) return t("recycleBin.item.type.file")
	return t("recycleBin.item.type.file")
}

/** 单选时父级不存在：原位置已不存在，请选择新位置恢复「xxx」 */
function getMissingParentMessage(target: RestoreTarget | null, t: TFunction) {
	const name = getRestoreTargetName(target, t)
	const resourceType = target?.kind === "item" ? target.item.resourceType : undefined
	const parentLabel =
		resourceType === RESOURCE_TYPE.PROJECT
			? t("recycleBin.item.type.workspace")
			: resourceType === RESOURCE_TYPE.TOPIC || resourceType === RESOURCE_TYPE.FILE
				? t("recycleBin.item.type.project")
				: t("recycleBin.restoreCheck.parentLabel")
	const locationLabel =
		resourceType === RESOURCE_TYPE.PROJECT
			? t("recycleBin.item.type.workspace")
			: resourceType === RESOURCE_TYPE.TOPIC || resourceType === RESOURCE_TYPE.FILE
				? t("recycleBin.item.type.project")
				: t("recycleBin.restoreCheck.locationLabel")
	return t("recycleBin.restoreCheck.missingParentMessage", {
		parentLabel,
		locationLabel,
		name,
	})
}

/** 多选时部分项父级不存在：按资源类型返回“请为这 N 个 xxx 选择…”的说明文案 */
function getNeedMoveStatusMessage(
	target: RestoreTarget | null,
	needMoveCount: number,
	t: TFunction,
	resourceType?: ResourceType,
) {
	const typeCode =
		resourceType ?? (target?.kind === "item" ? target.item.resourceType : undefined)
	const messageByType: Partial<Record<ResourceType, string>> = {
		[RESOURCE_TYPE.PROJECT]: t("recycleBin.restoreCheck.needMoveProjects", {
			count: needMoveCount,
		}),
		[RESOURCE_TYPE.TOPIC]: t("recycleBin.restoreCheck.needMoveTopics", {
			count: needMoveCount,
		}),
		[RESOURCE_TYPE.FILE]: t("recycleBin.restoreCheck.needMoveFiles", {
			count: needMoveCount,
		}),
	}
	if (typeCode && messageByType[typeCode]) return messageByType[typeCode]
	return t("recycleBin.restoreCheck.missingParentMessage", {
		parentLabel: t("recycleBin.restoreCheck.parentLabel"),
		locationLabel: t("recycleBin.restoreCheck.locationLabel"),
		name: getRestoreTargetName(target, t),
	})
}

function isRestorableResourceType(resourceType?: ResourceType): resourceType is ResourceType {
	return (
		resourceType === RESOURCE_TYPE.WORKSPACE ||
		resourceType === RESOURCE_TYPE.PROJECT ||
		resourceType === RESOURCE_TYPE.TOPIC
	)
}

function resolvePendingRestore(
	resourceType: ResourceType | undefined,
	resourceIds: string[],
): { resourceIds: string[]; resourceType: ResourceType } | null {
	if (!isRestorableResourceType(resourceType)) return null
	if (resourceIds.length === 0) return null
	return {
		resourceIds,
		resourceType,
	}
}

function extractSuccessResourceIds(results?: Array<{ success: boolean; resource_id: string }>) {
	if (!Array.isArray(results)) return []
	return results.filter((result) => result.success).map((result) => result.resource_id)
}

function getRestoreTargetResourceType({
	target,
	items,
}: {
	target: RestoreTarget
	items: RecycleBinItem[]
}): ResourceType | undefined {
	if (target.kind === "item") return target.item.resourceType
	const selectedItems = items.filter((item) => target.itemIds.includes(item.id))
	return selectedItems[0]?.resourceType
}

function getMoveProjectIds({ target, items }: { target: RestoreTarget; items: RecycleBinItem[] }) {
	if (target.kind === "item") return [target.item.resourceId]
	const selectedItems = items.filter((item) => target.itemIds.includes(item.id))
	return Array.from(new Set(selectedItems.map((item) => item.resourceId)))
}

function getRestoreResourceIds({
	target,
	items,
}: {
	target: RestoreTarget
	items: RecycleBinItem[]
}) {
	if (target.kind === "item") return [target.item.resourceId]
	const selectedItems = items.filter((item) => target.itemIds.includes(item.id))
	return Array.from(new Set(selectedItems.map((item) => item.resourceId)))
}
