import { IStorageAdapter, LocalStorageAdapter } from "./storage"
import { logger as Logger } from "@/opensource/utils/log"
import { platformKey } from "@/opensource/utils/storage"
import { userStore } from "@/opensource/models/user"

const logger = Logger.createLogger("SuperMagicTopicModelCacheService")

/**
 * Current cache data version
 * Increment this when making breaking changes to data structure
 */
const CACHE_VERSION = 1

/**
 * Cached model data structure for a single entity
 */
export interface CachedModelData {
	/** Language model ID */
	languageModelId?: string
	/** Image model ID */
	imageModelId?: string
	/** Cache timestamp */
	timestamp: number
}

/**
 * User-level cache structure
 * All model data for a user is stored in a single key
 */
interface UserCacheData {
	/** Cache data version for migration */
	version: number
	/** Default models (global fallback) */
	default?: CachedModelData
	/** Topic-level models, keyed by topicId */
	topics: Record<string, CachedModelData>
	/** Project-level models, keyed by projectId */
	projects: Record<string, CachedModelData>
	/** Mode-level default models, keyed by topicMode (e.g., "default_chat", "default_canvas") */
	modeDefaults: Record<string, CachedModelData>
	/** Last update timestamp */
	lastUpdated: number
}

/**
 * Cache service for Super Magic topic models
 * Uses single key per user for efficient storage and batch operations
 */
class SuperMagicTopicModelCacheService {
	private storageAdapter: IStorageAdapter

	constructor(storageAdapter: IStorageAdapter = new LocalStorageAdapter()) {
		this.storageAdapter = storageAdapter
	}

	/**
	 * Generate cache key for current user
	 * @returns Cache key
	 */
	private genUserCacheKey(): string {
		const organizationCode = userStore.user.organizationCode
		const userId = userStore.user.userInfo?.user_id
		return platformKey(`super_magic/topic_model_cache/${organizationCode}/${userId}`)
	}

	/**
	 * Get all cache data for current user
	 * Handles version migration automatically
	 * @returns User cache data or null if not found
	 */
	private async getUserCache(): Promise<UserCacheData | null> {
		try {
			const key = this.genUserCacheKey()
			const value = await this.storageAdapter.getItem(key)

			if (!value) {
				return null
			}

			const data = JSON.parse(value) as UserCacheData

			// Version check and migration
			if (!data.version || data.version < CACHE_VERSION) {
				logger.warn("Cache version mismatch, migrating...", {
					oldVersion: data.version || 0,
					newVersion: CACHE_VERSION,
				})
				return this.migrateCache(data)
			}

			return data
		} catch (error) {
			logger.error("Failed to get user cache", { error })
			return null
		}
	}

	/**
	 * Migrate cache data to current version
	 * @param oldData - Old cache data
	 * @returns Migrated cache data
	 */
	private async migrateCache(oldData: Partial<UserCacheData>): Promise<UserCacheData> {
		const migratedData: UserCacheData = {
			version: CACHE_VERSION,
			topics: oldData.topics || {},
			projects: oldData.projects || {},
			modeDefaults: oldData.modeDefaults || {},
			lastUpdated: oldData.lastUpdated || Date.now(),
		}

		// Save migrated data
		await this.saveUserCache(migratedData)

		logger.log("Cache migration completed", {
			topicCount: Object.keys(migratedData.topics).length,
			projectCount: Object.keys(migratedData.projects).length,
			modeDefaultCount: Object.keys(migratedData.modeDefaults).length,
		})

		return migratedData
	}

	/**
	 * Save all cache data for current user
	 * @param cacheData - User cache data to save
	 */
	private async saveUserCache(cacheData: UserCacheData): Promise<void> {
		try {
			const key = this.genUserCacheKey()
			const value = JSON.stringify(cacheData)
			await this.storageAdapter.setItem(key, value)
		} catch (error) {
			logger.error("Failed to save user cache", { error })
			throw error
		}
	}

	/**
	 * Get default model from cache
	 * @returns Cached default model data or null if not found
	 */
	async getDefaultModel(): Promise<CachedModelData | null> {
		try {
			const userCache = await this.getUserCache()

			if (!userCache?.default) {
				logger.log("Default model not found in cache")
				return null
			}

			const data = userCache.default
			logger.log("Default model retrieved from cache", {
				languageModelId: data.languageModelId,
				imageModelId: data.imageModelId,
				age: Date.now() - data.timestamp,
			})

			return data
		} catch (error) {
			logger.error("Failed to get default model from cache", { error })
			return null
		}
	}

	/**
	 * Get topic-level model from cache
	 * @param topicId - Topic ID
	 * @returns Cached model data or null if not found
	 */
	async getTopicModel(topicId: string): Promise<CachedModelData | null> {
		try {
			const userCache = await this.getUserCache()

			if (!userCache?.topics[topicId]) {
				logger.log("Topic model not found in cache", { topicId })
				return null
			}

			const data = userCache.topics[topicId]
			logger.log("Topic model retrieved from cache", {
				topicId,
				languageModelId: data.languageModelId,
				imageModelId: data.imageModelId,
				age: Date.now() - data.timestamp,
			})

			return data
		} catch (error) {
			logger.error("Failed to get topic model from cache", { topicId, error })
			return null
		}
	}

	/**
	 * Get project-level model from cache
	 * @param projectId - Project ID
	 * @returns Cached model data or null if not found
	 */
	async getProjectModel(projectId: string): Promise<CachedModelData | null> {
		try {
			const userCache = await this.getUserCache()

			if (!userCache?.projects[projectId]) {
				logger.log("Project model not found in cache", { projectId })
				return null
			}

			const data = userCache.projects[projectId]
			logger.log("Project model retrieved from cache", {
				projectId,
				languageModelId: data.languageModelId,
				imageModelId: data.imageModelId,
				age: Date.now() - data.timestamp,
			})

			return data
		} catch (error) {
			logger.error("Failed to get project model from cache", { projectId, error })
			return null
		}
	}

	/**
	 * Get mode-level default model from cache
	 * @param modeDefaultKey - Mode default key (e.g., "default_chat", "default_canvas")
	 * @returns Cached model data or null if not found
	 */
	async getModeDefaultModel(modeDefaultKey: string): Promise<CachedModelData | null> {
		try {
			const userCache = await this.getUserCache()

			if (!userCache?.modeDefaults[modeDefaultKey]) {
				logger.log("Mode default model not found in cache", { modeDefaultKey })
				return null
			}

			const data = userCache.modeDefaults[modeDefaultKey]
			logger.log("Mode default model retrieved from cache", {
				modeDefaultKey,
				languageModelId: data.languageModelId,
				imageModelId: data.imageModelId,
				age: Date.now() - data.timestamp,
			})

			return data
		} catch (error) {
			logger.error("Failed to get mode default model from cache", { modeDefaultKey, error })
			return null
		}
	}

	/**
	 * Get model with fallback chain: topic -> project -> modeDefault -> default
	 * @param topicId - Topic ID
	 * @param projectId - Project ID (optional)
	 * @param modeDefaultKey - Mode default key (optional, e.g., "default_chat")
	 * @returns Cached model data with source info, or null if not found
	 */
	async getModelWithFallback(
		topicId: string,
		projectId?: string,
		modeDefaultKey?: string,
	): Promise<{
		data: CachedModelData
		source: "topic" | "project" | "modeDefault" | "default"
	} | null> {
		try {
			// Try topic first
			const topicModel = await this.getTopicModel(topicId)
			if (topicModel) {
				return { data: topicModel, source: "topic" }
			}

			// Try project if provided
			if (projectId) {
				const projectModel = await this.getProjectModel(projectId)
				if (projectModel) {
					return { data: projectModel, source: "project" }
				}
			}

			// Try mode default if provided
			if (modeDefaultKey) {
				const modeDefaultModel = await this.getModeDefaultModel(modeDefaultKey)
				if (modeDefaultModel) {
					return { data: modeDefaultModel, source: "modeDefault" }
				}
			}

			// Fall back to default
			const defaultModel = await this.getDefaultModel()
			if (defaultModel) {
				return { data: defaultModel, source: "default" }
			}

			logger.log("No model found in fallback chain", { topicId, projectId, modeDefaultKey })
			return null
		} catch (error) {
			logger.error("Failed to get model with fallback", { topicId, projectId, error })
			return null
		}
	}

	/**
	 * Save default model to cache
	 * @param modelData - Model data to cache
	 */
	async saveDefaultModel(modelData: CachedModelData): Promise<void> {
		try {
			const userCache = (await this.getUserCache()) || {
				version: CACHE_VERSION,
				topics: {},
				projects: {},
				modeDefaults: {},
				lastUpdated: Date.now(),
			}

			userCache.default = modelData
			userCache.lastUpdated = Date.now()

			await this.saveUserCache(userCache)

			logger.log("Default model saved to cache", {
				languageModelId: modelData.languageModelId,
				imageModelId: modelData.imageModelId,
			})
		} catch (error) {
			logger.error("Failed to save default model to cache", { error })
			throw error
		}
	}

	/**
	 * Save topic-level model to cache
	 * @param topicId - Topic ID
	 * @param modelData - Model data to cache
	 */
	async saveTopicModel(topicId: string, modelData: CachedModelData): Promise<void> {
		try {
			const userCache = (await this.getUserCache()) || {
				version: CACHE_VERSION,
				topics: {},
				projects: {},
				modeDefaults: {},
				lastUpdated: Date.now(),
			}

			// Ensure topics field exists (for backward compatibility with old cache)
			if (!userCache.topics) {
				userCache.topics = {}
			}

			userCache.topics[topicId] = modelData
			userCache.lastUpdated = Date.now()

			await this.saveUserCache(userCache)

			logger.log("Topic model saved to cache", {
				topicId,
				languageModelId: modelData.languageModelId,
				imageModelId: modelData.imageModelId,
			})
		} catch (error) {
			logger.error("Failed to save topic model to cache", { topicId, error })
			throw error
		}
	}

	/**
	 * Save project-level model to cache
	 * @param projectId - Project ID
	 * @param modelData - Model data to cache
	 */
	async saveProjectModel(projectId: string, modelData: CachedModelData): Promise<void> {
		try {
			const userCache = (await this.getUserCache()) || {
				version: CACHE_VERSION,
				topics: {},
				projects: {},
				modeDefaults: {},
				lastUpdated: Date.now(),
			}

			// Ensure projects field exists (for backward compatibility with old cache)
			if (!userCache.projects) {
				userCache.projects = {}
			}

			userCache.projects[projectId] = modelData
			userCache.lastUpdated = Date.now()

			await this.saveUserCache(userCache)

			logger.log("Project model saved to cache", {
				projectId,
				languageModelId: modelData.languageModelId,
				imageModelId: modelData.imageModelId,
			})
		} catch (error) {
			logger.error("Failed to save project model to cache", { projectId, error })
			throw error
		}
	}

	/**
	 * Save mode-level default model to cache
	 * @param modeDefaultKey - Mode default key (e.g., "default_chat", "default_canvas")
	 * @param modelData - Model data to cache
	 */
	async saveModeDefaultModel(modeDefaultKey: string, modelData: CachedModelData): Promise<void> {
		try {
			const userCache = (await this.getUserCache()) || {
				version: CACHE_VERSION,
				topics: {},
				projects: {},
				modeDefaults: {},
				lastUpdated: Date.now(),
			}

			// Ensure modeDefaults field exists (for backward compatibility with old cache)
			if (!userCache.modeDefaults) {
				userCache.modeDefaults = {}
			}

			userCache.modeDefaults[modeDefaultKey] = modelData
			userCache.lastUpdated = Date.now()

			await this.saveUserCache(userCache)

			logger.log("Mode default model saved to cache", {
				modeDefaultKey,
				languageModelId: modelData.languageModelId,
				imageModelId: modelData.imageModelId,
			})
		} catch (error) {
			logger.error("Failed to save mode default model to cache", { modeDefaultKey, error })
			throw error
		}
	}

	/**
	 * Clear cache for specific scope or all
	 * @param scope - Optional scope:
	 *   - "all": clear all cache for current user
	 *   - "default": clear default model
	 *   - "topic:{topicId}": clear specific topic
	 *   - "project:{projectId}": clear specific project
	 *   - "modeDefault:{modeDefaultKey}": clear specific mode default
	 */
	async clearCache(scope?: string): Promise<void> {
		try {
			if (!scope || scope === "all") {
				// Clear all cache for current user
				const key = this.genUserCacheKey()
				await this.storageAdapter.removeItem(key)
				logger.log("Cleared all cache for user")
				return
			}

			// Handle default scope
			if (scope === "default") {
				const userCache = await this.getUserCache()
				if (!userCache) {
					logger.log("No cache to clear", { scope })
					return
				}

				delete userCache.default
				userCache.lastUpdated = Date.now()
				await this.saveUserCache(userCache)
				logger.log("Cleared default model cache")
				return
			}

			// Parse scope
			const [type, id] = scope.split(":")
			if (!type || !id) {
				logger.warn(
					"Invalid scope format, expected 'topic:id', 'project:id', or 'modeDefault:key'",
					{
						scope,
					},
				)
				return
			}

			const userCache = await this.getUserCache()
			if (!userCache) {
				logger.log("No cache to clear", { scope })
				return
			}

			// Clear specific scope
			if (type === "topic") {
				delete userCache.topics[id]
				logger.log("Cleared topic cache", { topicId: id })
			} else if (type === "project") {
				delete userCache.projects[id]
				logger.log("Cleared project cache", { projectId: id })
			} else if (type === "modeDefault") {
				delete userCache.modeDefaults[id]
				logger.log("Cleared mode default cache", { modeDefaultKey: id })
			} else {
				logger.warn("Unknown scope type", { type, scope })
				return
			}

			userCache.lastUpdated = Date.now()
			await this.saveUserCache(userCache)
		} catch (error) {
			logger.error("Failed to clear cache", { scope, error })
			throw error
		}
	}

	/**
	 * Get cache statistics for debugging
	 * @returns Cache statistics
	 */
	async getCacheStats(): Promise<{
		version: number
		hasDefault: boolean
		topicCount: number
		projectCount: number
		modeDefaultCount: number
		lastUpdated: number | null
		cacheSize: number
	}> {
		try {
			const userCache = await this.getUserCache()

			if (!userCache) {
				return {
					version: CACHE_VERSION,
					hasDefault: false,
					topicCount: 0,
					projectCount: 0,
					modeDefaultCount: 0,
					lastUpdated: null,
					cacheSize: 0,
				}
			}

			const key = this.genUserCacheKey()
			const value = await this.storageAdapter.getItem(key)
			const cacheSize = value ? new Blob([value]).size : 0

			return {
				version: userCache.version,
				hasDefault: !!userCache.default,
				topicCount: Object.keys(userCache.topics).length,
				projectCount: Object.keys(userCache.projects).length,
				modeDefaultCount: Object.keys(userCache.modeDefaults).length,
				lastUpdated: userCache.lastUpdated,
				cacheSize,
			}
		} catch (error) {
			logger.error("Failed to get cache stats", { error })
			return {
				version: CACHE_VERSION,
				hasDefault: false,
				topicCount: 0,
				projectCount: 0,
				modeDefaultCount: 0,
				lastUpdated: null,
				cacheSize: 0,
			}
		}
	}

	/**
	 * Set storage adapter (for testing or platform switching)
	 * @param adapter - New storage adapter
	 */
	setStorageAdapter(adapter: IStorageAdapter): void {
		this.storageAdapter = adapter
		logger.log("Storage adapter updated", { adapterType: adapter.constructor.name })
	}
}

const superMagicTopicModelCacheService = new SuperMagicTopicModelCacheService()

export default superMagicTopicModelCacheService
