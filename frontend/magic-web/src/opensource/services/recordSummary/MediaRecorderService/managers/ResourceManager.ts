/**
 * Resource manager for tracking and cleaning up resources
 * 资源管理器，用于追踪和清理资源
 */

import type { ManagedResource, ResourceCleanupFn } from "../types/RecorderTypes"
import type { LoggerInterface } from "../types/RecorderDependencies"

/**
 * ResourceManager manages lifecycle of resources (streams, contexts, etc.)
 * ResourceManager 管理资源的生命周期（流、上下文等）
 */
export class ResourceManager {
	private resources: Map<string, ManagedResource> = new Map()
	private cleanupOrder: string[] = []

	constructor(private readonly logger: LoggerInterface) {}

	/**
	 * Register a resource for management
	 * 注册一个资源进行管理
	 */
	register(id: string, type: string, cleanup: ResourceCleanupFn, resource?: unknown): void {
		if (this.resources.has(id)) {
			this.logger.warn(`Resource with id "${id}" already registered, replacing`)
			// Clean up existing resource before replacing
			this.unregister(id)
		}

		const managedResource: ManagedResource = {
			id,
			type,
			cleanup,
			resource,
		}

		this.resources.set(id, managedResource)
		this.cleanupOrder.push(id)

		this.logger.log(`Resource registered: ${type} (${id})`)
	}

	/**
	 * Unregister and cleanup a specific resource
	 * 注销并清理特定资源
	 */
	async unregister(id: string): Promise<void> {
		const resource = this.resources.get(id)
		if (!resource) {
			this.logger.warn(`Resource "${id}" not found for cleanup`)
			return
		}

		try {
			this.logger.log(`Cleaning up resource: ${resource.type} (${id})`)
			await resource.cleanup()
			this.resources.delete(id)

			// Remove from cleanup order
			const index = this.cleanupOrder.indexOf(id)
			if (index > -1) {
				this.cleanupOrder.splice(index, 1)
			}

			this.logger.log(`Resource cleaned up: ${resource.type} (${id})`)
		} catch (error) {
			this.logger.error(`Error cleaning up resource "${id}":`, error)
			// Still remove it from tracking to avoid memory leaks
			this.resources.delete(id)
			const index = this.cleanupOrder.indexOf(id)
			if (index > -1) {
				this.cleanupOrder.splice(index, 1)
			}
		}
	}

	/**
	 * Cleanup resources by type
	 * 按类型清理资源
	 */
	async cleanupByType(type: string): Promise<void> {
		const resourcesOfType = Array.from(this.resources.values()).filter((r) => r.type === type)

		for (const resource of resourcesOfType) {
			await this.unregister(resource.id)
		}
	}

	/**
	 * Cleanup all resources in reverse order of registration
	 * 按注册顺序的反向清理所有资源
	 */
	async cleanupAll(): Promise<void> {
		this.logger.log(`Cleaning up ${this.resources.size} resource(s)`)

		// Cleanup in reverse order (LIFO)
		const idsToCleanup = [...this.cleanupOrder].reverse()

		for (const id of idsToCleanup) {
			await this.unregister(id)
		}

		this.resources.clear()
		this.cleanupOrder = []
		this.logger.log("All resources cleaned up")
	}

	/**
	 * Get resource by id
	 * 根据 ID 获取资源
	 */
	get<T = unknown>(id: string): T | undefined {
		const resource = this.resources.get(id)
		return resource?.resource as T | undefined
	}

	/**
	 * Check if resource exists
	 * 检查资源是否存在
	 */
	has(id: string): boolean {
		return this.resources.has(id)
	}

	/**
	 * Get all resource IDs of a specific type
	 * 获取特定类型的所有资源 ID
	 */
	getIdsByType(type: string): string[] {
		return Array.from(this.resources.values())
			.filter((r) => r.type === type)
			.map((r) => r.id)
	}

	/**
	 * Get count of managed resources
	 * 获取托管资源数量
	 */
	getResourceCount(): number {
		return this.resources.size
	}

	/**
	 * Get all resource types currently managed
	 * 获取当前管理的所有资源类型
	 */
	getResourceTypes(): string[] {
		const types = new Set(Array.from(this.resources.values()).map((r) => r.type))
		return Array.from(types)
	}
}
