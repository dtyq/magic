import type {
	UploadFileResponse,
	VideoInputMode,
	VideoInputModeConfig,
} from "../../../../../public/magic-types"
import type { ResolveCanvasResourceReference } from "../../../../../public/resource-reference"
import { canAddReferenceAsset } from "../../../../../runtime/media-editors/video/reference-asset-limits"
import {
	getCanvasResourceFileName,
	getCanvasResourceReferenceIdentity,
} from "../../../../../runtime/shared/path/canvasResourcePath"
import {
	appendMentionToString,
	promptContainsMentionForFile,
	removeMentionFromString,
} from "../../../../editors/message/tiptap/contentUtils"
import type {
	LinkedFrameBinding,
	VideoModeInputDraft,
	VideoReferenceAssetInfo,
} from "../video-editor-config.types"

export type QuickEditSourceProjectionReason = "unsupported-mode" | "capacity"

export interface QuickEditSourceProjectionResult {
	draft: VideoModeInputDraft
	applied: boolean
	reason?: QuickEditSourceProjectionReason
}

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

export function cloneLinkedFrameBindings(
	bindings?: Array<LinkedFrameBinding | undefined>,
): Array<LinkedFrameBinding | undefined> {
	return (bindings || []).map((binding) => (binding ? { ...binding } : binding))
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
			linkedFrameBindings: cloneLinkedFrameBindings(draft.linkedFrameBindings),
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
	linkedFrameBindings: Array<LinkedFrameBinding | undefined>,
): Partial<Record<VideoInputMode, VideoModeInputDraft>> {
	const out = cloneModeDraftCache(base)
	out[selectedMode] = {
		prompt,
		activeInputTab,
		frameImageInfos: cloneFrameSlotInfos(frames),
		linkedFrameBindings: cloneLinkedFrameBindings(linkedFrameBindings),
		referenceAssetInfos: cloneVideoReferenceAssetInfos(refs),
	}
	return out
}

/**
 * 快捷编辑的源视频属于整个编辑会话，不属于某个 input_mode。
 * 切换模式时，仅把源视频投影到支持 reference_videos 的目标草稿中，
 * 保留目标模式已有的提示词和其他素材；容量不足时返回原因，避免静默丢素材。
 */
export function projectQuickEditSourceIntoModeDraft(options: {
	draft: VideoModeInputDraft
	source: VideoReferenceAssetInfo | null | undefined
	inputMode: VideoInputMode
	modeConfig: VideoInputModeConfig | undefined
	resolveResourceReference?: ResolveCanvasResourceReference
}): QuickEditSourceProjectionResult {
	const { draft, source, inputMode, modeConfig, resolveResourceReference } = options
	const clonedDraft: VideoModeInputDraft = {
		prompt: draft.prompt ?? "",
		activeInputTab: draft.activeInputTab ?? "frame",
		frameImageInfos: cloneFrameSlotInfos(draft.frameImageInfos),
		linkedFrameBindings: cloneLinkedFrameBindings(draft.linkedFrameBindings),
		referenceAssetInfos: cloneVideoReferenceAssetInfos(draft.referenceAssetInfos),
	}
	if (!source) return { draft: clonedDraft, applied: false }
	if (!modeConfig?.supported_fields?.includes("reference_videos")) {
		return { draft: clonedDraft, applied: false, reason: "unsupported-mode" }
	}

	const sourceFileName = source.fileName || getCanvasResourceFileName(source.path)
	const normalizedSource = sourceFileName ? { ...source, fileName: sourceFileName } : source
	const sourceIdentity = getCanvasResourceReferenceIdentity(
		normalizedSource.path,
		resolveResourceReference,
	)
	const referenceAssetInfos = clonedDraft.referenceAssetInfos ?? []
	const existingIndex = referenceAssetInfos.findIndex(
		(info) =>
			getCanvasResourceReferenceIdentity(info.path, resolveResourceReference) ===
			sourceIdentity,
	)

	if (existingIndex < 0) {
		if (
			!canAddReferenceAsset(modeConfig, referenceAssetInfos, "video", {
				ignoreModeMaxCountForTotal: inputMode === "omni_reference",
			})
		) {
			return { draft: clonedDraft, applied: false, reason: "capacity" }
		}
		referenceAssetInfos.unshift({ ...normalizedSource, assetType: "video" })
	} else {
		const existingInfo = referenceAssetInfos[existingIndex] ?? normalizedSource
		referenceAssetInfos[existingIndex] = {
			...existingInfo,
			...normalizedSource,
			assetType: "video",
		}
	}

	const prompt = clonedDraft.prompt ?? ""
	return {
		draft: {
			...clonedDraft,
			prompt: promptContainsMentionForFile(prompt, normalizedSource.fileName)
				? prompt
				: appendMentionToString(prompt, normalizedSource.path, normalizedSource.fileName),
			activeInputTab: "reference",
			referenceAssetInfos,
		},
		applied: true,
	}
}

/** 显式移除源视频时同步清理所有模式草稿，避免切回旧模式后再次出现。 */
export function removeQuickEditSourceFromModeDraftCache(
	base: Partial<Record<VideoInputMode, VideoModeInputDraft>>,
	source: VideoReferenceAssetInfo | null | undefined,
	resolveResourceReference?: ResolveCanvasResourceReference,
): Partial<Record<VideoInputMode, VideoModeInputDraft>> {
	const out = cloneModeDraftCache(base)
	if (!source) return out
	const sourceIdentity = getCanvasResourceReferenceIdentity(source.path, resolveResourceReference)

	for (const draft of Object.values(out)) {
		if (!draft) continue
		draft.referenceAssetInfos = (draft.referenceAssetInfos ?? []).filter(
			(info) =>
				getCanvasResourceReferenceIdentity(info.path, resolveResourceReference) !==
				sourceIdentity,
		)
		draft.prompt = removeMentionFromString(draft.prompt ?? "", source.path, source.fileName)
	}
	return out
}

/** 源视频被替换时同步更新已投影过的模式草稿，避免旧路径在新会话中复活。 */
export function replaceQuickEditSourceInModeDraftCache(
	base: Partial<Record<VideoInputMode, VideoModeInputDraft>>,
	previousSource: VideoReferenceAssetInfo,
	nextSource: VideoReferenceAssetInfo,
	resolveResourceReference?: ResolveCanvasResourceReference,
): Partial<Record<VideoInputMode, VideoModeInputDraft>> {
	const out = cloneModeDraftCache(base)
	const previousIdentity = getCanvasResourceReferenceIdentity(
		previousSource.path,
		resolveResourceReference,
	)

	for (const draft of Object.values(out)) {
		if (!draft) continue
		const referenceAssetInfos = draft.referenceAssetInfos ?? []
		const hadPreviousReference = referenceAssetInfos.some(
			(info) =>
				getCanvasResourceReferenceIdentity(info.path, resolveResourceReference) ===
				previousIdentity,
		)
		const hadPreviousMention = promptContainsMentionForFile(
			draft.prompt ?? "",
			previousSource.fileName,
		)
		if (!hadPreviousReference && !hadPreviousMention) continue

		draft.referenceAssetInfos = referenceAssetInfos.map((info) =>
			getCanvasResourceReferenceIdentity(info.path, resolveResourceReference) ===
			previousIdentity
				? { ...nextSource, assetType: "video" }
				: info,
		)
		draft.prompt = appendMentionToString(
			removeMentionFromString(
				draft.prompt ?? "",
				previousSource.path,
				previousSource.fileName,
			),
			nextSource.path,
			nextSource.fileName,
		)
	}
	return out
}
