import type { DraftKey, DraftData, DraftServiceInterface, DraftVersionInfo } from "../../types"
import {
	generateKey,
	genDraftVersionId,
	generateVersionKey,
	generateLegacyKey,
	isEqualData,
	hasMeaningfulData,
} from "./utils"

/**
 * LocalStorage Draft Service
 * Fallback implementation using localStorage
 */
export class LocalStorageDraftService implements DraftServiceInterface {
	private keyPrefix = "MessageEditorDraftsV2"
	private versionsKeyPrefix = "MessageEditorDraftVersions"

	/**
	 * Save draft data to localStorage
	 */
	async saveDraft(
		key: DraftKey,
		data: Omit<DraftData, "createdAt" | "updatedAt">,
	): Promise<void> {
		try {
			const latestDraft = await this.loadLatestDraftVersion(key)

			// 如果数据没有变化，则不保存
			if (isEqualData(data, latestDraft)) {
				return
			}

			const storageKey = generateKey(key)
			const now = Date.now()

			// Check if draft already exists
			const existingData = await this.loadDraft(key)

			const draftData: DraftData = {
				...data,
				createdAt: existingData?.createdAt ?? now,
				updatedAt: now,
			}

			localStorage.setItem(storageKey, JSON.stringify(draftData))
		} catch (error) {
			console.error("Error saving draft to localStorage:", error)
			throw new Error("Failed to save draft to localStorage")
		}
	}

	/**
	 * Save draft version to localStorage
	 */
	async saveDraftVersion(
		key: DraftKey,
		data: Omit<DraftData, "createdAt" | "updatedAt">,
		force: boolean = false,
	): Promise<void> {
		try {
			// Generate a unique version ID if not provided
			const versionData = {
				...data,
				versionId: data.versionId || genDraftVersionId(),
				versionTimestamp: data.versionTimestamp || Date.now(),
				isAutoSaved: data.isAutoSaved ?? true,
			}

			const storageKey = generateVersionKey(key, versionData.versionId)
			const now = Date.now()

			const latestDraft = await this.loadFirstDifferentTimeVersion(key, now)

			if (!latestDraft && !hasMeaningfulData(data)) {
				return
			}

			let deleteVersionId: string | null = null

			if (isEqualData(data, latestDraft) && latestDraft?.versionId) {
				deleteVersionId = latestDraft?.versionId
			}

			// Perform all async operations before saving
			const latestVersion = await this.loadLatestDraftVersion(key)

			// Ignore version if it's the same as the latest version
			if (isEqualData(versionData, latestVersion) && !force) {
				return
			}

			// Check if version already exists to preserve createdAt
			const existingVersion = await this.loadDraftByVersion(key, versionData.versionId)

			const draftData: DraftData = {
				...versionData,
				createdAt: existingVersion?.createdAt ?? now,
				updatedAt: now,
			}

			localStorage.setItem(storageKey, JSON.stringify(draftData))

			if (deleteVersionId) {
				localStorage.removeItem(generateVersionKey(key, deleteVersionId))
			}
		} catch (error) {
			console.error("Error saving draft version to localStorage:", error)
			throw new Error("Failed to save draft version to localStorage")
		}
	}

	async loadFirstDifferentTimeVersion(key: DraftKey, currentTimestamp: number) {
		const versions = await this.loadDraftVersions(key)
		if (versions.length === 0) {
			return null
		}

		const versionId = genDraftVersionId(currentTimestamp)

		// find the first version that is different from the current timestamp
		for (let i = 0; i < versions.length; i++) {
			if (versions[i].versionId !== versionId) {
				const version = await this.loadDraftByVersion(key, versions[i].versionId)
				if (version && hasMeaningfulData(version)) {
					return version
				}
			}
		}
		return null
	}

	async loadLatestDraftVersion(key: DraftKey): Promise<DraftData | null> {
		const versions = await this.loadDraftVersions(key)
		if (versions.length === 0) return null
		// Since versions are sorted by timestamp descending, the first one is the latest
		return this.loadDraftByVersion(key, versions[0].versionId)
	}

	/**
	 * Load draft data from localStorage
	 */
	async loadDraft(key: DraftKey): Promise<DraftData | null> {
		try {
			const storageKey = generateKey(key)
			const data = localStorage.getItem(storageKey)

			if (!data) {
				// Backward compatibility: try legacy key
				const legacy = localStorage.getItem(generateLegacyKey(key))
				if (!legacy) return null
				return JSON.parse(legacy) as DraftData
			}

			return JSON.parse(data) as DraftData
		} catch (error) {
			console.error("Error loading draft from localStorage:", error)
			return null
		}
	}

	/**
	 * Load all draft versions for a key from localStorage
	 */
	async loadDraftVersions(key: DraftKey): Promise<DraftVersionInfo[]> {
		try {
			const versions: DraftVersionInfo[] = []
			const baseKey = generateKey(key)
			const versionsBaseKey = baseKey.replace(this.keyPrefix, this.versionsKeyPrefix)

			// Find all keys that match our versions prefix
			for (let i = 0; i < localStorage.length; i++) {
				const storageKey = localStorage.key(i)
				if (storageKey && storageKey.startsWith(versionsBaseKey)) {
					const data = localStorage.getItem(storageKey)
					if (data) {
						try {
							const draftData = JSON.parse(data) as DraftData
							if (draftData.versionId && draftData.versionTimestamp) {
								versions.push({
									versionId: draftData.versionId,
									versionTimestamp: draftData.versionTimestamp,
									isAutoSaved: draftData.isAutoSaved ?? false,
									updatedAt: draftData.updatedAt,
									createdAt: draftData.createdAt,
									topicId: draftData.topicId,
								})
							}
						} catch (parseError) {
							console.warn(
								"Error parsing draft version from localStorage:",
								parseError,
							)
						}
					}
				}
			}

			// Sort by version timestamp descending (newest first)
			return versions.sort((a, b) => b.versionTimestamp - a.versionTimestamp)
		} catch (error) {
			console.error("Error loading draft versions from localStorage:", error)
			return []
		}
	}

	/**
	 * Load all draft versions for a project (across all topics) from localStorage
	 */
	async loadProjectDraftVersions(
		key: Pick<DraftKey, "workspaceId" | "projectId">,
		offset: number = 0,
		limit: number = 50,
	): Promise<DraftVersionInfo[]> {
		try {
			const versions: DraftVersionInfo[] = []
			const projectPrefix = `${this.versionsKeyPrefix}:${key.workspaceId}:${key.projectId}:`

			// Find all keys that match our project prefix
			for (let i = 0; i < localStorage.length; i++) {
				const storageKey = localStorage.key(i)
				if (storageKey && storageKey.startsWith(projectPrefix)) {
					const data = localStorage.getItem(storageKey)
					if (data) {
						try {
							const draftData = JSON.parse(data) as DraftData
							if (draftData.versionId && draftData.versionTimestamp) {
								versions.push({
									versionId: draftData.versionId,
									versionTimestamp: draftData.versionTimestamp,
									isAutoSaved: draftData.isAutoSaved ?? false,
									updatedAt: draftData.updatedAt,
									createdAt: draftData.createdAt,
									topicId: draftData.topicId,
								})
							}
						} catch (parseError) {
							console.warn(
								"Error parsing draft version from localStorage:",
								parseError,
							)
						}
					}
				}
			}

			// Sort by version timestamp descending (newest first)
			const sortedVersions = versions.sort((a, b) => b.versionTimestamp - a.versionTimestamp)

			// Apply pagination
			return sortedVersions.slice(offset, offset + limit)
		} catch (error) {
			console.error("Error loading project draft versions from localStorage:", error)
			return []
		}
	}

	/**
	 * Delete draft data from localStorage
	 */
	async deleteDraft(key: DraftKey): Promise<void> {
		try {
			const storageKey = generateKey(key)
			localStorage.removeItem(storageKey)
			// Also delete legacy key
			localStorage.removeItem(generateLegacyKey(key))
		} catch (error) {
			console.error("Error deleting draft from localStorage:", error)
			throw new Error("Failed to delete draft from localStorage")
		}
	}

	/**
	 * Load a specific draft version from localStorage
	 */
	async loadDraftByVersion(key: DraftKey, versionId: string): Promise<DraftData | null> {
		try {
			const storageKey = generateVersionKey(key, versionId)
			const data = localStorage.getItem(storageKey)

			if (!data) {
				return null
			}

			return JSON.parse(data) as DraftData
		} catch (error) {
			console.error("Error loading draft version from localStorage:", error)
			return null
		}
	}

	/**
	 * Delete a specific draft version from localStorage
	 */
	async deleteDraftVersion(key: DraftKey, versionId: string): Promise<void> {
		try {
			const storageKey = generateVersionKey(key, versionId)
			localStorage.removeItem(storageKey)
		} catch (error) {
			console.error("Error deleting draft version from localStorage:", error)
			throw new Error("Failed to delete draft version from localStorage")
		}
	}

	async deleteDraftVersions(key: DraftKey): Promise<void> {
		try {
			const versionsBaseKey = generateKey(key).replace(this.keyPrefix, this.versionsKeyPrefix)
			for (let i = 0; i < localStorage.length; i++) {
				const storageKey = localStorage.key(i)
				if (storageKey && storageKey.startsWith(versionsBaseKey)) {
					localStorage.removeItem(storageKey)
				}
			}
		} catch (error) {
			console.error("Error deleting draft versions from localStorage:", error)
			throw new Error("Failed to delete draft versions from localStorage")
		}
	}

	/**
	 * Clear all drafts from localStorage
	 */
	async clearAllDrafts(): Promise<void> {
		try {
			const keysToRemove: string[] = []

			// Find all keys that match our prefix
			for (let i = 0; i < localStorage.length; i++) {
				const storageKey = localStorage.key(i)
				if (storageKey && storageKey.startsWith(this.keyPrefix)) {
					keysToRemove.push(storageKey)
				}
			}

			// Remove all matching keys
			keysToRemove.forEach((storageKey) => localStorage.removeItem(storageKey))
		} catch (error) {
			console.error("Error clearing all drafts from localStorage:", error)
			throw new Error("Failed to clear all drafts from localStorage")
		}
	}

	/**
	 * Cleanup expired draft versions (older than retentionDays) from localStorage
	 */
	async cleanupExpiredVersions(retentionDays = 7): Promise<void> {
		try {
			const retentionPeriodInMs = retentionDays * 24 * 60 * 60 * 1000
			const retentionThreshold = Date.now() - retentionPeriodInMs

			const keysToRemove: string[] = []

			// Find all version keys that match our prefix
			for (let i = 0; i < localStorage.length; i++) {
				const storageKey = localStorage.key(i)
				if (storageKey && storageKey.startsWith(this.versionsKeyPrefix)) {
					const data = localStorage.getItem(storageKey)
					if (data) {
						try {
							const draftData = JSON.parse(data) as DraftData
							// Check if this version is older than retention period
							if (
								draftData.versionTimestamp &&
								draftData.versionTimestamp < retentionThreshold
							) {
								keysToRemove.push(storageKey)
							}
						} catch (parseError) {
							console.warn(
								"Error parsing draft version from localStorage:",
								parseError,
							)
						}
					}
				}
			}

			// Also check regular drafts that are auto-saved versions
			for (let i = 0; i < localStorage.length; i++) {
				const storageKey = localStorage.key(i)
				if (
					storageKey &&
					storageKey.startsWith(this.keyPrefix) &&
					!storageKey.startsWith(this.versionsKeyPrefix)
				) {
					const data = localStorage.getItem(storageKey)
					if (data) {
						try {
							const draftData = JSON.parse(data) as DraftData
							// Check if this is an auto-saved draft and is older than retention period
							if (
								draftData.isAutoSaved &&
								draftData.updatedAt &&
								draftData.updatedAt < retentionThreshold
							) {
								keysToRemove.push(storageKey)
							}
						} catch (parseError) {
							console.warn("Error parsing draft from localStorage:", parseError)
						}
					}
				}
			}

			// Remove all expired versions
			keysToRemove.forEach((storageKey) => localStorage.removeItem(storageKey))
		} catch (error) {
			console.error("Error cleaning up expired draft versions from localStorage:", error)
		}
	}

	/**
	 * Close method for interface compatibility (no-op for localStorage)
	 */
	close(): void {
		// No cleanup needed for localStorage
	}
}
