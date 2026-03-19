import type { TFunction } from "i18next"
import type { RecycleBin } from "@/apis/modules/recycle-bin"

const CATEGORY_TO_TYPE_KEY: Record<RecycleBinItem["category"], string> = {
	workspaces: "workspace",
	projects: "project",
	topics: "topic",
	files: "file",
}

const CATEGORY_TO_FALLBACK_TITLE_KEY: Record<RecycleBinItem["category"], string> = {
	workspaces: "workspace.unnamedWorkspace",
	projects: "common.untitledProject",
	topics: "common.untitledTopic",
	files: "common.untitledFile",
}

export const RESOURCE_TYPE = {
	WORKSPACE: 1,
	PROJECT: 2,
	TOPIC: 3,
	FILE: 4,
} as const

export type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE]

export interface RecycleBinDeletedByUser {
	nickname: string
	avatar: string
}

export interface RecycleBinItem {
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

export interface ItemTarget {
	kind: "item"
	item: RecycleBinItem
}

export interface SelectionTarget {
	kind: "selection"
	itemIds: string[]
}

export type ActionTarget = ItemTarget | SelectionTarget

export type RestoreTarget = ActionTarget
export type DeleteTarget = ActionTarget

export type SelectPathTarget =
	| { type: "topic"; target: RestoreTarget }
	| { type: "file"; target: RestoreTarget }

export interface RestoreCheckResult {
	/** 需移动的 resource_id（父级不存在） */
	itemsNeedMove: string[]
	/** 无需移动的 resource_id（父级存在可直接恢复） */
	itemsNoNeedMove: string[]
	message?: string
	messageKey?: string
	shouldBlockRestore: boolean
	status: "success" | "error" | "invalid" | "skipped"
}

export interface RestoreCheckPlanPayload {
	resource_ids: string[]
	resource_type: ResourceType
}

export type RestoreCheckPlan =
	| { status: "ready"; payload: RestoreCheckPlanPayload }
	| { status: "skip" }
	| { status: "invalid"; messageKey: string }

export interface UpdateTabCountsPayload {
	items: RecycleBinItem[]
	onTabCountChange?: (tabId: string, count: number) => void
}

export interface FilterItemsByTabPayload {
	items: RecycleBinItem[]
	tabId?: string
}

export type RecycleBinListItemDto = RecycleBin.ListItem

export function getCategoryLabel(category: RecycleBinItem["category"], t: TFunction) {
	return t(`recycleBin.item.type.${CATEGORY_TO_TYPE_KEY[category]}`)
}

export function getDisplayTitle(item: RecycleBinItem, t: TFunction) {
	const title = item.title.trim()
	if (title) return title
	return t(CATEGORY_TO_FALLBACK_TITLE_KEY[item.category])
}

export function toResourceType(value?: number): ResourceType {
	if (value === RESOURCE_TYPE.WORKSPACE) return RESOURCE_TYPE.WORKSPACE
	if (value === RESOURCE_TYPE.PROJECT) return RESOURCE_TYPE.PROJECT
	if (value === RESOURCE_TYPE.TOPIC) return RESOURCE_TYPE.TOPIC
	return RESOURCE_TYPE.FILE
}

export function mapRecycleBinItem(item: RecycleBinListItemDto): RecycleBinItem {
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

export function getCategoryByResourceType(resourceType?: ResourceType): RecycleBinItem["category"] {
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return "workspaces"
	if (resourceType === RESOURCE_TYPE.PROJECT) return "projects"
	if (resourceType === RESOURCE_TYPE.TOPIC) return "topics"
	return "files"
}

export function getResourceTypeByTabId(tabId?: string): ResourceType | undefined {
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

export function updateTabCounts({ items, onTabCountChange }: UpdateTabCountsPayload) {
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

export function filterItemsByTab({ items, tabId }: FilterItemsByTabPayload) {
	if (!tabId || tabId === "all") return items
	const resourceType = getResourceTypeByTabId(tabId)
	if (!resourceType) return items
	return items.filter((item) => getCategoryByResourceType(resourceType) === item.category)
}

/**
 * 从 items_need_move 的 resource_id 列表解析出需移动的 item.id 列表（用于弹窗选中）。
 */
export function resolveNeedMove(
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

export function buildRestoreCheckPlan({
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

export function getRestoreStatusMessage(
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

export function getRestoreTargetName(target: RestoreTarget | null, t: TFunction) {
	if (!target) return t("recycleBin.restoreCheck.unknownTarget")
	if (target.kind === "item") return target.item.title
	return t("recycleBin.restoreCheck.selectionName", { count: target.itemIds.length })
}

export function getRestoreTargetTypeLabel(
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
export function getMissingParentMessage(target: RestoreTarget | null, t: TFunction) {
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
export function getNeedMoveStatusMessage(
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

export function getRestoreTargetResourceType({
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

export function getMoveProjectIds({
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

export function getRestoreResourceIds({
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

export function getRestoreModalTitle(target: RestoreTarget | null, t: TFunction) {
	if (!target) return ""
	if (target.kind === "item")
		return t("recycleBin.restoreModal.titleItem", { title: target.item.title })
	return t("recycleBin.restoreModal.titleMulti", { count: target.itemIds.length })
}

export function getDeleteModalTitle(target: DeleteTarget | null, t: TFunction) {
	if (!target) return ""
	if (target.kind === "item")
		return t("recycleBin.deleteModal.titleItem", { title: target.item.title })
	return t("recycleBin.deleteModal.titleMulti", { count: target.itemIds.length })
}

export function getDeleteModalDescription(
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

export function isRestorableResourceType(
	resourceType?: ResourceType,
): resourceType is ResourceType {
	return (
		resourceType === RESOURCE_TYPE.WORKSPACE ||
		resourceType === RESOURCE_TYPE.PROJECT ||
		resourceType === RESOURCE_TYPE.TOPIC
	)
}

export function resolvePendingRestore(
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

export function extractSuccessResourceIds(
	results?: Array<{ success: boolean; resource_id: string }>,
) {
	if (!Array.isArray(results)) return []
	return results.filter((result) => result.success).map((result) => result.resource_id)
}
