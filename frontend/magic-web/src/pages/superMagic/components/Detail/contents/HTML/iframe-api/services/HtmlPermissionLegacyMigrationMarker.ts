/**
 * Remembers which apps already went through legacy-grant migration.
 *
 * Old grants are keyed on a content fingerprint, so adopting them again later (for example after a
 * revoke followed by reverting the file to an earlier version) would bring back a grant the user
 * removed. Persisting this marker makes the migration a one-time step per app. Only hashed app keys
 * are stored, never paths or ids.
 */
export interface HtmlPermissionLegacyMigrationMarker {
	has(appKey: string): boolean
	add(appKey: string): void
}

export const LOCAL_STORAGE_HTML_PERMISSION_LEGACY_MIGRATED_KEY =
	"magic:html-app-permissions:legacy-migrated:v1"
const MAX_MARKED_APPS = 2000

export function createLocalStorageLegacyMigrationMarker(): HtmlPermissionLegacyMigrationMarker {
	// Used when localStorage is unavailable, so a session still migrates at most once per app.
	const memory = new Set<string>()

	const read = (): string[] => {
		try {
			const raw = globalThis.localStorage?.getItem(
				LOCAL_STORAGE_HTML_PERMISSION_LEGACY_MIGRATED_KEY,
			)
			const parsed: unknown = raw ? JSON.parse(raw) : []
			return Array.isArray(parsed)
				? parsed.filter((item): item is string => typeof item === "string")
				: []
		} catch {
			return []
		}
	}

	return {
		has: (appKey) => memory.has(appKey) || read().includes(appKey),
		add: (appKey) => {
			memory.add(appKey)
			try {
				const next = [...read().filter((item) => item !== appKey), appKey]
				globalThis.localStorage?.setItem(
					LOCAL_STORAGE_HTML_PERMISSION_LEGACY_MIGRATED_KEY,
					JSON.stringify(next.slice(-MAX_MARKED_APPS)),
				)
			} catch {
				// Storage is best effort; the in-memory set above still prevents repeats this session.
			}
		},
	}
}

let sharedMarker: HtmlPermissionLegacyMigrationMarker | null = null

export function getSharedLegacyMigrationMarker(): HtmlPermissionLegacyMigrationMarker {
	sharedMarker ??= createLocalStorageLegacyMigrationMarker()
	return sharedMarker
}
