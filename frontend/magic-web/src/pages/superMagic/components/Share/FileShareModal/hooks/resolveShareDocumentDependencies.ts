import { resolveSingleDocumentStaticDependencies } from "@/pages/superMagic/utils/staticDependencies"
import type {
	StaticDependencyAttachment,
	StaticDependencyResult,
} from "@/pages/superMagic/utils/staticDependencies"

// Scope cached work to the attachment snapshot so discarded snapshots can be garbage-collected.
const dependencyAnalysisCache = new WeakMap<
	StaticDependencyAttachment[],
	Map<string, Promise<StaticDependencyResult>>
>()

interface ResolveShareDocumentDependenciesInput {
	/** IDs selected by the user; only supported document types are analyzed. */
	selectedFileIds: string[]
	/** Full attachment snapshot used to resolve local references. */
	attachments: StaticDependencyAttachment[]
	/** Optional bundle root used to prevent cross-recording matches. */
	bundleRootPath?: string
	/** Rejects unscoped analysis when the caller requires recording-bundle isolation. */
	requireBundleRootPath?: boolean
}

interface ResolveShareDocumentDependenciesResult {
	dependencyFileIds: string[]
	missingResourcePaths: string[]
}

/**
 * Resolves dependencies for every selected Markdown/HTML document while keeping one bad file
 * from preventing the remaining documents from contributing resources to the share.
 */
export async function resolveShareDocumentDependencies({
	selectedFileIds,
	attachments,
	bundleRootPath,
	requireBundleRootPath = false,
}: ResolveShareDocumentDependenciesInput): Promise<ResolveShareDocumentDependenciesResult> {
	if (requireBundleRootPath && !normalizePath(bundleRootPath)) {
		throw new Error("Recording dependency analysis requires a bundle root path")
	}

	const scopedAttachments = scopeAttachmentsToBundle(attachments, bundleRootPath)
	const scopedIds = new Set(scopedAttachments.map((file) => file.file_id).filter(Boolean))
	const documentIds = selectedFileIds.filter((fileId) => scopedIds.has(fileId))

	const results = await Promise.all(
		documentIds.map(async (fileId) => {
			const cacheKey = `${normalizePath(bundleRootPath)}:${fileId}`
			let snapshotCache = dependencyAnalysisCache.get(attachments)
			if (!snapshotCache) {
				snapshotCache = new Map()
				dependencyAnalysisCache.set(attachments, snapshotCache)
			}

			let analysisPromise = snapshotCache.get(cacheKey)
			if (!analysisPromise) {
				analysisPromise = resolveSingleDocumentStaticDependencies({
					fileIds: [fileId],
					attachments: scopedAttachments,
				})
				snapshotCache.set(cacheKey, analysisPromise)
				analysisPromise.catch(() => {
					// Failed work must not poison retries while the snapshot remains active.
					snapshotCache?.delete(cacheKey)
				})
			}

			return analysisPromise.catch((error) => {
				console.warn("Failed to resolve share document dependencies", { fileId, error })
				return null
			})
		}),
	)

	const dependencyFileIds = new Set<string>()
	const missingResourcePaths = new Set<string>()
	for (const result of results) {
		if (!result) continue
		result.dependencyFileIds.forEach((fileId) => dependencyFileIds.add(fileId))
		result.missingResourcePaths.forEach((path) => missingResourcePaths.add(path))
	}

	return {
		dependencyFileIds: [...dependencyFileIds],
		missingResourcePaths: [...missingResourcePaths],
	}
}

/** Filters a flat or nested attachment snapshot to one recording bundle. */
function scopeAttachmentsToBundle(
	attachments: StaticDependencyAttachment[],
	bundleRootPath?: string,
): StaticDependencyAttachment[] {
	const normalizedRoot = normalizePath(bundleRootPath)
	if (!normalizedRoot) return attachments

	const scoped = attachments.filter((file) =>
		getPathCandidates(file).some((path) => {
			const normalizedPath = normalizePath(path)
			return (
				normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
			)
		}),
	)

	return scoped
}

/** Returns every path field that may identify an attachment in API responses. */
function getPathCandidates(file: StaticDependencyAttachment): string[] {
	return [
		file.relative_file_path,
		file.path,
		file.file_key,
		file.file_name,
		file.filename,
	].filter((path): path is string => Boolean(path))
}

/** Normalizes encoded and platform-specific paths for bundle boundary checks. */
function normalizePath(path?: string): string {
	if (!path) return ""
	try {
		return decodeURIComponent(path)
			.trim()
			.toLowerCase()
			.replace(/\\/g, "/")
			.replace(/^\/+|\/+$/g, "")
	} catch {
		return path
			.trim()
			.toLowerCase()
			.replace(/\\/g, "/")
			.replace(/^\/+|\/+$/g, "")
	}
}
