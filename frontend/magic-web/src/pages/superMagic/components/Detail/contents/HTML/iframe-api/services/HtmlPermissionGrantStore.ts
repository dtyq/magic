import sha256 from "crypto-js/sha256"
import type { HtmlPermissionScope } from "../types"

export const LOCAL_STORAGE_HTML_PERMISSION_GRANT_STORE_KEY = "magic:html-app-permissions:v2"
export const LOCAL_STORAGE_HTML_PERMISSION_GRANT_FALLBACK_KEY =
	"magic:html-app-permissions:fallback:v1"
export const HTML_PERMISSION_GRANTS_CHANGED_EVENT = "magic:html-app-permissions:changed"
export const HTML_PERMISSION_GRANTS_CHANNEL_NAME = "magic:html-app-permissions"
export const MAX_HTML_PERMISSION_GRANTS = 1000

export interface HtmlPermissionGrantIdentity {
	mode: "manifest" | "legacy"
	userId: string
	projectId: string
	appRootDir: string
	entryPath: string
	appFingerprint: string
	/**
	 * Stable identity of a standalone micro app. When set (or when `entryFileId` is set) the
	 * grant key ignores path and content, so edits, renames and moves keep existing grants.
	 */
	appId?: string
	/** Stable file id of an ordinary HTML app entry; used when no `appId` exists. */
	entryFileId?: string
}

export interface HtmlPermissionGrant extends HtmlPermissionGrantIdentity {
	scope: HtmlPermissionScope
	grantedAt: number
	expiresAt: number | null
	/**
	 * Version of the app's executable files when the user last confirmed this grant. It is not part
	 * of the grant key: it only lets the service tell whether the code changed after authorization.
	 * Missing on grants saved before this field existed.
	 */
	codeFingerprint?: string
	/** Explicit consent to reuse this scope for future code versions of the same app. */
	reuseAcrossCodeChanges?: boolean
}

export interface HtmlPermissionGrantStore {
	getGrant(
		identity: HtmlPermissionGrantIdentity,
		scope: HtmlPermissionScope,
	): Promise<HtmlPermissionGrant | undefined>
	getAppGrants(identity: HtmlPermissionGrantIdentity): Promise<HtmlPermissionGrant[]>
	isPersistentAvailable(): Promise<boolean>
	save(grant: HtmlPermissionGrant): Promise<boolean>
	remove(identity: HtmlPermissionGrantIdentity, scope?: HtmlPermissionScope): Promise<void>
	prune(now: number): Promise<void>
	clear(): Promise<void>
}

export function isHtmlPermissionGrantActive(grant: HtmlPermissionGrant, now: number): boolean {
	return grant.expiresAt === null || grant.expiresAt > now
}

export function createHtmlPermissionAppKey(identity: HtmlPermissionGrantIdentity): string {
	if (identity.appId || identity.entryFileId) {
		// "v3" keeps stable-identity keys disjoint from legacy fingerprint keys below.
		return sha256(
			JSON.stringify([
				"v3",
				identity.mode,
				identity.userId,
				identity.projectId,
				identity.appId || "",
				identity.entryFileId || "",
			]),
		).toString()
	}
	// Legacy key (path + content fingerprint). Still used to find and migrate grants saved by
	// earlier versions; never produced for new grants.
	const source = JSON.stringify([
		identity.mode,
		identity.userId,
		identity.projectId,
		identity.appRootDir,
		identity.entryPath,
		identity.appFingerprint,
	])
	return sha256(source).toString()
}
