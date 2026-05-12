import type { UploadFileResponse, VideoInputMode } from "../../types.magic"
import { removeMentionFromString } from "../MessageEditor/tiptap/contentUtils"
import type { VideoModeInputDraft, VideoReferenceAssetInfo } from "./video-editor-config.types"

export function cloneFrameSlotInfos(
	frames?: Array<UploadFileResponse | undefined>,
): Array<UploadFileResponse | undefined> {
	return (frames || []).map((item) => (item ? { ...item } : item))
}

export function cloneVideoReferenceAssetInfos(
	infos?: VideoReferenceAssetInfo[],
): VideoReferenceAssetInfo[] {
	return (infos || []).map((item) => ({ ...item }))
}

/**
 * 同步参考素材变更时的 prompt 字符串：仅移除不再存在的 @；
 * 新增参考的 @ 由编辑器 insertMentionItems 插入。
 */
export function computeReferencePromptSync(
	prompt: string,
	prevRefs: VideoReferenceAssetInfo[],
	nextRefs: VideoReferenceAssetInfo[],
): { nextPrompt: string; refsToInsertMentions: VideoReferenceAssetInfo[] } {
	const nextPaths = new Set(nextRefs.map((r) => r.path))
	let nextPrompt = prompt
	for (const ref of prevRefs) {
		if (!nextPaths.has(ref.path)) {
			nextPrompt = removeMentionFromString(nextPrompt, ref.path, ref.fileName)
		}
	}
	const prevPaths = new Set(prevRefs.map((r) => r.path))
	const refsToInsertMentions = nextRefs.filter((ref) => !prevPaths.has(ref.path))
	return { nextPrompt, refsToInsertMentions }
}

export function cloneModeDraftCache(
	src: Partial<Record<VideoInputMode, VideoModeInputDraft>>,
): Partial<Record<VideoInputMode, VideoModeInputDraft>> {
	const out: Partial<Record<VideoInputMode, VideoModeInputDraft>> = {}
	for (const mode of [
		"standard",
		"keyframe_guided",
		"image_reference",
		"omni_reference",
		"video_edit",
	] as const) {
		const draft = src[mode]
		if (!draft) continue
		out[mode] = {
			prompt: draft.prompt ?? "",
			activeInputTab: draft.activeInputTab ?? "frame",
			frameImageInfos: cloneFrameSlotInfos(draft.frameImageInfos),
			referenceAssetInfos: cloneVideoReferenceAssetInfos(draft.referenceAssetInfos),
		}
	}
	return out
}

/** 将当前 UI 状态合并进各模式草稿（用于持久化到画布元素与 storage） */
export function mergeCurrentUiIntoModeDraftCache(
	base: Partial<Record<VideoInputMode, VideoModeInputDraft>>,
	selectedMode: VideoInputMode,
	prompt: string,
	activeInputTab: "frame" | "reference",
	frames: Array<UploadFileResponse | undefined>,
	refs: VideoReferenceAssetInfo[],
): Partial<Record<VideoInputMode, VideoModeInputDraft>> {
	const out = cloneModeDraftCache(base)
	out[selectedMode] = {
		prompt,
		activeInputTab,
		frameImageInfos: cloneFrameSlotInfos(frames),
		referenceAssetInfos: cloneVideoReferenceAssetInfos(refs),
	}
	return out
}
