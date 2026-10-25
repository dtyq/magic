import type { UploadFileResponse } from "../../../public/magic-types"
import type {
	CanvasResourceReferenceResolution,
	CanvasResourceReferenceResolveOptions,
	ResolveCanvasResourceReference,
} from "../../../public/resource-reference"
import {
	CANVAS_RESOURCE_ROOTS,
	buildAssetResourcePath,
	buildSharedMediaStorageScope,
	buildVirtualResourceScope,
	formatCanvasRelativeResourcePath,
	hasCurrentDirectoryPrefix,
	isAssetResourcePath,
	isAssetResourceScheme,
	isCanvasRelativeResourcePath as isCanvasRelativeResourcePathInternal,
	isOpaqueAssetReference,
	isRemoteOrSpecialPath,
	joinUploadResultPath,
	normalizePathSeparators,
	normalizeUploadFileResponse as normalizeUploadFileResponseInternal,
	parseAssetResourcePath,
	stripCurrentDirectoryPrefix,
	stripPathEdgeSlashes,
} from "./internal/pathPrimitives"

export {
	CANVAS_RESOURCE_ROOTS,
	buildAssetResourcePath,
	buildSharedMediaStorageScope,
	buildVirtualResourceScope,
	formatCanvasRelativeResourcePath,
	hasCurrentDirectoryPrefix,
	isAssetResourcePath,
	isAssetResourceScheme,
	isOpaqueAssetReference,
	isRemoteOrSpecialPath,
	normalizePathSeparators,
	parseAssetResourcePath,
	stripCurrentDirectoryPrefix,
	stripPathEdgeSlashes,
}

interface CanvasResourceReferenceHost {
	magicConfigManager?: {
		config?: {
			methods?: {
				resolveResourceReference?: ResolveCanvasResourceReference
			}
		}
	}
}

/**
 * Resolver revision 变化时的增量失效范围。
 *
 * `changedResourceIdentities` 只允许承载 resolver 解析得到的 identity；
 * 原始 referencePath 仍由各资源管理器保留并交给 resolver 处理。
 */
export interface CanvasResourceReferenceResolverChangeOptions {
	changedResourceIdentities?: ReadonlySet<string>
}

export function isCanvasResourceRootPath(path: string): boolean {
	return isCanvasRelativeResourcePathInternal(path)
}

/** Resolve a path stored in Canvas data with the host's explicit namespace contract. */
export function resolveCanvasStorageResourceReference(
	path: string,
	resolveResourceReference: ResolveCanvasResourceReference,
	options?: CanvasResourceReferenceResolveOptions,
): CanvasResourceReferenceResolution {
	const trimmedPath = path.trim()
	const isLegacyBareResource =
		!trimmedPath.startsWith("/") &&
		!hasCurrentDirectoryPrefix(trimmedPath) &&
		!isRemoteOrSpecialPath(trimmedPath) &&
		isCanvasResourceRootPath(trimmedPath)
	return resolveResourceReference(
		{
			namespace: "canvas-storage",
			path: trimmedPath,
			mode: isLegacyBareResource ? "legacy-recovery" : "strict-current-canvas",
		},
		options,
	)
}

export type CanvasResourceAvailability = "available" | "deleted" | "pending" | "unknown"

/**
 * Resolve whether a Canvas-stored resource still exists in the authoritative attachment snapshot.
 * Only an explicit `not-found` is a deletion; pending or ambiguous snapshots must fail open.
 */
export function getCanvasResourceAvailability(
	path: string | null | undefined,
	resolveResourceReference?: ResolveCanvasResourceReference,
): CanvasResourceAvailability {
	const trimmedPath = path?.trim() ?? ""
	if (!trimmedPath || !resolveResourceReference) {
		return "unknown"
	}

	const resolution = resolveCanvasStorageResourceReference(
		trimmedPath,
		resolveResourceReference,
		{
			requireAttachment: true,
		},
	)
	const availability: CanvasResourceAvailability =
		resolution.status === "resolved"
			? "available"
			: resolution.status === "not-found"
				? "deleted"
				: resolution.status === "attachments-pending"
					? "pending"
					: "unknown"
	return availability
}

/**
 * Design-aware identity entry point. A host resolver is authoritative when present; unresolved
 * references retain their exact namespace spelling and never fall back to weak path folding.
 */
export function getCanvasResourceReferenceIdentity(
	path?: string,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string {
	const trimmedPath = path?.trim() ?? ""
	if (!trimmedPath) return ""

	if (!resolveResourceReference) {
		return `unresolved:${normalizePathSeparators(trimmedPath)}`
	}

	const resolution = resolveCanvasStorageResourceReference(trimmedPath, resolveResourceReference)
	if (resolution.status === "resolved") return resolution.identity

	return `unresolved:${normalizePathSeparators(trimmedPath)}`
}

export function getCanvasHostResourceReferenceResolver(
	host?: CanvasResourceReferenceHost | null,
): ResolveCanvasResourceReference | undefined {
	return host?.magicConfigManager?.config?.methods?.resolveResourceReference
}

export function getCanvasHostResourceReferenceIdentity(
	host: CanvasResourceReferenceHost | null | undefined,
	path?: string,
): string {
	return getCanvasResourceReferenceIdentity(path, getCanvasHostResourceReferenceResolver(host))
}

export function areCanvasHostResourceReferencesSame(
	host: CanvasResourceReferenceHost | null | undefined,
	left: string,
	right: string,
): boolean {
	return (
		getCanvasHostResourceReferenceIdentity(host, left) ===
		getCanvasHostResourceReferenceIdentity(host, right)
	)
}

export function areCanvasResourceReferencesSame(
	left: string,
	right: string,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	return (
		getCanvasResourceReferenceIdentity(left, resolveResourceReference) ===
		getCanvasResourceReferenceIdentity(right, resolveResourceReference)
	)
}

function buildWorkspaceUploadPath(fileDir: string, fileName: string): string | undefined {
	const joinedPath = joinUploadResultPath(fileDir, fileName)
	if (!joinedPath || isRemoteOrSpecialPath(joinedPath)) return undefined
	return joinedPath.startsWith("/") ? joinedPath : `/${joinedPath}`
}

/** Backend generation paths are workspace paths; derive their Canvas storage form via the host resolver. */
export function resolveCanvasGeneratedResourceStoragePath(
	host: CanvasResourceReferenceHost | null | undefined,
	fileDir: string,
	fileName: string,
): string | undefined {
	const workspacePath = buildWorkspaceUploadPath(fileDir, fileName)
	if (!workspacePath) return undefined

	const resolveResourceReference = getCanvasHostResourceReferenceResolver(host)
	if (!resolveResourceReference) return undefined

	const resolution = resolveResourceReference({
		namespace: "workspace-path",
		path: workspacePath,
	})
	return resolution.status === "resolved" && resolution.resourceKind === "workspace-file"
		? resolution.storagePath
		: undefined
}

export function normalizeCanvasUploadFileResponsePath<T extends Pick<UploadFileResponse, "path">>(
	result: T,
): T {
	return normalizeUploadFileResponseInternal(result)
}

export function getCanvasResourceFileName(rawPath: string | null | undefined): string {
	const trimmed = rawPath?.trim() ?? ""
	if (!trimmed) return ""
	const withoutQuery = trimmed.split(/[?#]/)[0] ?? ""
	const pathname = (() => {
		try {
			return new URL(withoutQuery).pathname
		} catch {
			return withoutQuery
		}
	})()
	return pathname.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? ""
}
