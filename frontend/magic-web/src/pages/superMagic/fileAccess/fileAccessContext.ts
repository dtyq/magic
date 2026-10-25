import { matchPath } from "react-router"
import { RoutePath } from "@/constants/routes"

const SHARE_PAGE_ROUTE_PATTERNS = [
	RoutePath.SuperMagicShare,
	RoutePath.MicroAppShare,
	RoutePath.MagicShare,
] as const

export type SessionFileAccess = {
	kind: "session"
	projectId?: string
	topicId?: string
}

export type ShareFileAccess = {
	kind: "share"
	token: string
	projectId: string
	topicId?: string
	resourceId?: string
}

export type RecycleBinFileAccess = {
	kind: "recycle-bin"
	recycleBinId: string
	fileId: string
	identityKey: string
	projectId?: string
}

export type FileAccessContext = SessionFileAccess | ShareFileAccess | RecycleBinFileAccess

export function createSessionFileAccess(
	params: {
		projectId?: string
		topicId?: string
	} = {},
): SessionFileAccess {
	return { kind: "session", ...params }
}

export function createShareFileAccess(params: {
	token: string
	projectId: string
	topicId?: string
	resourceId?: string
}): ShareFileAccess {
	return { kind: "share", ...params }
}

export function getShareAccessToken(access?: FileAccessContext | null): string {
	return access?.kind === "share" ? access.token : ""
}

export function isShareFileAccess(access?: FileAccessContext | null): access is ShareFileAccess {
	return access?.kind === "share"
}

export function isSharePageLocation(
	pathname = typeof window === "undefined" ? "" : window.location.pathname,
): boolean {
	return SHARE_PAGE_ROUTE_PATTERNS.some(
		(pattern) => matchPath({ path: pattern, end: false }, pathname) != null,
	)
}

/** Share routes require explicit access; a runtime conversation can bind session access. */
export function shouldWaitForShareAccess(
	access?: FileAccessContext | null,
	pathname?: string,
): boolean {
	return isSharePageLocation(pathname) && !access
}

export function getAccessProjectId(access?: FileAccessContext | null, fallback = ""): string {
	if (access?.kind === "share") return access.projectId
	return access?.projectId || fallback
}

export function getAccessTopicId(access?: FileAccessContext | null, fallback = ""): string {
	if (access?.kind === "share") return access.topicId ?? ""
	return access?.kind === "recycle-bin" ? "" : access?.topicId || fallback
}

export function resolveAttachmentProjectId(
	projectId: string,
	access?: FileAccessContext | null,
): string {
	return access?.kind === "share" ? "0" : projectId
}

export function resolveTemporaryTokenFromAccess(
	access?: FileAccessContext | null,
	temporaryToken?: string | null,
): string {
	if (access?.kind === "share") return access.token
	if (temporaryToken === null) return ""
	return temporaryToken || ""
}

/**
 * Canonical identity of a file access context. FileApi instances are memoized on
 * this key instead of the object reference, so a provider that rebuilds an equal
 * access object does not churn every downstream closure. The share token never
 * leaves this in-memory key (it is a useMemo dependency, not a log or URL).
 */
export function getFileAccessIdentityKey(access?: FileAccessContext | null): string {
	if (!access) return "none"
	if (access.kind === "recycle-bin")
		return `recycle-bin:${access.identityKey}:${access.recycleBinId}:${access.fileId}`
	if (access.kind === "share") {
		return [
			"share",
			access.token,
			access.projectId,
			access.topicId ?? "",
			access.resourceId ?? "",
		].join(":")
	}
	return ["session", access.projectId ?? "", access.topicId ?? ""].join(":")
}

/**
 * Content-processing identity for share previews. Omits the temporary token so
 * token refresh does not reprocess HTML / remount the iframe.
 */
export function getFileAccessContentKey(access?: FileAccessContext | null): string {
	if (!access) return "none"
	if (access.kind === "recycle-bin")
		return `recycle-bin:${access.identityKey}:${access.recycleBinId}:${access.fileId}`
	if (access.kind === "share") {
		return ["share", access.projectId, access.topicId ?? "", access.resourceId ?? ""].join(":")
	}
	return ["session", access.projectId ?? "", access.topicId ?? ""].join(":")
}
