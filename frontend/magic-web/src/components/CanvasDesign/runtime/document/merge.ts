import type { CanvasConnection, CanvasDocument, ElementContentBase, LayerElement } from "./types"
import { isContentElement } from "./elementContent"
import {
	buildCanvasDocumentConnectionIndex,
	cloneCanvasConnection,
	createCanvasDocumentConnectionDiff,
	getCanvasConnectionHash,
	getCanvasDocumentElementIdSet,
	sanitizeCanvasConnections,
	toSortedCanvasConnectionIdArray,
	type CanvasDocumentConnectionDiff,
	type CanvasDocumentConnectionIndex,
} from "./connectionIndex"
import {
	addCanvasElementIds,
	buildCanvasDocumentElementIndex,
	cloneCanvasElement,
	cloneCanvasElements,
	cloneCanvasJson,
	createCanvasDocumentElementDiff,
	type CanvasDocumentElementDiff,
	type CanvasDocumentElementIndex,
	type CanvasDocumentElementParentId,
	intersectCanvasElementIdSets,
	isCanvasContainerElement,
	isCanvasElementIdSetEmpty,
	sortCanvasElementIdsByTreeDepth,
	sortCanvasElementsByZIndexStable,
	toSortedCanvasElementIdArray,
} from "./elementIndex"

export type CanvasDocumentMergeConflictReason =
	| "duplicate-element-id"
	| "duplicate-connection-id"
	| "same-element-changed"
	| "same-connection-changed"
	| "delete-update-conflict"
	| "connection-delete-update-conflict"
	| "parent-structure-conflict"
	| "missing-parent"

export type CanvasDocumentMergeElementConflictReason = Exclude<
	CanvasDocumentMergeConflictReason,
	| "duplicate-element-id"
	| "duplicate-connection-id"
	| "same-connection-changed"
	| "connection-delete-update-conflict"
>

export type CanvasDocumentMergeConnectionConflictReason =
	"duplicate-connection-id" | "same-connection-changed" | "connection-delete-update-conflict"

export interface CanvasDocumentMergeChangeSummary {
	localChangedElementIds: string[]
	remoteChangedElementIds: string[]
	localDeletedElementIds: string[]
	remoteDeletedElementIds: string[]
	localChangedConnectionIds: string[]
	remoteChangedConnectionIds: string[]
	localDeletedConnectionIds: string[]
	remoteDeletedConnectionIds: string[]
}

export interface CanvasDocumentElementMergeConflict {
	elementId: string
	reason: CanvasDocumentMergeElementConflictReason
	baseElement: LayerElement | null
	localElement: LayerElement | null
	remoteElement: LayerElement | null
	baseParentId: string | null
	localParentId: string | null
	remoteParentId: string | null
}

export interface CanvasDocumentConnectionMergeConflict {
	connectionId: string
	reason: CanvasDocumentMergeConnectionConflictReason
	baseConnection: CanvasConnection | null
	localConnection: CanvasConnection | null
	remoteConnection: CanvasConnection | null
}

export type CanvasDocumentMergeResult =
	| ({
			ok: true
			isElementLevelConflict?: false
			isConnectionLevelConflict?: false
			mergedCanvas: CanvasDocument
	  } & CanvasDocumentMergeChangeSummary)
	| ({
			ok: false
			isElementLevelConflict: true
			isConnectionLevelConflict?: false
			reason: CanvasDocumentMergeElementConflictReason
			conflictElementIds: string[]
			connectionConflictIds?: string[]
			elementConflicts: CanvasDocumentElementMergeConflict[]
			mergedCanvas: CanvasDocument
	  } & CanvasDocumentMergeChangeSummary)
	| ({
			ok: false
			isElementLevelConflict?: false
			isConnectionLevelConflict: true
			reason: CanvasDocumentMergeConnectionConflictReason
			conflictElementIds: string[]
			connectionConflictIds: string[]
			connectionConflicts: CanvasDocumentConnectionMergeConflict[]
			mergedCanvas: CanvasDocument
	  } & CanvasDocumentMergeChangeSummary)
	| ({
			ok: false
			isElementLevelConflict?: false
			isConnectionLevelConflict?: false
			reason: CanvasDocumentMergeConflictReason
			conflictElementIds: string[]
			connectionConflictIds?: string[]
	  } & CanvasDocumentMergeChangeSummary)

interface ConflictCheckResult {
	reason: CanvasDocumentMergeConflictReason
	conflictElementIds: string[]
	mergedCanvas?: CanvasDocument
}

interface ElementConflictAnalysis {
	conflict: ConflictCheckResult | null
	mergedElementsById: Map<string, LayerElement>
}

type LocalDiffApplyResult =
	| {
			ok: true
			mergedCanvas: CanvasDocument
	  }
	| ConflictCheckResult

function isLocalDiffApplySuccess(
	result: LocalDiffApplyResult,
): result is Extract<LocalDiffApplyResult, { ok: true }> {
	return "ok" in result && result.ok
}

function createChangeSummary(
	localDiff: CanvasDocumentElementDiff,
	remoteDiff: CanvasDocumentElementDiff,
	localConnectionDiff?: CanvasDocumentConnectionDiff,
	remoteConnectionDiff?: CanvasDocumentConnectionDiff,
): CanvasDocumentMergeChangeSummary {
	return {
		localChangedElementIds: toSortedCanvasElementIdArray(localDiff.changed),
		remoteChangedElementIds: toSortedCanvasElementIdArray(remoteDiff.changed),
		localDeletedElementIds: toSortedCanvasElementIdArray(localDiff.deleted),
		remoteDeletedElementIds: toSortedCanvasElementIdArray(remoteDiff.deleted),
		localChangedConnectionIds: toSortedCanvasConnectionIdArray(
			localConnectionDiff?.changed ?? [],
		),
		remoteChangedConnectionIds: toSortedCanvasConnectionIdArray(
			remoteConnectionDiff?.changed ?? [],
		),
		localDeletedConnectionIds: toSortedCanvasConnectionIdArray(
			localConnectionDiff?.deleted ?? [],
		),
		remoteDeletedConnectionIds: toSortedCanvasConnectionIdArray(
			remoteConnectionDiff?.deleted ?? [],
		),
	}
}

function areCanvasJsonValuesEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return (
		!!value &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	)
}

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
	return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined
}

const FIELD_LEVEL_MERGE_EXCLUDED_KEYS = new Set(["id", "type", "children", "contents"])

function cloneCanvasFieldValue<T>(value: T): T {
	return value === undefined ? value : cloneCanvasJson(value)
}

function mergeCanvasElementRecordsByField(
	baseRecord: Record<string, unknown>,
	localRecord: Record<string, unknown>,
	remoteRecord: Record<string, unknown>,
	depth = 0,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
	const merged: Record<string, unknown> = {}
	const keys = new Set([
		...Object.keys(baseRecord),
		...Object.keys(localRecord),
		...Object.keys(remoteRecord),
	])

	keys.forEach((key) => {
		if (depth === 0 && FIELD_LEVEL_MERGE_EXCLUDED_KEYS.has(key)) return
		const baseValue = getRecordValue(baseRecord, key)
		const localValue = getRecordValue(localRecord, key)
		const remoteValue = getRecordValue(remoteRecord, key)
		const localChanged = !areCanvasJsonValuesEqual(baseValue, localValue)
		const remoteChanged = !areCanvasJsonValuesEqual(baseValue, remoteValue)

		if (areCanvasJsonValuesEqual(localValue, remoteValue)) {
			merged[key] = cloneCanvasFieldValue(localValue)
			return
		}
		if (localChanged && !remoteChanged) {
			merged[key] = cloneCanvasFieldValue(localValue)
			return
		}
		if (!localChanged && remoteChanged) {
			merged[key] = cloneCanvasFieldValue(remoteValue)
			return
		}
		if (!localChanged && !remoteChanged) {
			merged[key] = cloneCanvasFieldValue(baseValue)
			return
		}

		if (
			(isPlainRecord(baseValue) || baseValue === undefined) &&
			isPlainRecord(localValue) &&
			isPlainRecord(remoteValue)
		) {
			const nestedMerge = mergeCanvasElementRecordsByField(
				isPlainRecord(baseValue) ? baseValue : {},
				localValue,
				remoteValue,
				depth + 1,
			)
			if (nestedMerge.ok) {
				merged[key] = nestedMerge.value
				return
			}
		}

		throw new Error("field-conflict")
	})

	return { ok: true, value: merged }
}

export function tryMergeCanvasElementsByField(
	baseElement: LayerElement,
	localElement: LayerElement,
	remoteElement: LayerElement,
): LayerElement | null {
	if (baseElement.type !== localElement.type || baseElement.type !== remoteElement.type) {
		return null
	}

	try {
		const mergeResult = mergeCanvasElementRecordsByField(
			baseElement as unknown as Record<string, unknown>,
			localElement as unknown as Record<string, unknown>,
			remoteElement as unknown as Record<string, unknown>,
		)
		if (!mergeResult.ok) return null

		if (isContentElement(localElement) && isContentElement(remoteElement)) {
			const mergedContents = mergeElementContentsById(
				isContentElement(baseElement) ? baseElement.contents : [],
				localElement.contents,
				remoteElement.contents,
			)
			if (!mergedContents) return null
			mergeResult.value.contents = mergedContents
			const mergedElement = mergeResult.value as unknown as {
				contents: ElementContentBase[]
				activeContentId: string | null
				mainContentId: string | null
			}
			const pointersValid =
				mergedContents.length === 0
					? mergedElement.activeContentId === null && mergedElement.mainContentId === null
					: typeof mergedElement.activeContentId === "string" &&
						mergedContents.some(
							(content) => content.contentId === mergedElement.activeContentId,
						) &&
						typeof mergedElement.mainContentId === "string" &&
						mergedContents.some(
							(content) => content.contentId === mergedElement.mainContentId,
						)
			if (!pointersValid) return null
		}

		const remoteChildren =
			isCanvasContainerElement(remoteElement) && Array.isArray(remoteElement.children)
				? { children: cloneCanvasElements(remoteElement.children) }
				: {}
		return {
			...mergeResult.value,
			id: remoteElement.id,
			type: remoteElement.type,
			...remoteChildren,
		} as LayerElement
	} catch {
		return null
	}
}

/** Content 数组按 contentId 做三方合并，适用于所有可迭代节点类型。 */
function mergeElementContentsById(
	baseContents: ElementContentBase[],
	localContents: ElementContentBase[],
	remoteContents: ElementContentBase[],
): ElementContentBase[] | null {
	const baseById = new Map(baseContents.map((content) => [content.contentId, content]))
	const localById = new Map(localContents.map((content) => [content.contentId, content]))
	const remoteById = new Map(remoteContents.map((content) => [content.contentId, content]))
	const mergedById = new Map<string, ElementContentBase>()

	const allIds = new Set<string>([...baseById.keys(), ...localById.keys(), ...remoteById.keys()])
	for (const id of allIds) {
		const base = baseById.get(id)
		const local = localById.get(id)
		const remote = remoteById.get(id)
		const localChanged = JSON.stringify(base) !== JSON.stringify(local)
		const remoteChanged = JSON.stringify(base) !== JSON.stringify(remote)

		if (!local && !remote) continue
		if (!local || !remote) {
			// 一侧删除，另一侧只有在未改变时才可接受删除。
			if (!base) {
				const added = local ?? remote
				if (local && remote && JSON.stringify(local) !== JSON.stringify(remote)) return null
				if (added) mergedById.set(id, cloneCanvasJson(added))
				continue
			}
			if (local && localChanged) return null
			if (remote && remoteChanged) return null
			continue
		}

		if (!localChanged && !remoteChanged) {
			mergedById.set(id, cloneCanvasJson(base ?? local))
		} else if (localChanged && !remoteChanged) {
			mergedById.set(id, cloneCanvasJson(local))
		} else if (!localChanged && remoteChanged) {
			mergedById.set(id, cloneCanvasJson(remote))
		} else if (JSON.stringify(local) === JSON.stringify(remote)) {
			mergedById.set(id, cloneCanvasJson(local))
		} else {
			return null
		}
	}

	const orderedIds: string[] = []
	const appendIfPresent = (id: string) => {
		if (mergedById.has(id) && !orderedIds.includes(id)) orderedIds.push(id)
	}
	baseContents.forEach((content) => appendIfPresent(content.contentId))
	localContents.forEach((content) => appendIfPresent(content.contentId))
	remoteContents.forEach((content) => appendIfPresent(content.contentId))

	return orderedIds.map((id) => mergedById.get(id) as ElementContentBase)
}

function findDuplicateConflict(
	...indexes: CanvasDocumentElementIndex[]
): ConflictCheckResult | null {
	const duplicateElementIds = new Set<string>()
	indexes.forEach((index) => addCanvasElementIds(duplicateElementIds, index.duplicateElementIds))
	if (duplicateElementIds.size === 0) return null
	return {
		reason: "duplicate-element-id",
		conflictElementIds: toSortedCanvasElementIdArray(duplicateElementIds),
	}
}

function analyzeElementConflicts(
	baseIndex: CanvasDocumentElementIndex,
	localIndex: CanvasDocumentElementIndex,
	remoteIndex: CanvasDocumentElementIndex,
	localDiff: CanvasDocumentElementDiff,
	remoteDiff: CanvasDocumentElementDiff,
): ElementConflictAnalysis {
	const conflictElementIds: string[] = []
	const mergedElementsById = new Map<string, LayerElement>()
	// Element.type is part of the immutable node identity. A type mismatch is
	// therefore an element-level conflict even when only one branch changed the
	// record (the ordinary changed-id intersection would miss that case).
	const allElementIds = new Set<string>([
		...baseIndex.records.keys(),
		...localIndex.records.keys(),
		...remoteIndex.records.keys(),
	])
	allElementIds.forEach((elementId) => {
		const types = [
			baseIndex.records.get(elementId)?.element.type,
			localIndex.records.get(elementId)?.element.type,
			remoteIndex.records.get(elementId)?.element.type,
		].filter((type): type is LayerElement["type"] => typeof type === "string")
		if (types.length >= 2 && new Set(types).size > 1) conflictElementIds.push(elementId)
	})
	const sameChangedIds = intersectCanvasElementIdSets(
		localDiff.changed,
		remoteDiff.changed,
	).filter((id) => {
		return !(localDiff.deleted.has(id) && remoteDiff.deleted.has(id))
	})

	if (sameChangedIds.length === 0 && conflictElementIds.length === 0) {
		return { conflict: null, mergedElementsById }
	}

	sameChangedIds.forEach((elementId) => {
		if (localDiff.deleted.has(elementId) || remoteDiff.deleted.has(elementId)) {
			conflictElementIds.push(elementId)
			return
		}
		if (localDiff.moved.has(elementId) || remoteDiff.moved.has(elementId)) {
			conflictElementIds.push(elementId)
			return
		}

		const baseElement = baseIndex.records.get(elementId)?.element
		const localElement = localIndex.records.get(elementId)?.element
		const remoteElement = remoteIndex.records.get(elementId)?.element
		if (!baseElement || !localElement || !remoteElement) {
			conflictElementIds.push(elementId)
			return
		}

		const mergedElement = tryMergeCanvasElementsByField(
			baseElement,
			localElement,
			remoteElement,
		)
		if (!mergedElement) {
			conflictElementIds.push(elementId)
			return
		}
		mergedElementsById.set(elementId, mergedElement)
	})

	if (conflictElementIds.length === 0) {
		return { conflict: null, mergedElementsById }
	}

	const hasDeleteUpdateConflict = conflictElementIds.some(
		(id) => localDiff.deleted.has(id) || remoteDiff.deleted.has(id),
	)
	return {
		conflict: {
			reason: hasDeleteUpdateConflict ? "delete-update-conflict" : "same-element-changed",
			conflictElementIds,
		},
		mergedElementsById,
	}
}

function isPureParentAddition(elementIds: Set<string>, diff: CanvasDocumentElementDiff): boolean {
	return Array.from(elementIds).every((elementId) => diff.added.has(elementId))
}

function findParentStructureConflict(
	localDiff: CanvasDocumentElementDiff,
	remoteDiff: CanvasDocumentElementDiff,
): ConflictCheckResult | null {
	const conflictElementIds = new Set<string>()
	localDiff.parentStructureChangedByParent.forEach((localElementIds, key) => {
		const remoteElementIds = remoteDiff.parentStructureChangedByParent.get(key)
		if (!remoteElementIds) return
		if (
			isPureParentAddition(localElementIds, localDiff) &&
			isPureParentAddition(remoteElementIds, remoteDiff)
		) {
			return
		}
		addCanvasElementIds(conflictElementIds, localElementIds)
		addCanvasElementIds(conflictElementIds, remoteElementIds)
	})

	if (conflictElementIds.size === 0) return null
	return {
		reason: "parent-structure-conflict",
		conflictElementIds: toSortedCanvasElementIdArray(conflictElementIds),
	}
}

function createConflictResult(
	reason: CanvasDocumentMergeConflictReason,
	conflictElementIds: string[],
	localDiff: CanvasDocumentElementDiff,
	remoteDiff: CanvasDocumentElementDiff,
	localConnectionDiff?: CanvasDocumentConnectionDiff,
	remoteConnectionDiff?: CanvasDocumentConnectionDiff,
): CanvasDocumentMergeResult {
	return {
		ok: false,
		reason,
		conflictElementIds: toSortedCanvasElementIdArray(conflictElementIds),
		...createChangeSummary(localDiff, remoteDiff, localConnectionDiff, remoteConnectionDiff),
	}
}

function isElementLevelConflictReason(
	reason: CanvasDocumentMergeConflictReason,
): reason is CanvasDocumentMergeElementConflictReason {
	return (
		reason !== "duplicate-element-id" &&
		reason !== "duplicate-connection-id" &&
		reason !== "same-connection-changed" &&
		reason !== "connection-delete-update-conflict"
	)
}

function hasAncestorInConflictSet(
	index: CanvasDocumentElementIndex,
	elementId: string,
	conflictElementIds: Set<string>,
): boolean {
	const record = index.records.get(elementId)
	return record?.ancestorIds.some((ancestorId) => conflictElementIds.has(ancestorId)) ?? false
}

function normalizeTopmostConflictElementIds(
	conflictElementIds: Iterable<string>,
	indexes: CanvasDocumentElementIndex[],
): string[] {
	const conflictElementIdSet = new Set(conflictElementIds)
	return toSortedCanvasElementIdArray(conflictElementIdSet).filter(
		(elementId) =>
			!indexes.some((index) =>
				hasAncestorInConflictSet(index, elementId, conflictElementIdSet),
			),
	)
}

function createConflictSubtreeElementIdSet(
	conflictElementIds: Iterable<string>,
	indexes: CanvasDocumentElementIndex[],
): Set<string> {
	const conflictElementIdSet = new Set(conflictElementIds)
	const excludedElementIds = new Set(conflictElementIdSet)

	indexes.forEach((index) => {
		index.records.forEach((record, elementId) => {
			if (record.ancestorIds.some((ancestorId) => conflictElementIdSet.has(ancestorId))) {
				excludedElementIds.add(elementId)
			}
		})
	})

	return excludedElementIds
}

function createElementLevelConflictResult(
	reason: CanvasDocumentMergeElementConflictReason,
	conflictElementIds: string[],
	mergedCanvas: CanvasDocument,
	localDiff: CanvasDocumentElementDiff,
	remoteDiff: CanvasDocumentElementDiff,
	localConnectionDiff: CanvasDocumentConnectionDiff | undefined,
	remoteConnectionDiff: CanvasDocumentConnectionDiff | undefined,
	baseIndex: CanvasDocumentElementIndex,
	localIndex: CanvasDocumentElementIndex,
	remoteIndex: CanvasDocumentElementIndex,
	reasonByElementId?: Map<string, CanvasDocumentMergeElementConflictReason>,
): CanvasDocumentMergeResult {
	const normalizedConflictElementIds = normalizeTopmostConflictElementIds(conflictElementIds, [
		baseIndex,
		localIndex,
		remoteIndex,
	])
	return {
		ok: false,
		isElementLevelConflict: true,
		reason,
		conflictElementIds: normalizedConflictElementIds,
		elementConflicts: buildElementMergeConflicts({
			reason,
			conflictElementIds: normalizedConflictElementIds,
			baseIndex,
			localIndex,
			remoteIndex,
			reasonByElementId,
		}),
		mergedCanvas,
		...createChangeSummary(localDiff, remoteDiff, localConnectionDiff, remoteConnectionDiff),
	}
}

function cloneIndexedElement(
	index: CanvasDocumentElementIndex,
	elementId: string,
): LayerElement | null {
	const element = index.records.get(elementId)?.element
	return element ? cloneCanvasElement(element) : null
}

function getIndexedParentId(index: CanvasDocumentElementIndex, elementId: string): string | null {
	return index.records.get(elementId)?.parentId ?? null
}

function buildElementMergeConflicts(options: {
	reason: CanvasDocumentMergeElementConflictReason
	conflictElementIds: string[]
	baseIndex: CanvasDocumentElementIndex
	localIndex: CanvasDocumentElementIndex
	remoteIndex: CanvasDocumentElementIndex
	reasonByElementId?: Map<string, CanvasDocumentMergeElementConflictReason>
}): CanvasDocumentElementMergeConflict[] {
	const { reason, conflictElementIds, baseIndex, localIndex, remoteIndex, reasonByElementId } =
		options
	return toSortedCanvasElementIdArray(conflictElementIds).map((elementId) => ({
		elementId,
		reason: reasonByElementId?.get(elementId) ?? reason,
		baseElement: cloneIndexedElement(baseIndex, elementId),
		localElement: cloneIndexedElement(localIndex, elementId),
		remoteElement: cloneIndexedElement(remoteIndex, elementId),
		baseParentId: getIndexedParentId(baseIndex, elementId),
		localParentId: getIndexedParentId(localIndex, elementId),
		remoteParentId: getIndexedParentId(remoteIndex, elementId),
	}))
}

export function refreshCanvasDocumentElementMergeConflictsFromRemote<
	T extends CanvasDocumentElementMergeConflict,
>(options: { elementConflicts: T[]; remoteCanvas: CanvasDocument | undefined }): T[] {
	const remoteIndex = buildCanvasDocumentElementIndex(options.remoteCanvas)
	return options.elementConflicts.map(
		(elementConflict) =>
			({
				...elementConflict,
				remoteElement: cloneIndexedElement(remoteIndex, elementConflict.elementId),
				remoteParentId: getIndexedParentId(remoteIndex, elementConflict.elementId),
			}) as T,
	)
}

function excludeDiffElementIds(
	diff: CanvasDocumentElementDiff,
	excludedIds: Set<string>,
): CanvasDocumentElementDiff {
	const withoutExcluded = (values: Set<string>) =>
		new Set(Array.from(values).filter((value) => !excludedIds.has(value)))

	const parentStructureChangedByParent = new Map<string, Set<string>>()
	diff.parentStructureChangedByParent.forEach((elementIds, key) => {
		const filtered = withoutExcluded(elementIds)
		if (filtered.size > 0) parentStructureChangedByParent.set(key, filtered)
	})

	return {
		added: withoutExcluded(diff.added),
		deleted: withoutExcluded(diff.deleted),
		updated: withoutExcluded(diff.updated),
		moved: withoutExcluded(diff.moved),
		changed: withoutExcluded(diff.changed),
		parentStructureChangedByParent,
	}
}

function removeElementById(elements: LayerElement[], elementId: string): LayerElement[] {
	const nextElements: LayerElement[] = []
	elements.forEach((element) => {
		if (element.id === elementId) return

		if (isCanvasContainerElement(element) && Array.isArray(element.children)) {
			nextElements.push({
				...element,
				children: removeElementById(element.children, elementId),
			})
			return
		}

		nextElements.push(element)
	})
	return nextElements
}

function insertIntoSiblings(siblings: LayerElement[], element: LayerElement): LayerElement[] {
	return sortCanvasElementsByZIndexStable([...siblings, element])
}

function upsertElementIntoParent(
	elements: LayerElement[],
	element: LayerElement,
	parentId: CanvasDocumentElementParentId,
): { elements: LayerElement[]; inserted: boolean } {
	if (parentId === null) {
		return {
			elements: insertIntoSiblings(removeElementById(elements, element.id), element),
			inserted: true,
		}
	}

	let inserted = false
	const withoutExisting = removeElementById(elements, element.id)
	const nextElements = withoutExisting.map((candidate) => {
		if (candidate.id === parentId) {
			if (!isCanvasContainerElement(candidate)) return candidate
			inserted = true
			return {
				...candidate,
				children: insertIntoSiblings(candidate.children ?? [], element),
			}
		}

		if (isCanvasContainerElement(candidate) && Array.isArray(candidate.children)) {
			const childResult = upsertElementIntoParent(candidate.children, element, parentId)
			if (childResult.inserted) {
				inserted = true
				return { ...candidate, children: childResult.elements }
			}
		}

		return candidate
	})

	return { elements: nextElements, inserted }
}

function createCanvasDocumentWithElements(
	canvas: CanvasDocument | undefined,
	elements: LayerElement[],
): CanvasDocument {
	return {
		...cloneCanvasJson(canvas ?? {}),
		elements: cloneCanvasElements(elements),
	}
}

function prepareLocalElementForMerge(
	elementId: string,
	localIndex: CanvasDocumentElementIndex,
	mergedIndex: CanvasDocumentElementIndex,
	localDiff: CanvasDocumentElementDiff,
	mergedElementsById?: Map<string, LayerElement>,
): LayerElement | null {
	const localRecord = localIndex.records.get(elementId)
	if (!localRecord) return null

	const element = cloneCanvasElement(mergedElementsById?.get(elementId) ?? localRecord.element)
	if (localDiff.added.has(elementId) || !isCanvasContainerElement(element)) return element

	const mergedRecord = mergedIndex.records.get(elementId)
	if (!mergedRecord || !isCanvasContainerElement(mergedRecord.element)) return element

	return {
		...element,
		children: cloneCanvasElements(mergedRecord.element.children),
	}
}

function applyLocalDiffToRemote(
	remoteCanvas: CanvasDocument | undefined,
	localIndex: CanvasDocumentElementIndex,
	localDiff: CanvasDocumentElementDiff,
	mergedElementsById?: Map<string, LayerElement>,
): LocalDiffApplyResult {
	const mergedCanvas = cloneCanvasJson(remoteCanvas ?? {})
	let elements = cloneCanvasElements(mergedCanvas.elements)

	sortCanvasElementIdsByTreeDepth(localDiff.deleted, localIndex)
		.reverse()
		.forEach((elementId) => {
			elements = removeElementById(elements, elementId)
		})

	const idsToUpsert = new Set<string>()
	addCanvasElementIds(idsToUpsert, localDiff.added)
	addCanvasElementIds(idsToUpsert, localDiff.updated)
	addCanvasElementIds(idsToUpsert, localDiff.moved)

	for (const elementId of sortCanvasElementIdsByTreeDepth(idsToUpsert, localIndex)) {
		const localRecord = localIndex.records.get(elementId)
		if (!localRecord) continue

		const mergedIndex = buildCanvasDocumentElementIndex({
			...mergedCanvas,
			elements,
		})
		if (localRecord.parentId !== null && !mergedIndex.records.has(localRecord.parentId)) {
			return {
				reason: "missing-parent",
				conflictElementIds: [elementId, localRecord.parentId],
				mergedCanvas: createCanvasDocumentWithElements(mergedCanvas, elements),
			}
		}

		const element = prepareLocalElementForMerge(
			elementId,
			localIndex,
			mergedIndex,
			localDiff,
			mergedElementsById,
		)
		if (!element) continue

		const upsertResult = upsertElementIntoParent(elements, element, localRecord.parentId)
		if (!upsertResult.inserted) {
			return {
				reason: "missing-parent",
				conflictElementIds: [elementId],
				mergedCanvas: createCanvasDocumentWithElements(mergedCanvas, elements),
			}
		}
		elements = upsertResult.elements
	}

	return {
		ok: true,
		mergedCanvas: {
			...mergedCanvas,
			elements,
		},
	}
}

function addElementConflictIds(options: {
	reasonByElementId: Map<string, CanvasDocumentMergeElementConflictReason>
	conflictElementIds: Iterable<string>
	reason: CanvasDocumentMergeElementConflictReason
}): boolean {
	let didAdd = false
	for (const elementId of options.conflictElementIds) {
		if (options.reasonByElementId.has(elementId)) continue
		options.reasonByElementId.set(elementId, options.reason)
		didAdd = true
	}
	return didAdd
}

function createElementLevelMergeResult(options: {
	reason: CanvasDocumentMergeElementConflictReason
	conflictElementIds: string[]
	remoteCanvas: CanvasDocument | undefined
	localDiff: CanvasDocumentElementDiff
	remoteDiff: CanvasDocumentElementDiff
	localConnectionDiff?: CanvasDocumentConnectionDiff
	remoteConnectionDiff?: CanvasDocumentConnectionDiff
	baseIndex: CanvasDocumentElementIndex
	localIndex: CanvasDocumentElementIndex
	remoteIndex: CanvasDocumentElementIndex
	mergedElementsById?: Map<string, LayerElement>
}): CanvasDocumentMergeResult {
	const {
		reason,
		conflictElementIds,
		remoteCanvas,
		localDiff,
		remoteDiff,
		localConnectionDiff,
		remoteConnectionDiff,
		baseIndex,
		localIndex,
		remoteIndex,
		mergedElementsById,
	} = options
	const reasonByElementId = new Map<string, CanvasDocumentMergeElementConflictReason>()
	addElementConflictIds({ reasonByElementId, conflictElementIds, reason })

	let fallbackMergedCanvas = createCanvasDocumentWithElements(
		remoteCanvas,
		cloneCanvasElements(remoteCanvas?.elements),
	)
	const indexes = [baseIndex, localIndex, remoteIndex]
	const maxIterations = localDiff.changed.size + remoteDiff.changed.size + 4

	for (let index = 0; index < maxIterations; index++) {
		const normalizedConflictElementIds = normalizeTopmostConflictElementIds(
			reasonByElementId.keys(),
			indexes,
		)
		const excludedElementIds = createConflictSubtreeElementIdSet(
			normalizedConflictElementIds,
			indexes,
		)
		const mergeableLocalDiff = excludeDiffElementIds(localDiff, excludedElementIds)
		const parentStructureConflict = findParentStructureConflict(mergeableLocalDiff, remoteDiff)

		if (parentStructureConflict) {
			const didAdd = addElementConflictIds({
				reasonByElementId,
				conflictElementIds: parentStructureConflict.conflictElementIds,
				reason: "parent-structure-conflict",
			})
			if (didAdd) continue
		}

		const partialMergeResult = applyLocalDiffToRemote(
			remoteCanvas,
			localIndex,
			mergeableLocalDiff,
			mergedElementsById,
		)
		if (isLocalDiffApplySuccess(partialMergeResult)) {
			return createElementLevelConflictResult(
				reason,
				normalizedConflictElementIds,
				partialMergeResult.mergedCanvas,
				localDiff,
				remoteDiff,
				localConnectionDiff,
				remoteConnectionDiff,
				baseIndex,
				localIndex,
				remoteIndex,
				reasonByElementId,
			)
		}

		fallbackMergedCanvas = partialMergeResult.mergedCanvas ?? fallbackMergedCanvas
		if (!isElementLevelConflictReason(partialMergeResult.reason)) {
			return createConflictResult(
				partialMergeResult.reason,
				partialMergeResult.conflictElementIds,
				localDiff,
				remoteDiff,
				localConnectionDiff,
				remoteConnectionDiff,
			)
		}

		const didAdd = addElementConflictIds({
			reasonByElementId,
			conflictElementIds: partialMergeResult.conflictElementIds,
			reason: partialMergeResult.reason,
		})
		if (!didAdd) break
	}

	return createElementLevelConflictResult(
		reason,
		normalizeTopmostConflictElementIds(reasonByElementId.keys(), indexes),
		fallbackMergedCanvas,
		localDiff,
		remoteDiff,
		localConnectionDiff,
		remoteConnectionDiff,
		baseIndex,
		localIndex,
		remoteIndex,
		reasonByElementId,
	)
}

type ConnectionMergeResult =
	| {
			ok: true
			connections: CanvasConnection[]
	  }
	| {
			ok: false
			reason: CanvasDocumentMergeConnectionConflictReason
			connectionConflictIds: string[]
			connectionConflicts: CanvasDocumentConnectionMergeConflict[]
			connections: CanvasConnection[]
	  }

function cloneIndexedConnection(
	index: CanvasDocumentConnectionIndex,
	connectionId: string,
): CanvasConnection | null {
	const connection = index.records.get(connectionId)?.connection
	return connection ? cloneCanvasConnection(connection) : null
}

function buildConnectionMergeConflict(options: {
	connectionId: string
	reason: CanvasDocumentMergeConnectionConflictReason
	baseIndex: CanvasDocumentConnectionIndex
	localIndex: CanvasDocumentConnectionIndex
	remoteIndex: CanvasDocumentConnectionIndex
}): CanvasDocumentConnectionMergeConflict {
	return {
		connectionId: options.connectionId,
		reason: options.reason,
		baseConnection: cloneIndexedConnection(options.baseIndex, options.connectionId),
		localConnection: cloneIndexedConnection(options.localIndex, options.connectionId),
		remoteConnection: cloneIndexedConnection(options.remoteIndex, options.connectionId),
	}
}

function mergeCanvasDocumentConnections(options: {
	remoteCanvas: CanvasDocument | undefined
	mergedCanvas: CanvasDocument
	baseIndex: CanvasDocumentConnectionIndex
	localIndex: CanvasDocumentConnectionIndex
	remoteIndex: CanvasDocumentConnectionIndex
	localDiff: CanvasDocumentConnectionDiff
	remoteDiff: CanvasDocumentConnectionDiff
}): ConnectionMergeResult {
	const {
		remoteCanvas,
		mergedCanvas,
		baseIndex,
		localIndex,
		remoteIndex,
		localDiff,
		remoteDiff,
	} = options
	const connectionsById = new Map<string, CanvasConnection>()
	sanitizeCanvasConnections(
		remoteCanvas?.connections,
		getCanvasDocumentElementIdSet(mergedCanvas),
	).forEach((connection) => connectionsById.set(connection.id, connection))

	const conflictReasonById = new Map<string, CanvasDocumentMergeConnectionConflictReason>()
	const allChangedIds = new Set<string>([...localDiff.changed, ...remoteDiff.changed])

	allChangedIds.forEach((connectionId) => {
		const localChanged = localDiff.changed.has(connectionId)
		const remoteChanged = remoteDiff.changed.has(connectionId)
		if (!localChanged) return

		const localDeleted = localDiff.deleted.has(connectionId)
		const remoteDeleted = remoteDiff.deleted.has(connectionId)
		const localConnection = localIndex.records.get(connectionId)?.connection ?? null
		const remoteConnection = remoteIndex.records.get(connectionId)?.connection ?? null

		if (localChanged && remoteChanged) {
			if (localDeleted && remoteDeleted) {
				connectionsById.delete(connectionId)
				return
			}
			if (localDeleted || remoteDeleted) {
				conflictReasonById.set(connectionId, "connection-delete-update-conflict")
				return
			}
			if (
				localConnection &&
				remoteConnection &&
				getCanvasConnectionHash(localConnection) ===
					getCanvasConnectionHash(remoteConnection)
			) {
				connectionsById.set(connectionId, cloneCanvasConnection(localConnection))
				return
			}
			conflictReasonById.set(connectionId, "same-connection-changed")
			return
		}

		if (!remoteChanged) {
			if (localDeleted) {
				connectionsById.delete(connectionId)
				return
			}
			if (localConnection) {
				connectionsById.set(connectionId, cloneCanvasConnection(localConnection))
			}
			return
		}
	})

	const connections = sanitizeCanvasConnections(
		Array.from(connectionsById.values()),
		getCanvasDocumentElementIdSet(mergedCanvas),
	)
	if (conflictReasonById.size === 0) {
		return { ok: true, connections }
	}

	const connectionConflictIds = toSortedCanvasConnectionIdArray(conflictReasonById.keys())
	return {
		ok: false,
		reason: conflictReasonById.values().next().value ?? "same-connection-changed",
		connectionConflictIds,
		connectionConflicts: connectionConflictIds.map((connectionId) =>
			buildConnectionMergeConflict({
				connectionId,
				reason: conflictReasonById.get(connectionId) ?? "same-connection-changed",
				baseIndex,
				localIndex,
				remoteIndex,
			}),
		),
		connections,
	}
}

function withConnections(canvas: CanvasDocument, connections: CanvasConnection[]): CanvasDocument {
	return connections.length > 0
		? { ...canvas, connections }
		: { ...canvas, connections: undefined }
}

export function mergeCanvasDocuments(options: {
	baseCanvas: CanvasDocument | undefined
	localCanvas: CanvasDocument | undefined
	remoteCanvas: CanvasDocument | undefined
}): CanvasDocumentMergeResult {
	const { baseCanvas, localCanvas } = options
	const remoteCanvas = options.remoteCanvas
	const baseIndex = buildCanvasDocumentElementIndex(baseCanvas)
	const localIndex = buildCanvasDocumentElementIndex(localCanvas)
	const remoteIndex = buildCanvasDocumentElementIndex(remoteCanvas)
	const localDiff = createCanvasDocumentElementDiff(baseIndex, localIndex)
	const remoteDiff = createCanvasDocumentElementDiff(baseIndex, remoteIndex)
	const baseConnectionIndex = buildCanvasDocumentConnectionIndex(baseCanvas)
	const localConnectionIndex = buildCanvasDocumentConnectionIndex(localCanvas)
	const remoteConnectionIndex = buildCanvasDocumentConnectionIndex(remoteCanvas)
	const localConnectionDiff = createCanvasDocumentConnectionDiff(
		baseConnectionIndex,
		localConnectionIndex,
	)
	const remoteConnectionDiff = createCanvasDocumentConnectionDiff(
		baseConnectionIndex,
		remoteConnectionIndex,
	)

	const duplicateConflict = findDuplicateConflict(baseIndex, localIndex, remoteIndex)
	if (duplicateConflict) {
		return createConflictResult(
			duplicateConflict.reason,
			duplicateConflict.conflictElementIds,
			localDiff,
			remoteDiff,
			localConnectionDiff,
			remoteConnectionDiff,
		)
	}
	const duplicateConnectionIds = new Set<string>([
		...baseConnectionIndex.duplicateConnectionIds,
		...localConnectionIndex.duplicateConnectionIds,
		...remoteConnectionIndex.duplicateConnectionIds,
	])
	if (duplicateConnectionIds.size > 0) {
		const connectionConflictIds = toSortedCanvasConnectionIdArray(duplicateConnectionIds)
		return {
			ok: false,
			isConnectionLevelConflict: true,
			reason: "duplicate-connection-id",
			conflictElementIds: [],
			connectionConflictIds,
			connectionConflicts: connectionConflictIds.map((connectionId) =>
				buildConnectionMergeConflict({
					connectionId,
					reason: "duplicate-connection-id",
					baseIndex: baseConnectionIndex,
					localIndex: localConnectionIndex,
					remoteIndex: remoteConnectionIndex,
				}),
			),
			mergedCanvas: cloneCanvasJson(remoteCanvas ?? {}),
			...createChangeSummary(
				localDiff,
				remoteDiff,
				localConnectionDiff,
				remoteConnectionDiff,
			),
		}
	}

	const elementConflictAnalysis = analyzeElementConflicts(
		baseIndex,
		localIndex,
		remoteIndex,
		localDiff,
		remoteDiff,
	)
	const { mergedElementsById } = elementConflictAnalysis
	const elementConflict = elementConflictAnalysis.conflict
	if (elementConflict) {
		if (isElementLevelConflictReason(elementConflict.reason)) {
			return createElementLevelMergeResult({
				reason: elementConflict.reason,
				conflictElementIds: elementConflict.conflictElementIds,
				remoteCanvas,
				localDiff,
				remoteDiff,
				localConnectionDiff,
				remoteConnectionDiff,
				baseIndex,
				localIndex,
				remoteIndex,
				mergedElementsById,
			})
		}

		return createConflictResult(
			elementConflict.reason,
			elementConflict.conflictElementIds,
			localDiff,
			remoteDiff,
			localConnectionDiff,
			remoteConnectionDiff,
		)
	}

	const parentStructureConflict = findParentStructureConflict(localDiff, remoteDiff)
	if (parentStructureConflict) {
		if (isElementLevelConflictReason(parentStructureConflict.reason)) {
			return createElementLevelMergeResult({
				reason: parentStructureConflict.reason,
				conflictElementIds: parentStructureConflict.conflictElementIds,
				remoteCanvas,
				localDiff,
				remoteDiff,
				localConnectionDiff,
				remoteConnectionDiff,
				baseIndex,
				localIndex,
				remoteIndex,
				mergedElementsById,
			})
		}

		return createConflictResult(
			parentStructureConflict.reason,
			parentStructureConflict.conflictElementIds,
			localDiff,
			remoteDiff,
			localConnectionDiff,
			remoteConnectionDiff,
		)
	}

	const mergeResult = applyLocalDiffToRemote(
		remoteCanvas,
		localIndex,
		localDiff,
		mergedElementsById,
	)
	if (!isLocalDiffApplySuccess(mergeResult)) {
		if (isElementLevelConflictReason(mergeResult.reason)) {
			return createElementLevelMergeResult({
				reason: mergeResult.reason,
				conflictElementIds: mergeResult.conflictElementIds,
				remoteCanvas,
				localDiff,
				remoteDiff,
				localConnectionDiff,
				remoteConnectionDiff,
				baseIndex,
				localIndex,
				remoteIndex,
				mergedElementsById,
			})
		}

		return createConflictResult(
			mergeResult.reason,
			mergeResult.conflictElementIds,
			localDiff,
			remoteDiff,
			localConnectionDiff,
			remoteConnectionDiff,
		)
	}

	const connectionMergeResult = mergeCanvasDocumentConnections({
		remoteCanvas,
		mergedCanvas: mergeResult.mergedCanvas,
		baseIndex: baseConnectionIndex,
		localIndex: localConnectionIndex,
		remoteIndex: remoteConnectionIndex,
		localDiff: localConnectionDiff,
		remoteDiff: remoteConnectionDiff,
	})
	const mergedCanvas = withConnections(
		mergeResult.mergedCanvas,
		connectionMergeResult.connections,
	)
	if (!connectionMergeResult.ok) {
		return {
			ok: false,
			isConnectionLevelConflict: true,
			reason: connectionMergeResult.reason,
			conflictElementIds: [],
			connectionConflictIds: connectionMergeResult.connectionConflictIds,
			connectionConflicts: connectionMergeResult.connectionConflicts,
			mergedCanvas,
			...createChangeSummary(
				localDiff,
				remoteDiff,
				localConnectionDiff,
				remoteConnectionDiff,
			),
		}
	}

	return {
		ok: true,
		mergedCanvas,
		...createChangeSummary(localDiff, remoteDiff, localConnectionDiff, remoteConnectionDiff),
	}
}

export function hasCanvasDocumentLocalChanges(options: {
	baseCanvas: CanvasDocument | undefined
	localCanvas: CanvasDocument | undefined
}): boolean {
	const baseIndex = buildCanvasDocumentElementIndex(options.baseCanvas)
	const localIndex = buildCanvasDocumentElementIndex(options.localCanvas)
	const localDiff = createCanvasDocumentElementDiff(baseIndex, localIndex)
	const baseConnectionIndex = buildCanvasDocumentConnectionIndex(options.baseCanvas)
	const localConnectionIndex = buildCanvasDocumentConnectionIndex(options.localCanvas)
	const localConnectionDiff = createCanvasDocumentConnectionDiff(
		baseConnectionIndex,
		localConnectionIndex,
	)
	return !isCanvasElementIdSetEmpty(localDiff.changed) || localConnectionDiff.changed.size > 0
}
