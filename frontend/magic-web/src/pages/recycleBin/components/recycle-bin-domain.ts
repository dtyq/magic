import type { TFunction } from "i18next"
import type { RecycleBin } from "@/apis/modules/recycle-bin"

const MAX_CONFLICT_NAME_PREVIEW_COUNT = 5

export const RESOURCE_TYPE = {
	WORKSPACE: 1,
	PROJECT: 2,
	TOPIC: 3,
	FILE: 4,
	MICRO_APP: 5,
} as const

export type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE]

/** Parent location snapshot stored in recycle-bin list `extra_data.parent_info`. */
export interface RecycleBinParentInfo {
	space_type?: "user" | "project"
	workspace_id?: number
	workspace_name?: string
	project_id?: number
	project_name?: string
	relative_file_path?: string
}

export interface RecycleBinItem {
	id: string
	resourceId: string
	resourceType: ResourceType
	category: "workspaces" | "projects" | "topics" | "files" | "microApps"
	fileKind?: "file" | "folder"
	title: string
	path: string
	deletedOn: string
	remainingDays: number
	originalPath?: string | null
	deletedByName?: string
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

export type SelectPathTarget = { type: "topic"; target: RestoreTarget }

export interface RestoreCheckResult {
	rootSpaceTypes?: Array<"user" | "project">
	/** 需移动的 resource_id（父级不存在） */
	itemsNeedMove: string[]
	/** 无需移动的 resource_id（父级存在可直接恢复） */
	itemsNoNeedMove: string[]
	/** 显式可直接恢复的 resource_id，仅文件恢复使用 */
	directResourceIds?: string[]
	/** 文件恢复冲突策略，key 为 resource_id */
	conflictResolutions?: Record<
		string,
		{
			parent_missing?: "restore_to_root"
			name_conflict?: "overwrite" | "skip"
		}
	>
	/** 需要单独确认是否覆盖的同名冲突文件列表 */
	pendingNameConflictItems?: Array<{
		resourceId: string
		fileName: string
	}>
	/** 必须跳过的资源 ID，例如 project_missing / duplicate_restore_target */
	mustSkipResourceIds?: string[]
	/** 同名冲突被跳过的文件数量 */
	skippedNameConflictCount?: number
	/** 同名冲突文件名，用于恢复确认提示 */
	skippedNameConflictNames?: string[]
	/** 同名冲突资源 ID，恢复请求必须排除 */
	skippedNameConflictResourceIds?: string[]
	/** 同名冲突文件列表，用于逐个恢复确认 */
	skippedNameConflictItems?: Array<{
		resourceId: string
		fileName: string
	}>
	/** 文件所属项目不存在或已删除的数量（终止型冲突，仅提示） */
	projectMissingCount?: number
	/** project_missing 对应的文件名（用于提示，最多展示前若干项） */
	projectMissingFileNames?: string[]
	/** 同批恢复同目标同名文件数量（终止型冲突，仅提示） */
	duplicateRestoreTargetCount?: number
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

export function getCategoryLabel(
	category: RecycleBinItem["category"],
	t: TFunction,
	fileKind?: RecycleBinItem["fileKind"],
) {
	if (category === "files" && fileKind === "folder") return t("recycleBin.item.type.folder")
	if (category === "workspaces") return t("recycleBin.item.type.workspace")
	if (category === "projects") return t("recycleBin.item.type.project")
	if (category === "topics") return t("recycleBin.item.type.topic")
	if (category === "microApps") return t("recycleBin.item.type.microApp")
	return t("recycleBin.item.type.file")
}

export function getDisplayTitle(item: RecycleBinItem, t: TFunction) {
	const title = item.title.trim()
	if (title) return title
	if (item.category === "workspaces") return t("workspace.unnamedWorkspace")
	if (item.category === "projects") return t("common.untitledProject")
	if (item.category === "topics") return t("common.untitledTopic")
	if (item.category === "microApps") return t("microAppsPage.unnamedApp")
	return t("common.untitledFile")
}

export function toResourceType(value?: number): ResourceType {
	if (value === RESOURCE_TYPE.WORKSPACE) return RESOURCE_TYPE.WORKSPACE
	if (value === RESOURCE_TYPE.PROJECT) return RESOURCE_TYPE.PROJECT
	if (value === RESOURCE_TYPE.TOPIC) return RESOURCE_TYPE.TOPIC
	if (value === RESOURCE_TYPE.MICRO_APP) return RESOURCE_TYPE.MICRO_APP
	return RESOURCE_TYPE.FILE
}

export function mapRecycleBinItem(item: RecycleBinListItemDto, t: TFunction): RecycleBinItem {
	const parentInfo = item.extra_data?.parent_info
	const workspaceName =
		item.extra_data?.space_type === "user"
			? t("userSpace.title")
			: parentInfo?.workspace_name?.trim() || item.extra_data?.workspace_name?.trim() || ""
	const projectName =
		item.extra_data?.space_type === "user"
			? ""
			: parentInfo?.project_name?.trim() || item.extra_data?.project_name?.trim() || ""
	const relativeFilePath = item.extra_data?.relative_file_path?.trim() || ""
	const resourceType = toResourceType(item.resource_type)
	const path =
		resourceType === RESOURCE_TYPE.MICRO_APP
			? t("microAppsPage.title")
			: buildRecycleBinItemPath({
					workspaceName,
					projectName,
					relativeFilePath,
					resourceName: item.resource_name,
				})
	const fileKind =
		resourceType === RESOURCE_TYPE.FILE
			? item.extra_data?.is_directory
				? "folder"
				: "file"
			: undefined
	return {
		id: item.id,
		resourceId: item.resource_id,
		resourceType,
		category: getCategoryByResourceType(resourceType),
		fileKind,
		title: getRecycleBinItemTitle({
			resourceName: item.resource_name,
			resourceType,
			t,
		}),
		path,
		deletedOn: item.deleted_at ?? "",
		remainingDays: item.remaining_days ?? 0,
		originalPath: getOriginalFileParentPath(item),
		deletedByName: item.deleted_by_user?.nickname || item.deleted_by_name,
	}
}

/** 删除快照用于本次查询的展示分类；缺少快照时不能用活跃目录树猜测旧位置。 */
function getOriginalFileParentPath(item: RecycleBinListItemDto): string | null {
	const filePath = item.extra_data?.relative_file_path?.trim()
	if (filePath && filePath !== "/" && filePath.startsWith("/")) {
		const normalizedPath = filePath.replace(/\/+$/, "")
		return normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) || "/"
	}
	const parent = item.extra_data?.original_parent_id
	return parent === null || parent === 0 || parent === "0" ? "/" : null
}

export function getCategoryByResourceType(resourceType?: ResourceType): RecycleBinItem["category"] {
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return "workspaces"
	if (resourceType === RESOURCE_TYPE.PROJECT) return "projects"
	if (resourceType === RESOURCE_TYPE.TOPIC) return "topics"
	if (resourceType === RESOURCE_TYPE.MICRO_APP) return "microApps"
	return "files"
}

export function getRecycleBinItemTitle(props: {
	resourceName?: string
	resourceType?: ResourceType
	t: TFunction
}) {
	const { resourceName, resourceType, t } = props
	const trimmedName = resourceName?.trim() ?? ""
	if (trimmedName) return trimmedName
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return t("common.unNamedWorkspace")
	if (resourceType === RESOURCE_TYPE.PROJECT) return t("common.untitledProject")
	if (resourceType === RESOURCE_TYPE.TOPIC) return t("common.untitledTopic")
	if (resourceType === RESOURCE_TYPE.FILE) return t("common.untitledFile")
	if (resourceType === RESOURCE_TYPE.MICRO_APP) return t("microAppsPage.unnamedApp")
	return trimmedName
}

/** Resolve one path segment; fall back to the same copy used in list rows. */
export function resolveRecycleBinSegmentName(props: {
	segment: "workspace" | "project"
	rawName?: string
	t: TFunction
}) {
	const trimmed = props.rawName?.trim() ?? ""
	if (trimmed) return trimmed
	if (props.segment === "workspace") return props.t("common.unNamedWorkspace")
	return props.t("common.untitledProject")
}

export function buildRecycleBinItemPath(props: {
	workspaceName?: string
	projectName?: string
	relativeFilePath?: string
	resourceName?: string
}) {
	const basePath = [props.workspaceName?.trim(), props.projectName?.trim()]
		.filter(Boolean)
		.join("/")
	const relativeFilePath = resolveRecycleBinParentPath({
		relativeFilePath: props.relativeFilePath,
		resourceName: props.resourceName,
	})
	if (!relativeFilePath) return basePath || "/"
	if (relativeFilePath === "/") return basePath ? `${basePath}/` : "/"
	return [basePath, relativeFilePath.replace(/^\/+|\/+$/g, "")].filter(Boolean).join("/")
}

export function resolveRecycleBinParentPath(props: {
	relativeFilePath?: string
	resourceName?: string
}) {
	const relativeFilePath = props.relativeFilePath?.trim()
	if (!relativeFilePath) return ""

	const normalizedPath = relativeFilePath.replace(/\\/g, "/")
	const normalizedResourceName = props.resourceName?.trim()
	if (!normalizedResourceName) return normalizedPath

	const pathParts = normalizedPath.split("/").filter(Boolean)
	if (pathParts.at(-1) !== normalizedResourceName) return normalizedPath

	pathParts.pop()
	return pathParts.length > 0 ? pathParts.join("/") : "/"
}

/** Build path segments under the workspaces scope (excludes scope head). */
export function buildRecycleBinPathParts(props: {
	resourceType: ResourceType
	parentInfo?: RecycleBinParentInfo
	resourceName?: string
	t: TFunction
}) {
	const { resourceType, parentInfo, resourceName, t } = props
	if (resourceType === RESOURCE_TYPE.FILE && parentInfo?.space_type === "user") {
		const path = resolveRecycleBinParentPath({
			relativeFilePath: parentInfo.relative_file_path,
			resourceName,
		})
		return path ? [path.replace(/^\/+|\/+$/g, "")] : []
	}
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return []
	if (resourceType === RESOURCE_TYPE.PROJECT) {
		return [
			resolveRecycleBinSegmentName({
				segment: "workspace",
				rawName: parentInfo?.workspace_name,
				t,
			}),
		]
	}
	if (resourceType === RESOURCE_TYPE.TOPIC) {
		return [
			resolveRecycleBinSegmentName({
				segment: "workspace",
				rawName: parentInfo?.workspace_name,
				t,
			}),
			resolveRecycleBinSegmentName({
				segment: "project",
				rawName: parentInfo?.project_name,
				t,
			}),
		]
	}
	if (resourceType === RESOURCE_TYPE.FILE) {
		const parentParts = [
			resolveRecycleBinSegmentName({
				segment: "workspace",
				rawName: parentInfo?.workspace_name,
				t,
			}),
			resolveRecycleBinSegmentName({
				segment: "project",
				rawName: parentInfo?.project_name,
				t,
			}),
		]
		const relativeFilePath = resolveRecycleBinParentPath({
			relativeFilePath: parentInfo?.relative_file_path,
			resourceName,
		})
		if (!relativeFilePath) return parentParts
		if (relativeFilePath === "/") return [...parentParts, ""]
		return [...parentParts, relativeFilePath.replace(/^\/+|\/+$/g, "")]
	}
	return []
}

/** Mobile recycle-bin breadcrumb: scope head + parent segments, aligned with prototype TrashScreen. */
export function buildRecycleBinPathLabel(props: {
	resourceType: ResourceType
	parentInfo?: RecycleBinParentInfo
	resourceName?: string
	t: TFunction
}) {
	if (props.resourceType === RESOURCE_TYPE.MICRO_APP) {
		return props.t("mobile.recycleBin.pathScopes.microApps")
	}
	const head = props.t(
		props.parentInfo?.space_type === "user"
			? "userSpace.title"
			: "mobile.recycleBin.pathScopes.workspaces",
	)
	const parts = buildRecycleBinPathParts({
		resourceType: props.resourceType,
		parentInfo: props.parentInfo,
		resourceName: props.resourceName,
		t: props.t,
	})
	return [head, ...parts].join(" / ")
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
	microApps: RESOURCE_TYPE.MICRO_APP,
}

const RECYCLE_BIN_TAB_ID_BY_RESOURCE_TYPE: Record<ResourceType, string> = {
	[RESOURCE_TYPE.WORKSPACE]: "workspaces",
	[RESOURCE_TYPE.PROJECT]: "projects",
	[RESOURCE_TYPE.TOPIC]: "topics",
	[RESOURCE_TYPE.FILE]: "files",
	[RESOURCE_TYPE.MICRO_APP]: "microApps",
}

const RECYCLE_BIN_TAB_ID_BY_CATEGORY: Record<RecycleBinItem["category"], string> = {
	workspaces: "workspaces",
	projects: "projects",
	topics: "topics",
	files: "files",
	microApps: "microApps",
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

	const resourceType = target ? getRestoreTargetResourceType({ target, items }) : undefined
	const conflictCount = Object.keys(result.conflictResolutions ?? {}).length
	const rootSpaceTypes = result.rootSpaceTypes ?? ["project"]
	const rootLocation = t(
		rootSpaceTypes.length > 1
			? "recycleBin.restoreCheck.spaceRoots"
			: rootSpaceTypes[0] === "user"
				? "recycleBin.restoreCheck.userRoot"
				: "recycleBin.restoreCheck.projectRoot",
	)
	const skippedCount = result.skippedNameConflictCount ?? 0
	const projectMissingCount = result.projectMissingCount ?? 0
	const projectMissingFileNames = result.projectMissingFileNames ?? []
	const duplicateRestoreTargetCount = result.duplicateRestoreTargetCount ?? 0
	const conflictNameList = result.skippedNameConflictNames ?? []
	const visibleConflictNames = conflictNameList
		.slice(0, MAX_CONFLICT_NAME_PREVIEW_COUNT)
		.map((name) => `「${name}」`)
		.join("、")
	const conflictNames =
		conflictNameList.length > MAX_CONFLICT_NAME_PREVIEW_COUNT
			? t("recycleBin.restoreCheck.conflictNamesWithEtc", {
					names: visibleConflictNames,
				})
			: visibleConflictNames
	const terminalConflictMessages: string[] = []
	if (projectMissingCount > 0) {
		const visibleFileNames = projectMissingFileNames
			.slice(0, MAX_CONFLICT_NAME_PREVIEW_COUNT)
			.map((name) => `「${name}」`)
			.join("、")
		const fileNames =
			projectMissingFileNames.length > MAX_CONFLICT_NAME_PREVIEW_COUNT
				? t("recycleBin.restoreCheck.fileNamesWithEtc", {
						names: visibleFileNames,
					})
				: visibleFileNames
		terminalConflictMessages.push(
			fileNames
				? t("recycleBin.restoreCheck.projectMissingTipWithNames", {
						count: projectMissingCount,
						fileNames,
					})
				: t("recycleBin.restoreCheck.projectMissingTip", { count: projectMissingCount }),
		)
	}
	if (duplicateRestoreTargetCount > 0) {
		terminalConflictMessages.push(
			t("recycleBin.restoreCheck.duplicateRestoreTargetTip", {
				count: duplicateRestoreTargetCount,
			}),
		)
	}
	if (
		resourceType === RESOURCE_TYPE.FILE &&
		(conflictCount > 0 || skippedCount > 0 || terminalConflictMessages.length > 0)
	) {
		let baseMessage = ""
		if (conflictCount > 0 && skippedCount > 0) {
			if (!conflictNames) {
				baseMessage = t("recycleBin.restoreCheck.fileConflictCountConfirmMessage", {
					parentMissingCount: conflictCount,
					rootLocation,
					nameConflictCount: skippedCount,
				})
				return [baseMessage, ...terminalConflictMessages].filter(Boolean).join("\n")
			}
			baseMessage = t("recycleBin.restoreCheck.fileConflictConfirmMessage", {
				parentMissingCount: conflictCount,
				rootLocation,
				nameConflictCount: skippedCount,
				conflictNames,
			})
			return [baseMessage, ...terminalConflictMessages].filter(Boolean).join("\n")
		}
		if (skippedCount > 0) {
			if (!conflictNames) {
				baseMessage = t("recycleBin.restoreCheck.nameConflictCountConfirmMessage", {
					count: skippedCount,
				})
				return [baseMessage, ...terminalConflictMessages].filter(Boolean).join("\n")
			}
			baseMessage = t("recycleBin.restoreCheck.nameConflictConfirmMessage", {
				count: skippedCount,
				conflictNames,
			})
			return [baseMessage, ...terminalConflictMessages].filter(Boolean).join("\n")
		}
		if (conflictCount > 0) {
			baseMessage = t("recycleBin.restoreCheck.parentMissingConfirmMessage", {
				rootLocation,
				count: conflictCount,
			})
			return [baseMessage, ...terminalConflictMessages].filter(Boolean).join("\n")
		}
		return terminalConflictMessages.join("\n")
	}

	if (
		result.itemsNeedMove.length > 0 &&
		!shouldRestoreMicroAppWithoutMove(resourceType, result.itemsNeedMove)
	) {
		if (target?.kind !== "selection") return getMissingParentMessage(target, t)
		const selectionResourceType = getRestoreTargetResourceType({ target, items })
		return getNeedMoveStatusMessage(
			target,
			result.itemsNeedMove.length,
			t,
			selectionResourceType,
		)
	}

	const typeLabel = getRestoreTargetTypeLabel(target, t, items)
	const name = getRestoreTargetName(target, t)
	return t("recycleBin.restoreCheck.confirmMessage", { type: typeLabel, name })
}

/** 微应用使用系统隐藏工作区，不向用户暴露项目式的目标工作区选择。 */
export function shouldRestoreMicroAppWithoutMove(
	resourceType: ResourceType | undefined,
	needMoveIds: string[],
): resourceType is typeof RESOURCE_TYPE.MICRO_APP {
	return resourceType === RESOURCE_TYPE.MICRO_APP && needMoveIds.length > 0
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
	if (resourceType === RESOURCE_TYPE.MICRO_APP) return t("recycleBin.item.type.microApp")
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
		resourceType === RESOURCE_TYPE.TOPIC ||
		resourceType === RESOURCE_TYPE.FILE ||
		resourceType === RESOURCE_TYPE.MICRO_APP
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

export function getRestoreFailureMessage(
	data: {
		success_count: number
		failed_count: number
		results: Array<{ success: boolean; error_message?: string }>
	},
	t: TFunction,
) {
	const rawReason = data.results
		.find((item) => !item.success && item.error_message?.trim())
		?.error_message?.trim()
	const reason = rawReason?.replace(/，请选择覆盖或退出$/, "")
	const messageKey =
		data.success_count > 0
			? reason
				? "recycleBin.restoreResult.partialWithReason"
				: "recycleBin.restoreResult.partial"
			: reason
				? "recycleBin.restoreResult.failedWithReason"
				: "recycleBin.restoreResult.failed"

	return t(messageKey, {
		successCount: data.success_count,
		failedCount: data.failed_count,
		reason,
	})
}

export function excludeRestoreResourceIds(resourceIds: string[], excludedResourceIds: string[]) {
	if (excludedResourceIds.length === 0) return Array.from(new Set(resourceIds))
	const excludedSet = new Set(excludedResourceIds)
	return Array.from(new Set(resourceIds)).filter((resourceId) => !excludedSet.has(resourceId))
}
