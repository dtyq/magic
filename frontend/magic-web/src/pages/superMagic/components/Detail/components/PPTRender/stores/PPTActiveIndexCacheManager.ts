import type { PPTLoggerService } from "../services"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"

export interface PPTActiveIndexCacheConfig {
	organizationCode?: string
	selectedProjectId?: string
	mainFileId?: string
}

/**
 * PPTActiveIndexCacheManager - Manages caching and restoration of PPT activeIndex
 * 管理 PPT activeIndex 的缓存和恢复
 *
 * Features:
 * - Debounced save (500ms) to avoid excessive writes
 * - Retry mechanism for projectId validation (max 10 retries, 100ms interval)
 * - Automatic cache restoration on initialization
 */
export class PPTActiveIndexCacheManager {
	private projectStateRepository: ProjectStateRepository
	private organizationCode?: string
	private selectedProjectId?: string
	private mainFileId?: string
	private logger: PPTLoggerService
	private debouncedSaveTimer?: NodeJS.Timeout
	private configGeneration = 0
	private disposed = false

	constructor(logger: PPTLoggerService, config: PPTActiveIndexCacheConfig) {
		this.logger = logger
		this.projectStateRepository = new ProjectStateRepository()
		this.updateConfig(config)

		this.logger.debug("PPTActiveIndexCacheManager initialized", {
			operation: "constructor",
			metadata: {
				hasOrganizationCode: !!config.organizationCode,
				hasSelectedProjectId: !!config.selectedProjectId,
				hasMainFileId: !!config.mainFileId,
			},
		})
	}

	/**
	 * Update cache configuration
	 * 更新缓存配置
	 */
	updateConfig(config: PPTActiveIndexCacheConfig): void {
		const configChanged =
			this.organizationCode !== config.organizationCode ||
			this.selectedProjectId !== config.selectedProjectId ||
			this.mainFileId !== config.mainFileId
		if (configChanged) {
			this.configGeneration++
			clearTimeout(this.debouncedSaveTimer)
			this.debouncedSaveTimer = undefined
		}

		this.organizationCode = config.organizationCode
		this.selectedProjectId = config.selectedProjectId
		this.mainFileId = config.mainFileId

		this.logger.debug("Cache config updated", {
			operation: "updateConfig",
			metadata: {
				hasOrganizationCode: !!config.organizationCode,
				hasSelectedProjectId: !!config.selectedProjectId,
				hasMainFileId: !!config.mainFileId,
			},
		})
	}

	/**
	 * Save activeIndex to cache with debouncing
	 * 防抖保存 activeIndex 到缓存
	 */
	saveActiveIndexDebounced(index: number): void {
		if (!this.canCache()) {
			this.logger.debug("Cannot cache - missing required config", {
				operation: "saveActiveIndexDebounced",
				metadata: {
					hasOrganizationCode: !!this.organizationCode,
					hasSelectedProjectId: !!this.selectedProjectId,
					hasMainFileId: !!this.mainFileId,
				},
			})
			return
		}

		if (this.disposed) {
			this.logger.warn("Cannot save - manager is disposed", {
				operation: "saveActiveIndexDebounced",
			})
			return
		}

		// Clear existing timer
		clearTimeout(this.debouncedSaveTimer)
		const configGeneration = this.configGeneration

		// Schedule save
		this.debouncedSaveTimer = setTimeout(() => {
			this.debouncedSaveTimer = undefined
			void this.saveActiveIndex(index, configGeneration)
		}, 500)
	}

	/**
	 * Save activeIndex immediately
	 * 立即保存 activeIndex
	 */
	private async saveActiveIndex(index: number, configGeneration: number): Promise<void> {
		if (this.disposed || configGeneration !== this.configGeneration || !this.canCache()) return
		const { organizationCode, selectedProjectId, mainFileId } = this
		if (!organizationCode || !selectedProjectId || !mainFileId) return

		try {
			this.logger.debug("Saving activeIndex to cache", {
				operation: "saveActiveIndex",
				metadata: { index, fileId: mainFileId },
			})

			const currentState = await this.projectStateRepository.getProjectState(
				organizationCode,
				selectedProjectId,
			)
			if (this.disposed || configGeneration !== this.configGeneration) return

			const pptActiveIndexMap = {
				...(currentState?.fileState?.pptActiveIndexMap || {}),
				[mainFileId]: index,
			}

			const fileState = {
				pptActiveIndexMap,
			}

			await this.projectStateRepository.updateFileState(
				organizationCode,
				selectedProjectId,
				fileState,
			)

			this.logger.debug("💾 PPT activeIndex saved to cache", {
				operation: "saveActiveIndex",
				metadata: { index, fileId: mainFileId },
			})
		} catch (error) {
			this.logger.error({
				eventKey: "save_active_index_failed",
				errorKind: "render",
				error: error,
				message: "Failed to save activeIndex",
				context: { operation: "saveActiveIndex" },
			})
		}
	}

	/**
	 * Restore activeIndex from cache
	 * 从缓存恢复 activeIndex
	 *
	 * @returns The cached activeIndex, or null if not available
	 */
	async restoreActiveIndex(): Promise<number | null> {
		if (!this.canCache()) {
			this.logger.debug("Cannot restore - missing required config", {
				operation: "restoreActiveIndex",
			})
			return null
		}
		const configGeneration = this.configGeneration
		const { organizationCode, selectedProjectId, mainFileId } = this
		if (!organizationCode || !selectedProjectId || !mainFileId) return null

		try {
			this.logger.debug("Restoring activeIndex from cache", {
				operation: "restoreActiveIndex",
				metadata: {
					organizationCode,
					projectId: selectedProjectId,
					fileId: mainFileId,
				},
			})

			const cachedState = await this.projectStateRepository.getProjectState(
				organizationCode,
				selectedProjectId,
			)
			if (this.disposed || configGeneration !== this.configGeneration) return null

			const cachedIndex = cachedState?.fileState?.pptActiveIndexMap?.[mainFileId]

			if (typeof cachedIndex === "number" && cachedIndex >= 0) {
				if (configGeneration === this.configGeneration) {
					this.logger.debug("🔄 Restored cached activeIndex", {
						operation: "restoreActiveIndex",
						metadata: { index: cachedIndex, fileId: mainFileId },
					})
					return cachedIndex
				}
			} else {
				this.logger.debug("No cached activeIndex found", {
					operation: "restoreActiveIndex",
					metadata: { cachedIndex },
				})
			}

			return null
		} catch (error) {
			this.logger.error({
				eventKey: "restore_active_index_failed",
				errorKind: "render",
				error: error,
				message: "Failed to restore activeIndex",
				context: { operation: "restoreActiveIndex" },
			})
			return null
		}
	}

	/**
	 * Check if caching is possible with current configuration
	 * 检查当前配置是否可以进行缓存
	 */
	private canCache(): boolean {
		return !!(this.organizationCode && this.selectedProjectId && this.mainFileId)
	}

	/**
	 * Dispose manager and cleanup resources
	 * 清理管理器资源
	 */
	dispose(): void {
		this.disposed = true
		this.configGeneration++
		clearTimeout(this.debouncedSaveTimer)
		this.debouncedSaveTimer = undefined
		this.logger.debug("PPTActiveIndexCacheManager disposed", {
			operation: "dispose",
		})
	}
}
