import { useMemo } from "react"
import { measureFileTreeOperation } from "@/pages/superMagic/utils/fileTreePerf"
import { buildAttachmentIndex } from "../utils/attachmentIndex"
import {
	readAttachmentIndexSessionCache,
	writeAttachmentIndexSessionCache,
} from "../utils/attachmentIndexSessionCache"
import type { AttachmentItem } from "./types"
import { recordAttachmentIndexStructureMetrics } from "./useAttachmentIndexPerf"

interface UseAttachmentIndexOptions {
	mergedFiles: AttachmentItem[]
	cacheIdentity?: string
	flatListSource?: AttachmentItem[]
}

export function useAttachmentIndex({
	mergedFiles,
	cacheIdentity = "",
	flatListSource,
}: UseAttachmentIndexOptions) {
	const attachmentIndex = useMemo(() => {
		if (flatListSource) {
			const cachedIndex = readAttachmentIndexSessionCache(mergedFiles, flatListSource)
			if (cachedIndex) {
				return cachedIndex
			}
		}

		return measureFileTreeOperation(
			"attachment_index_build_ms",
			mergedFiles,
			() => buildAttachmentIndex(mergedFiles),
			(nextAttachmentIndex) => {
				if (flatListSource) {
					writeAttachmentIndexSessionCache(
						mergedFiles,
						flatListSource,
						nextAttachmentIndex,
					)
				}
				const context = {
					cache_identity: cacheIdentity,
					attachment_index_entry_count: nextAttachmentIndex.totalCount,
				}
				return {
					...context,
					...recordAttachmentIndexStructureMetrics(nextAttachmentIndex, context),
				}
			},
		)
	}, [cacheIdentity, flatListSource, mergedFiles])

	return {
		attachmentIndex,
	}
}
