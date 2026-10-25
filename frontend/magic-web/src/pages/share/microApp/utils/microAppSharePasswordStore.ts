export interface RememberedSharePassword {
	password: string
	expiresAt: number
}

export interface MicroAppSharePasswordStore {
	read(resourceId: string): RememberedSharePassword | null
	save(resourceId: string, password: string): void
	remove(resourceId: string): void
}

export const MICRO_APP_SHARE_PASSWORD_TTL = 30 * 24 * 60 * 60 * 1000
export const MICRO_APP_SHARE_PASSWORD_KEY_PREFIX = "magic:micro-app-share-password:"
const MICRO_APP_SHARE_RESOURCE_KEY_PREFIX = "magic:micro-app-share-resource:"

function getStorageKey(resourceId: string): string {
	return `${MICRO_APP_SHARE_PASSWORD_KEY_PREFIX}${resourceId}`
}

export const microAppSharePasswordStore: MicroAppSharePasswordStore = {
	read(resourceId) {
		if (!resourceId || typeof window === "undefined") return null
		try {
			const raw = window.localStorage.getItem(getStorageKey(resourceId))
			if (!raw) return null
			const value = JSON.parse(raw) as Partial<RememberedSharePassword>
			if (
				typeof value.password !== "string" ||
				!value.password ||
				typeof value.expiresAt !== "number" ||
				value.expiresAt <= Date.now()
			) {
				window.localStorage.removeItem(getStorageKey(resourceId))
				return null
			}
			return { password: value.password, expiresAt: value.expiresAt }
		} catch {
			try {
				window.localStorage.removeItem(getStorageKey(resourceId))
			} catch {
				// Ignore storage access errors.
			}
			return null
		}
	},
	save(resourceId, password) {
		if (!resourceId || !password || typeof window === "undefined") return
		try {
			window.localStorage.setItem(
				getStorageKey(resourceId),
				JSON.stringify({ password, expiresAt: Date.now() + MICRO_APP_SHARE_PASSWORD_TTL }),
			)
		} catch {
			// localStorage is best-effort; the current session remains usable.
		}
	},
	remove(resourceId) {
		if (!resourceId || typeof window === "undefined") return
		try {
			window.localStorage.removeItem(getStorageKey(resourceId))
		} catch {
			// Ignore storage access errors.
		}
	},
}

export function rememberMicroAppShareResource(appId: string, resourceId: string): void {
	if (!appId || !resourceId || typeof window === "undefined") return
	try {
		window.localStorage.setItem(`${MICRO_APP_SHARE_RESOURCE_KEY_PREFIX}${appId}`, resourceId)
	} catch {
		// The password record remains usable even if the cleanup index cannot be saved.
	}
}

export function removeMicroAppSharePassword(appId: string, resourceId?: string): void {
	if (typeof window === "undefined") return
	try {
		const resourceKey = `${MICRO_APP_SHARE_RESOURCE_KEY_PREFIX}${appId}`
		const resolvedResourceId = resourceId || window.localStorage.getItem(resourceKey) || ""
		if (resolvedResourceId) microAppSharePasswordStore.remove(resolvedResourceId)
		window.localStorage.removeItem(resourceKey)
	} catch {
		// Ignore storage access errors.
	}
}
