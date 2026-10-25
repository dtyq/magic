import type { CanvasConnection, CanvasDocument, LayerElement } from "./types"
import { buildCanvasDocumentElementIndex, toSortedCanvasElementIdArray } from "./elementIndex"

export interface CanvasDocumentConnectionRecord {
	id: string
	connection: CanvasConnection
	hash: string
}

export interface CanvasDocumentConnectionIndex {
	records: Map<string, CanvasDocumentConnectionRecord>
	duplicateConnectionIds: Set<string>
}

export interface CanvasDocumentConnectionDiff {
	added: Set<string>
	deleted: Set<string>
	updated: Set<string>
	changed: Set<string>
}

export function cloneCanvasConnection(connection: CanvasConnection): CanvasConnection {
	return {
		id: connection.id,
		sourceElementId: connection.sourceElementId,
		targetElementId: connection.targetElementId,
	}
}

export function cloneCanvasConnections(
	connections: CanvasConnection[] | undefined,
): CanvasConnection[] {
	return (connections ?? []).map(cloneCanvasConnection)
}

export function getCanvasConnectionHash(connection: CanvasConnection): string {
	return JSON.stringify({
		sourceElementId: connection.sourceElementId,
		targetElementId: connection.targetElementId,
	})
}

export function buildCanvasDocumentConnectionIndex(
	canvas: CanvasDocument | undefined,
): CanvasDocumentConnectionIndex {
	const index: CanvasDocumentConnectionIndex = {
		records: new Map(),
		duplicateConnectionIds: new Set(),
	}

	;(canvas?.connections ?? []).forEach((connection) => {
		if (index.records.has(connection.id)) {
			index.duplicateConnectionIds.add(connection.id)
		}
		index.records.set(connection.id, {
			id: connection.id,
			connection,
			hash: getCanvasConnectionHash(connection),
		})
	})

	return index
}

export function createCanvasDocumentConnectionDiff(
	base: CanvasDocumentConnectionIndex,
	target: CanvasDocumentConnectionIndex,
): CanvasDocumentConnectionDiff {
	const added = new Set<string>()
	const deleted = new Set<string>()
	const updated = new Set<string>()

	target.records.forEach((targetRecord, connectionId) => {
		const baseRecord = base.records.get(connectionId)
		if (!baseRecord) {
			added.add(connectionId)
			return
		}
		if (baseRecord.hash !== targetRecord.hash) {
			updated.add(connectionId)
		}
	})

	base.records.forEach((_baseRecord, connectionId) => {
		if (!target.records.has(connectionId)) {
			deleted.add(connectionId)
		}
	})

	const changed = new Set<string>([...added, ...deleted, ...updated])
	return { added, deleted, updated, changed }
}

export function getCanvasDocumentElementIdSet(
	canvasOrElements: CanvasDocument | LayerElement[] | undefined,
): Set<string> {
	const canvas = Array.isArray(canvasOrElements)
		? { elements: canvasOrElements }
		: canvasOrElements
	return new Set(buildCanvasDocumentElementIndex(canvas).records.keys())
}

export function sanitizeCanvasConnections(
	connections: CanvasConnection[] | undefined,
	elementIds: Set<string>,
): CanvasConnection[] {
	const seenIds = new Set<string>()
	const result: CanvasConnection[] = []

	for (const connection of connections ?? []) {
		if (!connection.id || seenIds.has(connection.id)) continue
		if (connection.sourceElementId === connection.targetElementId) continue
		if (!elementIds.has(connection.sourceElementId)) continue
		if (!elementIds.has(connection.targetElementId)) continue

		seenIds.add(connection.id)
		result.push(cloneCanvasConnection(connection))
	}

	return result
}

export function toSortedCanvasConnectionIdArray(values: Iterable<string>): string[] {
	return toSortedCanvasElementIdArray(values)
}
