import type { AudioRecordingCardStatus } from "@/types/audioProject"
import type { AudioAttachmentNode } from "./find-audio-entry-file"
import { findAudioEntryFile } from "./find-audio-entry-file"
import { findRawAudioFile } from "./find-raw-audio-file"

export type AudioPreviewTarget =
	| { kind: "html"; file: AudioAttachmentNode }
	| { kind: "raw-audio"; file: AudioAttachmentNode }

export type AudioPreviewMissingKind = "html-entry" | "raw-audio"

/**
 * Resolves which file to open in Detail based on list card status.
 * Summarized items use bundled HTML; pending/in-progress summary items use raw audio only.
 */
export function resolveAudioPreviewTarget(options: {
	cardStatus: AudioRecordingCardStatus
	audioFileId?: string
	tree: AudioAttachmentNode[]
	list: AudioAttachmentNode[]
}): AudioPreviewTarget | null {
	const { cardStatus, audioFileId, tree, list } = options

	if (cardStatus === "summarized") {
		const entry = findAudioEntryFile(tree)
		return entry ? { kind: "html", file: entry } : null
	}

	if (cardStatus === "not_summarized" || cardStatus === "summarizing") {
		const file = findRawAudioFile(list, audioFileId)
		return file ? { kind: "raw-audio", file } : null
	}

	return null
}

/**
 * Resolves preview target when route state is missing (direct URL access).
 * Tries HTML entry first, then raw audio scan as a defensive fallback.
 */
export function resolveAudioPreviewTargetWithFallback(options: {
	cardStatus?: AudioRecordingCardStatus
	audioFileId?: string
	tree: AudioAttachmentNode[]
	list: AudioAttachmentNode[]
}): { target: AudioPreviewTarget | null; missingKind: AudioPreviewMissingKind | null } {
	const status = options.cardStatus ?? "summarized"

	if (status === "not_summarized" || status === "summarizing") {
		const file = findRawAudioFile(options.list, options.audioFileId)
		return file
			? { target: { kind: "raw-audio", file }, missingKind: null }
			: { target: null, missingKind: "raw-audio" }
	}

	const htmlEntry = findAudioEntryFile(options.tree)
	if (htmlEntry) {
		return { target: { kind: "html", file: htmlEntry }, missingKind: null }
	}

	const rawFallback = findRawAudioFile(options.list, options.audioFileId)
	if (rawFallback) {
		return { target: { kind: "raw-audio", file: rawFallback }, missingKind: null }
	}

	return { target: null, missingKind: "html-entry" }
}
