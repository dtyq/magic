import Dexie, { type Table } from "dexie"
import type { PendingDesignUpgrade } from "../managers/types"

const STORAGE_PREFIX = "MAGIC:supermagic-design:upgrade:"
const DB_NAME = "MAGIC:supermagic-design:upgrades"
const memory = new Map<string, PendingDesignUpgrade>()

interface StoredPendingDesignUpgrade extends PendingDesignUpgrade {
	key: string
}

class DesignUpgradeDatabase extends Dexie {
	entries!: Table<StoredPendingDesignUpgrade, string>

	constructor() {
		super(DB_NAME)
		this.version(1).stores({ entries: "key, fileId, createdAt, reason" })
	}
}

let dbPromise: Promise<DesignUpgradeDatabase> | null = null

export interface DesignUpgradeIdentity {
	projectId?: string
	designProjectId?: string
	magicProjectJsFileId?: string | null
}

function part(value: string | null | undefined): string {
	return value?.trim() || "_"
}

export function buildDesignUpgradeKey(identity: DesignUpgradeIdentity): string {
	return [
		STORAGE_PREFIX,
		part(identity.projectId),
		part(identity.designProjectId),
		part(identity.magicProjectJsFileId),
	].join(":")
}

function hasCompleteIdentity(identity: DesignUpgradeIdentity): boolean {
	return !!(
		identity.projectId?.trim() &&
		identity.designProjectId?.trim() &&
		identity.magicProjectJsFileId?.trim()
	)
}

function storage(): Storage | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage
	} catch {
		return null
	}
}

async function database(): Promise<DesignUpgradeDatabase> {
	if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable")
	if (dbPromise) return dbPromise
	dbPromise = (async () => {
		const db = new DesignUpgradeDatabase()
		await db.open()
		return db
	})().catch((error) => {
		dbPromise = null
		throw error
	})
	return dbPromise
}

function clone(value: PendingDesignUpgrade): PendingDesignUpgrade {
	return { ...value }
}

export async function readPendingDesignUpgrade(
	identity: DesignUpgradeIdentity,
): Promise<PendingDesignUpgrade | null> {
	if (!hasCompleteIdentity(identity)) return null
	const key = buildDesignUpgradeKey(identity)
	try {
		const stored = await (await database()).entries.get(key)
		if (stored) {
			return {
				reason: stored.reason,
				fileId: stored.fileId,
				sourceVersion: stored.sourceVersion,
				targetVersion: stored.targetVersion,
				createdAt: stored.createdAt,
			}
		}
	} catch {
		// fall through to localStorage
	}
	const local = storage()
	if (local) {
		try {
			const raw = local.getItem(key)
			if (raw) {
				const parsed = JSON.parse(raw) as PendingDesignUpgrade
				if (parsed?.fileId && parsed?.targetVersion) return parsed
			}
		} catch {
			// fall through to memory fallback
		}
	}
	return memory.get(key) ? clone(memory.get(key)!) : null
}

export async function writePendingDesignUpgrade(
	identity: DesignUpgradeIdentity,
	upgrade: PendingDesignUpgrade,
): Promise<boolean> {
	if (!hasCompleteIdentity(identity)) return false
	const key = buildDesignUpgradeKey(identity)
	const value = clone(upgrade)
	try {
		await (await database()).entries.put({ key, ...value })
		return true
	} catch {
		// fall through to localStorage
	}
	const local = storage()
	if (local) {
		try {
			local.setItem(key, JSON.stringify(value))
			return true
		} catch {
			// use memory fallback below
		}
	}
	memory.set(key, value)
	return true
}

export async function clearPendingDesignUpgrade(identity: DesignUpgradeIdentity): Promise<void> {
	if (!hasCompleteIdentity(identity)) return
	const key = buildDesignUpgradeKey(identity)
	try {
		await (await database()).entries.delete(key)
	} catch {
		// continue clearing fallbacks
	}
	try {
		storage()?.removeItem(key)
	} catch {
		// ignore
	}
	memory.delete(key)
}
