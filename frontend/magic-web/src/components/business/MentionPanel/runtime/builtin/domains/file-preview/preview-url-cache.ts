import type { GetTemporaryDownloadUrlItem } from "@/pages/superMagic/utils/api"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	getCachedSharedMediaUrls,
	seedSharedMediaUrls,
} from "@/pages/superMagic/services/sharedMediaUrlCache"
import { SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS } from "@/pages/superMagic/services/sharedMediaImageProcess"

const MENTION_PREVIEW_IMAGE_PROCESS = SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS

function buildMentionPreviewOptions(
	fileUpdatedAtMap?: ReadonlyMap<string, string>,
	fileResourceVersionMap?: ReadonlyMap<string, string>,
	fileVersions?: ReadonlyMap<string, number>,
	identityKey?: string,
) {
	return {
		imageProcess: MENTION_PREVIEW_IMAGE_PROCESS,
		allowAttachmentListUrl: true,
		fileUpdatedAtMap,
		fileResourceVersionMap,
		fileVersions,
		// Identity is part of the cache/batch key so host and share previews of the
		// same file never share a cached URL.
		identityKey,
	}
}

export function getCachedMentionPreviewUrls(params: {
	fileIds: string[]
	fileUpdatedAtMap?: ReadonlyMap<string, string>
	fileResourceVersionMap?: ReadonlyMap<string, string>
	fileVersions?: ReadonlyMap<string, number>
	fileApi: Pick<FileApi, "identityKey">
}): {
	cached: GetTemporaryDownloadUrlItem[]
	missing: string[]
} {
	return getCachedSharedMediaUrls({
		fileIds: params.fileIds,
		options: buildMentionPreviewOptions(
			params.fileUpdatedAtMap,
			params.fileResourceVersionMap,
			params.fileVersions,
			params.fileApi.identityKey,
		),
	})
}

export function updateMentionPreviewUrlCache(params: {
	urlData: GetTemporaryDownloadUrlItem[]
	fileUpdatedAtMap?: ReadonlyMap<string, string>
	fileResourceVersionMap?: ReadonlyMap<string, string>
	fileVersions?: ReadonlyMap<string, number>
	fileApi: Pick<FileApi, "identityKey">
}): void {
	seedSharedMediaUrls({
		items: params.urlData,
		options: buildMentionPreviewOptions(
			params.fileUpdatedAtMap,
			params.fileResourceVersionMap,
			params.fileVersions,
			params.fileApi.identityKey,
		),
	})
}

export function requestMentionPreviewUrls(
	fileIds: string[],
	params: {
		fileUpdatedAtMap?: ReadonlyMap<string, string>
		fileResourceVersionMap?: ReadonlyMap<string, string>
		fileVersions?: ReadonlyMap<string, number>
		fileApi: Pick<FileApi, "identityKey" | "requestSharedMediaUrls">
	},
): Promise<GetTemporaryDownloadUrlItem[]> {
	return params.fileApi.requestSharedMediaUrls(
		fileIds,
		buildMentionPreviewOptions(
			params.fileUpdatedAtMap,
			params.fileResourceVersionMap,
			params.fileVersions,
			params.fileApi.identityKey,
		),
	)
}
