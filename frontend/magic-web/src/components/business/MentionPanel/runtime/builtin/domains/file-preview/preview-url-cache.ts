import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import { isOssExpired, parseExpiresAt } from "@/components/CanvasDesign/canvas/utils/ossExpiryUtils"

interface MentionPreviewUrlCacheItem {
	url: string
	expiresAt: string
	updatedAt?: string
}

const mentionPreviewUrlCache = new Map<string, MentionPreviewUrlCacheItem>()
const mentionPreviewUrlRequestCache = new Map<string, Promise<GetTemporaryDownloadUrlItem[]>>()

function buildMentionPreviewRequestKey(fileIds: string[]): string {
	return Array.from(new Set(fileIds)).sort().join(",")
}

function isMentionPreviewUrlCacheValid(params: {
	cachedItem?: MentionPreviewUrlCacheItem
	currentUpdatedAt?: string
}) {
	const { cachedItem, currentUpdatedAt } = params
	if (!cachedItem?.url || !cachedItem.expiresAt) return false

	const expiresAtTs = parseExpiresAt(cachedItem.expiresAt)
	if (isOssExpired(expiresAtTs)) return false

	if (!currentUpdatedAt) return true
	return cachedItem.updatedAt === currentUpdatedAt
}

export function getCachedMentionPreviewUrls(params: {
	fileIds: string[]
	fileUpdatedAtMap?: ReadonlyMap<string, string>
}) {
	const { fileIds, fileUpdatedAtMap } = params
	const cached: GetTemporaryDownloadUrlItem[] = []
	const missing: string[] = []

	for (const fileId of fileIds) {
		const cachedItem = mentionPreviewUrlCache.get(fileId)
		const currentUpdatedAt = fileUpdatedAtMap?.get(fileId)
		if (
			isMentionPreviewUrlCacheValid({
				cachedItem,
				currentUpdatedAt,
			})
		) {
			cached.push({
				file_id: fileId,
				url: cachedItem?.url ?? "",
				expires_at: cachedItem?.expiresAt ?? "",
			})
			continue
		}

		if (cachedItem) mentionPreviewUrlCache.delete(fileId)
		missing.push(fileId)
	}

	return { cached, missing }
}

export function updateMentionPreviewUrlCache(params: {
	urlData: GetTemporaryDownloadUrlItem[]
	fileUpdatedAtMap?: ReadonlyMap<string, string>
}) {
	const { urlData, fileUpdatedAtMap } = params

	for (const item of urlData) {
		if (!item.file_id || !item.url || !item.expires_at) continue
		mentionPreviewUrlCache.set(item.file_id, {
			url: item.url,
			expiresAt: item.expires_at,
			updatedAt: fileUpdatedAtMap?.get(item.file_id),
		})
	}
}

export function requestMentionPreviewUrls(
	fileIds: string[],
): Promise<GetTemporaryDownloadUrlItem[]> {
	if (fileIds.length === 0) return Promise.resolve([])

	const requestKey = buildMentionPreviewRequestKey(fileIds)
	const cachedRequest = mentionPreviewUrlRequestCache.get(requestKey)
	if (cachedRequest) return cachedRequest

	const request = getTemporaryDownloadUrl({
		file_ids: Array.from(new Set(fileIds)),
		options: {
			xMagicImageProcess: { quality: 10, format: "webp" },
		},
	}).finally(() => {
		mentionPreviewUrlRequestCache.delete(requestKey)
	})

	mentionPreviewUrlRequestCache.set(requestKey, request)
	return request
}
