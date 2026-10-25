import i18n from "i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { flushFileSaves, getFileSaveQueue } from "./FileSaveQueue"

const BLOCKED_TOAST_KEY = "file-save-blocked"

/**
 * Flush pending saves before an action that reads remote content. When a save
 * failed, tell the user why the action stopped and bring back the recovery
 * actions they may have dismissed.
 */
export async function ensureFileSavesSynced(fileIds?: string[]): Promise<boolean> {
	if (await flushFileSaves(fileIds)) return true
	const queue = getFileSaveQueue()
	queue
		.getFailedFileIds()
		.filter((fileId) => !fileIds?.length || fileIds.includes(fileId))
		.forEach((fileId) => queue.revealFailure(fileId))
	magicToast.warning({
		key: BLOCKED_TOAST_KEY,
		content: i18n.t("detail.fileSave.blocked", { ns: "super" }),
	})
	return false
}
