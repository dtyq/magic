import type { TFunction } from "i18next"
import { SuperMagicApi } from "@/apis"
import { generateShareMessageText } from "@/pages/superMagic/components/Share/utils/generateShareMessageText"
import { generateShareUrl } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"
import type { MobileShareItem } from "../types"
import { isWholeProjectShare } from "./shareScope"

interface BuildShareClipboardTextParams {
	share: MobileShareItem
	projectName?: string
	t: TFunction<"super", undefined>
}

/**
 * Resolves the file count used in multi-file share copy text; mirrors PC `actualFileCount`.
 */
function resolveFileCount(share: MobileShareItem): number {
	if (share.extend?.file_count != null) {
		return share.extend.file_count
	}

	if ("file_ids" in share && Array.isArray(share.file_ids) && share.file_ids.length > 0) {
		return share.file_ids.length
	}

	return 1
}

/**
 * Loads display_config for single-file shares so special file types use the same copy branch as PC.
 */
async function fetchFileDisplayConfig(
	fileIds?: string[],
): Promise<{ type?: string; [key: string]: unknown } | undefined> {
	if (!fileIds || fileIds.length !== 1) {
		return undefined
	}

	try {
		const response = await SuperMagicApi.batchGetFileDetails({ file_ids: fileIds })
		return response?.files?.[0]?.display_config
	} catch (error) {
		console.error("Failed to fetch file details for share clipboard text:", error)
		return undefined
	}
}

/**
 * Builds the multi-line clipboard message for project/file shares, aligned with PC ShareSuccessModal.
 */
export async function buildShareClipboardText({
	share,
	projectName,
	t,
}: BuildShareClipboardTextParams): Promise<string> {
	const shareUrl = generateShareUrl(share.resource_id, share.password, "files")
	const fileIds = "file_ids" in share && Array.isArray(share.file_ids) ? share.file_ids : undefined
	const fileDisplayConfig = await fetchFileDisplayConfig(fileIds)

	return generateShareMessageText({
		fileCount: resolveFileCount(share),
		mainFileName: share.main_file_name || share.title || t("share.untitled"),
		shareName: share.title,
		projectName: share.project_name || projectName,
		shareProject: isWholeProjectShare(share),
		shareUrl,
		fileDisplayConfig,
		t,
	})
}
