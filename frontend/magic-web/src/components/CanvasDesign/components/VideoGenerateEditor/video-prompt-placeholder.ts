import type { VideoInputMode } from "../../types.magic"
import {
	createPromptPlaceholderTokenFactory,
	type PromptPlaceholderTokenConfig,
	resolvePromptPlaceholderDecodeLabels,
} from "../MessageEditor/reference-assets/promptPlaceholderTokenConfig"
import {
	decodePromptPlaceholdersToMentions,
	encodePromptMentionsToPlaceholders,
	type PromptPlaceholderReference,
} from "../MessageEditor/reference-assets/promptPlaceholderCodec"
import type { VideoReferenceAssetInfo, VideoReferenceAssetKind } from "./video-editor-config.types"

interface VideoPromptPlaceholderReference extends PromptPlaceholderReference {
	assetType: VideoReferenceAssetKind
	assetTypeIndex: number
	legacyAssetIndex: number
}

interface VideoPromptPlaceholderModeConfig {
	resolveReferences: (params: {
		referenceImageInfos: VideoReferenceAssetInfo[]
	}) => VideoPromptPlaceholderReference[]
}

function buildTypedPromptReferences(
	referenceImageInfos: VideoReferenceAssetInfo[],
): VideoPromptPlaceholderReference[] {
	const assetTypeCounter: Record<VideoReferenceAssetKind, number> = {
		image: 0,
		video: 0,
		audio: 0,
	}
	return referenceImageInfos.map((info, index) => {
		assetTypeCounter[info.assetType] += 1
		return {
			path: info.path,
			fileName: info.fileName,
			assetType: info.assetType,
			assetTypeIndex: assetTypeCounter[info.assetType],
			legacyAssetIndex: index + 1,
		}
	})
}

const VIDEO_PROMPT_PLACEHOLDER_MODE_CONFIG: Record<
	VideoInputMode,
	VideoPromptPlaceholderModeConfig
> = {
	standard: {
		resolveReferences: () => [],
	},
	keyframe_guided: {
		// 首尾帧来自模式输入，不是 prompt mention 绑定来源。
		resolveReferences: () => [],
	},
	image_reference: {
		resolveReferences: ({ referenceImageInfos }) =>
			buildTypedPromptReferences(
				referenceImageInfos.filter((info) => info.assetType === "image"),
			),
	},
	omni_reference: {
		resolveReferences: ({ referenceImageInfos }) =>
			buildTypedPromptReferences(referenceImageInfos),
	},
	video_edit: {
		resolveReferences: ({ referenceImageInfos }) =>
			buildTypedPromptReferences(referenceImageInfos),
	},
}

function resolveTokenLabelByAssetType(
	assetType: VideoReferenceAssetKind,
	config: PromptPlaceholderTokenConfig,
): string {
	if (assetType === "image") {
		return config.imageLabel
	}
	if (assetType === "video") {
		return config.videoLabel
	}
	if (assetType === "audio") {
		return config.audioLabel
	}
	return config.imageLabel
}

function resolveDecodeLabelsByAssetType(
	assetType: VideoReferenceAssetKind,
	config: PromptPlaceholderTokenConfig,
): string[] {
	if (assetType === "image") {
		return resolvePromptPlaceholderDecodeLabels("image", config)
	}
	if (assetType === "video") {
		return resolvePromptPlaceholderDecodeLabels("video", config)
	}
	return resolvePromptPlaceholderDecodeLabels("audio", config)
}

export function encodeVideoPromptMentionsToPlaceholders(
	prompt: string,
	references: VideoPromptPlaceholderReference[],
	config: PromptPlaceholderTokenConfig,
): string {
	if (!prompt || references.length === 0) return prompt
	let encoded = prompt
	for (const reference of references) {
		const tokenFactory = createPromptPlaceholderTokenFactory(
			resolveTokenLabelByAssetType(reference.assetType, config),
			config,
		)
		encoded = encodePromptMentionsToPlaceholders(encoded, [reference], {
			buildToken: () => tokenFactory(reference.assetTypeIndex),
		})
	}
	return encoded
}

export function decodeVideoPromptPlaceholdersToMentions(
	prompt: string,
	references: VideoPromptPlaceholderReference[],
	mode: VideoInputMode,
	config: PromptPlaceholderTokenConfig,
) {
	void mode
	if (!prompt || references.length === 0) return prompt

	let decoded = prompt

	for (const reference of references) {
		const labels = resolveDecodeLabelsByAssetType(reference.assetType, config)
		for (const label of labels) {
			const tokenFactory = createPromptPlaceholderTokenFactory(label, config)
			decoded = decodePromptPlaceholdersToMentions(decoded, [reference], {
				buildToken: () => tokenFactory(reference.assetTypeIndex),
			})
		}
	}

	return decoded
}

export function shouldUseVideoPromptPlaceholders(mode: VideoInputMode): boolean {
	return mode === "image_reference" || mode === "omni_reference" || mode === "video_edit"
}

export function resolveVideoPromptPlaceholderReferences(params: {
	mode: VideoInputMode
	referenceImageInfos: VideoReferenceAssetInfo[]
}): VideoPromptPlaceholderReference[] {
	const { mode, referenceImageInfos } = params
	if (!shouldUseVideoPromptPlaceholders(mode)) return []
	return VIDEO_PROMPT_PLACEHOLDER_MODE_CONFIG[mode].resolveReferences({
		referenceImageInfos,
	})
}
