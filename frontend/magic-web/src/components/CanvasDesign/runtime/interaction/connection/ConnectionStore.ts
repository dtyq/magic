import { cloneCanvasConnection } from "../../document/connectionIndex"
import type { CanvasConnection } from "../../document/types"

function cloneConnections(connections: CanvasConnection[]): CanvasConnection[] {
	return connections.map(cloneCanvasConnection)
}

function createDirectedPairKey(sourceElementId: string, targetElementId: string): string {
	return `${sourceElementId}\u0000${targetElementId}`
}

function createUndirectedPairKey(sourceElementId: string, targetElementId: string): string {
	return [sourceElementId, targetElementId].sort().join("\u0000")
}

function addToStringSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
	const values = map.get(key) ?? new Set<string>()
	values.add(value)
	map.set(key, values)
}

export class ConnectionStore {
	private connections: CanvasConnection[] = []
	private connectionsById = new Map<string, CanvasConnection>()
	private connectionIdByDirectedPair = new Map<string, string>()
	private connectionIdByUndirectedPair = new Map<string, string>()
	private connectionIdsByElementId = new Map<string, Set<string>>()
	private upstreamConnectionIdsByElementId = new Map<string, Set<string>>()
	private downstreamConnectionIdsByElementId = new Map<string, Set<string>>()

	public load(connections: CanvasConnection[]): void {
		this.connections = []
		this.connectionsById.clear()
		this.connectionIdByDirectedPair.clear()
		this.connectionIdByUndirectedPair.clear()
		this.connectionIdsByElementId.clear()
		this.upstreamConnectionIdsByElementId.clear()
		this.downstreamConnectionIdsByElementId.clear()

		connections.forEach((connection) => {
			this.addInternal(connection)
		})
	}

	public clear(): void {
		this.load([])
	}

	public isEmpty(): boolean {
		return this.connections.length === 0
	}

	public getConnections(): CanvasConnection[] {
		return cloneConnections(this.connections)
	}

	public getConnectionIds(): string[] {
		return this.connections.map((connection) => connection.id)
	}

	public getConnectionsByIds(connectionIds: Iterable<string>): CanvasConnection[] {
		const connectionIdSet = new Set(connectionIds)
		return this.connections
			.filter((connection) => connectionIdSet.has(connection.id))
			.map(cloneCanvasConnection)
	}

	public hasConnectionId(connectionId: string): boolean {
		return this.connectionsById.has(connectionId)
	}

	public hasConnection(sourceElementId: string, targetElementId: string): boolean {
		return this.connectionIdByDirectedPair.has(
			createDirectedPairKey(sourceElementId, targetElementId),
		)
	}

	public hasReverseConnection(sourceElementId: string, targetElementId: string): boolean {
		return this.hasConnection(targetElementId, sourceElementId)
	}

	public hasAnyConnectionBetween(sourceElementId: string, targetElementId: string): boolean {
		return this.connectionIdByUndirectedPair.has(
			createUndirectedPairKey(sourceElementId, targetElementId),
		)
	}

	public getUpstreamConnections(elementId: string): CanvasConnection[] {
		return this.getConnectionsByIndexedIds(this.upstreamConnectionIdsByElementId.get(elementId))
	}

	public getDownstreamConnections(elementId: string): CanvasConnection[] {
		return this.getConnectionsByIndexedIds(
			this.downstreamConnectionIdsByElementId.get(elementId),
		)
	}

	public getConnectionIdsByElementId(elementId: string): string[] {
		return Array.from(this.connectionIdsByElementId.get(elementId) ?? [])
	}

	public add(connection: CanvasConnection): boolean {
		return this.addInternal(connection)
	}

	public removeConnections(connectionIds: Iterable<string>): string[] {
		const connectionIdSet = new Set(connectionIds)
		const deletedConnectionIds = this.connections
			.filter((connection) => connectionIdSet.has(connection.id))
			.map((connection) => connection.id)
		if (deletedConnectionIds.length === 0) return []

		this.load(this.connections.filter((connection) => !connectionIdSet.has(connection.id)))
		return deletedConnectionIds
	}

	public removeConnectionsByElementId(elementId: string): string[] {
		return this.removeConnections(this.getConnectionIdsByElementId(elementId))
	}

	private addInternal(connection: CanvasConnection): boolean {
		if (!connection.id || this.connectionsById.has(connection.id)) {
			return false
		}
		if (connection.sourceElementId === connection.targetElementId) {
			return false
		}

		const directedPairKey = createDirectedPairKey(
			connection.sourceElementId,
			connection.targetElementId,
		)
		if (this.connectionIdByDirectedPair.has(directedPairKey)) {
			return false
		}

		const undirectedPairKey = createUndirectedPairKey(
			connection.sourceElementId,
			connection.targetElementId,
		)
		if (this.connectionIdByUndirectedPair.has(undirectedPairKey)) {
			return false
		}

		const clonedConnection = cloneCanvasConnection(connection)
		this.connections.push(clonedConnection)
		this.connectionsById.set(clonedConnection.id, clonedConnection)
		this.connectionIdByDirectedPair.set(directedPairKey, clonedConnection.id)
		this.connectionIdByUndirectedPair.set(undirectedPairKey, clonedConnection.id)
		addToStringSetMap(
			this.connectionIdsByElementId,
			clonedConnection.sourceElementId,
			clonedConnection.id,
		)
		addToStringSetMap(
			this.connectionIdsByElementId,
			clonedConnection.targetElementId,
			clonedConnection.id,
		)
		addToStringSetMap(
			this.upstreamConnectionIdsByElementId,
			clonedConnection.targetElementId,
			clonedConnection.id,
		)
		addToStringSetMap(
			this.downstreamConnectionIdsByElementId,
			clonedConnection.sourceElementId,
			clonedConnection.id,
		)
		return true
	}

	private getConnectionsByIndexedIds(connectionIds: Set<string> | undefined): CanvasConnection[] {
		if (!connectionIds) return []
		return Array.from(connectionIds)
			.map((connectionId) => this.connectionsById.get(connectionId))
			.filter((connection): connection is CanvasConnection => !!connection)
			.map(cloneCanvasConnection)
	}
}
