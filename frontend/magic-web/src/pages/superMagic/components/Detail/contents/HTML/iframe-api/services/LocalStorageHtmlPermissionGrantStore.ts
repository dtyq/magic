import { htmlMicroAppPreviewLogger } from "../../utils/htmlMicroAppPreviewLogger"
import type { HtmlPermissionScope } from "../types"
import {
	createHtmlPermissionAppKey,
	isHtmlPermissionGrantActive,
	LOCAL_STORAGE_HTML_PERMISSION_GRANT_FALLBACK_KEY,
	LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY,
	MAX_HTML_PERMISSION_GRANTS,
	type HtmlPermissionGrant,
	type HtmlPermissionGrantIdentity,
	type HtmlPermissionGrantStore,
} from "./HtmlPermissionGrantStore"
import { notifyPermissionGrantChange } from "./HtmlPermissionGrantNotifications"
import {
	compareHtmlPermissionGrantEvictionPriority,
	grantRecordKey,
	isValidStoredGrant,
	toHtmlPermissionGrant,
	type StoredHtmlPermissionGrant,
} from "./IndexedDbHtmlPermissionGrantStore.utils"

interface StoredFallbackRevision {
	epoch: number
	revision: number
}

export interface StoredFallbackGrant extends StoredHtmlPermissionGrant {
	revision: number
}

export interface HtmlPermissionGrantFallbackSnapshot {
	version: 1
	epoch: number
	revision: number
	clearedAtRevision: number | null
	grants: Record<string, StoredFallbackGrant>
	scopeRevocations: Record<string, StoredFallbackRevision>
	appRevocations: Record<string, StoredFallbackRevision>
}

export type HtmlPermissionAuthorityLockResult<T> =
	{ acquired: true; value: T } | { acquired: false }

const EMPTY_FALLBACK_DATA: HtmlPermissionGrantFallbackSnapshot = {
	version: 1,
	epoch: 0,
	revision: 0,
	clearedAtRevision: null,
	grants: {},
	scopeRevocations: {},
	appRevocations: {},
}

/**
 * Degraded persistence used only when IndexedDB cannot be opened or transacted.
 * Web Locks serializes cross-tab writes; without it the permission service uses one-time consent.
 */
export class LocalStorageHtmlPermissionGrantStore implements HtmlPermissionGrantStore {
	constructor(
		private readonly getNow: () => number = () => Date.now(),
		private readonly storageKey = LOCAL_STORAGE_HTML_PERMISSION_GRANT_FALLBACK_KEY,
	) {}

	async isPersistentAvailable(): Promise<boolean> {
		return Boolean(this.getLockManager()) && this.probeStorage()
	}

	async getGrant(
		identity: HtmlPermissionGrantIdentity,
		scope: HtmlPermissionScope,
	): Promise<HtmlPermissionGrant | undefined> {
		const grants = await this.getAppGrants(identity)
		return grants.find((grant) => grant.scope === scope)
	}

	async getAppGrants(identity: HtmlPermissionGrantIdentity): Promise<HtmlPermissionGrant[]> {
		const data = this.readData()
		if (!data) return []

		const appKey = createHtmlPermissionAppKey(identity)
		const now = this.getNow()
		return Object.values(data.grants)
			.filter(
				(record) =>
					record.appKey === appKey &&
					record.epoch === data.epoch &&
					isFallbackGrantEffective(data, record) &&
					isHtmlPermissionGrantActive(toHtmlPermissionGrant(identity, record), now),
			)
			.map((record) => toHtmlPermissionGrant(identity, record))
	}

	async save(grant: HtmlPermissionGrant): Promise<boolean> {
		const result = await this.withAuthorityLock(() => {
			const data = this.readData()
			if (!data) return false

			this.removeExpired(data, this.getNow())
			const appKey = createHtmlPermissionAppKey(grant)
			const key = grantRecordKey(appKey, grant.scope)
			const revision = data.revision + 1
			data.revision = revision
			data.grants[key] = {
				key,
				appKey,
				scope: grant.scope,
				grantedAt: grant.grantedAt,
				expiresAt: grant.expiresAt,
				...(grant.codeFingerprint ? { codeFingerprint: grant.codeFingerprint } : {}),
				...(grant.reuseAcrossCodeChanges === true ? { reuseAcrossCodeChanges: true } : {}),
				epoch: data.epoch,
				revision,
			}
			this.limitGrantCount(data)
			return this.writeChangedData(data)
		})
		return result.acquired ? result.value : false
	}

	async remove(
		identity: HtmlPermissionGrantIdentity,
		scope?: HtmlPermissionScope,
	): Promise<void> {
		const result = await this.withAuthorityLock(() => {
			const data = this.readData()
			if (!data) return false

			const appKey = createHtmlPermissionAppKey(identity)
			const revision = data.revision + 1
			data.revision = revision
			if (scope) {
				const key = grantRecordKey(appKey, scope)
				delete data.grants[key]
				data.scopeRevocations[key] = { epoch: data.epoch, revision }
			} else {
				for (const record of Object.values(data.grants)) {
					if (record.appKey === appKey) delete data.grants[record.key]
				}
				data.appRevocations[appKey] = { epoch: data.epoch, revision }
			}
			return this.writeChangedData(data)
		})
		const written = result.acquired && result.value
		if (!written) throw new Error("HTML permission fallback revocation could not be persisted")
	}

	async prune(now: number): Promise<void> {
		await this.withAuthorityLock(() => {
			const data = this.readData()
			if (!data || !this.removeExpired(data, now)) return
			data.revision += 1
			this.writeChangedData(data)
		})
	}

	async clear(shouldNotify = true): Promise<void> {
		const result = await this.withAuthorityLock(() => this.clearForRecoveryUnlocked())
		// Without Web Locks no fallback writer can persist, so an unlocked clear cannot race writes.
		const written = result.acquired ? result.value : this.clearForRecoveryUnlocked()
		if (!written) throw new Error("HTML permission fallback clear could not be persisted")
		if (shouldNotify) notifyPermissionGrantChange()
	}

	readRecoverySnapshotUnlocked(): HtmlPermissionGrantFallbackSnapshot | null {
		const storage = globalThis.localStorage
		if (!storage) return null
		const raw = storage.getItem(this.storageKey)
		if (!raw) return null
		const parsed: unknown = JSON.parse(raw)
		if (!isValidFallbackData(parsed)) {
			throw new Error("Invalid HTML permission fallback recovery snapshot")
		}
		return parsed
	}

	clearForRecoveryUnlocked(): boolean {
		const data = this.readData() || this.createEmptyData()
		const revision = data.revision + 1
		data.epoch += 1
		data.revision = revision
		data.clearedAtRevision = revision
		data.grants = {}
		data.scopeRevocations = {}
		data.appRevocations = {}
		return this.writeData(data)
	}

	discardRecoverySnapshotUnlocked(): void {
		globalThis.localStorage?.removeItem(this.storageKey)
	}

	async withAuthorityLock<T>(
		operation: () => T | Promise<T>,
	): Promise<HtmlPermissionAuthorityLockResult<T>> {
		const lockManager = this.getLockManager()
		if (!lockManager) return { acquired: false }
		const value = await lockManager.request(`${this.storageKey}:lock`, () => operation())
		return { acquired: true, value }
	}

	private readData(): HtmlPermissionGrantFallbackSnapshot | null {
		try {
			const storage = globalThis.localStorage
			if (!storage) return null
			const raw = storage.getItem(this.storageKey)
			if (!raw) return this.createEmptyData()
			const parsed: unknown = JSON.parse(raw)
			if (!isValidFallbackData(parsed)) {
				this.logStorageError(
					"Corrupted HTML permission localStorage fallback",
					"invalid data",
				)
				return this.createEmptyData()
			}
			return parsed
		} catch (error) {
			this.logStorageError("Failed to read HTML permission localStorage fallback", error)
			return null
		}
	}

	private writeChangedData(data: HtmlPermissionGrantFallbackSnapshot): boolean {
		const written = this.writeData(data)
		if (written) notifyPermissionGrantChange()
		return written
	}

	private writeData(data: HtmlPermissionGrantFallbackSnapshot): boolean {
		try {
			const storage = globalThis.localStorage
			if (!storage) return false
			storage.setItem(this.storageKey, JSON.stringify(data))
			return true
		} catch (error) {
			this.logStorageError("Failed to persist HTML permission localStorage fallback", error)
			return false
		}
	}

	private probeStorage(): boolean {
		try {
			const storage = globalThis.localStorage
			if (!storage) return false
			const probeKey = `${this.storageKey}:probe`
			storage.setItem(probeKey, "1")
			storage.removeItem(probeKey)
			return true
		} catch {
			return false
		}
	}

	private getLockManager(): LockManager | null {
		if (typeof navigator === "undefined") return null
		const lockManager = navigator.locks
		return lockManager && typeof lockManager.request === "function" ? lockManager : null
	}

	private removeExpired(data: HtmlPermissionGrantFallbackSnapshot, now: number): boolean {
		let changed = false
		for (const record of Object.values(data.grants)) {
			if (
				record.epoch !== data.epoch ||
				(record.expiresAt !== null && record.expiresAt <= now)
			) {
				delete data.grants[record.key]
				changed = true
			}
		}
		return changed
	}

	private limitGrantCount(data: HtmlPermissionGrantFallbackSnapshot): void {
		const records = Object.values(data.grants)
		if (records.length <= MAX_HTML_PERMISSION_GRANTS) return

		const overflow = records
			.sort(compareHtmlPermissionGrantEvictionPriority)
			.slice(0, records.length - MAX_HTML_PERMISSION_GRANTS)
		for (const record of overflow) delete data.grants[record.key]
		htmlMicroAppPreviewLogger.warn("Permission grant limit exceeded", {
			limit: MAX_HTML_PERMISSION_GRANTS,
			evictedCount: overflow.length,
			storage: "localStorage-fallback",
		})
	}

	private createEmptyData(): HtmlPermissionGrantFallbackSnapshot {
		return {
			...EMPTY_FALLBACK_DATA,
			grants: {},
			scopeRevocations: {},
			appRevocations: {},
		}
	}

	private logStorageError(message: string, error: unknown): void {
		htmlMicroAppPreviewLogger.warn(message, {
			error: error instanceof Error ? error.message : String(error),
		})
	}
}

function isValidFallbackData(value: unknown): value is HtmlPermissionGrantFallbackSnapshot {
	if (!isRecord(value)) return false
	if (
		value.version !== 1 ||
		!isNonNegativeInteger(value.epoch) ||
		!isNonNegativeInteger(value.revision) ||
		!(value.clearedAtRevision === null || isNonNegativeInteger(value.clearedAtRevision)) ||
		!isRecord(value.grants) ||
		!isRecord(value.scopeRevocations) ||
		!isRecord(value.appRevocations)
	) {
		return false
	}
	return (
		Object.entries(value.grants).every(
			([key, grant]) =>
				isValidStoredGrant(grant) &&
				isRecord(grant) &&
				grant.key === key &&
				isNonNegativeInteger(grant.revision),
		) &&
		Object.values(value.scopeRevocations).every(isValidFallbackRevision) &&
		Object.values(value.appRevocations).every(isValidFallbackRevision)
	)
}

function isValidFallbackRevision(value: unknown): value is StoredFallbackRevision {
	return (
		isRecord(value) && isNonNegativeInteger(value.epoch) && isNonNegativeInteger(value.revision)
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0
}

export function isFallbackGrantEffective(
	data: HtmlPermissionGrantFallbackSnapshot,
	grant: StoredFallbackGrant,
): boolean {
	if (data.clearedAtRevision !== null && grant.revision <= data.clearedAtRevision) return false
	const appRevocation = data.appRevocations[grant.appKey]
	if (appRevocation && grant.revision <= appRevocation.revision) return false
	const scopeRevocation = data.scopeRevocations[grant.key]
	return !scopeRevocation || grant.revision > scopeRevocation.revision
}

export function clearLegacyHtmlPermissionGrantStorage(): void {
	try {
		globalThis.localStorage?.removeItem(LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY)
	} catch (error) {
		htmlMicroAppPreviewLogger.warn(
			"Failed to remove legacy permission grants from localStorage",
			{
				error: error instanceof Error ? error.message : String(error),
			},
		)
	}
}
