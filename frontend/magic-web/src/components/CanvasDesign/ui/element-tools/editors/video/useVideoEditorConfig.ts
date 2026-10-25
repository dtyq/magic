import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useUnmount, useUpdateEffect } from "ahooks"
import { toast } from "sonner"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import type {
	DefaultGenerateVideoConfig,
	GenerateVideoRequest,
	UploadFileResponse,
	VideoGenerationConstraints,
	VideoInputMode,
} from "../../../../public/magic-types"
import { VideoElement as VideoElementClass } from "../../../../runtime/elements/video/VideoElement"
import { getActiveContent } from "../../../../runtime/document/elementContent"
import {
	areCanvasResourceReferencesSame,
	getCanvasResourceFileName,
	getCanvasResourceReferenceIdentity,
} from "../../../../runtime/shared/path/canvasResourcePath"
import { useFileInput } from "../../../editors/message/useFileInput"
import { CanvasUploadMentionController } from "../../../editors/message/CanvasUploadMentionController"
import type { CanvasUploadMentionHandle } from "../../../editors/message/CanvasUploadMentionController"
import {
	removeMentionFromString,
	appendMentionToString,
	areMentionPathBindingsEqual,
	type MentionPathBinding,
} from "../../../editors/message/tiptap/contentUtils"
import {
	resolvePromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenConfig,
} from "../../../editors/message/reference-assets/promptPlaceholderTokenConfig"
import {
	areOrderedPathsEqual,
	pruneProtectedReferencePaths,
	reconcileProtectedReferencePaths,
	resolveReferenceBindingState,
	unprotectPromptBoundReferencePaths,
	type ReferenceBindingMode,
} from "../../../editors/message/reference-assets/referenceBinding"
import { createReferenceResourcePanelItemFromPath } from "../../../editors/message/reference-assets/createReferenceResourcePanelItem"
import type { ReferenceResourceType } from "../../../editors/message/reference-assets/reference-resource.types"
import { classifyReferenceAssetFile } from "../../../editors/message/reference-assets/referenceResourceSelection"
import type { ReferenceResourceMetadataCandidate } from "../../../editors/message/reference-assets/referenceResourceDescriptor"
import {
	cloneFrameSlotInfos,
	cloneLinkedFrameBindings,
	cloneModeDraftCache,
	cloneVideoReferenceAssetInfos,
	mergeCurrentUiIntoModeDraftCache,
	projectQuickEditSourceIntoModeDraft,
	removeQuickEditSourceFromModeDraftCache,
	replaceQuickEditSourceInModeDraftCache,
} from "./draft/video-editor-config.draft"
import {
	buildVideoAspectRatioOptions,
	buildVideoDurationOptions,
	buildVideoResolutionOptions,
	getVideoDurationConfig,
	intersectVideoGenerationConstraints,
	resolveDraftVideoGenerationConstraints,
	resolveVideoDefaultDuration,
	resolveVideoGenerationSelection,
	resolveVideoGenerationSelectionPreserving,
	resolveRestoredVideoResolution,
} from "./generation/video-editor-config.generation"
import {
	buildFrameInputs,
	buildFrameSlotInfos,
	buildReferenceAssetInfos,
	buildReferenceAssetInputs,
	canAddReferenceAsset,
	canReplaceReferenceAssetByCounts,
	clampReferenceAssetsToLimits,
	countReferenceAssets,
	getAvailableInputModes,
	getAvailableInputTabs,
	getDefaultInputTab,
	getInputModeConfig,
	getMaxFrameCount,
	getMaxReferenceImageCount,
	resolveReferenceAssetLimits,
	resolveVideoFrameRoleSupport,
	getRequestInputTab,
	hasVideoInputs,
	isReferenceAssetTypeAllowed,
	resolveInputModeForAvailableModes,
	resolveInputModeFromRequest,
	resolveSelectableInputModeForAvailableModes,
	resolveInputSubTabForAvailableTabs,
	resolveVideoReferenceAssetInfo,
	resolveVideoReferenceVideoModel,
} from "./model-config/video-editor-config.model"
import type {
	LinkedFrameBinding,
	VideoEditSessionSnapshot,
	VideoEditorConfig,
	VideoInputSlotInfo,
	VideoModelOption,
	VideoModelOptionGroup,
	VideoModeInputDraft,
	VideoReferenceAssetKind,
	VideoReferenceAssetInfo,
	UseVideoEditorConfigOptions,
} from "./video-editor-config.types"
import { buildMediaEditSourceFingerprint } from "../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"
import { persistVideoEditorDraft } from "../../../../runtime/interaction/media-edit-recovery/videoEditorDraftPersistence"
import {
	decodeVideoPromptPlaceholdersToMentions,
	encodeVideoPromptMentionsToPlaceholders,
	resolveVideoPromptPlaceholderReferences,
} from "./prompt-placeholders/video-prompt-placeholder"
import { createCanvasMentionPathMatcher } from "../../../editors/connection/linkedMediaMentionMatcher"
import type { MessageEditorMentionChangeContext } from "../../../editors/message/MessageEditor"

export type { VideoEditorConfig } from "./video-editor-config.types"

function mergeVideoGenerationConstraints(
	modeConstraints?: VideoGenerationConstraints,
	variantConstraints?: VideoGenerationConstraints,
): VideoGenerationConstraints | undefined {
	const resolutions =
		variantConstraints?.resolutions !== undefined
			? variantConstraints.resolutions
			: modeConstraints?.resolutions
	const aspectRatios =
		variantConstraints?.aspect_ratios !== undefined
			? variantConstraints.aspect_ratios
			: modeConstraints?.aspect_ratios
	const durations =
		variantConstraints?.durations !== undefined
			? variantConstraints.durations
			: modeConstraints?.durations
	const sizes =
		variantConstraints?.sizes !== undefined ? variantConstraints.sizes : modeConstraints?.sizes

	if (
		resolutions === undefined &&
		aspectRatios === undefined &&
		durations === undefined &&
		sizes === undefined
	) {
		return undefined
	}

	return {
		resolutions,
		aspect_ratios: aspectRatios,
		durations,
		sizes,
	}
}

type StoredQuickEditSource = UploadFileResponse & { assetType: "video" }

function cloneQuickEditSource(
	source: VideoReferenceAssetInfo | null | undefined,
): StoredQuickEditSource | null {
	return source ? { ...source, assetType: "video" } : null
}

export function useVideoEditorConfig(options: UseVideoEditorConfigOptions): VideoEditorConfig {
	const {
		videoElement,
		messageEditorRef,
		restoreOnMount = "preferDraft",
		sessionSnapshot,
		manageRecoverySession = true,
		recoveryIntent = "generate",
		syncElementSize = true,
		getAdditionalReferenceAssetInfos,
	} = options
	const { t } = useCanvasDesignI18n()
	const { videoModelList, isLoadingVideoModelList, methods } = useMagic()
	const { canvas } = useCanvas()
	const activeVideoContent = getActiveContent(videoElement)
	const savedRequest = activeVideoContent?.generateVideoRequest
	const persistedEditorDraft =
		activeVideoContent?.videoEditorDraft?.version === 1
			? activeVideoContent.videoEditorDraft
			: undefined
	const resolveResourceReference = methods?.resolveResourceReference
	const activeVideoContentId = activeVideoContent?.contentId
	const recoveryKey = useMemo(
		() =>
			manageRecoverySession && activeVideoContentId
				? {
						elementId: videoElement.id,
						contentId: activeVideoContentId,
						intent: recoveryIntent,
					}
				: null,
		[activeVideoContentId, manageRecoverySession, recoveryIntent, videoElement.id],
	)
	const recoverySourceFingerprint = activeVideoContent
		? buildMediaEditSourceFingerprint(activeVideoContent.contentId, activeVideoContent.src)
		: ""

	const [selectedModelId, setSelectedModelId] = useState("")
	const [selectedInputMode, setSelectedInputMode] = useState<VideoInputMode>("standard")
	const [prompt, setPrompt] = useState("")
	const promptPlaceholderTokenConfig = useMemo<PromptPlaceholderTokenConfig>(
		() => resolvePromptPlaceholderTokenConfig(t),
		[t],
	)

	const selectRefsMissingMentions = useCallback(
		(promptText: string, refs: VideoReferenceAssetInfo[]) => {
			const escapeRegex = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
			const availableCountByName = new Map<string, number>()
			const consumedCountByName = new Map<string, number>()

			for (const ref of refs) {
				const name = ref.fileName || ""
				if (!name || availableCountByName.has(name)) continue
				const matches = promptText.match(new RegExp(`@${escapeRegex(name)}`, "gi"))
				availableCountByName.set(name, matches?.length ?? 0)
			}

			return refs.filter((ref) => {
				const name = ref.fileName || ""
				if (!name) return false
				const consumed = consumedCountByName.get(name) ?? 0
				const available = availableCountByName.get(name) ?? 0
				consumedCountByName.set(name, consumed + 1)
				return consumed >= available
			})
		},
		[],
	)

	const latestMentionBindingsRef = useRef<MentionPathBinding[]>([])
	const [mentionBindings, setMentionBindings] = useState<MentionPathBinding[]>([])
	const updateMentionBindings = useCallback((bindings: MentionPathBinding[]) => {
		const nextBindings = bindings.map((binding) => ({ ...binding }))
		latestMentionBindingsRef.current = nextBindings
		setMentionBindings((previous) =>
			areMentionPathBindingsEqual(previous, nextBindings) ? previous : nextBindings,
		)
	}, [])

	const scheduleReferenceMentionInserts = useCallback(
		(
			refs: VideoReferenceAssetInfo[],
			insertOpts?: { placement?: "cursor" | "documentEnd"; force?: boolean },
		) => {
			if (!refs.length || !messageEditorRef) return
			const placement = insertOpts?.placement ?? "cursor"
			setTimeout(() => {
				const editor = messageEditorRef.current
				if (!editor) return
				const latestPrompt = editor.getCurrentPrompt()
				const toInsert = insertOpts?.force
					? refs
					: selectRefsMissingMentions(latestPrompt, refs)
				if (!toInsert.length) return
				editor.insertMentionItems(
					toInsert.map((r) =>
						createReferenceResourcePanelItemFromPath(r.path, r.fileName, {
							fileId: r.file_id,
							sourceFileId: r.source_file_id,
							sourceProjectId: r.source_project_id,
							projectId: r.project_id,
							mediaType: r.assetType,
						}),
					),
					placement === "documentEnd" ? { placement: "documentEnd" } : {},
				)
			}, 0)
		},
		[messageEditorRef, selectRefsMissingMentions],
	)

	const [selectedResolution, setSelectedResolution] = useState<string | undefined>(undefined)
	const resolutionBeforeDraftRef = useRef<string | undefined>(undefined)
	const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | undefined>(undefined)
	const [selectedDurationSeconds, setSelectedDurationSeconds] = useState<number | undefined>(
		undefined,
	)
	/** Slider interaction state; unlike selectedDurationSeconds, this is not persisted/submitted. */
	const [durationDraftSeconds, setDurationDraftSeconds] = useState<number | undefined>(undefined)
	const [selectedGenerateAudio, setSelectedGenerateAudio] = useState<boolean | undefined>(
		undefined,
	)
	const [selectedWebSearch, setSelectedWebSearch] = useState<boolean | undefined>(undefined)
	const [selectedDraft, setSelectedDraft] = useState<boolean | undefined>(undefined)
	const [selectedCompressionQuality, setSelectedCompressionQuality] = useState<
		string | undefined
	>(undefined)
	const [activeInputTab, setActiveInputTab] = useState<"frame" | "reference">("frame")
	const activeInputTabRef = useRef<"frame" | "reference">(activeInputTab)
	const [frameImageInfos, setFrameImageInfos] = useState<Array<UploadFileResponse | undefined>>(
		[],
	)
	// Upload callbacks can arrive back-to-back in one promise turn. Keep the
	// latest slot state synchronously so a multi-file paste never targets the
	// same empty frame/reference slot twice before React renders again.
	const frameImageInfosRef = useRef(frameImageInfos)
	const [linkedFrameBindings, setLinkedFrameBindings] = useState<
		Array<LinkedFrameBinding | undefined>
	>([])
	const [referenceImageInfos, setReferenceImageInfos] = useState<VideoReferenceAssetInfo[]>([])
	const referenceImageInfosRef = useRef(referenceImageInfos)
	const [protectedReferencePaths, setProtectedReferencePaths] = useState<string[]>([])
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)
	const [isReferenceProjectPanelOpen, setIsReferenceProjectPanelOpen] = useState(false)
	const [selectedResourceSlot, setSelectedResourceSlot] = useState<VideoInputSlotInfo | null>(
		null,
	)
	const [uploadUiDismissed, setUploadUiDismissed] = useState(false)
	const previousReferenceMentionPromptRef = useRef<string | null>(null)

	const hasRestoredRef = useRef(false)
	const isRestoringRef = useRef(false)
	const [restoreRevision, setRestoreRevision] = useState(0)
	const popoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const draftPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingDraftRequestRef = useRef<Partial<GenerateVideoRequest> | null>(null)
	const isApplyingRestoreRef = useRef(false)
	const isRemovingReferenceImageRef = useRef(false)
	const selectedResourceSlotRef = useRef<VideoInputSlotInfo | null>(null)
	const discardPendingUploadRef = useRef(false)
	const uploadMentionController = useMemo(
		() => (messageEditorRef ? new CanvasUploadMentionController(messageEditorRef) : undefined),
		[messageEditorRef],
	)
	/** 本地上传多选：记录起始槽位，按序号连续写入 */
	const batchUploadBaseRef = useRef<{
		inputTab: "frame" | "reference"
		startSlot: number
		retainResourceSlotAfterBatch?: boolean
		isCurrent?: () => boolean
		suppressPromptMention?: boolean
		hasExistingSlot?: boolean
	} | null>(null)
	const modeDraftCacheRef = useRef<Partial<Record<VideoInputMode, VideoModeInputDraft>>>({})
	const quickEditSourceRef = useRef<VideoReferenceAssetInfo | null>(null)
	const quickEditSourceRemovedRef = useRef(false)
	const restoreModeRef = useRef<"normal" | "quickEdit">("normal")
	const sessionRestoreSnapshotRef = useRef<VideoEditSessionSnapshot | null>(
		sessionSnapshot ?? null,
	)

	const selectedModel = useMemo(() => {
		return videoModelList.find((model) => model.model_id === selectedModelId)
	}, [videoModelList, selectedModelId])

	const availableInputModes = useMemo(() => {
		return getAvailableInputModes(selectedModel)
	}, [selectedModel])
	const resolvedInputMode = useMemo(
		() => resolveSelectableInputModeForAvailableModes(availableInputModes, selectedInputMode),
		[availableInputModes, selectedInputMode],
	)
	const currentInputModeConfig = useMemo(() => {
		return getInputModeConfig(selectedModel, selectedInputMode)
	}, [selectedModel, selectedInputMode])
	const isReferencePolicyReady =
		!isLoadingVideoModelList &&
		selectedInputMode === resolvedInputMode &&
		Boolean(selectedModel && currentInputModeConfig)
	const supportedFields = currentInputModeConfig?.supported_fields || []
	const { supportsStartFrame, supportsEndFrame } = useMemo(
		() => resolveVideoFrameRoleSupport(currentInputModeConfig),
		[currentInputModeConfig],
	)
	const supportsReferenceImages = supportedFields.includes("reference_images")
	const supportsReferenceVideos = supportedFields.includes("reference_videos")
	const supportsReferenceAudios = supportedFields.includes("reference_audios")
	const supportsReferenceAssets =
		supportsReferenceImages || supportsReferenceVideos || supportsReferenceAudios
	const availableInputTabs = useMemo(
		() => getAvailableInputTabs(selectedModel, selectedInputMode),
		[selectedModel, selectedInputMode],
	)
	const referenceResourceType: ReferenceResourceType = useMemo(() => {
		if (supportsReferenceVideos || supportsReferenceAudios) return "file"
		if (supportsReferenceImages) return "image"
		return "image"
	}, [supportsReferenceAudios, supportsReferenceImages, supportsReferenceVideos])
	const fileInputAccept = useMemo(() => {
		const acceptParts: string[] = []
		if (supportsReferenceImages) {
			acceptParts.push("image/*")
		}
		if (supportsReferenceVideos) {
			acceptParts.push("video/*")
		}
		if (supportsReferenceAudios) {
			acceptParts.push("audio/*", ".mp3", ".wav", ".ogg", ".m4a", ".aac")
		}
		if (!acceptParts.length) {
			return "image/*"
		}
		return Array.from(new Set(acceptParts)).join(",")
	}, [supportsReferenceAudios, supportsReferenceImages, supportsReferenceVideos])
	const resolveModeDraftInputTab = useCallback(
		(
			inputMode: VideoInputMode,
			model: typeof selectedModel,
			draftTab?: "frame" | "reference",
		): "frame" | "reference" => {
			const availableTabs = getAvailableInputTabs(model, inputMode)
			if (draftTab && availableTabs.includes(draftTab)) return draftTab
			return getDefaultInputTab(model, inputMode)
		},
		[],
	)
	const buildModeDraftFromRequest = useCallback(
		(
			inputMode: VideoInputMode,
			request: Partial<GenerateVideoRequest> | undefined,
			model: typeof selectedModel,
		): VideoModeInputDraft => {
			const promptText = request?.prompt || ""
			const frameInfos = buildFrameSlotInfos(request?.inputs?.frames, model, inputMode)
			let referenceInfos = buildReferenceAssetInfos(request?.inputs)
			const maxReferenceCount = getMaxReferenceImageCount(model, inputMode, referenceInfos)
			if (maxReferenceCount !== Infinity && referenceInfos.length > maxReferenceCount) {
				referenceInfos = referenceInfos.slice(0, maxReferenceCount)
			}
			return {
				prompt: promptText,
				activeInputTab: resolveModeDraftInputTab(
					inputMode,
					model,
					getRequestInputTab(request, inputMode),
				),
				frameImageInfos: frameInfos,
				linkedFrameBindings: [],
				referenceAssetInfos: referenceInfos,
			}
		},
		[resolveModeDraftInputTab],
	)
	const getModeDraftForView = useCallback(
		(
			inputMode: VideoInputMode,
			model: typeof selectedModel,
			cache: Partial<Record<VideoInputMode, VideoModeInputDraft>>,
		): VideoModeInputDraft => {
			const cachedDraft = cache[inputMode]
			if (!cachedDraft) {
				return buildModeDraftFromRequest(inputMode, undefined, model)
			}
			const maxFrameCount = getMaxFrameCount(model, inputMode)
			const frameInfos =
				maxFrameCount > 0
					? cloneFrameSlotInfos(cachedDraft.frameImageInfos).slice(0, maxFrameCount)
					: []
			const linkedFrameBindings =
				maxFrameCount > 0
					? cloneLinkedFrameBindings(cachedDraft.linkedFrameBindings).slice(
							0,
							maxFrameCount,
						)
					: []
			let referenceInfos = cloneVideoReferenceAssetInfos(cachedDraft.referenceAssetInfos)
			const maxReferenceCount = getMaxReferenceImageCount(model, inputMode, referenceInfos)
			if (maxReferenceCount !== Infinity && referenceInfos.length > maxReferenceCount) {
				referenceInfos = referenceInfos.slice(0, maxReferenceCount)
			}
			return {
				prompt: cachedDraft.prompt ?? "",
				activeInputTab: resolveModeDraftInputTab(
					inputMode,
					model,
					cachedDraft.activeInputTab,
				),
				frameImageInfos: frameInfos,
				linkedFrameBindings,
				referenceAssetInfos: referenceInfos,
			}
		},
		[buildModeDraftFromRequest, resolveModeDraftInputTab],
	)

	useEffect(() => {
		if (selectedInputMode !== resolvedInputMode) {
			setSelectedInputMode(resolvedInputMode)
		}
	}, [availableInputModes, resolvedInputMode, selectedInputMode, selectedModelId])

	useEffect(() => {
		if (!availableInputTabs.includes(activeInputTab)) {
			const nextInputTab = resolveInputSubTabForAvailableTabs(
				availableInputTabs,
				activeInputTab,
			)
			activeInputTabRef.current = nextInputTab
			setActiveInputTab(nextInputTab)
		}
	}, [availableInputTabs, activeInputTab])

	useEffect(() => {
		const supportsFrameTab = availableInputTabs.includes("frame")
		const supportsReferenceTab = availableInputTabs.includes("reference")
		if (supportsFrameTab && !supportsReferenceTab && activeInputTab !== "frame") {
			setActiveInputTab("frame")
			return
		}
		if (supportsReferenceTab && !supportsFrameTab && activeInputTab !== "reference") {
			setActiveInputTab("reference")
		}
	}, [activeInputTab, availableInputTabs])

	const maxFrameImages = useMemo(() => {
		if (!supportsStartFrame && !supportsEndFrame) return undefined
		const frameRoles = currentInputModeConfig?.frame_roles
		if (frameRoles?.length) return frameRoles.length
		let frameCount = 0
		if (supportsStartFrame) frameCount += 1
		if (supportsEndFrame) frameCount += 1
		return frameCount > 0 ? frameCount : undefined
	}, [currentInputModeConfig?.frame_roles, supportsEndFrame, supportsStartFrame])

	const referenceAssetLimits = useMemo(
		() =>
			resolveReferenceAssetLimits(currentInputModeConfig, referenceImageInfos, {
				ignoreModeMaxCountForTotal: selectedInputMode === "omni_reference",
			}),
		[currentInputModeConfig, referenceImageInfos, selectedInputMode],
	)

	const currentInputModeVariant = useMemo(() => {
		const variantCode = referenceAssetLimits.variantCode
		if (!variantCode) return undefined
		return currentInputModeConfig?.variants?.find((variant) => variant.code === variantCode)
	}, [currentInputModeConfig, referenceAssetLimits.variantCode])

	const baseGenerationConstraints = useMemo(() => {
		return mergeVideoGenerationConstraints(
			currentInputModeConfig?.generation_constraints,
			currentInputModeVariant?.generation_constraints,
		)
	}, [currentInputModeConfig?.generation_constraints, currentInputModeVariant])
	const draftGenerationConstraints = useMemo(() => {
		const draftConfig = selectedModel?.video_generation_config?.generation?.draft
		if (!draftConfig) return undefined
		return intersectVideoGenerationConstraints(
			baseGenerationConstraints,
			resolveDraftVideoGenerationConstraints(draftConfig.constraints),
		)
	}, [baseGenerationConstraints, selectedModel])
	const canEnableDraft = useMemo(() => {
		if (!selectedModel?.video_generation_config?.generation?.draft) return false
		return buildVideoResolutionOptions(selectedModel, draftGenerationConstraints).some(
			(option) => option.value === "480p",
		)
	}, [draftGenerationConstraints, selectedModel])
	const effectiveGenerationConstraints =
		selectedDraft === true && canEnableDraft
			? draftGenerationConstraints
			: baseGenerationConstraints

	const referenceAssetCounts = useMemo(
		() =>
			referenceImageInfos.reduce(
				(acc, info) => {
					if (info.assetType === "image") acc.images++
					else if (info.assetType === "video") acc.videos++
					else if (info.assetType === "audio") acc.audios++
					return acc
				},
				{ images: 0, videos: 0, audios: 0 },
			),
		[referenceImageInfos],
	)
	const getEffectiveReferenceAssetInfos = useCallback(() => {
		const currentInfos = referenceImageInfosRef.current
		const additionalInfos = getAdditionalReferenceAssetInfos?.() ?? []
		if (additionalInfos.length === 0) return [...currentInfos]
		const existingIdentities = new Set(
			currentInfos.map((info) =>
				getCanvasResourceReferenceIdentity(info.path, resolveResourceReference),
			),
		)
		return [
			...currentInfos,
			...additionalInfos.filter((info) => {
				const identity = getCanvasResourceReferenceIdentity(
					info.path,
					resolveResourceReference,
				)
				if (!identity || existingIdentities.has(identity)) return false
				existingIdentities.add(identity)
				return true
			}),
		]
	}, [getAdditionalReferenceAssetInfos, resolveResourceReference])

	const maxReferenceImages = useMemo(() => {
		if (!supportsReferenceAssets) return 0
		const maxCount = referenceAssetLimits.total.max
		if (!Number.isFinite(maxCount)) return undefined
		return maxCount && maxCount > 0 ? maxCount : undefined
	}, [referenceAssetLimits.total.max, supportsReferenceAssets])

	const currentReferenceImages = useMemo(
		() => referenceImageInfos.map((info) => info.path),
		[referenceImageInfos],
	)
	const updateProtectedReferencePaths = useCallback(
		(nextPaths: string[]) => {
			setProtectedReferencePaths((prev) => {
				return areOrderedPathsEqual(prev, nextPaths, resolveResourceReference)
					? prev
					: nextPaths
			})
		},
		[resolveResourceReference],
	)
	const applyBindingStateFromPromptAndReferences = useCallback(
		(
			nextPrompt: string,
			nextReferenceInfos: VideoReferenceAssetInfo[],
			nextMentionBindings?: MentionPathBinding[],
		) => {
			const bindingState = resolveReferenceBindingState({
				prompt: nextPrompt,
				referenceFileInfos: nextReferenceInfos,
				tokenConfig: promptPlaceholderTokenConfig,
				resolveResourceReference,
				mentionBindings: nextMentionBindings,
			})
			updateProtectedReferencePaths(bindingState.protectedReferencePaths)
			return bindingState
		},
		[promptPlaceholderTokenConfig, resolveResourceReference, updateProtectedReferencePaths],
	)
	const referenceBindingMode = useMemo<ReferenceBindingMode>(() => {
		const protectedCount = protectedReferencePaths.length
		const referenceCount = currentReferenceImages.length
		if (protectedCount === 0) return "prompt-linked"
		if (protectedCount >= referenceCount) return "detached-legacy"
		return "mixed"
	}, [currentReferenceImages.length, protectedReferencePaths.length])
	const selectedReferenceAssetKinds = useMemo(() => {
		if (selectedResourceSlot?.inputTab !== "reference") return undefined
		if (
			selectedResourceSlot.referenceAssetKinds &&
			selectedResourceSlot.referenceAssetKinds.length > 0
		) {
			return selectedResourceSlot.referenceAssetKinds
		}
		return selectedResourceSlot.referenceAssetKind
			? [selectedResourceSlot.referenceAssetKind]
			: undefined
	}, [selectedResourceSlot])
	const selectedReferenceFiles = useMemo(() => {
		if (!selectedReferenceAssetKinds || selectedReferenceAssetKinds.length === 0) {
			return currentReferenceImages
		}
		const allowedKinds = new Set(selectedReferenceAssetKinds)
		return referenceImageInfos
			.filter((info) => allowedKinds.has(info.assetType))
			.map((info) => info.path)
	}, [currentReferenceImages, referenceImageInfos, selectedReferenceAssetKinds])
	const selectedReferenceMaxFiles = useMemo(() => {
		if (!selectedReferenceAssetKinds || selectedReferenceAssetKinds.length === 0) {
			return maxReferenceImages
		}
		const typeMaxSum = selectedReferenceAssetKinds.reduce((sum, kind) => {
			const range =
				kind === "image"
					? referenceAssetLimits.reference_images
					: kind === "video"
						? referenceAssetLimits.reference_videos
						: referenceAssetLimits.reference_audios
			if (!Number.isFinite(range.max)) return Number.POSITIVE_INFINITY
			return sum + Math.max(range.max, 0)
		}, 0)
		const totalMax = maxReferenceImages ?? Number.POSITIVE_INFINITY
		const effectiveMax = Math.min(typeMaxSum, totalMax)
		if (!Number.isFinite(effectiveMax)) return undefined
		return effectiveMax > 0 ? effectiveMax : undefined
	}, [maxReferenceImages, referenceAssetLimits, selectedReferenceAssetKinds])
	const selectedReferenceAccept = useMemo(() => {
		if (!selectedReferenceAssetKinds || selectedReferenceAssetKinds.length === 0) {
			return fileInputAccept
		}
		const acceptParts: string[] = []
		if (selectedReferenceAssetKinds.includes("image")) acceptParts.push("image/*")
		if (selectedReferenceAssetKinds.includes("video")) acceptParts.push("video/*")
		if (selectedReferenceAssetKinds.includes("audio")) {
			acceptParts.push("audio/*", ".mp3", ".wav", ".ogg", ".m4a", ".aac")
		}
		return Array.from(new Set(acceptParts)).join(",") || fileInputAccept
	}, [fileInputAccept, selectedReferenceAssetKinds])
	const filterSelectedReferenceFiles = useCallback(
		(files: File[], options?: { ignoreSelectedResourceSlot?: boolean }) => {
			const selectedSlot = options?.ignoreSelectedResourceSlot
				? null
				: selectedResourceSlotRef.current
			if (
				selectedSlot?.inputTab === "frame" ||
				(options?.ignoreSelectedResourceSlot && activeInputTabRef.current === "frame")
			)
				return files
			const allowedKinds = new Set<VideoReferenceAssetKind>(
				selectedReferenceAssetKinds?.length
					? selectedReferenceAssetKinds
					: [
							supportsReferenceImages ? "image" : null,
							supportsReferenceVideos ? "video" : null,
							supportsReferenceAudios ? "audio" : null,
						].filter((kind): kind is VideoReferenceAssetKind => Boolean(kind)),
			)
			const selectedPath = selectedSlot?.path
			const replacing = Boolean(selectedPath)
			const effectiveAssets = getEffectiveReferenceAssetInfos()
			const replacedInfo = selectedPath
				? effectiveAssets.find((info) =>
						areCanvasResourceReferencesSame(
							info.path,
							selectedPath,
							resolveResourceReference,
						),
					)
				: undefined
			if (replacing && !replacedInfo) return []
			const nextAssets = replacedInfo
				? effectiveAssets.filter((info) => info !== replacedInfo)
				: [...effectiveAssets]
			const seenIdentities = new Set(
				nextAssets.map((info) =>
					getCanvasResourceReferenceIdentity(info.path, resolveResourceReference),
				),
			)
			const filesToCheck = replacing ? files.slice(0, 1) : files
			return filesToCheck.filter((file) => {
				const kind = classifyReferenceAssetFile({
					fileName: file.name,
					mimeType: file.type,
				})
				if (kind === "unknown" || !allowedKinds.has(kind)) return false
				const identity = [
					"local",
					file.name.toLowerCase(),
					file.size,
					file.lastModified,
					file.type.toLowerCase(),
				].join(":")
				if (seenIdentities.has(identity)) return false
				const limitOptions = {
					ignoreModeMaxCountForTotal: selectedInputMode === "omni_reference",
				}
				if (replacedInfo) {
					if (
						!canReplaceReferenceAssetByCounts(
							currentInputModeConfig,
							countReferenceAssets(effectiveAssets),
							replacedInfo.assetType,
							kind,
							limitOptions,
						)
					)
						return false
				} else if (
					!canAddReferenceAsset(currentInputModeConfig, nextAssets, kind, limitOptions)
				) {
					return false
				}
				seenIdentities.add(identity)
				nextAssets.push({ path: identity, src: "", fileName: file.name, assetType: kind })
				return true
			})
		},
		[
			currentInputModeConfig,
			getEffectiveReferenceAssetInfos,
			resolveResourceReference,
			selectedInputMode,
			selectedReferenceAssetKinds,
			supportsReferenceAudios,
			supportsReferenceImages,
			supportsReferenceVideos,
		],
	)
	const matchableItems = useMemo(() => {
		return referenceImageInfos.map((info) => ({
			name: info.fileName,
			path: info.path,
			assetType: info.assetType,
			source: "element-reference" as const,
		}))
	}, [referenceImageInfos])
	const isReferenceImageLimitReached = useMemo(() => {
		if (maxReferenceImages === undefined) return false
		return currentReferenceImages.length >= maxReferenceImages
	}, [currentReferenceImages.length, maxReferenceImages])

	const currentFrameImages = useMemo(
		() => frameImageInfos.map((info) => info?.path),
		[frameImageInfos],
	)
	const currentReferenceImagesRef = useRef(currentReferenceImages)
	const selectedReferenceFilesRef = useRef(selectedReferenceFiles)
	const selectedReferenceMaxFilesRef = useRef(selectedReferenceMaxFiles)
	const filterSelectedReferenceFilesRef = useRef(filterSelectedReferenceFiles)
	const protectedReferencePathsRef = useRef(protectedReferencePaths)
	const currentInputModeConfigRef = useRef(currentInputModeConfig)
	const selectedInputModeRef = useRef(selectedInputMode)
	const maxFrameImagesRef = useRef(maxFrameImages)
	const maxReferenceImagesRef = useRef(maxReferenceImages)
	frameImageInfosRef.current = frameImageInfos
	currentReferenceImagesRef.current = currentReferenceImages
	selectedReferenceFilesRef.current = selectedReferenceFiles
	selectedReferenceMaxFilesRef.current = selectedReferenceMaxFiles
	filterSelectedReferenceFilesRef.current = filterSelectedReferenceFiles
	referenceImageInfosRef.current = referenceImageInfos
	protectedReferencePathsRef.current = protectedReferencePaths
	currentInputModeConfigRef.current = currentInputModeConfig
	selectedInputModeRef.current = selectedInputMode
	activeInputTabRef.current = activeInputTab
	maxFrameImagesRef.current = maxFrameImages
	maxReferenceImagesRef.current = maxReferenceImages
	const hasFrameImagesConfigured = useMemo(
		() => currentFrameImages.some((path) => Boolean(path)),
		[currentFrameImages],
	)
	const hasReferenceImagesConfigured = currentReferenceImages.length > 0

	const modelOptions = useMemo<VideoModelOption[]>(() => {
		return videoModelList.map((model) => ({
			label: model.model_name || model.model_id,
			value: model.model_id,
			model,
		}))
	}, [videoModelList])

	const modelOptionGroups = useMemo<VideoModelOptionGroup[]>(() => {
		const groupMap = new Map<string, VideoModelOptionGroup>()
		modelOptions.forEach((option) => {
			const groupId =
				option.model.model_group?.id || option.model.group_id || option.model.model_id
			const groupLabel = option.model.model_group?.name || t("messageHistory.model", "模型")
			const groupSource =
				option.model.model_group?.source || option.model.model_source || "official"

			if (!groupMap.has(groupId)) {
				groupMap.set(groupId, {
					id: groupId,
					label: groupLabel,
					icon: option.model.model_group?.icon,
					sort: option.model.model_group?.sort ?? Number.MAX_SAFE_INTEGER,
					source: groupSource,
					options: [],
				})
			}

			groupMap.get(groupId)?.options.push(option)
		})

		return Array.from(groupMap.values()).sort((groupA, groupB) => {
			if (groupA.source !== groupB.source) {
				return groupA.source === "custom" ? -1 : 1
			}
			if (groupA.sort !== groupB.sort) {
				return groupA.sort - groupB.sort
			}
			return groupA.label.localeCompare(groupB.label)
		})
	}, [modelOptions, t])

	const selectedModelOption = useMemo(() => {
		return modelOptions.find((opt) => opt.value === selectedModelId)
	}, [modelOptions, selectedModelId])

	const supportedResolutionOptions = useMemo<
		VideoEditorConfig["supportedResolutionOptions"]
	>(() => {
		return buildVideoResolutionOptions(selectedModel, effectiveGenerationConstraints)
	}, [selectedModel, effectiveGenerationConstraints])

	const supportedAspectRatioOptions = useMemo<
		VideoEditorConfig["supportedAspectRatioOptions"]
	>(() => {
		return buildVideoAspectRatioOptions(
			selectedModel,
			selectedResolution,
			effectiveGenerationConstraints,
		)
	}, [selectedModel, selectedResolution, effectiveGenerationConstraints])

	const supportedDurationOptions = useMemo(() => {
		return buildVideoDurationOptions(selectedModel, effectiveGenerationConstraints)
	}, [selectedModel, effectiveGenerationConstraints])

	const durationConfig = useMemo(
		() => getVideoDurationConfig(selectedModel, effectiveGenerationConstraints),
		[selectedModel, effectiveGenerationConstraints],
	)
	const generationSwitchConfig = useMemo(() => {
		const generation = selectedModel?.video_generation_config?.generation
		return {
			audio: generation?.generate_audio,
			webSearch: generation?.web_search,
			draft: generation?.draft,
		}
	}, [selectedModel])

	const supportedCompressionQualityOptions = useMemo(() => {
		const gen = selectedModel?.video_generation_config?.generation
		if (!gen?.supports_compression_quality) return []
		return (gen.compression_quality_options || []).filter(Boolean)
	}, [selectedModel])

	const currentSelectValue = selectedAspectRatio

	const ratioOption = useMemo(() => {
		return supportedAspectRatioOptions.find((option) => option.value === currentSelectValue)
	}, [supportedAspectRatioOptions, currentSelectValue])

	const syncReferenceImagesFromElement = useCallback(() => {
		//
	}, [])

	const updateVideoElementSize = useCallback(
		(size?: { width: number; height: number } | null) => {
			if (!syncElementSize) return
			if (!canvas || !size) return
			if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return
			canvas.elementManager.update(videoElement.id, {
				width: size.width,
				height: size.height,
			})
		},
		[canvas, syncElementSize, videoElement.id],
	)
	const restoreResolutionAfterDraft = useCallback(() => {
		const baseOptions = buildVideoResolutionOptions(selectedModel, baseGenerationConstraints)
		const restoredResolution = resolveRestoredVideoResolution(
			selectedModel,
			baseOptions,
			resolutionBeforeDraftRef.current,
		)
		resolutionBeforeDraftRef.current = undefined
		setSelectedResolution(restoredResolution)
		const nextAspectOptions = buildVideoAspectRatioOptions(
			selectedModel,
			restoredResolution,
			baseGenerationConstraints,
		)
		const nextAspectOption =
			nextAspectOptions.find((option) => option.value === selectedAspectRatio) ??
			nextAspectOptions[0]
		setSelectedAspectRatio(nextAspectOption?.value)
		updateVideoElementSize(nextAspectOption)
	}, [baseGenerationConstraints, selectedAspectRatio, selectedModel, updateVideoElementSize])

	useEffect(() => {
		setDurationDraftSeconds(selectedDurationSeconds)
	}, [selectedDurationSeconds])

	useEffect(() => {
		if (supportedResolutionOptions.length === 0) {
			if (selectedResolution !== undefined) {
				setSelectedResolution(undefined)
			}
			return
		}
		if (!selectedResolution) {
			setSelectedResolution(supportedResolutionOptions[0]?.value)
			return
		}
		const isValidResolution = supportedResolutionOptions.some(
			(option) => option.value === selectedResolution,
		)
		if (!isValidResolution) {
			setSelectedResolution(supportedResolutionOptions[0]?.value)
		}
	}, [selectedResolution, supportedResolutionOptions])

	useEffect(() => {
		if (supportedAspectRatioOptions.length === 0) {
			if (selectedAspectRatio !== undefined) {
				setSelectedAspectRatio(undefined)
			}
			return
		}
		if (!selectedAspectRatio) {
			const nextOption = supportedAspectRatioOptions[0]
			setSelectedAspectRatio(nextOption?.value)
			updateVideoElementSize(nextOption)
			return
		}
		const isValidAspectRatio = supportedAspectRatioOptions.some(
			(option) => option.value === selectedAspectRatio,
		)
		if (!isValidAspectRatio) {
			const nextOption = supportedAspectRatioOptions[0]
			setSelectedAspectRatio(nextOption?.value)
			updateVideoElementSize(nextOption)
		}
	}, [selectedAspectRatio, supportedAspectRatioOptions, updateVideoElementSize])

	useEffect(() => {
		if (supportedDurationOptions.length === 0) {
			if (selectedDurationSeconds !== undefined) {
				setSelectedDurationSeconds(undefined)
			}
			if (durationDraftSeconds !== undefined) {
				setDurationDraftSeconds(undefined)
			}
			return
		}
		if (selectedDurationSeconds == null) {
			const nextDuration = resolveVideoDefaultDuration(
				selectedModel,
				effectiveGenerationConstraints,
			)
			setSelectedDurationSeconds(nextDuration)
			return
		}
		if (!supportedDurationOptions.includes(selectedDurationSeconds)) {
			const nextDuration = resolveVideoDefaultDuration(
				selectedModel,
				effectiveGenerationConstraints,
			)
			setSelectedDurationSeconds(nextDuration)
		}
	}, [
		effectiveGenerationConstraints,
		selectedDurationSeconds,
		selectedModel,
		supportedDurationOptions,
	])

	useEffect(() => {
		if (!generationSwitchConfig.audio) {
			if (selectedGenerateAudio !== undefined) setSelectedGenerateAudio(undefined)
			return
		}
		if (selectedGenerateAudio === undefined) {
			setSelectedGenerateAudio(generationSwitchConfig.audio.default)
		}
	}, [generationSwitchConfig.audio, selectedGenerateAudio])

	useEffect(() => {
		if (!generationSwitchConfig.webSearch) {
			if (selectedWebSearch !== undefined) setSelectedWebSearch(undefined)
			return
		}
		if (selectedWebSearch === undefined) {
			setSelectedWebSearch(generationSwitchConfig.webSearch.default)
		}
	}, [generationSwitchConfig.webSearch, selectedWebSearch])

	useEffect(() => {
		// 能力未声明时保持 undefined，让设置面板隐藏且请求不会携带 draft。
		if (!generationSwitchConfig.draft) {
			if (selectedDraft !== undefined) setSelectedDraft(undefined)
			resolutionBeforeDraftRef.current = undefined
			return
		}
		if (selectedDraft === undefined) {
			setSelectedDraft(generationSwitchConfig.draft.default && canEnableDraft)
			return
		}
		if (selectedDraft && !canEnableDraft) {
			setSelectedDraft(false)
			restoreResolutionAfterDraft()
		}
	}, [canEnableDraft, generationSwitchConfig.draft, selectedDraft, restoreResolutionAfterDraft])

	const resetSelectedResourceSlot = useCallback((expectedSlot?: VideoInputSlotInfo) => {
		const currentSlot = selectedResourceSlotRef.current
		if (
			expectedSlot &&
			(!currentSlot ||
				currentSlot.inputTab !== expectedSlot.inputTab ||
				currentSlot.slotIndex !== expectedSlot.slotIndex ||
				currentSlot.slotKey !== expectedSlot.slotKey ||
				currentSlot.referenceAssetKind !== expectedSlot.referenceAssetKind ||
				currentSlot.path !== expectedSlot.path)
		) {
			return
		}
		selectedResourceSlotRef.current = null
		setSelectedResourceSlot(null)
	}, [])

	const replaceFrameImageAt = useCallback(
		(
			slotIndex: number,
			fileInfo: UploadFileResponse,
			options?: { retainResourceSlot?: boolean },
		) => {
			const next = [...frameImageInfosRef.current]
			next[slotIndex] = {
				path: fileInfo.path,
				src: fileInfo.src || fileInfo.path,
				fileName:
					fileInfo.fileName || getCanvasResourceFileName(fileInfo.path) || fileInfo.path,
			}
			frameImageInfosRef.current = next
			setFrameImageInfos(next)
			activeInputTabRef.current = "frame"
			setActiveInputTab("frame")
			if (!options?.retainResourceSlot) {
				resetSelectedResourceSlot()
			}
		},
		[resetSelectedResourceSlot],
	)

	const appendFrameImage = useCallback(
		(fileInfo: UploadFileResponse): boolean => {
			const next = [...frameImageInfosRef.current]
			const firstEmptySlot = next.findIndex((info) => !info?.path)
			const slotIndex = firstEmptySlot >= 0 ? firstEmptySlot : next.length
			if (maxFrameImages !== undefined && slotIndex >= maxFrameImages) return false

			next[slotIndex] = {
				path: fileInfo.path,
				src: fileInfo.src || fileInfo.path,
				fileName:
					fileInfo.fileName || getCanvasResourceFileName(fileInfo.path) || fileInfo.path,
			}
			frameImageInfosRef.current = next
			setFrameImageInfos(next)
			activeInputTabRef.current = "frame"
			setActiveInputTab("frame")
			return true
		},
		[maxFrameImages],
	)

	const replaceReferenceImageAt = useCallback(
		(
			slotIndex: number,
			fileInfo: UploadFileResponse & { assetType?: VideoReferenceAssetKind },
			options?: {
				retainResourceSlot?: boolean
				/** 默认 cursor；仅少数场景（如需文末追加）可传 documentEnd */
				mentionPlacement?: "cursor" | "documentEnd"
				suppressPromptMention?: boolean
				/** 用户显式选择已有资源时，重复选择仍需补齐编辑器 @mention。 */
				ensurePromptMention?: boolean
			},
		) => {
			const latestReferenceImageInfos = referenceImageInfosRef.current
			const latestProtectedReferencePaths = protectedReferencePathsRef.current
			const latestInputModeConfig = currentInputModeConfigRef.current
			const latestSelectedInputMode = selectedInputModeRef.current
			const normalizedFileInfo = resolveVideoReferenceAssetInfo({
				path: fileInfo.path,
				src: fileInfo.src,
				fileName: fileInfo.fileName,
				file_id: fileInfo.file_id,
				source_file_id: fileInfo.source_file_id,
				source_project_id: fileInfo.source_project_id,
				project_id: fileInfo.project_id,
				explicitAssetType: fileInfo.assetType,
				metadataCandidates: latestReferenceImageInfos,
				resolveResourceReference,
			})
			if (!normalizedFileInfo) return
			const { assetType } = normalizedFileInfo
			if (!isReferenceAssetTypeAllowed(assetType, latestInputModeConfig)) return
			const selectedSlot = selectedResourceSlotRef.current
			const expectedAssetTypes =
				selectedSlot?.inputTab === "reference"
					? selectedSlot.referenceAssetKinds &&
						selectedSlot.referenceAssetKinds.length > 0
						? selectedSlot.referenceAssetKinds
						: selectedSlot.referenceAssetKind
							? [selectedSlot.referenceAssetKind]
							: undefined
					: undefined
			const previousInfo = latestReferenceImageInfos[slotIndex]
			if (expectedAssetTypes?.length && !expectedAssetTypes.includes(assetType)) return
			const isSelectedSlotReplacement = Boolean(
				selectedSlot?.inputTab === "reference" &&
				selectedSlot.path &&
				previousInfo?.path &&
				areCanvasResourceReferencesSame(
					selectedSlot.path,
					previousInfo.path,
					resolveResourceReference,
				),
			)
			const isDuplicateReference =
				Boolean(
					previousInfo?.path &&
					areCanvasResourceReferencesSame(
						previousInfo.path,
						fileInfo.path,
						resolveResourceReference,
					),
				) ||
				latestReferenceImageInfos.some(
					(info, index) =>
						index !== slotIndex &&
						areCanvasResourceReferencesSame(
							info.path,
							fileInfo.path,
							resolveResourceReference,
						),
				)
			if (isDuplicateReference) {
				if (options?.ensurePromptMention && !options.suppressPromptMention) {
					scheduleReferenceMentionInserts([normalizedFileInfo], {
						placement: options.mentionPlacement ?? "cursor",
						force: true,
					})
				}
				if (!options?.retainResourceSlot) {
					resetSelectedResourceSlot()
				}
				return
			}
			if (isSelectedSlotReplacement) {
				const effectiveCurrentInfos = getEffectiveReferenceAssetInfos()
				if (
					!canReplaceReferenceAssetByCounts(
						latestInputModeConfig,
						countReferenceAssets(effectiveCurrentInfos),
						previousInfo.assetType,
						assetType,
						{
							ignoreModeMaxCountForTotal:
								latestSelectedInputMode === "omni_reference",
						},
					)
				) {
					return
				}
			}
			const deduped = latestReferenceImageInfos.filter(
				(info) =>
					!areCanvasResourceReferencesSame(
						info.path,
						fileInfo.path,
						resolveResourceReference,
					),
			)
			const nextInfos = [...deduped]
			const shouldReplaceExisting =
				previousInfo !== undefined &&
				previousInfo.assetType === assetType &&
				(!expectedAssetTypes || expectedAssetTypes.includes(previousInfo.assetType))
			if (shouldReplaceExisting) {
				nextInfos[slotIndex] = normalizedFileInfo
			} else {
				const nextIndex = Math.max(0, Math.min(slotIndex, nextInfos.length))
				nextInfos.splice(nextIndex, 0, normalizedFileInfo)
			}
			const limitedInfos = clampReferenceAssetsToLimits(
				nextInfos.filter(Boolean) as VideoReferenceAssetInfo[],
				latestInputModeConfig,
				{ ignoreModeMaxCountForTotal: latestSelectedInputMode === "omni_reference" },
			)
			referenceImageInfosRef.current = limitedInfos
			setReferenceImageInfos(limitedInfos)
			const currentQuickEditSource = quickEditSourceRef.current
			if (
				currentQuickEditSource &&
				previousInfo &&
				areCanvasResourceReferencesSame(
					previousInfo.path,
					currentQuickEditSource.path,
					resolveResourceReference,
				)
			) {
				const nextQuickEditSource: VideoReferenceAssetInfo | null =
					assetType === "video" &&
					limitedInfos.some((info) =>
						areCanvasResourceReferencesSame(
							info.path,
							normalizedFileInfo.path,
							resolveResourceReference,
						),
					)
						? { ...normalizedFileInfo, assetType: "video" }
						: null
				modeDraftCacheRef.current = nextQuickEditSource
					? replaceQuickEditSourceInModeDraftCache(
							modeDraftCacheRef.current,
							currentQuickEditSource,
							nextQuickEditSource,
							resolveResourceReference,
						)
					: removeQuickEditSourceFromModeDraftCache(
							modeDraftCacheRef.current,
							currentQuickEditSource,
							resolveResourceReference,
						)
				quickEditSourceRef.current = nextQuickEditSource
				quickEditSourceRemovedRef.current = nextQuickEditSource === null
			}
			const nextProtectedReferencePaths =
				shouldReplaceExisting && previousInfo?.path
					? latestProtectedReferencePaths.map((path) =>
							areCanvasResourceReferencesSame(
								path,
								previousInfo.path,
								resolveResourceReference,
							)
								? normalizedFileInfo.path
								: path,
						)
					: latestProtectedReferencePaths
			const prunedProtectedReferencePaths = pruneProtectedReferencePaths(
				limitedInfos.map((info) => info.path),
				nextProtectedReferencePaths,
				resolveResourceReference,
			)
			protectedReferencePathsRef.current = prunedProtectedReferencePaths
			updateProtectedReferencePaths(prunedProtectedReferencePaths)
			if (shouldReplaceExisting && previousInfo?.path) {
				messageEditorRef?.current?.replaceMentionItems(
					createCanvasMentionPathMatcher(previousInfo.path, resolveResourceReference),
					createReferenceResourcePanelItemFromPath(
						normalizedFileInfo.path,
						normalizedFileInfo.fileName,
						{
							fileId: normalizedFileInfo.file_id,
							sourceFileId: normalizedFileInfo.source_file_id,
							sourceProjectId: normalizedFileInfo.source_project_id,
							projectId: normalizedFileInfo.project_id,
							mediaType: normalizedFileInfo.assetType,
						},
					),
				)
			}
			if (
				!shouldReplaceExisting &&
				!options?.suppressPromptMention &&
				limitedInfos.some((info) =>
					areCanvasResourceReferencesSame(
						info.path,
						normalizedFileInfo.path,
						resolveResourceReference,
					),
				)
			) {
				scheduleReferenceMentionInserts([normalizedFileInfo], {
					placement: options?.mentionPlacement ?? "cursor",
					force: options?.ensurePromptMention === true,
				})
			}
			activeInputTabRef.current = "reference"
			setActiveInputTab("reference")
			if (!options?.retainResourceSlot) {
				resetSelectedResourceSlot()
			}
		},
		[
			scheduleReferenceMentionInserts,
			resetSelectedResourceSlot,
			getEffectiveReferenceAssetInfos,
			resolveResourceReference,
			updateProtectedReferencePaths,
			messageEditorRef,
		],
	)

	const replaceSelectedResource = useCallback(
		(fileInfo: UploadFileResponse, options?: { retainResourceSlot?: boolean }) => {
			const selectedSlot = selectedResourceSlotRef.current
			if (!selectedSlot) return
			if (selectedSlot.inputTab === "frame") {
				replaceFrameImageAt(selectedSlot.slotIndex, fileInfo, options)
				return
			}
			replaceReferenceImageAt(selectedSlot.slotIndex, fileInfo, options)
		},
		[replaceFrameImageAt, replaceReferenceImageAt],
	)

	const {
		fileInputRef,
		triggerFileSelect: rawTriggerFileSelect,
		uploadFiles: rawUploadFiles,
		handleFileChange,
		isUploading,
	} = useFileInput({
		methods,
		currentReferenceFiles:
			selectedResourceSlot?.inputTab === "frame"
				? currentFrameImages.filter((path): path is string => Boolean(path))
				: selectedReferenceFiles,
		canvas: canvas || undefined,
		elementId: videoElement.id,
		maxReferenceFiles:
			selectedResourceSlot?.inputTab === "frame" ? maxFrameImages : selectedReferenceMaxFiles,
		accept: selectedResourceSlot?.inputTab === "frame" ? "image/*" : selectedReferenceAccept,
		filterFiles: filterSelectedReferenceFiles,
		shouldSaveToElement: false,
		onFileUploaded: useCallback(
			(result: UploadFileResponse, fileIndex = 0, batchTotal = 1) => {
				if (discardPendingUploadRef.current) return
				const base = batchUploadBaseRef.current
				if (!base) return
				if (base.isCurrent?.() === false) return
				const targetIndex = base.startSlot + fileIndex
				const retainResourceSlot =
					base.retainResourceSlotAfterBatch === true || fileIndex < batchTotal - 1
				if (base.inputTab === "frame") {
					replaceFrameImageAt(targetIndex, result, { retainResourceSlot })
				} else {
					replaceReferenceImageAt(targetIndex, result, {
						retainResourceSlot,
						suppressPromptMention:
							base.suppressPromptMention === true || Boolean(uploadMentionController),
					})
				}
			},
			[replaceFrameImageAt, replaceReferenceImageAt, uploadMentionController],
		),
		onUploadSessionEnd: useCallback(() => {
			batchUploadBaseRef.current = null
		}, []),
		pendingUploadMentionController: uploadMentionController,
		shouldInsertPendingMention: useCallback(
			() =>
				batchUploadBaseRef.current?.inputTab === "reference" &&
				!batchUploadBaseRef.current?.hasExistingSlot &&
				!batchUploadBaseRef.current?.suppressPromptMention,
			[],
		),
	})

	const triggerFileSelect = useCallback(() => {
		if (isUploading) return
		const sel = selectedResourceSlotRef.current
		batchUploadBaseRef.current = sel
			? {
					inputTab: sel.inputTab,
					startSlot: sel.slotIndex,
					hasExistingSlot: Boolean(sel.path),
				}
			: null
		rawTriggerFileSelect({
			maxSelectedFiles: sel?.path ? 1 : undefined,
			ignoreReferenceFileCapacity: Boolean(sel?.path) || sel?.inputTab === "reference",
		})
	}, [isUploading, rawTriggerFileSelect])

	const uploadReferenceFiles = useCallback(
		async (
			files: File[],
			options?: {
				ignoreSelectedResourceSlot?: boolean
				retainSelectedResourceSlot?: boolean
				suppressPartialSkippedToast?: boolean
				isCurrent?: () => boolean
				suppressPromptMention?: boolean
				pendingMentionHandles?: Array<CanvasUploadMentionHandle | undefined>
			},
		) => {
			if (isUploading || files.length === 0) return []
			const latestCurrentFrameImages = frameImageInfosRef.current.map((info) => info?.path)
			const latestCurrentReferenceImages = currentReferenceImagesRef.current
			const latestSelectedReferenceFiles = selectedReferenceFilesRef.current
			const latestSelectedReferenceMaxFiles = selectedReferenceMaxFilesRef.current
			const latestFilterSelectedReferenceFiles = filterSelectedReferenceFilesRef.current
			const latestActiveInputTab = activeInputTabRef.current
			const latestMaxFrameImages = maxFrameImagesRef.current
			const selectedSlot = options?.ignoreSelectedResourceSlot
				? null
				: selectedResourceSlotRef.current
			const targetInputTab = selectedSlot?.inputTab ?? latestActiveInputTab
			if (!supportsReferenceAssets && targetInputTab !== "frame") return []
			if (targetInputTab === "frame") {
				const isReplacingFrameSlot = Boolean(
					selectedSlot?.inputTab === "frame" && selectedSlot.path,
				)
				const imageFiles = files.filter((file) =>
					file.type.toLowerCase().startsWith("image/"),
				)
				const filesToUpload = isReplacingFrameSlot ? imageFiles.slice(0, 1) : imageFiles
				if (filesToUpload.length === 0) return []
				const currentFrameCount = latestCurrentFrameImages.filter(Boolean).length
				const remainingFrameCapacity =
					latestMaxFrameImages === undefined
						? undefined
						: Math.max(
								0,
								latestMaxFrameImages -
									currentFrameCount +
									(isReplacingFrameSlot ? 1 : 0),
							)
				const capacityLimitedFiles =
					remainingFrameCapacity === undefined
						? filesToUpload
						: filesToUpload.slice(0, remainingFrameCapacity)
				if (capacityLimitedFiles.length === 0) return []
				const firstEmptyFrameSlot = latestCurrentFrameImages.findIndex((path) => !path)
				batchUploadBaseRef.current = {
					inputTab: "frame",
					startSlot: isReplacingFrameSlot
						? (selectedSlot?.slotIndex ?? 0)
						: selectedSlot?.inputTab === "frame"
							? selectedSlot.slotIndex
							: firstEmptyFrameSlot >= 0
								? firstEmptyFrameSlot
								: latestCurrentFrameImages.length,
					retainResourceSlotAfterBatch: options?.retainSelectedResourceSlot === true,
					isCurrent: options?.isCurrent,
					suppressPromptMention: options?.suppressPromptMention,
					hasExistingSlot: isReplacingFrameSlot,
				}
				return await rawUploadFiles(capacityLimitedFiles, {
					currentReferenceFiles: latestCurrentFrameImages.filter((path): path is string =>
						Boolean(path),
					),
					maxReferenceFiles: remainingFrameCapacity,
					maxSelectedFiles: isReplacingFrameSlot ? 1 : capacityLimitedFiles.length,
					ignoreReferenceFileCapacity: false,
					pendingMentionHandles: options?.pendingMentionHandles,
				})
			}
			const replacementSlot =
				selectedSlot?.inputTab === "reference" && selectedSlot.path ? selectedSlot : null
			const replacementPath = replacementSlot?.path
			const acceptedFiles = latestFilterSelectedReferenceFiles(files, {
				ignoreSelectedResourceSlot: options?.ignoreSelectedResourceSlot,
			})
			const filesToUpload = replacementSlot ? acceptedFiles.slice(0, 1) : acceptedFiles
			if (filesToUpload.length < files.length && !options?.suppressPartialSkippedToast) {
				toast.info(
					t("videoEditor.referenceAssetPartialSkipped", {
						defaultValue: "部分素材因类型不支持、重复或达到上限已跳过",
					}),
				)
			}
			if (filesToUpload.length === 0) return []

			const startSlot = replacementSlot
				? replacementSlot.slotIndex
				: selectedSlot?.inputTab === "reference"
					? selectedSlot.slotIndex
					: latestCurrentReferenceImages.length
			batchUploadBaseRef.current = {
				inputTab: "reference",
				startSlot,
				retainResourceSlotAfterBatch: options?.retainSelectedResourceSlot === true,
				isCurrent: options?.isCurrent,
				suppressPromptMention: options?.suppressPromptMention,
				hasExistingSlot: Boolean(replacementSlot?.path),
			}
			return await rawUploadFiles(filesToUpload, {
				currentReferenceFiles:
					replacementSlot && replacementPath
						? latestSelectedReferenceFiles.filter(
								(path) =>
									!areCanvasResourceReferencesSame(
										path,
										replacementPath,
										resolveResourceReference,
									),
							)
						: latestCurrentReferenceImages,
				maxReferenceFiles:
					replacementSlot && replacementPath
						? latestSelectedReferenceMaxFiles
						: undefined,
				maxSelectedFiles: replacementSlot ? 1 : filesToUpload.length,
				ignoreReferenceFileCapacity: !replacementSlot,
				pendingMentionHandles: options?.pendingMentionHandles,
			})
		},
		[isUploading, supportsReferenceAssets, resolveResourceReference, rawUploadFiles, t],
	)

	const [resourceUploadSlotKey, setResourceUploadSlotKey] = useState<string | null>(null)
	useEffect(() => {
		if (!isUploading) {
			setResourceUploadSlotKey(null)
			setUploadUiDismissed(false)
			discardPendingUploadRef.current = false
			return
		}
		const slot = selectedResourceSlotRef.current
		if (slot) {
			setResourceUploadSlotKey(slot.slotKey || `${slot.inputTab}-${slot.slotIndex}`)
		}
	}, [isUploading])

	const cancelPendingResourceUpload = useCallback(() => {
		discardPendingUploadRef.current = true
		batchUploadBaseRef.current = null
		setUploadUiDismissed(true)
		isRemovingReferenceImageRef.current = true
		setIsPopoverOpen(false)
		selectedResourceSlotRef.current = null
		setSelectedResourceSlot(null)
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
			popoverCloseTimeoutRef.current = null
		}
		setTimeout(() => {
			isRemovingReferenceImageRef.current = false
		}, 200)
	}, [])

	const handleModelChange = useCallback(
		(modelId: string) => {
			// 切换模型时以进入样片模式前的分辨率作为普通模式偏好，避免把协议固定的
			// 480p 误当成用户选择带到下一个模型。
			const prevResolution =
				selectedDraft === true
					? (resolutionBeforeDraftRef.current ?? selectedResolution)
					: selectedResolution
			const prevAspectRatio = selectedAspectRatio
			const prevDurationSeconds = selectedDurationSeconds
			const prevCompressionQuality = selectedCompressionQuality
			const prevInputTab = activeInputTab

			const nextModel = modelOptions.find((opt) => opt.value === modelId)?.model
			const nextModes = getAvailableInputModes(nextModel)
			let nextInputMode = resolveInputModeForAvailableModes(nextModes, selectedInputMode)
			const quickEditSource = quickEditSourceRef.current
			// 快捷编辑源视频属于会话输入，切换模型时不能因模式或容量变化被静默裁掉。
			if (quickEditSource) {
				const compatibleQuickEditModel = resolveVideoReferenceVideoModel(
					nextModel ? [nextModel] : [],
					modelId,
				)
				if (!compatibleQuickEditModel) {
					toast.error(
						t(
							"videoEditor.quickEditSourceModelUnsupported",
							"当前模型不支持关联源视频，无法保留快捷编辑",
						),
					)
					return
				}
				if (
					!isReferenceAssetTypeAllowed(
						"video",
						getInputModeConfig(nextModel, nextInputMode),
					)
				) {
					nextInputMode = compatibleQuickEditModel.inputMode
				}
			}
			const nextModeConfig = getInputModeConfig(nextModel, nextInputMode)
			const sourceAwareReferenceInfos = quickEditSource
				? referenceImageInfos.some((info) =>
						areCanvasResourceReferencesSame(
							info.path,
							quickEditSource.path,
							resolveResourceReference,
						),
					)
					? referenceImageInfos
					: [quickEditSource, ...referenceImageInfos]
				: referenceImageInfos
			const limitedReferenceInfos = clampReferenceAssetsToLimits<VideoReferenceAssetInfo>(
				sourceAwareReferenceInfos,
				nextModeConfig,
				{
					ignoreModeMaxCountForTotal: nextInputMode === "omni_reference",
					preserveIncompatibleVariants: true,
				},
			)
			if (
				quickEditSource &&
				!limitedReferenceInfos.some((info) =>
					areCanvasResourceReferencesSame(
						info.path,
						quickEditSource.path,
						resolveResourceReference,
					),
				)
			) {
				toast.error(
					t(
						"videoEditor.quickEditSourceLimitReached",
						"当前模型无法容纳快捷编辑的源视频，请先调整其他素材",
					),
				)
				return
			}

			setSelectedModelId(modelId)
			setSelectedInputMode(nextInputMode)
			const nextTabs = getAvailableInputTabs(nextModel, nextInputMode)
			const nextInputTab =
				quickEditSource && nextTabs.includes("reference")
					? "reference"
					: resolveInputSubTabForAvailableTabs(nextTabs, prevInputTab)
			activeInputTabRef.current = nextInputTab
			setActiveInputTab(nextInputTab)
			selectedResourceSlotRef.current = null
			setSelectedResourceSlot(null)
			const nextFrameMaxCount = getMaxFrameCount(nextModel, nextInputMode)
			setFrameImageInfos((prev) =>
				nextFrameMaxCount > 0 ? prev.slice(0, nextFrameMaxCount) : [],
			)
			setLinkedFrameBindings((previous) =>
				nextFrameMaxCount > 0 ? previous.slice(0, nextFrameMaxCount) : [],
			)
			const nextVariantCode = resolveReferenceAssetLimits(
				nextModeConfig,
				limitedReferenceInfos,
				{ ignoreModeMaxCountForTotal: nextInputMode === "omni_reference" },
			).variantCode
			const nextVariantConfig = nextModeConfig?.variants?.find(
				(variant) => variant.code === nextVariantCode,
			)
			const nextGenerationConstraints = mergeVideoGenerationConstraints(
				nextModeConfig?.generation_constraints,
				nextVariantConfig?.generation_constraints,
			)
			const selection = resolveVideoGenerationSelectionPreserving(
				nextModel,
				{
					resolution: prevResolution,
					aspectRatio: prevAspectRatio,
				},
				nextGenerationConstraints,
			)
			const nextDurations = buildVideoDurationOptions(nextModel, nextGenerationConstraints)
			const nextGen = nextModel?.video_generation_config?.generation
			const nextQualityOpts =
				nextGen?.supports_compression_quality && nextGen.compression_quality_options?.length
					? nextGen.compression_quality_options.filter(Boolean)
					: []
			setSelectedResolution(selection.resolution)
			setSelectedAspectRatio(selection.aspectRatio)
			setSelectedDurationSeconds(
				prevDurationSeconds != null && nextDurations.includes(prevDurationSeconds)
					? prevDurationSeconds
					: resolveVideoDefaultDuration(nextModel, nextGenerationConstraints),
			)
			setSelectedGenerateAudio(
				nextGen?.generate_audio ? nextGen.generate_audio.default : undefined,
			)
			setSelectedWebSearch(nextGen?.web_search ? nextGen.web_search.default : undefined)
			resolutionBeforeDraftRef.current = nextGen?.draft?.default
				? selection.resolution
				: undefined
			setSelectedDraft(nextGen?.draft ? nextGen.draft.default : undefined)
			setSelectedCompressionQuality(
				prevCompressionQuality && nextQualityOpts.includes(prevCompressionQuality)
					? prevCompressionQuality
					: nextQualityOpts[0],
			)
			updateVideoElementSize(selection.size)
			const nextReferenceMaxCount = getMaxReferenceImageCount(
				nextModel,
				nextInputMode,
				limitedReferenceInfos,
			)
			if (referenceImageInfos.length > nextReferenceMaxCount) {
				const retainedPathIdentities = new Set(
					limitedReferenceInfos.map((info) =>
						getCanvasResourceReferenceIdentity(info.path, resolveResourceReference),
					),
				)
				const removedInfos = referenceImageInfos.filter(
					(info) =>
						!retainedPathIdentities.has(
							getCanvasResourceReferenceIdentity(info.path, resolveResourceReference),
						),
				)
				setReferenceImageInfos(limitedReferenceInfos)
				updateProtectedReferencePaths(
					pruneProtectedReferencePaths(
						limitedReferenceInfos.map((info) => info.path),
						protectedReferencePaths,
						resolveResourceReference,
					),
				)
				setPrompt((currentPrompt) => {
					return removedInfos.reduce((nextPrompt, info) => {
						return removeMentionFromString(nextPrompt, info.path, info.fileName)
					}, currentPrompt)
				})
			} else {
				setReferenceImageInfos(limitedReferenceInfos)
				updateProtectedReferencePaths(
					pruneProtectedReferencePaths(
						limitedReferenceInfos.map((info) => info.path),
						protectedReferencePaths,
						resolveResourceReference,
					),
				)
			}
		},
		[
			modelOptions,
			referenceImageInfos,
			resolveResourceReference,
			updateVideoElementSize,
			selectedResolution,
			selectedDraft,
			selectedAspectRatio,
			selectedDurationSeconds,
			selectedGenerateAudio,
			selectedWebSearch,
			selectedCompressionQuality,
			activeInputTab,
			selectedInputMode,
			t,
			protectedReferencePaths,
			updateProtectedReferencePaths,
		],
	)

	const handleResolutionChange = useCallback(
		(value: string) => {
			const nextResolution = value || undefined
			const nextAspectOptions = buildVideoAspectRatioOptions(
				selectedModel,
				nextResolution,
				effectiveGenerationConstraints,
			)
			const preservedAspectOption = nextAspectOptions.find(
				(option) =>
					option.value === selectedAspectRatio || option.label === selectedAspectRatio,
			)
			const nextAspectOption = preservedAspectOption ?? nextAspectOptions[0]
			setSelectedResolution(nextResolution)
			setSelectedAspectRatio(nextAspectOption?.value)
			updateVideoElementSize(nextAspectOption)
		},
		[
			selectedAspectRatio,
			selectedModel,
			updateVideoElementSize,
			effectiveGenerationConstraints,
		],
	)

	const handleRatioChange = useCallback(
		(value: string) => {
			const nextOption = supportedAspectRatioOptions.find((option) => option.value === value)
			const nextAspectRatio = value || undefined
			setSelectedAspectRatio(nextAspectRatio)
			if (nextOption?.originalScale) {
				setSelectedResolution(nextOption.originalScale)
			}
			updateVideoElementSize(nextOption)
		},
		[supportedAspectRatioOptions, updateVideoElementSize],
	)

	const handleDurationChange = useCallback((seconds: number) => {
		if (!Number.isFinite(seconds)) return
		setSelectedDurationSeconds(seconds)
	}, [])

	const handleDurationDraftChange = useCallback((seconds: number) => {
		if (!Number.isFinite(seconds)) return
		setDurationDraftSeconds(seconds)
	}, [])

	const handleDurationPopoverOpenChange = useCallback(
		(_open: boolean) => {
			setDurationDraftSeconds(selectedDurationSeconds)
		},
		[selectedDurationSeconds],
	)

	const handleGenerateAudioChange = useCallback((value: boolean) => {
		setSelectedGenerateAudio(value)
	}, [])

	const handleWebSearchChange = useCallback((value: boolean) => {
		setSelectedWebSearch(value)
	}, [])

	const handleDraftChange = useCallback(
		(value: boolean) => {
			if (value) {
				if (!canEnableDraft) return
				resolutionBeforeDraftRef.current = selectedResolution
				setSelectedDraft(true)
				setSelectedResolution("480p")
				const nextAspectOptions = buildVideoAspectRatioOptions(
					selectedModel,
					"480p",
					draftGenerationConstraints,
				)
				const nextAspectOption =
					nextAspectOptions.find((option) => option.value === selectedAspectRatio) ??
					nextAspectOptions[0]
				setSelectedAspectRatio(nextAspectOption?.value)
				updateVideoElementSize(nextAspectOption)
				return
			}

			setSelectedDraft(false)
			restoreResolutionAfterDraft()
		},
		[
			canEnableDraft,
			draftGenerationConstraints,
			restoreResolutionAfterDraft,
			selectedAspectRatio,
			selectedModel,
			selectedResolution,
			updateVideoElementSize,
		],
	)

	const handleCompressionQualityChange = useCallback((value: string) => {
		setSelectedCompressionQuality(value || undefined)
	}, [])

	const handleInputModeChange = useCallback(
		(value: VideoInputMode) => {
			resetSelectedResourceSlot()
			setIsReferenceProjectPanelOpen(false)
			const nextCache = mergeCurrentUiIntoModeDraftCache(
				modeDraftCacheRef.current,
				selectedInputMode,
				prompt,
				activeInputTab,
				frameImageInfos,
				referenceImageInfos,
				linkedFrameBindings,
			)
			modeDraftCacheRef.current = nextCache
			const baseNextDraft = getModeDraftForView(value, selectedModel, nextCache)
			// 各 input_mode 独立存草稿；切换时只投影会话级源视频，保留目标模式自己的提示词和素材。
			const quickEditSourceProjection = quickEditSourceRef.current
				? projectQuickEditSourceIntoModeDraft({
						draft: baseNextDraft,
						source: quickEditSourceRef.current,
						inputMode: value,
						modeConfig: getInputModeConfig(selectedModel, value),
						resolveResourceReference,
					})
				: null
			if (quickEditSourceProjection && !quickEditSourceProjection.applied) {
				toast.error(
					quickEditSourceProjection.reason === "capacity"
						? t(
								"videoEditor.quickEditSourceLimitReached",
								"当前模式无法容纳快捷编辑的源视频，请先调整其他素材",
							)
						: t(
								"videoEditor.quickEditSourceModeUnsupported",
								"当前模式不支持关联源视频，无法保留快捷编辑",
							),
				)
				return
			}
			const nextDraft = quickEditSourceProjection?.applied
				? quickEditSourceProjection.draft
				: baseNextDraft
			if (quickEditSourceProjection?.applied) {
				nextCache[value] = nextDraft
				modeDraftCacheRef.current = nextCache
			}
			setSelectedInputMode(value)
			const nextReferenceInfos = nextDraft.referenceAssetInfos ?? []
			const decodedDraftPrompt = decodeVideoPromptPlaceholdersToMentions(
				nextDraft.prompt ?? "",
				resolveVideoPromptPlaceholderReferences({
					mode: value,
					referenceImageInfos: nextReferenceInfos,
				}),
				value,
				promptPlaceholderTokenConfig,
			)
			setPrompt(decodedDraftPrompt)
			const nextInputTab = resolveModeDraftInputTab(
				value,
				selectedModel,
				nextDraft.activeInputTab,
			)
			activeInputTabRef.current = nextInputTab
			setActiveInputTab(nextInputTab)
			setFrameImageInfos(nextDraft.frameImageInfos ?? [])
			setLinkedFrameBindings(nextDraft.linkedFrameBindings ?? [])
			setReferenceImageInfos(nextReferenceInfos)
			applyBindingStateFromPromptAndReferences(decodedDraftPrompt, nextReferenceInfos)
			const nextModeConfig = getInputModeConfig(selectedModel, value)
			const nextVariantCode = resolveReferenceAssetLimits(
				nextModeConfig,
				nextReferenceInfos,
				{ ignoreModeMaxCountForTotal: value === "omni_reference" },
			).variantCode
			const nextVariantConfig = nextModeConfig?.variants?.find(
				(variant) => variant.code === nextVariantCode,
			)
			const nextGenerationConstraints = mergeVideoGenerationConstraints(
				nextModeConfig?.generation_constraints,
				nextVariantConfig?.generation_constraints,
			)
			const selection = resolveVideoGenerationSelectionPreserving(
				selectedModel,
				{
					resolution: selectedResolution,
					aspectRatio: selectedAspectRatio,
				},
				nextGenerationConstraints,
			)
			setSelectedResolution(selection.resolution)
			setSelectedAspectRatio(selection.aspectRatio)
			updateVideoElementSize(selection.size)
			const nextDurations = buildVideoDurationOptions(
				selectedModel,
				nextGenerationConstraints,
			)
			setSelectedDurationSeconds(
				nextDurations.length === 0
					? undefined
					: selectedDurationSeconds != null &&
						  nextDurations.includes(selectedDurationSeconds)
						? selectedDurationSeconds
						: resolveVideoDefaultDuration(selectedModel, nextGenerationConstraints),
			)
		},
		[
			activeInputTab,
			applyBindingStateFromPromptAndReferences,
			frameImageInfos,
			getModeDraftForView,
			prompt,
			referenceImageInfos,
			linkedFrameBindings,
			resetSelectedResourceSlot,
			promptPlaceholderTokenConfig,
			selectedModel,
			selectedInputMode,
			selectedDurationSeconds,
			selectedResolution,
			selectedAspectRatio,
			t,
			updateVideoElementSize,
			resolveModeDraftInputTab,
			resolveResourceReference,
		],
	)

	const handleInputTabChange = useCallback(
		(value: "frame" | "reference") => {
			resetSelectedResourceSlot()
			setIsReferenceProjectPanelOpen(false)
			activeInputTabRef.current = value
			setActiveInputTab(value)
		},
		[resetSelectedResourceSlot],
	)

	const handleReferenceMentionPathsChange = useCallback(
		(
			paths: string[],
			currentPrompt?: string,
			context?: MessageEditorMentionChangeContext,
			metadataCandidates: readonly ReferenceResourceMetadataCandidate[] = [],
		) => {
			if (!supportsReferenceAssets) return
			const previousPrompt = previousReferenceMentionPromptRef.current ?? undefined
			previousReferenceMentionPromptRef.current = currentPrompt ?? null
			const uniquePathByIdentity = new Map<string, string>()
			paths.forEach((path) => {
				const identity = getCanvasResourceReferenceIdentity(path, resolveResourceReference)
				if (identity && !uniquePathByIdentity.has(identity)) {
					uniquePathByIdentity.set(identity, path)
				}
			})
			const uniquePaths = Array.from(uniquePathByIdentity.values())
			const effectiveProtectedPaths = reconcileProtectedReferencePaths({
				referenceFileInfos: referenceImageInfos,
				protectedReferencePaths,
				currentPrompt,
				previousPrompt,
				source: context?.source,
				resolveResourceReference,
			})
			const nextProtectedPaths = unprotectPromptBoundReferencePaths(
				effectiveProtectedPaths,
				uniquePaths,
				resolveResourceReference,
			)
			updateProtectedReferencePaths(nextProtectedPaths)
			const nextProtectedPathIdentities = new Set(
				nextProtectedPaths.map((path) =>
					getCanvasResourceReferenceIdentity(path, resolveResourceReference),
				),
			)
			const sourcePaths = [
				...nextProtectedPaths,
				...uniquePaths.filter(
					(path) =>
						!nextProtectedPathIdentities.has(
							getCanvasResourceReferenceIdentity(path, resolveResourceReference),
						),
				),
			]
			const latestMentionBindings =
				messageEditorRef?.current?.getMentionBindings?.() ??
				latestMentionBindingsRef.current
			if (latestMentionBindings.length) {
				updateMentionBindings(latestMentionBindings)
			}
			const typeMetadataCandidates: ReferenceResourceMetadataCandidate[] = [
				...referenceImageInfos,
				...metadataCandidates,
				...matchableItems.flatMap((item) =>
					item.path ? [{ path: item.path, assetType: item.assetType }] : [],
				),
			]
			const nextInfos = sourcePaths
				.map((path) => {
					const existingInfo = referenceImageInfos.find((info) =>
						areCanvasResourceReferencesSame(info.path, path, resolveResourceReference),
					)
					if (
						existingInfo &&
						isReferenceAssetTypeAllowed(existingInfo.assetType, currentInputModeConfig)
					) {
						return existingInfo
					}
					const matchedItem = matchableItems.find((item) =>
						Boolean(
							item.path &&
							areCanvasResourceReferencesSame(
								item.path,
								path,
								resolveResourceReference,
							),
						),
					)
					const binding = latestMentionBindings.find((item) =>
						areCanvasResourceReferencesSame(item.path, path, resolveResourceReference),
					)
					const normalizedInfo = resolveVideoReferenceAssetInfo({
						path,
						fileName: matchedItem?.name || binding?.fileName,
						file_id: binding?.fileId || existingInfo?.file_id,
						source_file_id: binding?.sourceFileId || existingInfo?.source_file_id,
						source_project_id:
							binding?.sourceProjectId || existingInfo?.source_project_id,
						project_id: binding?.projectId || existingInfo?.project_id,
						metadataCandidates: typeMetadataCandidates,
						resolveResourceReference,
					})
					if (!normalizedInfo) return null
					if (
						!isReferenceAssetTypeAllowed(
							normalizedInfo.assetType,
							currentInputModeConfig,
						)
					)
						return null
					return normalizedInfo
				})
				.filter((item): item is VideoReferenceAssetInfo => Boolean(item))
			const normalizedInfos =
				maxReferenceImages !== undefined
					? clampReferenceAssetsToLimits(
							nextInfos.slice(0, maxReferenceImages),
							currentInputModeConfig,
							{ ignoreModeMaxCountForTotal: selectedInputMode === "omni_reference" },
						)
					: clampReferenceAssetsToLimits(nextInfos, currentInputModeConfig, {
							ignoreModeMaxCountForTotal: selectedInputMode === "omni_reference",
						})
			const quickEditSource = quickEditSourceRef.current
			if (
				context?.source === "user" &&
				quickEditSource &&
				!normalizedInfos.some((info) =>
					areCanvasResourceReferencesSame(
						info.path,
						quickEditSource.path,
						resolveResourceReference,
					),
				)
			) {
				// 同步清理所有模式缓存，避免用户显式删除后切回旧模式时源视频再次出现。
				modeDraftCacheRef.current = removeQuickEditSourceFromModeDraftCache(
					modeDraftCacheRef.current,
					quickEditSource,
					resolveResourceReference,
				)
				quickEditSourceRef.current = null
				quickEditSourceRemovedRef.current = true
			}
			setReferenceImageInfos(normalizedInfos)
			setIsPopoverOpen(false)
			setIsReferenceProjectPanelOpen(false)
			resetSelectedResourceSlot()
			if (normalizedInfos.length > 0) {
				activeInputTabRef.current = "reference"
				setActiveInputTab("reference")
			}
		},
		[
			supportsReferenceAssets,
			currentInputModeConfig,
			matchableItems,
			maxReferenceImages,
			messageEditorRef,
			protectedReferencePaths,
			referenceImageInfos,
			resetSelectedResourceSlot,
			resolveResourceReference,
			selectedInputMode,
			updateMentionBindings,
			updateProtectedReferencePaths,
		],
	)

	const prepareResourceSlotSelection = useCallback(
		(
			inputTab: "frame" | "reference",
			slotIndex: number,
			options?: {
				slotKey?: string
				referenceAssetKind?: VideoReferenceAssetKind
				referenceAssetKinds?: VideoReferenceAssetKind[]
				path?: string
			},
		) => {
			const targetPaths = inputTab === "frame" ? currentFrameImages : currentReferenceImages
			const nextSlot = {
				inputTab,
				slotIndex,
				slotKey: options?.slotKey,
				referenceAssetKind: options?.referenceAssetKind,
				referenceAssetKinds: options?.referenceAssetKinds,
				path: options?.path ?? targetPaths[slotIndex],
			}
			selectedResourceSlotRef.current = nextSlot
			setSelectedResourceSlot(nextSlot)
		},
		[currentFrameImages, currentReferenceImages],
	)

	const handleReferenceImageRemove = useCallback(
		(path: string) => {
			isRemovingReferenceImageRef.current = true
			// 图片编辑器在 Popover 内删图需保持打开；视频编辑器在 SourceList 槽位上删图，应关闭来源菜单
			setIsPopoverOpen(false)
			selectedResourceSlotRef.current = null
			setSelectedResourceSlot(null)
			if (popoverCloseTimeoutRef.current) {
				clearTimeout(popoverCloseTimeoutRef.current)
				popoverCloseTimeoutRef.current = null
			}
			const removedInfo = referenceImageInfos.find((info) =>
				areCanvasResourceReferencesSame(info.path, path, resolveResourceReference),
			)
			const currentQuickEditSource = quickEditSourceRef.current
			if (
				currentQuickEditSource &&
				areCanvasResourceReferencesSame(
					currentQuickEditSource.path,
					path,
					resolveResourceReference,
				)
			) {
				modeDraftCacheRef.current = removeQuickEditSourceFromModeDraftCache(
					modeDraftCacheRef.current,
					currentQuickEditSource,
					resolveResourceReference,
				)
				quickEditSourceRef.current = null
				quickEditSourceRemovedRef.current = true
			}
			setPrompt((currentPrompt) =>
				removeMentionFromString(currentPrompt, path, removedInfo?.fileName),
			)
			setReferenceImageInfos((prev) =>
				prev.filter(
					(info) =>
						!areCanvasResourceReferencesSame(info.path, path, resolveResourceReference),
				),
			)
			updateProtectedReferencePaths(
				protectedReferencePaths.filter(
					(protectedPath) =>
						!areCanvasResourceReferencesSame(
							protectedPath,
							path,
							resolveResourceReference,
						),
				),
			)
			setTimeout(() => {
				isRemovingReferenceImageRef.current = false
			}, 200)
		},
		[
			protectedReferencePaths,
			referenceImageInfos,
			resolveResourceReference,
			updateProtectedReferencePaths,
		],
	)

	const handleFrameImageRemove = useCallback(
		(slotIndex: number) => {
			isRemovingReferenceImageRef.current = true
			setIsPopoverOpen(false)
			resetSelectedResourceSlot()
			if (popoverCloseTimeoutRef.current) {
				clearTimeout(popoverCloseTimeoutRef.current)
				popoverCloseTimeoutRef.current = null
			}
			setFrameImageInfos((prev) => {
				const next = [...prev]
				delete next[slotIndex]
				return next
			})
			setTimeout(() => {
				isRemovingReferenceImageRef.current = false
			}, 200)
		},
		[resetSelectedResourceSlot],
	)

	const handleSwapFramePair = useCallback(() => {
		setIsPopoverOpen(false)
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
			popoverCloseTimeoutRef.current = null
		}
		selectedResourceSlotRef.current = null
		resetSelectedResourceSlot()
		setFrameImageInfos((prev) => {
			if (prev.length < 2) return prev
			const next = [...prev]
			;[next[0], next[1]] = [next[1], next[0]]
			return next
		})
	}, [resetSelectedResourceSlot])

	useEffect(() => {
		if (!availableInputTabs.includes("frame") || !availableInputTabs.includes("reference"))
			return
		if (
			hasReferenceImagesConfigured &&
			!hasFrameImagesConfigured &&
			activeInputTab !== "reference"
		) {
			activeInputTabRef.current = "reference"
			setActiveInputTab("reference")
		}
		if (
			hasFrameImagesConfigured &&
			!hasReferenceImagesConfigured &&
			activeInputTab !== "frame"
		) {
			activeInputTabRef.current = "frame"
			setActiveInputTab("frame")
		}
	}, [availableInputTabs, hasFrameImagesConfigured, hasReferenceImagesConfigured, activeInputTab])

	const handlePopoverMouseEnter = useCallback(() => {
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
			popoverCloseTimeoutRef.current = null
		}
		setIsPopoverOpen(true)
	}, [])

	const handlePopoverMouseLeave = useCallback(() => {
		if (isRemovingReferenceImageRef.current) return
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
		}
		popoverCloseTimeoutRef.current = setTimeout(() => {
			setIsPopoverOpen(false)
			popoverCloseTimeoutRef.current = null
		}, 100)
	}, [])

	const buildRequestParams = useCallback((): Partial<GenerateVideoRequest> => {
		const trimmedPrompt = prompt.trim() || undefined
		const draftEnabled = selectedDraft === true && canEnableDraft
		const selectedResolutionIsValid = supportedResolutionOptions.some(
			(option) => option.value === selectedResolution,
		)
		const requestResolution = draftEnabled
			? "480p"
			: selectedResolutionIsValid
				? selectedResolution
				: supportedResolutionOptions[0]?.value
		const generation = {
			...(supportedAspectRatioOptions.length > 0 && selectedAspectRatio
				? { aspect_ratio: selectedAspectRatio }
				: {}),
			...(supportedResolutionOptions.length > 0 && requestResolution
				? { resolution: requestResolution }
				: {}),
			...(supportedDurationOptions.length > 0 &&
			selectedDurationSeconds != null &&
			Number.isFinite(selectedDurationSeconds)
				? { duration_seconds: selectedDurationSeconds }
				: {}),
			...(selectedGenerateAudio !== undefined
				? { generate_audio: selectedGenerateAudio }
				: {}),
			...(selectedWebSearch !== undefined ? { web_search: selectedWebSearch } : {}),
			// 方舟侧缺省即为 false；关闭时省略字段，只有用户明确开启才透传。
			...(draftEnabled ? { draft: true } : {}),
			...(selectedCompressionQuality
				? { compression_quality: selectedCompressionQuality }
				: {}),
		}
		/** 仅打包当前 input_mode 允许的 inputs，互斥模式下的缓存不参与请求 */
		const frameInputs =
			supportsStartFrame || supportsEndFrame
				? buildFrameInputs(currentFrameImages, {
						supportsStartFrame,
						supportsEndFrame,
					})
				: {}
		const referenceInputs = supportsReferenceAssets
			? buildReferenceAssetInputs(referenceImageInfos, currentInputModeConfig)
			: {}
		const inputs = {
			...frameInputs,
			...referenceInputs,
		}
		const promptReferences = resolveVideoPromptPlaceholderReferences({
			mode: selectedInputMode,
			referenceImageInfos,
		})
		let encodedPrompt: string | undefined
		if (trimmedPrompt) {
			encodedPrompt = encodeVideoPromptMentionsToPlaceholders(
				trimmedPrompt,
				promptReferences,
				promptPlaceholderTokenConfig,
			)
		}

		return {
			model_id: selectedModelId || undefined,
			prompt: encodedPrompt,
			input_mode: selectedInputMode,
			task: currentInputModeConfig?.task || "generate",
			...(hasVideoInputs(inputs) ? { inputs } : {}),
			...(Object.keys(generation).length > 0 ? { generation } : {}),
		}
	}, [
		currentFrameImages,
		currentInputModeConfig,
		prompt,
		selectedInputMode,
		referenceImageInfos,
		promptPlaceholderTokenConfig,
		selectedAspectRatio,
		selectedModelId,
		selectedResolution,
		supportedAspectRatioOptions.length,
		supportedResolutionOptions,
		supportedDurationOptions.length,
		selectedDurationSeconds,
		selectedGenerateAudio,
		selectedWebSearch,
		selectedDraft,
		canEnableDraft,
		selectedCompressionQuality,
		supportsReferenceAssets,
		supportsEndFrame,
		supportsStartFrame,
	])

	const saveDraftRequest = useCallback(
		(request: Partial<GenerateVideoRequest>) => {
			if (isRestoringRef.current) {
				pendingDraftRequestRef.current = null
				return
			}
			if (!canvas || !manageRecoverySession || !recoveryKey) return
			const capturedMentionBindings =
				messageEditorRef?.current?.getMentionBindings?.() ??
				latestMentionBindingsRef.current
			updateMentionBindings(capturedMentionBindings)
			const snapshot: VideoEditSessionSnapshot = {
				request,
				modeDrafts: cloneModeDraftCache(modeDraftCacheRef.current),
				quickEditSource: cloneQuickEditSource(quickEditSourceRef.current) ?? undefined,
				quickEditSourceRemoved: quickEditSourceRemovedRef.current ? true : undefined,
				mentionBindings: capturedMentionBindings,
			}
			canvas.mediaEditRecoveryManager.saveDraft(
				recoveryKey,
				recoverySourceFingerprint,
				snapshot,
			)
			persistVideoEditorDraft({
				canvas,
				elementId: videoElement.id,
				contentId: recoveryKey.contentId,
				snapshot,
			})
			pendingDraftRequestRef.current = null
		},
		[
			canvas,
			manageRecoverySession,
			messageEditorRef,
			recoveryKey,
			recoverySourceFingerprint,
			updateMentionBindings,
			videoElement.id,
		],
	)

	const cancelPendingDraftPersistence = useCallback(() => {
		if (draftPersistTimeoutRef.current) {
			clearTimeout(draftPersistTimeoutRef.current)
			draftPersistTimeoutRef.current = null
		}
		pendingDraftRequestRef.current = null
	}, [])

	const scheduleDraftPersistence = useCallback(
		(request: Partial<GenerateVideoRequest>) => {
			if (isRestoringRef.current) {
				pendingDraftRequestRef.current = null
				return
			}
			pendingDraftRequestRef.current = request
			if (draftPersistTimeoutRef.current) {
				clearTimeout(draftPersistTimeoutRef.current)
			}
			draftPersistTimeoutRef.current = setTimeout(() => {
				draftPersistTimeoutRef.current = null
				if (isRestoringRef.current) {
					pendingDraftRequestRef.current = null
					return
				}
				if (!pendingDraftRequestRef.current) return
				saveDraftRequest(pendingDraftRequestRef.current)
			}, 250)
		},
		[saveDraftRequest],
	)

	const restoreConfig = useCallback(() => {
		if (!canvas) return
		const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
		if (!(elementInstance instanceof VideoElementClass)) return
		if (isApplyingRestoreRef.current) return
		isApplyingRestoreRef.current = true

		isRestoringRef.current = true
		try {
			const shouldRestoreDraft = restoreOnMount === "preferDraft"
			const sessionSnapshot =
				sessionRestoreSnapshotRef.current ??
				(shouldRestoreDraft && manageRecoverySession && recoveryKey
					? canvas.mediaEditRecoveryManager.get<VideoEditSessionSnapshot>(
							recoveryKey,
							recoverySourceFingerprint,
						)?.draft
					: undefined) ??
				(shouldRestoreDraft && persistedEditorDraft
					? {
							request: persistedEditorDraft.request,
							modeDrafts: persistedEditorDraft.modeDrafts,
							quickEditSource: persistedEditorDraft.quickEditSource,
							quickEditSourceRemoved: persistedEditorDraft.quickEditSourceRemoved,
							mentionBindings: persistedEditorDraft.mentionBindings,
						}
					: undefined)
			sessionRestoreSnapshotRef.current = null
			const restoredMentionBindings = sessionSnapshot?.mentionBindings ?? []
			updateMentionBindings(restoredMentionBindings)
			const isSessionRestore = Boolean(sessionSnapshot)
			const isQuickEditIntent =
				recoveryIntent === "quick-edit" ||
				restoreOnMount === "quickEdit" ||
				restoreModeRef.current === "quickEdit"
			const isFreshQuickEdit = isQuickEditIntent && !isSessionRestore
			const fromElementDrafts = sessionSnapshot?.modeDrafts ?? undefined
			modeDraftCacheRef.current = cloneModeDraftCache(
				(fromElementDrafts ?? {}) as Partial<Record<VideoInputMode, VideoModeInputDraft>>,
			)
			const currentRequest = savedRequest
			const requestToRestore = sessionSnapshot?.request ?? currentRequest
			const rootStorage = canvas.magicConfigManager.config?.methods?.getRootStorage?.()
			const defaultConfig = rootStorage?.defaultGenerateVideoConfig as
				DefaultGenerateVideoConfig | undefined
			const currentVideoPath = getActiveContent(videoElement)?.src
			const currentVideoFileName = currentVideoPath
				? getCanvasResourceFileName(currentVideoPath) || currentVideoPath
				: ""
			const quickEditSourceRemoved = sessionSnapshot?.quickEditSourceRemoved === true
			quickEditSourceRemovedRef.current = quickEditSourceRemoved
			const quickEditSource =
				isQuickEditIntent && !quickEditSourceRemoved
					? (cloneQuickEditSource(sessionSnapshot?.quickEditSource) ??
						(currentVideoPath
							? (resolveVideoReferenceAssetInfo({
									path: currentVideoPath,
									src: currentVideoPath,
									fileName: currentVideoFileName,
									explicitAssetType: "video",
									resolveResourceReference,
								}) ?? null)
							: null))
					: null
			quickEditSourceRef.current = quickEditSource
			const quickEditPreferredModelId = selectedModelId || savedRequest?.model_id
			const quickEditModel = isFreshQuickEdit
				? resolveVideoReferenceVideoModel(videoModelList, quickEditPreferredModelId)
				: null
			if (isFreshQuickEdit && !quickEditModel) return
			const config = requestToRestore || defaultConfig
			const modelId =
				quickEditModel?.model.model_id ||
				(config?.model_id &&
				videoModelList.some((model) => model.model_id === config.model_id)
					? config.model_id
					: videoModelList[0]?.model_id)
			const fallbackModel =
				videoModelList.find((model) => model.model_id === modelId) || videoModelList[0]

			if (modelId) {
				setSelectedModelId(modelId)
			}
			const restoredInputMode =
				sessionSnapshot?.request.input_mode ??
				quickEditModel?.inputMode ??
				resolveInputModeFromRequest(requestToRestore, fallbackModel)
			setSelectedInputMode(restoredInputMode)
			const restoredModeConfig = getInputModeConfig(fallbackModel, restoredInputMode)
			const restoredReferenceInfos = clampReferenceAssetsToLimits(
				isFreshQuickEdit && quickEditSource
					? [quickEditSource]
					: buildReferenceAssetInfos(requestToRestore?.inputs),
				restoredModeConfig,
				{
					ignoreModeMaxCountForTotal: restoredInputMode === "omni_reference",
					preserveIncompatibleVariants: true,
				},
			)
			const restoredVariantCode = resolveReferenceAssetLimits(
				restoredModeConfig,
				restoredReferenceInfos,
				{ ignoreModeMaxCountForTotal: restoredInputMode === "omni_reference" },
			).variantCode
			const restoredVariantConfig = restoredModeConfig?.variants?.find(
				(variant) => variant.code === restoredVariantCode,
			)
			const resolvedSelection = resolveVideoGenerationSelection(
				fallbackModel,
				config?.generation,
				mergeVideoGenerationConstraints(
					restoredModeConfig?.generation_constraints,
					restoredVariantConfig?.generation_constraints,
				),
			)
			setSelectedAspectRatio(resolvedSelection.aspectRatio)
			setSelectedResolution(resolvedSelection.resolution)

			const fallbackConstraints = mergeVideoGenerationConstraints(
				restoredModeConfig?.generation_constraints,
				restoredVariantConfig?.generation_constraints,
			)
			const fallbackDurations = buildVideoDurationOptions(fallbackModel, fallbackConstraints)
			const fallbackGen = fallbackModel?.video_generation_config?.generation
			const fromTempDuration = isFreshQuickEdit
				? undefined
				: requestToRestore?.generation?.duration_seconds
			const resolvedDuration =
				fromTempDuration != null && fallbackDurations.includes(fromTempDuration)
					? fromTempDuration
					: resolveVideoDefaultDuration(fallbackModel, fallbackConstraints)
			setSelectedDurationSeconds(fallbackDurations.length > 0 ? resolvedDuration : undefined)
			setSelectedGenerateAudio(
				fallbackGen?.generate_audio
					? (requestToRestore?.generation?.generate_audio ??
							fallbackGen.generate_audio.default)
					: undefined,
			)
			setSelectedWebSearch(
				fallbackGen?.web_search
					? (requestToRestore?.generation?.web_search ?? fallbackGen.web_search.default)
					: undefined,
			)
			const draftFromRequest = isFreshQuickEdit
				? undefined
				: requestToRestore?.generation?.draft
			setSelectedDraft(
				fallbackGen?.draft ? (draftFromRequest ?? fallbackGen.draft.default) : undefined,
			)

			const qualityOpts =
				fallbackGen?.supports_compression_quality &&
				fallbackGen.compression_quality_options?.length
					? fallbackGen.compression_quality_options.filter(Boolean)
					: []
			const fromTempQuality = isFreshQuickEdit
				? undefined
				: requestToRestore?.generation?.compression_quality
			setSelectedCompressionQuality(
				fromTempQuality && qualityOpts.includes(fromTempQuality)
					? fromTempQuality
					: qualityOpts[0],
			)
			if (!modeDraftCacheRef.current[restoredInputMode]) {
				const draftFromRequest = buildModeDraftFromRequest(
					restoredInputMode,
					isFreshQuickEdit ? undefined : requestToRestore,
					fallbackModel,
				)
				const draftFromRequestReferenceInfos = isFreshQuickEdit
					? restoredReferenceInfos
					: (draftFromRequest.referenceAssetInfos ?? [])
				modeDraftCacheRef.current = mergeCurrentUiIntoModeDraftCache(
					modeDraftCacheRef.current,
					restoredInputMode,
					isFreshQuickEdit ? "" : (draftFromRequest.prompt ?? ""),
					isFreshQuickEdit
						? "reference"
						: resolveModeDraftInputTab(
								restoredInputMode,
								fallbackModel,
								draftFromRequest.activeInputTab,
							),
					isFreshQuickEdit ? [] : (draftFromRequest.frameImageInfos ?? []),
					draftFromRequestReferenceInfos,
					isFreshQuickEdit ? [] : (draftFromRequest.linkedFrameBindings ?? []),
				)
			}
			const restoredModeDraft = getModeDraftForView(
				restoredInputMode,
				fallbackModel,
				modeDraftCacheRef.current,
			)
			const quickEditSourceProjection =
				isQuickEditIntent && quickEditSource && !isFreshQuickEdit
					? projectQuickEditSourceIntoModeDraft({
							draft: restoredModeDraft,
							source: quickEditSource,
							inputMode: restoredInputMode,
							modeConfig: restoredModeConfig,
							resolveResourceReference,
						})
					: null
			const restoredModeDraftWithSource = quickEditSourceProjection?.applied
				? quickEditSourceProjection.draft
				: restoredModeDraft
			const restoredReferenceInfosForDraft = isFreshQuickEdit
				? restoredReferenceInfos
				: (restoredModeDraftWithSource.referenceAssetInfos ?? [])
			const restoredFrameInfosForDraft = isFreshQuickEdit
				? []
				: (restoredModeDraftWithSource.frameImageInfos ?? [])
			const restoredLinkedFrameBindings = isFreshQuickEdit
				? []
				: (restoredModeDraftWithSource.linkedFrameBindings ?? [])
			const restoredActiveInputTabForDraft = isFreshQuickEdit
				? "reference"
				: resolveModeDraftInputTab(
						restoredInputMode,
						fallbackModel,
						restoredModeDraftWithSource.activeInputTab,
					)
			const rawRestoredPrompt = isFreshQuickEdit
				? quickEditSource
					? appendMentionToString("", quickEditSource.path, quickEditSource.fileName)
					: ""
				: isQuickEditIntent && restoredModeDraftWithSource.prompt
					? restoredModeDraftWithSource.prompt
					: requestToRestore?.prompt && requestToRestore.prompt.trim().length > 0
						? requestToRestore.prompt
						: (restoredModeDraftWithSource.prompt ?? "")
			const promptToRestore = decodeVideoPromptPlaceholdersToMentions(
				rawRestoredPrompt,
				resolveVideoPromptPlaceholderReferences({
					mode: restoredInputMode,
					referenceImageInfos: restoredReferenceInfosForDraft,
				}),
				restoredInputMode,
				promptPlaceholderTokenConfig,
			)
			setPrompt(promptToRestore)
			setFrameImageInfos(restoredFrameInfosForDraft)
			setLinkedFrameBindings(restoredLinkedFrameBindings)
			activeInputTabRef.current = restoredActiveInputTabForDraft
			setActiveInputTab(restoredActiveInputTabForDraft)
			setReferenceImageInfos(restoredReferenceInfosForDraft)
			applyBindingStateFromPromptAndReferences(
				promptToRestore,
				restoredReferenceInfosForDraft,
				restoredMentionBindings,
			)

			const mergedDrafts = mergeCurrentUiIntoModeDraftCache(
				modeDraftCacheRef.current,
				restoredInputMode,
				promptToRestore,
				restoredActiveInputTabForDraft,
				restoredFrameInfosForDraft,
				restoredReferenceInfosForDraft,
				restoredLinkedFrameBindings,
			)
			modeDraftCacheRef.current = mergedDrafts

			hasRestoredRef.current = true
			setRestoreRevision((revision) => revision + 1)
		} finally {
			setTimeout(() => {
				isRestoringRef.current = false
				isApplyingRestoreRef.current = false
			}, 0)
		}
	}, [
		buildModeDraftFromRequest,
		canvas,
		getModeDraftForView,
		applyBindingStateFromPromptAndReferences,
		videoElement.id,
		videoElement,
		savedRequest,
		selectedModelId,
		videoModelList,
		resolveModeDraftInputTab,
		promptPlaceholderTokenConfig,
		restoreOnMount,
		manageRecoverySession,
		recoveryKey,
		recoverySourceFingerprint,
		recoveryIntent,
		persistedEditorDraft,
		resolveResourceReference,
		updateMentionBindings,
	])

	const restoreOriginalGenerateVideoRequestToUi = useCallback(() => {
		if (!canvas) return
		if (isApplyingRestoreRef.current) return
		if (!savedRequest) return

		cancelPendingDraftPersistence()
		modeDraftCacheRef.current = {}
		quickEditSourceRef.current = null
		quickEditSourceRemovedRef.current = false
		updateMentionBindings([])
		hasRestoredRef.current = false
		restoreModeRef.current = "normal"
		restoreConfig()
	}, [
		canvas,
		videoElement.id,
		savedRequest,
		cancelPendingDraftPersistence,
		restoreConfig,
		updateMentionBindings,
	])

	const restoreQuickEditConfigToUi = useCallback(() => {
		if (!canvas || !getActiveContent(videoElement)?.src) return
		const quickEditPreferredModelId = selectedModelId || savedRequest?.model_id
		if (!resolveVideoReferenceVideoModel(videoModelList, quickEditPreferredModelId)) return
		cancelPendingDraftPersistence()
		modeDraftCacheRef.current = {}
		quickEditSourceRef.current = null
		quickEditSourceRemovedRef.current = false
		updateMentionBindings([])
		hasRestoredRef.current = false
		restoreModeRef.current = "quickEdit"
		restoreConfig()
	}, [
		canvas,
		cancelPendingDraftPersistence,
		restoreConfig,
		selectedModelId,
		updateMentionBindings,
		videoElement,
		videoModelList,
	])

	const buildSessionSnapshot = useCallback((): VideoEditSessionSnapshot => {
		const capturedMentionBindings =
			messageEditorRef?.current?.getMentionBindings?.() ?? latestMentionBindingsRef.current
		updateMentionBindings(capturedMentionBindings)
		const request = buildRequestParams()
		return {
			request,
			modeDrafts: cloneModeDraftCache(modeDraftCacheRef.current),
			quickEditSource: cloneQuickEditSource(quickEditSourceRef.current) ?? undefined,
			quickEditSourceRemoved: quickEditSourceRemovedRef.current ? true : undefined,
			mentionBindings: capturedMentionBindings,
		}
	}, [buildRequestParams, messageEditorRef, updateMentionBindings])

	// 首次完成初始化后建立普通生成意图的 baseline；已有失败/中断草稿则保留原 baseline。
	useEffect(() => {
		if (
			!manageRecoverySession ||
			!canvas ||
			!recoveryKey ||
			!hasRestoredRef.current ||
			restoreRevision === 0
		)
			return
		if (!canvas.mediaEditRecoveryManager.get(recoveryKey, recoverySourceFingerprint)) {
			const baseline = buildSessionSnapshot()
			canvas.mediaEditRecoveryManager.set(
				recoveryKey,
				recoverySourceFingerprint,
				baseline,
				baseline,
			)
		}
	}, [
		buildSessionSnapshot,
		canvas,
		manageRecoverySession,
		recoveryKey,
		recoverySourceFingerprint,
		restoreRevision,
	])

	const restoreSessionSnapshotToUi = useCallback(
		(snapshot: VideoEditSessionSnapshot) => {
			if (!canvas || videoModelList.length === 0) return
			if (isApplyingRestoreRef.current) return

			cancelPendingDraftPersistence()
			sessionRestoreSnapshotRef.current = snapshot
			hasRestoredRef.current = false
			restoreModeRef.current = "normal"
			restoreConfig()
		},
		[canvas, cancelPendingDraftPersistence, restoreConfig, videoModelList.length],
	)

	useEffect(() => {
		if (
			!canvas ||
			hasRestoredRef.current ||
			isRestoringRef.current ||
			videoModelList.length === 0
		)
			return
		restoreConfig()
	}, [canvas, videoModelList, restoreConfig])

	useEffect(() => {
		updateProtectedReferencePaths(
			pruneProtectedReferencePaths(
				currentReferenceImages,
				protectedReferencePaths,
				resolveResourceReference,
			),
		)
	}, [
		currentReferenceImages,
		protectedReferencePaths,
		resolveResourceReference,
		updateProtectedReferencePaths,
	])

	useLayoutEffect(() => {
		if (!canvas || !hasRestoredRef.current || isRestoringRef.current) return
		const merged = mergeCurrentUiIntoModeDraftCache(
			modeDraftCacheRef.current,
			selectedInputMode,
			prompt,
			activeInputTab,
			frameImageInfos,
			referenceImageInfos,
			linkedFrameBindings,
		)
		modeDraftCacheRef.current = merged
	}, [
		activeInputTab,
		canvas,
		videoElement.id,
		selectedInputMode,
		prompt,
		frameImageInfos,
		referenceImageInfos,
		linkedFrameBindings,
	])

	useUpdateEffect(() => {
		if (isRestoringRef.current) return
		scheduleDraftPersistence(buildRequestParams())
	}, [buildRequestParams, scheduleDraftPersistence])

	useUnmount(() => {
		if (canvas && manageRecoverySession && hasRestoredRef.current && !isRestoringRef.current) {
			modeDraftCacheRef.current = mergeCurrentUiIntoModeDraftCache(
				modeDraftCacheRef.current,
				selectedInputMode,
				prompt,
				activeInputTab,
				frameImageInfos,
				referenceImageInfos,
				linkedFrameBindings,
			)
			saveDraftRequest(buildRequestParams())
		}
		cancelPendingDraftPersistence()
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
		}
	})

	const handlers = useMemo(
		() => ({
			setPrompt,
			setLinkedFrameBindings,
			setPopoverOpen: setIsPopoverOpen,
			setReferenceProjectPanelOpen: setIsReferenceProjectPanelOpen,
			handleModelChange,
			handleResolutionChange,
			handleRatioChange,
			handleDurationChange,
			handleDurationDraftChange,
			handleDurationPopoverOpenChange,
			handleGenerateAudioChange,
			handleWebSearchChange,
			handleDraftChange,
			handleCompressionQualityChange,
			handleInputModeChange,
			handleInputTabChange,
			handleReferenceMentionPathsChange,
			resetSelectedResourceSlot,
			prepareResourceSlotSelection,
			replaceFrameImageAt,
			appendFrameImage,
			replaceReferenceImageAt,
			replaceSelectedResource,
			handleReferenceImageRemove,
			handleFrameImageRemove,
			cancelPendingResourceUpload,
			handleSwapFramePair,
			handlePopoverMouseEnter,
			handlePopoverMouseLeave,
			buildRequestParams,
			saveDraftRequest,
			cancelPendingDraftPersistence,
			restoreOriginalGenerateVideoRequestToUi,
			restoreQuickEditConfigToUi,
			buildSessionSnapshot,
			restoreSessionSnapshotToUi,
			triggerFileSelect,
			uploadReferenceFiles,
			uploadMentionController,
			handleFileChange,
			syncReferenceImagesFromElement,
			updateMentionBindings,
		}),
		[
			handleModelChange,
			handleResolutionChange,
			handleRatioChange,
			handleDurationChange,
			handleGenerateAudioChange,
			handleWebSearchChange,
			handleDraftChange,
			handleCompressionQualityChange,
			handleInputModeChange,
			handleInputTabChange,
			handleReferenceMentionPathsChange,
			resetSelectedResourceSlot,
			prepareResourceSlotSelection,
			replaceFrameImageAt,
			appendFrameImage,
			replaceReferenceImageAt,
			replaceSelectedResource,
			handleReferenceImageRemove,
			handleFrameImageRemove,
			cancelPendingResourceUpload,
			handleSwapFramePair,
			handlePopoverMouseEnter,
			handlePopoverMouseLeave,
			buildRequestParams,
			saveDraftRequest,
			cancelPendingDraftPersistence,
			restoreOriginalGenerateVideoRequestToUi,
			restoreQuickEditConfigToUi,
			buildSessionSnapshot,
			restoreSessionSnapshotToUi,
			triggerFileSelect,
			uploadReferenceFiles,
			uploadMentionController,
			handleFileChange,
			syncReferenceImagesFromElement,
			updateMentionBindings,
		],
	)

	return {
		selectedModelId,
		selectedInputMode,
		availableInputModes,
		currentInputModeConfig,
		prompt,
		selectedResolution,
		selectedAspectRatio,
		selectedDurationSeconds,
		durationDraftSeconds,
		selectedGenerateAudio,
		selectedWebSearch,
		selectedDraft,
		canEnableDraft,
		selectedCompressionQuality,
		currentFrameImages,
		frameImageInfos,
		linkedFrameBindings,
		currentReferenceImages,
		protectedReferencePaths,
		referenceBindingMode,
		referenceImageInfos,
		mentionBindings,
		matchableItems,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		maxFrameImages,
		maxReferenceImages,
		isReferenceImageLimitReached,
		referenceAssetLimits,
		referenceAssetCounts,
		isUploading,
		resourceUploadSlotKey,
		uploadUiDismissed,
		activeInputTab,
		hasFrameImagesConfigured,
		hasReferenceImagesConfigured,
		supportsStartFrame,
		supportsEndFrame,
		supportsReferenceAssets,
		isReferencePolicyReady,
		supportsReferenceImages,
		supportsReferenceVideos,
		supportsReferenceAudios,
		referenceResourceType,
		fileInputAccept,
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		supportedDurationOptions,
		durationType: durationConfig.type,
		durationRange: durationConfig.range,
		supportedCompressionQualityOptions,
		currentSelectValue,
		ratioOption,
		isPopoverOpen,
		isReferenceProjectPanelOpen,
		selectedResourceSlot,
		hasRestoredRef,
		isRestoringRef,
		restoreRevision,
		handlers,
		fileInputRef,
	}
}
