const STORAGE_PREFIX = "magic-html-edit-button:"
const MAX_AGE_MS = 30 * 60 * 1000

interface CachedHtmlEditButton {
	visible: boolean
	savedAt: number
}

function getStorageKey(fileId: string): string {
	return `${STORAGE_PREFIX}${fileId}`
}

/** Reads a short-lived edit-button visibility snapshot without affecting preview rendering. */
export function readCachedHtmlEditButton(fileId?: string): boolean | undefined {
	if (!fileId || typeof window === "undefined") return undefined

	try {
		const storage = window.sessionStorage
		if (!storage) return undefined
		const raw = storage.getItem(getStorageKey(fileId))
		if (!raw) return undefined
		const value = JSON.parse(raw) as Partial<CachedHtmlEditButton>
		const hasValidShape =
			typeof value.visible === "boolean" && typeof value.savedAt === "number"
		if (!hasValidShape) return undefined
		if (Date.now() - value.savedAt > MAX_AGE_MS) {
			storage.removeItem(getStorageKey(fileId))
			return undefined
		}
		return value.visible
	} catch {
		return undefined
	}
}

/** Stores the latest authoritative edit-button visibility for the current browser session. */
export function writeCachedHtmlEditButton(fileId: string | undefined, visible: boolean): void {
	if (!fileId || typeof window === "undefined") return

	try {
		const storage = window.sessionStorage
		if (!storage) return
		storage.setItem(
			getStorageKey(fileId),
			JSON.stringify({ visible, savedAt: Date.now() } satisfies CachedHtmlEditButton),
		)
	} catch {
		// Storage can be blocked by privacy settings; the live calculation remains authoritative.
	}
}
