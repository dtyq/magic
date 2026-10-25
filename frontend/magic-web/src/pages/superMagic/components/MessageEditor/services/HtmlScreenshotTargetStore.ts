import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	MentionItemType,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"

const LEGACY_META_STORAGE_KEY = "html-screenshot-targets:v1"

type MentionListener = () => void

const mentions = new Map<string, TiptapMentionAttributes>()
const listeners = new Map<string, Set<MentionListener>>()

function removeLegacyPersistedMeta() {
	try {
		localStorage.removeItem(LEGACY_META_STORAGE_KEY)
	} catch {
		// Ignore storage access errors in tests or private mode.
	}
}

removeLegacyPersistedMeta()

function notify(captureId: string) {
	listeners.get(captureId)?.forEach((listener) => listener())
}

const DEFAULT_SCREENSHOT_FILE_NAME = "html-screenshot.png"

export function getHtmlScreenshotStorageId(mention: TiptapMentionAttributes): string | undefined {
	if (mention.type !== MentionItemType.UPLOAD_FILE) return undefined
	const data = mention.data as UploadFileMentionData
	return data.storage_id || (data.is_html_screenshot ? data.file_path : undefined)
}

/** Rebuild a local mention from the capture id stored on a node. */
export function createLocalScreenshotMention(captureId: string): TiptapMentionAttributes {
	return {
		type: MentionItemType.UPLOAD_FILE,
		data: {
			file_id: captureId,
			file_name: DEFAULT_SCREENSHOT_FILE_NAME,
			file_path: captureId,
			file_extension: "png",
			is_hidden: true,
			is_html_screenshot: true,
			storage_id: captureId,
			upload_status: "done",
		},
	}
}

/** Remember a prepared screenshot mention for one capture. */
export function setHtmlScreenshotMention(captureId: string, mention: TiptapMentionAttributes) {
	mentions.set(captureId, mention)
	notify(captureId)
}

export function getHtmlScreenshotMention(captureId: string): TiptapMentionAttributes | undefined {
	return mentions.get(captureId)
}

export function subscribeHtmlScreenshotTarget(captureId: string, listener: MentionListener) {
	const set = listeners.get(captureId) ?? new Set<MentionListener>()
	set.add(listener)
	listeners.set(captureId, set)
	return () => {
		const current = listeners.get(captureId)
		if (!current) return
		current.delete(listener)
		if (current.size === 0) listeners.delete(captureId)
	}
}

export function forgetHtmlScreenshotTarget(captureId: string) {
	mentions.delete(captureId)
	notify(captureId)
}

export function forgetHtmlScreenshotByStorageId(storageId: string) {
	for (const [captureId, mention] of mentions) {
		if (getHtmlScreenshotStorageId(mention) === storageId) {
			forgetHtmlScreenshotTarget(captureId)
			return
		}
	}
}

/** Test-only: drop memory so the next get cannot hydrate a mention. */
export function clearHtmlScreenshotMentionMemory() {
	mentions.clear()
}

/** Test-only reset for in-memory target mentions. */
export function resetHtmlScreenshotTargetStore() {
	mentions.clear()
	listeners.clear()
	removeLegacyPersistedMeta()
}
