import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { getFileAccessIdentityKey } from "@/pages/superMagic/fileAccess/fileAccessContext"
import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import { buildImageProcessQuery, type ImageProcessOptions } from "@/utils/image-processing"
import { UrlCacheManager } from "./urlCache"

interface ResolveCachedResourceUrlsOptions {
	fileIds: string[]
	imageFileIds: Set<string>
	fileUpdatedAtMap: Map<string, string>
	imageProcessOptions?: ImageProcessOptions
	access?: FileAccessContext | null
	fileApi?: FileApi
}

const originalUrlCacheManagers = new Map<string, UrlCacheManager>()
const processedImageUrlCacheManagers = new Map<string, UrlCacheManager>()

function getUrlCacheManager(identityKey: string, options?: ImageProcessOptions): UrlCacheManager {
	if (!options) {
		const cached = originalUrlCacheManagers.get(identityKey)
		if (cached) return cached
		const manager = new UrlCacheManager()
		originalUrlCacheManagers.set(identityKey, manager)
		return manager
	}

	const signature = buildImageProcessQuery(options)
	const cacheKey = `${identityKey}:${signature}`
	const cachedManager = processedImageUrlCacheManagers.get(cacheKey)
	if (cachedManager) return cachedManager

	const manager = new UrlCacheManager()
	processedImageUrlCacheManagers.set(cacheKey, manager)
	return manager
}

export async function resolveCachedResourceUrls({
	fileIds,
	imageFileIds,
	fileUpdatedAtMap,
	imageProcessOptions,
	access,
	fileApi,
}: ResolveCachedResourceUrlsOptions): Promise<GetTemporaryDownloadUrlItem[]> {
	const identityKey = fileApi?.identityKey ?? getFileAccessIdentityKey(access)
	const requestUrls = fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
	const imageIds = fileIds.filter((id) => imageFileIds.has(id))
	const otherIds = fileIds.filter((id) => !imageFileIds.has(id))
	const imageUrlCacheManager = getUrlCacheManager(identityKey, imageProcessOptions)
	const originalUrlCacheManager = getUrlCacheManager(identityKey)
	const { cached: cachedImageUrls, missing: missingImageIds } =
		imageUrlCacheManager.getCachedUrls(imageIds, fileUpdatedAtMap)
	const { cached: cachedOtherUrls, missing: missingOtherIds } =
		originalUrlCacheManager.getCachedUrls(otherIds, fileUpdatedAtMap)

	const [fetchedImageUrls, fetchedOtherUrls] = await Promise.all([
		missingImageIds.length > 0
			? requestUrls({
					file_ids: missingImageIds,
					access: access ?? undefined,
					...(imageProcessOptions && {
						options: { xMagicImageProcess: imageProcessOptions },
					}),
				}).then((result) => result || [])
			: Promise.resolve([]),
		missingOtherIds.length > 0
			? requestUrls({
					file_ids: missingOtherIds,
					access: access ?? undefined,
				}).then((result) => result || [])
			: Promise.resolve([]),
	])

	imageUrlCacheManager.updateUrlCache(fetchedImageUrls, fileUpdatedAtMap)
	originalUrlCacheManager.updateUrlCache(fetchedOtherUrls, fileUpdatedAtMap)

	return [...cachedImageUrls, ...cachedOtherUrls, ...fetchedImageUrls, ...fetchedOtherUrls]
}
