import type { SeqResponse } from "@/types/request"
import type {
	SuperMagicFileChangeItem,
	SuperMagicFileChangeMessage,
} from "@/types/chat/intermediate_message"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { SuperMagicApi } from "@/apis"
import type { ProjectAttachmentsV2NextParentState } from "@/apis/modules/superMagic"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { loadProjectAttachments } from "../../services"
import { withAttachmentsRefreshWaitersResolved } from "../../services/attachmentsTopicSync"
import { projectAttachmentsChangeLog } from "./changeLogReporter"
import { parseProjectAttachmentsChangeEvent } from "./changeEventParser"
import { getAttachmentName, normalizeAttachmentId, normalizeAttachmentItem } from "./treeUtils"
import { getSharedMediaResourceScope } from "../../services/sharedMediaResourceScope"

export { getProjectAttachmentsChangeDedupeKey } from "./changeEventParser"

export const DEFAULT_PROJECT_ATTACHMENTS_CHANGE_DEBOUNCE_MS = 200
export const DEFAULT_PROJECT_ATTACHMENTS_PARENT_REFRESH_WINDOW_MS = 1000

const DEDUPE_TTL_MS = 60_000
const PROJECT_ATTACHMENTS_PARENT_REFRESH_PAGE_SIZE = 1000
const FILE_TYPES = ["user_upload", "user_create", "process", "system_auto_upload", "directory"]
// Dedupe state follows each store instance so pages/popups do not swallow each other.
const appliedSeqKeysByStore = new WeakMap<ProjectFilesStore, Map<string, number>>()
// Full-refresh fallback can have many triggers; keep one in-flight request per project.
const fallbackRefreshByProject = new Map<
	string,
	Promise<{ tree: AttachmentItem[]; list: AttachmentItem[] }>
>()

function getTemporaryToken() {
	return ""
}

export function getProjectAttachmentsChangeDedupeMap(store: ProjectFilesStore) {
	let dedupeMap = appliedSeqKeysByStore.get(store)
	if (!dedupeMap) {
		dedupeMap = new Map<string, number>()
		appliedSeqKeysByStore.set(store, dedupeMap)
	}
	return dedupeMap
}

export function cleanupProjectAttachmentsChangeDedupeMap(
	dedupeMap: Map<string, number>,
	now: number,
) {
	// Dedupe only short duplicate bursts; do not let seq keys grow forever.
	dedupeMap.forEach((timestamp, key) => {
		if (now - timestamp > DEDUPE_TTL_MS) {
			dedupeMap.delete(key)
		}
	})
}

export function resolveProjectAttachmentsChangeEvent(params: {
	seq: SeqResponse<SuperMagicFileChangeMessage>
	projectId?: string
	enabled: boolean
	store: ProjectFilesStore
	currentTraceId?: string
}) {
	const { seq, projectId, enabled, store, currentTraceId } = params
	const parsedEvent = parseProjectAttachmentsChangeEvent(seq)
	const { messageData, dedupeKey } = parsedEvent
	// Reuse traceId within one debounce batch to connect receive/queue/apply/fallback.
	const traceId =
		currentTraceId ||
		projectAttachmentsChangeLog.createTraceId(projectId || parsedEvent.projectId, dedupeKey)

	projectAttachmentsChangeLog.wsReceived({ projectId, enabled, seq, dedupeKey, traceId })

	// These return-null paths mean the event was received but did not enter apply.
	if (!enabled || !projectId) {
		projectAttachmentsChangeLog.wsIgnored("hook_disabled_or_missing_project", {
			projectId,
			enabled,
			seq,
			traceId,
		})
		return null
	}

	if (!messageData) {
		projectAttachmentsChangeLog.wsIgnored("missing_message", { projectId, seq, traceId })
		return null
	}

	if (messageData.project_id !== projectId) {
		projectAttachmentsChangeLog.wsIgnored("project_mismatch", {
			projectId,
			seq,
			traceId,
			level: "debug",
		})
		return null
	}

	if (parsedEvent.changeCount === 0 && parsedEvent.refreshParentIds.length === 0) {
		projectAttachmentsChangeLog.wsIgnored("empty_changes", { projectId, seq, traceId })
		return null
	}

	const dedupeMap = getProjectAttachmentsChangeDedupeMap(store)
	const now = Date.now()
	cleanupProjectAttachmentsChangeDedupeMap(dedupeMap, now)

	// Reconnects or compensation may repeat events; skip duplicate seqs.
	if (dedupeMap.has(dedupeKey)) {
		projectAttachmentsChangeLog.wsIgnored("duplicate_seq", {
			projectId,
			seq,
			dedupeKey,
			traceId,
			level: "debug",
		})
		return null
	}

	dedupeMap.set(dedupeKey, now)
	return { messageData, dedupeKey, traceId, projectId }
}

export function loadProjectAttachmentsSingleflight(projectId: string) {
	// 同项目只合并同一账户／组织的读取，不能复用切换身份前仍在途的请求。
	const requestKey = `${getSharedMediaResourceScope()}\0${projectId}`
	const existing = fallbackRefreshByProject.get(requestKey)
	if (existing) return existing

	// Unsafe reducer states such as missing parents fall back to full refresh.
	const request = withAttachmentsRefreshWaitersResolved(
		projectId,
		loadProjectAttachments({
			projectId,
			temporaryToken: getTemporaryToken(),
		}).then((res) => ({
			tree: res.tree || [],
			list: res.list || [],
		})),
	).finally(() => {
		fallbackRefreshByProject.delete(requestKey)
	})

	fallbackRefreshByProject.set(requestKey, request)
	return request
}

export interface ProjectAttachmentParentRefreshTrace {
	traceId?: string
	projectId?: string
	seqKeys?: string[]
	batchSize?: number
}

interface LoadRefreshParentFileItemsFromV2Params {
	projectId: string
	parentIds: string[]
	temporaryToken?: string
	signal?: AbortSignal
	trace?: ProjectAttachmentParentRefreshTrace
}

interface ApplyRefreshParentFileItemsParams {
	projectId: string
	parentIds: string[]
	parentFileItems: AttachmentItem[]
	store: ProjectFilesStore
	trace?: ProjectAttachmentParentRefreshTrace
}

interface LoadRefreshParentChildrenSubtreeFromV2Params {
	projectId: string
	parentIds: string[]
	temporaryToken?: string
	signal?: AbortSignal
	trace?: ProjectAttachmentParentRefreshTrace
}

interface ApplyRefreshParentChildrenSubtreeParams {
	projectId: string
	parentIds: string[]
	serverItems: AttachmentItem[]
	store: ProjectFilesStore
	trace?: ProjectAttachmentParentRefreshTrace
}

interface ApplyMergedParentRefreshParams {
	projectId: string
	parentItemIds: string[]
	parentFileItems: AttachmentItem[]
	childrenParentIds: string[]
	serverItems: AttachmentItem[]
	store: ProjectFilesStore
	trace?: ProjectAttachmentParentRefreshTrace
}

// Normalizes parent IDs and removes duplicates while preserving order.
export function normalizeRefreshParentIds(parentIds: unknown) {
	if (!Array.isArray(parentIds)) return []
	const seen = new Set<string>()
	const result: string[] = []
	for (const parentId of parentIds) {
		const normalizedId = normalizeAttachmentId(parentId)
		if (!normalizedId || seen.has(normalizedId)) continue
		seen.add(normalizedId)
		result.push(normalizedId)
	}
	return result
}

// Builds an O(1) lookup by file_id for local/server attachment rows.
function createAttachmentLookup(list: AttachmentItem[]) {
	const lookup = new Map<string, AttachmentItem>()
	for (const item of list) {
		const fileId = normalizeAttachmentId(item.file_id)
		if (fileId) lookup.set(fileId, item)
	}
	return lookup
}

// Creates a stable key for detecting repeated backend BFS cursor states.
function createNextParentStateKey(nextParentIds: ProjectAttachmentsV2NextParentState[]) {
	try {
		return JSON.stringify(nextParentIds)
	} catch (_error) {
		return nextParentIds
			.map((state, index) => `${index}:${String(state.parent_id || "")}`)
			.join("|")
	}
}

// Keeps backend BFS cursor states as-is, only guarding non-array values.
function normalizeNextParentStates(
	nextParentIds: ProjectAttachmentsV2NextParentState[] | null | undefined,
) {
	if (!Array.isArray(nextParentIds)) return []
	return nextParentIds
}

// Resolves the change target id from either wrapper or file payload.
function getChangeFileId(change: SuperMagicFileChangeItem) {
	return normalizeAttachmentId(change.file_id || change.file?.file_id)
}

// Collects parent IDs that need subtree reconcile from non-directory file changes.
export function collectFileChangeParentRefreshIds(
	changes: SuperMagicFileChangeItem[],
	beforeList: AttachmentItem[],
) {
	// Only file changes can imply missed sibling updates; deletes use the pre-apply list.
	const beforeById = createAttachmentLookup(beforeList)
	const parentIds: string[] = []
	for (const change of changes) {
		const fileId = getChangeFileId(change)
		const incoming = change.file ? normalizeAttachmentItem(change.file as AttachmentItem) : null
		const previous = fileId ? beforeById.get(fileId) || null : null
		const file = incoming || previous
		if (!file || file.is_directory) continue

		const parentId = normalizeAttachmentId(file.parent_id)
		if (parentId) parentIds.push(parentId)
	}
	return normalizeRefreshParentIds(parentIds)
}

// WS already carries explicit non-directory file payloads; subtree reconcile is redundant.
export function shouldSkipParentChildrenReconcileAfterWsApply(changes: SuperMagicFileChangeItem[]) {
	if (changes.length === 0) return true

	return changes.every((change) => {
		if (change.operation === "delete") return false
		const incoming = change.file ? normalizeAttachmentItem(change.file as AttachmentItem) : null
		return Boolean(incoming && !incoming.is_directory)
	})
}

function buildParentItemRefreshChanges(
	parentFileItems: AttachmentItem[],
	localItemById: Map<string, AttachmentItem>,
) {
	const changes: SuperMagicFileChangeItem[] = []
	for (const parent of parentFileItems) {
		const fileId = normalizeAttachmentId(parent.file_id)
		if (!fileId) continue

		const localItem = localItemById.get(fileId)
		if (
			localItem &&
			getParentItemRefreshSignature(localItem) === getParentItemRefreshSignature(parent)
		) {
			continue
		}

		changes.push({
			operation: "update",
			file_id: fileId,
			file: parent as SuperMagicFileChangeItem["file"],
		})
	}
	return changes
}

function buildParentChildrenReconcileChanges(params: {
	parentIds: string[]
	serverItems: AttachmentItem[]
	store: ProjectFilesStore
}) {
	const parentIds = normalizeRefreshParentIds(params.parentIds)
	if (parentIds.length === 0) return []

	const localItemById = createAttachmentLookup(params.store.workspaceFilesList)
	const serverItems = withResolvedSubtreePaths(params.serverItems, localItemById)
	const localParentItems = parentIds
		.map((parentId) => localItemById.get(parentId))
		.filter((item): item is AttachmentItem => Boolean(item))
	const localItems = [
		...localParentItems,
		...collectLocalDescendants(params.store.workspaceFilesList, parentIds),
	]

	return createParentChildrenReconcileChanges({
		parentIds,
		serverItems,
		localItems,
	})
}

export function buildMergedParentRefreshChanges(params: {
	projectId: string
	parentItemIds: string[]
	parentFileItems: AttachmentItem[]
	childrenParentIds: string[]
	serverItems: AttachmentItem[]
	store: ProjectFilesStore
	trace?: ProjectAttachmentParentRefreshTrace
}) {
	const parentItemIds = normalizeRefreshParentIds(params.parentItemIds)
	const childrenParentIds = normalizeRefreshParentIds(params.childrenParentIds)
	const localItemById = createAttachmentLookup(params.store.workspaceFilesList)
	const changes: SuperMagicFileChangeItem[] = []

	if (parentItemIds.length > 0 && params.parentFileItems.length > 0) {
		const refreshedParentIds = new Set(
			params.parentFileItems
				.map((item) => normalizeAttachmentId(item.file_id))
				.filter(Boolean),
		)
		const missingParentIds = parentItemIds.filter(
			(parentId) => !refreshedParentIds.has(parentId),
		)
		if (missingParentIds.length > 0) {
			projectAttachmentsChangeLog.refreshParentIdsSkipped({
				projectId: params.projectId,
				parentIds: missingParentIds,
				reason: "parent_not_found",
				traceId: params.trace?.traceId,
			})
		}
		const parentChanges = buildParentItemRefreshChanges(params.parentFileItems, localItemById)
		if (parentChanges.length === 0 && params.parentFileItems.length > 0) {
			projectAttachmentsChangeLog.refreshParentIdsSkipped({
				projectId: params.projectId,
				parentIds: parentItemIds,
				reason: "no_diff",
				traceId: params.trace?.traceId,
			})
		}
		changes.push(...parentChanges)
	}

	if (childrenParentIds.length > 0) {
		changes.push(
			...buildParentChildrenReconcileChanges({
				parentIds: childrenParentIds,
				serverItems: params.serverItems,
				store: params.store,
			}),
		)
	}

	return changes
}

// Extracts the requested parent folder item from a v2 response page.
function getResponseParentFileItem(responseList: AttachmentItem[], parentId: string) {
	for (const item of responseList) {
		const normalized = normalizeAttachmentItem(item)
		if (normalized?.file_id === parentId && !normalized.is_hidden) return normalized
	}
	return null
}

// Normalizes v2 rows and removes hidden entries before reconcile.
function normalizeVisibleAttachmentRows(rows: AttachmentItem[]) {
	const normalizedRows: AttachmentItem[] = []
	for (const row of rows) {
		const normalized = normalizeAttachmentItem(row)
		if (!normalized || normalized.is_hidden) continue
		normalizedRows.push({ ...normalized, children: [] })
	}
	return normalizedRows
}

// Joins parent path and file name without introducing duplicate separators.
function joinAttachmentPath(parentPath: string, name: string) {
	if (!parentPath) return name
	if (!name) return parentPath
	return `${parentPath}/${name}`
}

// Rebuilds relative paths for server subtree rows before applying reducer changes.
function withResolvedSubtreePaths(
	items: AttachmentItem[],
	localItemById: Map<string, AttachmentItem>,
) {
	// V2 rows can omit paths; rebuild paths so reducer updates remain openable.
	const itemById = createAttachmentLookup(items)
	const pathById = new Map<string, string>()

	const resolvePath = (item: AttachmentItem, visiting = new Set<string>()): string => {
		const fileId = normalizeAttachmentId(item.file_id)
		const cached = pathById.get(fileId)
		if (cached !== undefined) return cached
		if (visiting.has(fileId)) return item.relative_file_path || getAttachmentName(item)
		visiting.add(fileId)

		const existingPath = localItemById.get(fileId)?.relative_file_path
		const parentId = normalizeAttachmentId(item.parent_id)
		const parent = itemById.get(parentId)
		const parentPath = parent ? resolvePath(parent, visiting) : ""
		const resolvedPath = parent
			? joinAttachmentPath(parentPath, getAttachmentName(item))
			: existingPath || item.relative_file_path || getAttachmentName(item)
		pathById.set(fileId, resolvedPath)
		visiting.delete(fileId)
		return resolvedPath
	}

	return items.map((item) => ({
		...item,
		relative_file_path: resolvePath(item),
	}))
}

// Collects all local descendants under the target parent IDs.
function collectLocalDescendants(list: AttachmentItem[], parentIds: string[]) {
	// Compare against all local descendants, not just direct children.
	const parentSet = new Set(parentIds)
	const childrenByParentId = new Map<string, AttachmentItem[]>()
	for (const item of list) {
		const parentId = normalizeAttachmentId(item.parent_id)
		const children = childrenByParentId.get(parentId) || []
		children.push(item)
		childrenByParentId.set(parentId, children)
	}

	const result: AttachmentItem[] = []
	const stack = parentIds.flatMap((parentId) => childrenByParentId.get(parentId) || [])
	while (stack.length > 0) {
		const item = stack.pop()
		if (!item) continue
		const fileId = normalizeAttachmentId(item.file_id)
		if (!fileId || parentSet.has(fileId)) continue
		result.push(item)
		const children = childrenByParentId.get(fileId)
		if (children?.length) stack.push(...children)
	}
	return result
}

// Produces a lightweight business signature for detecting changed file rows.
function getReconcileSignature(item: AttachmentItem) {
	return [
		normalizeAttachmentId(item.parent_id),
		getAttachmentName(item),
		String(Boolean(item.is_directory)),
		String(item.file_type || ""),
		String(item.file_extension || ""),
		String(item.file_key || ""),
		String(item.file_size ?? ""),
		String(item.file_url || ""),
		String(item.updated_at || ""),
		String(item.sort ?? ""),
		String(item.source ?? ""),
		createConfigSignature(item.display_config),
		createConfigSignature(item.metadata),
	].join("|")
}

// Parent folder refresh often only bumps updated_at/sort; skip those for no-op detection.
function getParentItemRefreshSignature(item: AttachmentItem) {
	return [
		normalizeAttachmentId(item.parent_id),
		getAttachmentName(item),
		String(Boolean(item.is_directory)),
		String(item.file_type || ""),
		String(item.file_extension || ""),
		String(item.file_key || ""),
		String(item.file_size ?? ""),
		String(item.file_url || ""),
		String(item.source ?? ""),
		createConfigSignature(item.display_config),
		createConfigSignature(item.metadata),
	].join("|")
}

// Serializes display metadata only for reconcile comparisons.
function createConfigSignature(value: unknown) {
	if (value === null || value === undefined) return ""
	if (typeof value === "string") return value
	try {
		return JSON.stringify(value)
	} catch (_error) {
		return ""
	}
}

/**
 * Converts a server parent-subtree snapshot into reducer changes.
 *
 * Diff rules:
 * - Parent items:
 *   - server parent missing locally -> add
 *   - server parent differs locally -> update
 *   - server parent equals locally -> skip
 *   - local parent missing on server -> never delete here
 * - Child / descendant items:
 *   - server child missing locally -> add
 *   - server child differs locally -> update
 *   - server child equals locally -> skip
 *   - local child missing on server -> delete
 *
 * The server snapshot is authoritative for children, while parent items are
 * refreshed only when returned by the snapshot.
 */
function createParentChildrenReconcileChanges(params: {
	parentIds: string[]
	serverItems: AttachmentItem[]
	localItems: AttachmentItem[]
}) {
	const parentIdSet = new Set(params.parentIds)
	const localById = createAttachmentLookup(params.localItems)
	const serverParentItems = params.serverItems.filter((item) =>
		parentIdSet.has(normalizeAttachmentId(item.file_id)),
	)
	const serverChildren = params.serverItems.filter(
		(item) => !parentIdSet.has(normalizeAttachmentId(item.file_id)),
	)
	const localChildren = params.localItems.filter(
		(item) => !parentIdSet.has(normalizeAttachmentId(item.file_id)),
	)
	const serverById = createAttachmentLookup(serverChildren)
	const changes: SuperMagicFileChangeItem[] = []

	for (const serverParentItem of serverParentItems) {
		const fileId = normalizeAttachmentId(serverParentItem.file_id)
		const localParentItem = localById.get(fileId)
		if (
			localParentItem &&
			getReconcileSignature(localParentItem) === getReconcileSignature(serverParentItem)
		) {
			continue
		}
		changes.push({
			operation: localParentItem ? "update" : "add",
			file_id: fileId,
			file: serverParentItem as SuperMagicFileChangeItem["file"],
		})
	}

	for (const serverItem of serverChildren) {
		const fileId = normalizeAttachmentId(serverItem.file_id)
		const localItem = localById.get(fileId)
		if (!localItem) {
			changes.push({
				operation: "add",
				file_id: fileId,
				file: serverItem as SuperMagicFileChangeItem["file"],
			})
			continue
		}

		if (getReconcileSignature(localItem) === getReconcileSignature(serverItem)) continue
		changes.push({
			operation: "update",
			file_id: fileId,
			file: serverItem as SuperMagicFileChangeItem["file"],
		})
	}

	for (const localItem of localChildren) {
		const fileId = normalizeAttachmentId(localItem.file_id)
		if (!fileId || serverById.has(fileId)) continue
		changes.push({
			operation: "delete",
			file_id: fileId,
		})
	}

	return changes
}

// Loads only the parent folder items requested by refresh_parent_ids.
export async function loadRefreshParentFileItemsFromV2(
	params: LoadRefreshParentFileItemsFromV2Params,
) {
	const parentIds = normalizeRefreshParentIds(params.parentIds)
	if (parentIds.length === 0) return []

	projectAttachmentsChangeLog.refreshParentIdsStart({
		projectId: params.projectId,
		parentIds,
		traceId: params.trace?.traceId,
	})

	const responses = await Promise.all(
		parentIds.map((parentId) =>
			SuperMagicApi.getProjectAttachmentsV2Page(
				{
					projectId: params.projectId,
					parentId,
					pageSize: PROJECT_ATTACHMENTS_PARENT_REFRESH_PAGE_SIZE,
					fileType: FILE_TYPES,
					temporaryToken: params.temporaryToken ?? getTemporaryToken(),
				},
				{ signal: params.signal },
			),
		),
	)

	return responses
		.map((response, index) => getResponseParentFileItem(response.list || [], parentIds[index]))
		.filter((item): item is AttachmentItem => Boolean(item))
}

// Recursively loads complete parent subtrees via v2 parent_id and BFS cursors.
export async function loadRefreshParentChildrenSubtreeFromV2(
	params: LoadRefreshParentChildrenSubtreeFromV2Params,
) {
	const parentIds = normalizeRefreshParentIds(params.parentIds)
	if (parentIds.length === 0) return []

	projectAttachmentsChangeLog.refreshParentChildrenStart({
		projectId: params.projectId,
		parentIds,
		traceId: params.trace?.traceId,
	})

	const itemsById = new Map<string, AttachmentItem>()
	for (const parentId of parentIds) {
		// Follow backend BFS cursors until this parent subtree is complete.
		const seenNextParentStateKeys = new Set<string>()
		let requestNextParentIds: ProjectAttachmentsV2NextParentState[] | undefined
		let hasNextPage = true

		while (hasNextPage) {
			const response = await SuperMagicApi.getProjectAttachmentsV2Page(
				{
					projectId: params.projectId,
					parentId,
					nextParentIds: requestNextParentIds,
					pageSize: PROJECT_ATTACHMENTS_PARENT_REFRESH_PAGE_SIZE,
					fileType: FILE_TYPES,
					temporaryToken: params.temporaryToken ?? getTemporaryToken(),
				},
				{ signal: params.signal },
			)

			for (const item of normalizeVisibleAttachmentRows(response.list || [])) {
				const fileId = normalizeAttachmentId(item.file_id)
				if (fileId && !itemsById.has(fileId)) itemsById.set(fileId, item)
			}

			const nextParentIds = normalizeNextParentStates(response.next_parent_ids)
			if (response.has_more && nextParentIds.length === 0) {
				throw new Error("empty_next_parent_ids_with_has_more")
			}
			const hasMoreAfterPage = Boolean(response.has_more && nextParentIds.length > 0)
			if (!hasMoreAfterPage) break

			const nextParentStateKey = createNextParentStateKey(nextParentIds)
			if (seenNextParentStateKeys.has(nextParentStateKey)) {
				throw new Error("repeated_next_parent_state")
			}

			seenNextParentStateKeys.add(nextParentStateKey)
			requestNextParentIds = nextParentIds
			hasNextPage = hasMoreAfterPage
		}
	}

	return Array.from(itemsById.values())
}

// Applies refreshed parent folder items as update changes.
export function applyRefreshParentFileItems(params: ApplyRefreshParentFileItemsParams) {
	const parentIds = normalizeRefreshParentIds(params.parentIds)
	const parentFileItems = params.parentFileItems
	if (parentIds.length === 0) return null

	const changes = buildMergedParentRefreshChanges({
		projectId: params.projectId,
		parentItemIds: parentIds,
		parentFileItems,
		childrenParentIds: [],
		serverItems: [],
		store: params.store,
		trace: params.trace,
	})
	if (changes.length === 0) return null

	const result = params.store.applyFileChanges(changes, {
		applySource: "refresh_parent_ids",
		trace: {
			...params.trace,
			projectId: params.projectId,
			batchSize: changes.length,
		},
	})

	if (result.fallbackRequired) {
		projectAttachmentsChangeLog.refreshParentIdsSkipped({
			projectId: params.projectId,
			parentIds,
			reason: result.fallbackReason || "apply_fallback_required",
			traceId: params.trace?.traceId,
		})
		return null
	}

	projectAttachmentsChangeLog.refreshParentIdsSuccess({
		projectId: params.projectId,
		parentIds: parentFileItems
			.map((item) => normalizeAttachmentId(item.file_id))
			.filter(Boolean),
		treeCount: result.tree.length,
		listCount: result.list.length,
		traceId: params.trace?.traceId,
	})

	return result
}

// Applies parent item refresh and children reconcile in one reducer pass.
export function applyMergedParentRefresh(params: ApplyMergedParentRefreshParams) {
	const parentItemIds = normalizeRefreshParentIds(params.parentItemIds)
	const childrenParentIds = normalizeRefreshParentIds(params.childrenParentIds)
	if (parentItemIds.length === 0 && childrenParentIds.length === 0) return null

	const changes = buildMergedParentRefreshChanges({
		projectId: params.projectId,
		parentItemIds,
		parentFileItems: params.parentFileItems,
		childrenParentIds,
		serverItems: params.serverItems,
		store: params.store,
		trace: params.trace,
	})
	if (changes.length === 0) {
		if (childrenParentIds.length > 0) {
			projectAttachmentsChangeLog.refreshParentChildrenSkipped({
				projectId: params.projectId,
				parentIds: childrenParentIds,
				reason: "no_diff",
				traceId: params.trace?.traceId,
			})
		}
		return null
	}

	const result = params.store.applyFileChanges(changes, {
		applySource: "refresh_parent_merged",
		trace: {
			...params.trace,
			projectId: params.projectId,
			batchSize: changes.length,
		},
	})

	if (result.fallbackRequired) {
		projectAttachmentsChangeLog.refreshParentIdsSkipped({
			projectId: params.projectId,
			parentIds: [...parentItemIds, ...childrenParentIds],
			reason: result.fallbackReason || "apply_fallback_required",
			traceId: params.trace?.traceId,
		})
		return null
	}

	if (parentItemIds.length > 0) {
		projectAttachmentsChangeLog.refreshParentIdsSuccess({
			projectId: params.projectId,
			parentIds: params.parentFileItems
				.map((item) => normalizeAttachmentId(item.file_id))
				.filter(Boolean),
			treeCount: result.tree.length,
			listCount: result.list.length,
			traceId: params.trace?.traceId,
		})
	}
	if (childrenParentIds.length > 0) {
		projectAttachmentsChangeLog.refreshParentChildrenSuccess({
			projectId: params.projectId,
			parentIds: childrenParentIds,
			changeCount: changes.length,
			treeCount: result.tree.length,
			listCount: result.list.length,
			traceId: params.trace?.traceId,
		})
	}

	return result
}

// Applies reconciled subtree changes for parent children consistency.
export function applyRefreshParentChildrenSubtree(params: ApplyRefreshParentChildrenSubtreeParams) {
	const parentIds = normalizeRefreshParentIds(params.parentIds)
	if (parentIds.length === 0) return null

	const changes = buildMergedParentRefreshChanges({
		projectId: params.projectId,
		parentItemIds: [],
		parentFileItems: [],
		childrenParentIds: parentIds,
		serverItems: params.serverItems,
		store: params.store,
		trace: params.trace,
	})

	if (changes.length === 0) {
		projectAttachmentsChangeLog.refreshParentChildrenSkipped({
			projectId: params.projectId,
			parentIds,
			reason: "no_diff",
			traceId: params.trace?.traceId,
		})
		return null
	}

	const result = params.store.applyFileChanges(changes, {
		applySource: "refresh_parent_children",
		trace: {
			...params.trace,
			projectId: params.projectId,
			batchSize: changes.length,
		},
	})

	if (result.fallbackRequired) {
		projectAttachmentsChangeLog.refreshParentChildrenSkipped({
			projectId: params.projectId,
			parentIds,
			reason: result.fallbackReason || "apply_fallback_required",
			traceId: params.trace?.traceId,
		})
		return null
	}

	projectAttachmentsChangeLog.refreshParentChildrenSuccess({
		projectId: params.projectId,
		parentIds,
		changeCount: changes.length,
		treeCount: result.tree.length,
		listCount: result.list.length,
		traceId: params.trace?.traceId,
	})

	return result
}
