import type { AssetItem, AssetMediaType } from "@/apis"
import type {
	CanvasAssetMediaType,
	VideoInputMode,
	VideoInputModeConfig,
} from "../../../../public/magic-types"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"
import type { CanvasAssetImportResult } from "../../../../runtime/resources/asset/CanvasAssetImportManager"
import {
	countVideoReferenceAssetInfosByKind,
	validateReferenceAssetAdditionsByCounts,
} from "../../../../runtime/media-editors/video/reference-asset-limits"
import { areCanvasResourceReferencesSame } from "../../../../runtime/shared/path/canvasResourcePath"
import type {
	VideoEditorConfig,
	VideoInputSlotInfo,
	VideoReferenceAssetKind,
} from "./video-editor-config.types"
import { resolveLinkedFrameRoleForSlotIndex } from "./linkedFrameBindings"

interface VideoAssetMediaCapabilities {
	image: boolean
	video: boolean
	audio: boolean
}

export interface VideoAssetMediaTypes {
	assetMediaTypes: AssetMediaType[]
	canvasMediaTypes: CanvasAssetMediaType[]
}

type AssetSelectionHandlers = Pick<
	VideoEditorConfig["handlers"],
	"replaceFrameImageAt" | "replaceReferenceImageAt" | "setLinkedFrameBindings"
>

const ASSET_MEDIA_TYPE_BY_KIND: Record<VideoReferenceAssetKind, AssetMediaType> = {
	image: "IMAGE",
	video: "VIDEO",
	audio: "AUDIO",
}

const REFERENCE_KIND_BY_ASSET_MEDIA_TYPE: Record<AssetMediaType, VideoReferenceAssetKind> = {
	IMAGE: "image",
	VIDEO: "video",
	AUDIO: "audio",
}

/**
 * Validate an entire asset-library confirmation before any Canvas work starts.
 * The picker has one total `maxCount`, while video models can additionally
 * constrain each media kind and variant. Incremental checks preserve drafts
 * that are not yet complete, but reject batches that can no longer fit a
 * legal variant.
 */
export function validateVideoAssetSelection(options: {
	slot: VideoInputSlotInfo
	assets: readonly Pick<AssetItem, "asset_id" | "asset_media_type">[]
	allowedMediaTypes: readonly AssetMediaType[]
	currentReferenceAssets: readonly { path: string; assetType: VideoReferenceAssetKind }[]
	inputMode: VideoInputMode
	modeConfig?: VideoInputModeConfig
	resolveResourceReference?: ResolveCanvasResourceReference
}): string | null {
	if (options.assets.length === 0) return "At least one asset must be selected"

	const allowedMediaTypes = new Set(options.allowedMediaTypes)
	for (const asset of options.assets) {
		if (!asset.asset_id.trim()) return "Selected asset is invalid"
		if (!asset.asset_media_type || !allowedMediaTypes.has(asset.asset_media_type)) {
			return "Selected asset media type is not supported by this video input"
		}
	}

	if (options.slot.inputTab === "frame") {
		if (options.assets.length !== 1) return "A frame slot accepts only one image asset"
		return options.assets[0]?.asset_media_type === "IMAGE"
			? null
			: "A frame slot accepts only one image asset"
	}

	let counts = countVideoReferenceAssetInfosByKind(options.currentReferenceAssets)
	const replacedPath = options.slot.path
	if (replacedPath) {
		const replacedIndex = options.currentReferenceAssets.findIndex((info) =>
			areCanvasResourceReferencesSame(
				info.path,
				replacedPath,
				options.resolveResourceReference,
			),
		)
		if (replacedIndex >= 0) {
			const replacedKind =
				options.currentReferenceAssets[replacedIndex]?.assetType ??
				options.slot.referenceAssetKind
			if (replacedKind === "image") counts = { ...counts, images: counts.images - 1 }
			if (replacedKind === "video") counts = { ...counts, videos: counts.videos - 1 }
			if (replacedKind === "audio") counts = { ...counts, audios: counts.audios - 1 }
		} else {
			// A linked slot can be represented by the connection controller rather
			// than the manual reference array. Its explicit single kind still
			// identifies the one count that this replacement frees.
			const fallbackKind =
				options.slot.referenceAssetKind ??
				(options.slot.referenceAssetKinds?.length === 1
					? options.slot.referenceAssetKinds[0]
					: undefined)
			if (fallbackKind === "image" && counts.images > 0)
				counts = { ...counts, images: counts.images - 1 }
			if (fallbackKind === "video" && counts.videos > 0)
				counts = { ...counts, videos: counts.videos - 1 }
			if (fallbackKind === "audio" && counts.audios > 0)
				counts = { ...counts, audios: counts.audios - 1 }
		}
	}

	const seenAssetIds = new Set<string>()
	const additions: VideoReferenceAssetKind[] = []
	for (const asset of options.assets) {
		const assetId = asset.asset_id.trim()
		if (!assetId || seenAssetIds.has(assetId)) continue
		seenAssetIds.add(assetId)
		const mediaType = asset.asset_media_type
		if (!mediaType) continue
		additions.push(REFERENCE_KIND_BY_ASSET_MEDIA_TYPE[mediaType])
	}
	if (
		!validateReferenceAssetAdditionsByCounts(options.modeConfig, counts, additions, {
			ignoreModeMaxCountForTotal: options.inputMode === "omni_reference",
		})
	) {
		return "Selected assets exceed the current video reference limits"
	}

	return null
}

/** 将当前视频槽位的模型约束转换为素材查询及 Canvas 导入共用类型。 */
export function resolveVideoAssetMediaTypes(
	slot: VideoInputSlotInfo,
	capabilities: VideoAssetMediaCapabilities,
): VideoAssetMediaTypes {
	if (slot.inputTab === "frame") {
		return { assetMediaTypes: ["IMAGE"], canvasMediaTypes: ["image"] }
	}

	const configuredKinds = slot.referenceAssetKinds?.length
		? slot.referenceAssetKinds
		: slot.referenceAssetKind
			? [slot.referenceAssetKind]
			: undefined
	const kinds =
		configuredKinds ??
		([
			...(capabilities.image ? (["image"] as const) : []),
			...(capabilities.video ? (["video"] as const) : []),
			...(capabilities.audio ? (["audio"] as const) : []),
		] satisfies VideoReferenceAssetKind[])
	const canvasMediaTypes = Array.from(new Set(kinds))
	return {
		canvasMediaTypes,
		assetMediaTypes: canvasMediaTypes.map((kind) => ASSET_MEDIA_TYPE_BY_KIND[kind]),
	}
}

/** 将已导入并连线的素材写入用户打开弹窗时捕获的视频编辑器槽位。 */
export function applyImportedAssetToVideoSlot(options: {
	slot: VideoInputSlotInfo
	imported: CanvasAssetImportResult
	supportsStartFrame: boolean
	supportsEndFrame: boolean
	retainResourceSlot?: boolean
	handlers: AssetSelectionHandlers
}): void {
	const { slot, imported, handlers, retainResourceSlot = false } = options
	const fileInfo = {
		path: imported.workspacePath,
		src: imported.workspacePath,
		fileName: imported.fileName,
	}

	if (slot.inputTab === "reference") {
		const importedFileInfo = {
			...fileInfo,
			assetType: imported.mediaType,
		}
		// 素材库确认属于一次显式选择；资源列表仍去重，但 Prompt 允许追加多个 mention。
		handlers.replaceReferenceImageAt(
			slot.slotIndex,
			importedFileInfo,
			retainResourceSlot
				? { ensurePromptMention: true, retainResourceSlot: true }
				: { ensurePromptMention: true },
		)
		return
	}

	handlers.replaceFrameImageAt(slot.slotIndex, fileInfo)
	const frameRole = resolveLinkedFrameRoleForSlotIndex(
		slot.slotIndex,
		options.supportsStartFrame,
		options.supportsEndFrame,
	)
	handlers.setLinkedFrameBindings((previous) => {
		const next = [...previous]
		next[slot.slotIndex] = {
			framePath: imported.workspacePath,
			sourceConnectionId: imported.connectionId,
			sourcePath: imported.workspacePath,
			sourceKind: "image",
			sourceFileName: imported.fileName,
			frameRole,
		}
		return next
	})
}
