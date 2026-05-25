import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useUnmount, useUpdateEffect } from "ahooks"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useMagic } from "../../context/MagicContext"
import type {
	DefaultGenerateVideoConfig,
	GenerateVideoRequest,
	StoredVideoModeDraftsMap,
	UploadFileResponse,
	VideoGenerationConstraints,
	VideoInputMode,
} from "../../types.magic"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"
import { useFileInput } from "../MessageEditor/useFileInput"
import { removeMentionFromString } from "../MessageEditor/tiptap/contentUtils"
import {
	resolvePromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenConfig,
} from "../MessageEditor/reference-assets/promptPlaceholderTokenConfig"
import {
	areOrderedPathsEqual,
	pruneProtectedReferencePaths,
	resolveReferenceBindingState,
	unprotectPromptBoundReferencePaths,
	type ReferenceBindingMode,
} from "../MessageEditor/reference-assets/referenceBinding"
import { createReferenceResourcePanelItemFromPath } from "../MessageEditor/reference-assets/createReferenceResourcePanelItem"
import type { ReferenceResourceType } from "../MessageEditor/reference-assets/reference-resource.types"
import {
	cloneFrameSlotInfos,
	cloneModeDraftCache,
	cloneVideoReferenceAssetInfos,
	mergeCurrentUiIntoModeDraftCache,
} from "./video-editor-config.draft"
import {
	buildVideoAspectRatioOptions,
	buildVideoDurationOptions,
	buildVideoResolutionOptions,
	resolveVideoGenerationSelection,
	resolveVideoGenerationSelectionPreserving,
} from "./video-editor-config.generation"
import {
	buildFrameInputs,
	buildFrameSlotInfos,
	buildReferenceAssetInfos,
	buildReferenceAssetInputs,
	clampReferenceAssetsToLimits,
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
	resolveInputSubTabForAvailableTabs,
	resolveReferenceAssetType,
} from "./video-editor-config.model"
import type {
	VideoEditorConfig,
	VideoInputSlotInfo,
	VideoModelOption,
	VideoModelOptionGroup,
	VideoModeInputDraft,
	VideoReferenceAssetKind,
	VideoReferenceAssetInfo,
	UseVideoEditorConfigOptions,
} from "./video-editor-config.types"
import {
	decodeVideoPromptPlaceholdersToMentions,
	encodeVideoPromptMentionsToPlaceholders,
	resolveVideoPromptPlaceholderReferences,
} from "./video-prompt-placeholder"

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

export function useVideoEditorConfig(options: UseVideoEditorConfigOptions): VideoEditorConfig {
	const { videoElement, messageEditorRef, restoreOnMount = "preferDraft" } = options
	const { t } = useCanvasDesignI18n()
	const { videoModelList, methods } = useMagic()
	const { canvas } = useCanvas()

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

	const scheduleReferenceMentionInserts = useCallback(
		(
			refs: VideoReferenceAssetInfo[],
			insertOpts?: { placement?: "cursor" | "documentEnd" },
		) => {
			if (!refs.length || !messageEditorRef) return
			const placement = insertOpts?.placement ?? "cursor"
			setTimeout(() => {
				const editor = messageEditorRef.current
				if (!editor) return
				const latestPrompt = editor.getCurrentPrompt()
				const toInsert = selectRefsMissingMentions(latestPrompt, refs)
				if (!toInsert.length) return
				editor.insertMentionItems(
					toInsert.map((r) =>
						createReferenceResourcePanelItemFromPath(r.path, r.fileName),
					),
					placement === "documentEnd" ? { placement: "documentEnd" } : {},
				)
			}, 0)
		},
		[messageEditorRef, selectRefsMissingMentions],
	)

	const [selectedResolution, setSelectedResolution] = useState<string | undefined>(undefined)
	const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | undefined>(undefined)
	const [selectedDurationSeconds, setSelectedDurationSeconds] = useState<number | undefined>(
		undefined,
	)
	const [selectedCompressionQuality, setSelectedCompressionQuality] = useState<
		string | undefined
	>(undefined)
	const [activeInputTab, setActiveInputTab] = useState<"frame" | "reference">("frame")
	const [frameImageInfos, setFrameImageInfos] = useState<Array<UploadFileResponse | undefined>>(
		[],
	)
	const [referenceImageInfos, setReferenceImageInfos] = useState<VideoReferenceAssetInfo[]>([])
	const [protectedReferencePaths, setProtectedReferencePaths] = useState<string[]>([])
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)
	const [isReferenceProjectPanelOpen, setIsReferenceProjectPanelOpen] = useState(false)
	const [selectedResourceSlot, setSelectedResourceSlot] = useState<VideoInputSlotInfo | null>(
		null,
	)
	const [uploadUiDismissed, setUploadUiDismissed] = useState(false)

	const hasRestoredRef = useRef(false)
	const isRestoringRef = useRef(false)
	const popoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const draftPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingDraftRequestRef = useRef<Partial<GenerateVideoRequest> | null>(null)
	const lastPersistedDraftRef = useRef("")
	const isApplyingRestoreRef = useRef(false)
	const isRemovingReferenceImageRef = useRef(false)
	const selectedResourceSlotRef = useRef<VideoInputSlotInfo | null>(null)
	const discardPendingUploadRef = useRef(false)
	/** 本地上传多选：记录起始槽位，按序号连续写入 */
	const batchUploadBaseRef = useRef<{
		inputTab: "frame" | "reference"
		startSlot: number
	} | null>(null)
	const modeDraftCacheRef = useRef<Partial<Record<VideoInputMode, VideoModeInputDraft>>>({})

	const selectedModel = useMemo(() => {
		return videoModelList.find((model) => model.model_id === selectedModelId)
	}, [videoModelList, selectedModelId])

	const availableInputModes = useMemo(() => {
		return getAvailableInputModes(selectedModel)
	}, [selectedModel])
	const currentInputModeConfig = useMemo(() => {
		return getInputModeConfig(selectedModel, selectedInputMode)
	}, [selectedModel, selectedInputMode])
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
				referenceAssetInfos: referenceInfos,
			}
		},
		[buildModeDraftFromRequest, resolveModeDraftInputTab],
	)

	useEffect(() => {
		if (availableInputModes.length === 0) {
			setSelectedInputMode("standard")
			return
		}
		if (!availableInputModes.includes(selectedInputMode)) {
			const nextInputMode = resolveInputModeForAvailableModes(
				availableInputModes,
				selectedInputMode,
			)
			setSelectedInputMode(nextInputMode)
			return
		}
		/** 底部模式 Tab 不展示 standard，若仍停在 standard 会导致无任何 Tab 呈选中态 */
		const hasNonStandardMode = availableInputModes.some((mode) => mode !== "standard")
		if (selectedInputMode === "standard" && hasNonStandardMode) {
			const nonStandardModes = availableInputModes.filter((mode) => mode !== "standard")
			const nextInputMode = resolveInputModeForAvailableModes(
				nonStandardModes,
				"omni_reference",
			)
			setSelectedInputMode(nextInputMode)
		}
	}, [availableInputModes, selectedInputMode])

	useEffect(() => {
		if (!availableInputTabs.includes(activeInputTab)) {
			setActiveInputTab(
				resolveInputSubTabForAvailableTabs(availableInputTabs, activeInputTab),
			)
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
		() => resolveReferenceAssetLimits(currentInputModeConfig, referenceImageInfos),
		[currentInputModeConfig, referenceImageInfos],
	)

	const currentInputModeVariant = useMemo(() => {
		const variantCode = referenceAssetLimits.variantCode
		if (!variantCode) return undefined
		return currentInputModeConfig?.variants?.find((variant) => variant.code === variantCode)
	}, [currentInputModeConfig, referenceAssetLimits.variantCode])

	const effectiveGenerationConstraints = useMemo(() => {
		return mergeVideoGenerationConstraints(
			currentInputModeConfig?.generation_constraints,
			currentInputModeVariant?.generation_constraints,
		)
	}, [currentInputModeConfig?.generation_constraints, currentInputModeVariant])

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
	const updateProtectedReferencePaths = useCallback((nextPaths: string[]) => {
		setProtectedReferencePaths((prev) => {
			return areOrderedPathsEqual(prev, nextPaths) ? prev : nextPaths
		})
	}, [])
	const applyBindingStateFromPromptAndReferences = useCallback(
		(nextPrompt: string, nextReferenceInfos: VideoReferenceAssetInfo[]) => {
			const bindingState = resolveReferenceBindingState({
				prompt: nextPrompt,
				referenceFileInfos: nextReferenceInfos,
				tokenConfig: promptPlaceholderTokenConfig,
			})
			updateProtectedReferencePaths(bindingState.protectedReferencePaths)
			return bindingState
		},
		[promptPlaceholderTokenConfig, updateProtectedReferencePaths],
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
	const matchableItems = useMemo(() => {
		return referenceImageInfos.map((info) => ({
			name: info.fileName,
			path: info.path,
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
	const hasFrameImagesConfigured = useMemo(
		() => currentFrameImages.some((path) => Boolean(path)),
		[currentFrameImages],
	)
	const hasReferenceImagesConfigured = currentReferenceImages.length > 0

	const modelOptions = useMemo<VideoModelOption[]>(() => {
		return videoModelList.map((model) => ({
			label: model.model_name,
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
			if (!canvas || !size) return
			if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return
			canvas.elementManager.update(videoElement.id, {
				width: size.width,
				height: size.height,
			})
		},
		[canvas, videoElement.id],
	)

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
			return
		}
		if (selectedDurationSeconds == null) {
			setSelectedDurationSeconds(supportedDurationOptions[0])
			return
		}
		if (!supportedDurationOptions.includes(selectedDurationSeconds)) {
			setSelectedDurationSeconds(supportedDurationOptions[0])
		}
	}, [selectedDurationSeconds, supportedDurationOptions])

	const resetSelectedResourceSlot = useCallback(() => {
		selectedResourceSlotRef.current = null
		setSelectedResourceSlot(null)
	}, [])

	const replaceFrameImageAt = useCallback(
		(
			slotIndex: number,
			fileInfo: UploadFileResponse,
			options?: { retainResourceSlot?: boolean },
		) => {
			setFrameImageInfos((prev) => {
				const next = [...prev]
				next[slotIndex] = {
					path: fileInfo.path,
					src: fileInfo.src || fileInfo.path,
					fileName: fileInfo.fileName || fileInfo.path.split("/").pop() || fileInfo.path,
				}
				return next
			})
			setActiveInputTab("frame")
			if (!options?.retainResourceSlot) {
				resetSelectedResourceSlot()
			}
		},
		[resetSelectedResourceSlot],
	)

	const replaceReferenceImageAt = useCallback(
		(
			slotIndex: number,
			fileInfo: UploadFileResponse,
			options?: {
				retainResourceSlot?: boolean
				/** 默认 cursor；仅少数场景（如需文末追加）可传 documentEnd */
				mentionPlacement?: "cursor" | "documentEnd"
			},
		) => {
			const assetType = resolveReferenceAssetType(fileInfo.path)
			if (!assetType) return
			if (!isReferenceAssetTypeAllowed(assetType, currentInputModeConfig)) return
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
			const previousInfo = referenceImageInfos[slotIndex]
			const normalizedFileInfo: VideoReferenceAssetInfo = {
				path: fileInfo.path,
				src: fileInfo.src || fileInfo.path,
				fileName: fileInfo.fileName || fileInfo.path.split("/").pop() || fileInfo.path,
				assetType,
			}
			const deduped = referenceImageInfos.filter((info) => info.path !== fileInfo.path)
			const nextInfos = [...deduped]
			const shouldReplaceExisting =
				Boolean(previousInfo) &&
				previousInfo?.assetType === assetType &&
				(!expectedAssetTypes || expectedAssetTypes.includes(previousInfo?.assetType))
			if (shouldReplaceExisting) {
				nextInfos[slotIndex] = normalizedFileInfo
			} else {
				const nextIndex = Math.max(0, Math.min(slotIndex, nextInfos.length))
				nextInfos.splice(nextIndex, 0, normalizedFileInfo)
			}
			const limitedInfos = clampReferenceAssetsToLimits(
				nextInfos.filter(Boolean) as VideoReferenceAssetInfo[],
				currentInputModeConfig,
			)
			setReferenceImageInfos(limitedInfos)
			updateProtectedReferencePaths(
				pruneProtectedReferencePaths(
					limitedInfos.map((info) => info.path),
					protectedReferencePaths,
				),
			)
			setPrompt((currentPrompt) => {
				if (
					shouldReplaceExisting &&
					previousInfo?.path &&
					previousInfo.path !== normalizedFileInfo.path
				) {
					return removeMentionFromString(
						currentPrompt,
						previousInfo.path,
						previousInfo.fileName,
					)
				}
				return currentPrompt
			})
			if (limitedInfos.some((info) => info.path === normalizedFileInfo.path)) {
				scheduleReferenceMentionInserts([normalizedFileInfo], {
					placement: options?.mentionPlacement ?? "cursor",
				})
			}
			setActiveInputTab("reference")
			if (!options?.retainResourceSlot) {
				resetSelectedResourceSlot()
			}
		},
		[
			scheduleReferenceMentionInserts,
			resetSelectedResourceSlot,
			currentInputModeConfig,
			referenceImageInfos,
			protectedReferencePaths,
			updateProtectedReferencePaths,
		],
	)

	const replaceSelectedResource = useCallback(
		(fileInfo: UploadFileResponse) => {
			const selectedSlot = selectedResourceSlotRef.current
			if (!selectedSlot) return
			if (selectedSlot.inputTab === "frame") {
				replaceFrameImageAt(selectedSlot.slotIndex, fileInfo)
				return
			}
			replaceReferenceImageAt(selectedSlot.slotIndex, fileInfo)
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
		shouldSaveToElement: false,
		onFileUploaded: useCallback(
			(result: UploadFileResponse, fileIndex = 0, batchTotal = 1) => {
				if (discardPendingUploadRef.current) return
				const base = batchUploadBaseRef.current
				if (!base) return
				const targetIndex = base.startSlot + fileIndex
				const retainResourceSlot = fileIndex < batchTotal - 1
				if (base.inputTab === "frame") {
					replaceFrameImageAt(targetIndex, result, { retainResourceSlot })
				} else {
					replaceReferenceImageAt(targetIndex, result, { retainResourceSlot })
				}
			},
			[replaceFrameImageAt, replaceReferenceImageAt],
		),
		onUploadSessionEnd: useCallback(() => {
			batchUploadBaseRef.current = null
		}, []),
	})

	const triggerFileSelect = useCallback(() => {
		if (isUploading) return
		const sel = selectedResourceSlotRef.current
		batchUploadBaseRef.current = sel
			? { inputTab: sel.inputTab, startSlot: sel.slotIndex }
			: null
		rawTriggerFileSelect()
	}, [isUploading, rawTriggerFileSelect])

	const uploadReferenceFiles = useCallback(
		async (files: File[]) => {
			if (isUploading || !supportsReferenceAssets || files.length === 0) return

			const startSlot = currentReferenceImages.length
			batchUploadBaseRef.current = {
				inputTab: "reference",
				startSlot,
			}
			await rawUploadFiles(files, {
				currentReferenceFiles: currentReferenceImages,
				maxReferenceFiles: maxReferenceImages,
			})
		},
		[
			isUploading,
			supportsReferenceAssets,
			currentReferenceImages,
			maxReferenceImages,
			rawUploadFiles,
		],
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
			const prevResolution = selectedResolution
			const prevAspectRatio = selectedAspectRatio
			const prevDurationSeconds = selectedDurationSeconds
			const prevCompressionQuality = selectedCompressionQuality
			const prevInputTab = activeInputTab

			setSelectedModelId(modelId)
			const nextModel = modelOptions.find((opt) => opt.value === modelId)?.model
			const nextModes = getAvailableInputModes(nextModel)
			const nextInputMode = resolveInputModeForAvailableModes(nextModes, selectedInputMode)
			setSelectedInputMode(nextInputMode)
			const nextTabs = getAvailableInputTabs(nextModel, nextInputMode)
			setActiveInputTab(resolveInputSubTabForAvailableTabs(nextTabs, prevInputTab))
			selectedResourceSlotRef.current = null
			setSelectedResourceSlot(null)
			const nextFrameMaxCount = getMaxFrameCount(nextModel, nextInputMode)
			setFrameImageInfos((prev) =>
				nextFrameMaxCount > 0 ? prev.slice(0, nextFrameMaxCount) : [],
			)
			const nextModeConfig = getInputModeConfig(nextModel, nextInputMode)
			const limitedReferenceInfos = clampReferenceAssetsToLimits(
				referenceImageInfos,
				nextModeConfig,
			)
			const nextVariantCode = resolveReferenceAssetLimits(
				nextModeConfig,
				limitedReferenceInfos,
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
					: nextDurations[0],
			)
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
				const removedPathSet = new Set(limitedReferenceInfos.map((info) => info.path))
				const removedInfos = referenceImageInfos.filter(
					(info) => !removedPathSet.has(info.path),
				)
				setReferenceImageInfos(limitedReferenceInfos)
				updateProtectedReferencePaths(
					pruneProtectedReferencePaths(
						limitedReferenceInfos.map((info) => info.path),
						protectedReferencePaths,
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
					),
				)
			}
		},
		[
			modelOptions,
			referenceImageInfos,
			updateVideoElementSize,
			selectedResolution,
			selectedAspectRatio,
			selectedDurationSeconds,
			selectedCompressionQuality,
			activeInputTab,
			selectedInputMode,
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
			)
			modeDraftCacheRef.current = nextCache
			setSelectedInputMode(value)
			const nextDraft = getModeDraftForView(value, selectedModel, nextCache)
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
			setActiveInputTab(
				resolveModeDraftInputTab(value, selectedModel, nextDraft.activeInputTab),
			)
			setFrameImageInfos(nextDraft.frameImageInfos ?? [])
			setReferenceImageInfos(nextReferenceInfos)
			applyBindingStateFromPromptAndReferences(decodedDraftPrompt, nextReferenceInfos)
		},
		[
			activeInputTab,
			applyBindingStateFromPromptAndReferences,
			frameImageInfos,
			getModeDraftForView,
			prompt,
			referenceImageInfos,
			resetSelectedResourceSlot,
			promptPlaceholderTokenConfig,
			selectedModel,
			selectedInputMode,
			resolveModeDraftInputTab,
		],
	)

	const handleInputTabChange = useCallback(
		(value: "frame" | "reference") => {
			resetSelectedResourceSlot()
			setIsReferenceProjectPanelOpen(false)
			setActiveInputTab(value)
		},
		[resetSelectedResourceSlot],
	)

	const handleReferenceMentionPathsChange = useCallback(
		(paths: string[]) => {
			if (!supportsReferenceAssets) return
			const uniquePaths = paths.filter((path, index) => path && paths.indexOf(path) === index)
			const nextProtectedPaths = unprotectPromptBoundReferencePaths(
				protectedReferencePaths,
				uniquePaths,
			)
			updateProtectedReferencePaths(nextProtectedPaths)
			const protectedInfos = referenceImageInfos.filter((info) =>
				nextProtectedPaths.includes(info.path),
			)
			const sourcePaths = [
				...nextProtectedPaths,
				...uniquePaths.filter((path) => !nextProtectedPaths.includes(path)),
			]
			const nextInfos = sourcePaths
				.map((path) => {
					const protectedInfo = protectedInfos.find((info) => info.path === path)
					if (protectedInfo) return protectedInfo
					const assetType = resolveReferenceAssetType(path)
					if (!assetType) return null
					if (!isReferenceAssetTypeAllowed(assetType, currentInputModeConfig)) return null
					const matchedItem = matchableItems.find((item) => item.path === path)
					return {
						path,
						src: path,
						fileName: matchedItem?.name || path.split("/").pop() || path,
						assetType,
					} satisfies VideoReferenceAssetInfo
				})
				.filter((item): item is VideoReferenceAssetInfo => Boolean(item))
			const normalizedInfos =
				maxReferenceImages !== undefined
					? clampReferenceAssetsToLimits(
							nextInfos.slice(0, maxReferenceImages),
							currentInputModeConfig,
						)
					: clampReferenceAssetsToLimits(nextInfos, currentInputModeConfig)
			setReferenceImageInfos(normalizedInfos)
			setIsPopoverOpen(false)
			setIsReferenceProjectPanelOpen(false)
			resetSelectedResourceSlot()
			if (normalizedInfos.length > 0) {
				setActiveInputTab("reference")
			}
		},
		[
			supportsReferenceAssets,
			currentInputModeConfig,
			matchableItems,
			maxReferenceImages,
			resetSelectedResourceSlot,
			protectedReferencePaths,
			referenceImageInfos,
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
			},
		) => {
			const targetPaths = inputTab === "frame" ? currentFrameImages : currentReferenceImages
			const nextSlot = {
				inputTab,
				slotIndex,
				slotKey: options?.slotKey,
				referenceAssetKind: options?.referenceAssetKind,
				referenceAssetKinds: options?.referenceAssetKinds,
				path: targetPaths[slotIndex],
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
			const removedInfo = referenceImageInfos.find((info) => info.path === path)
			setPrompt((currentPrompt) =>
				removeMentionFromString(currentPrompt, path, removedInfo?.fileName),
			)
			setReferenceImageInfos((prev) => prev.filter((info) => info.path !== path))
			updateProtectedReferencePaths(
				protectedReferencePaths.filter((protectedPath) => protectedPath !== path),
			)
			setTimeout(() => {
				isRemovingReferenceImageRef.current = false
			}, 200)
		},
		[protectedReferencePaths, referenceImageInfos, updateProtectedReferencePaths],
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
			setActiveInputTab("reference")
		}
		if (
			hasFrameImagesConfigured &&
			!hasReferenceImagesConfigured &&
			activeInputTab !== "frame"
		) {
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
		const generation = {
			...(supportedAspectRatioOptions.length > 0 && selectedAspectRatio
				? { aspect_ratio: selectedAspectRatio }
				: {}),
			...(supportedResolutionOptions.length > 0 && selectedResolution
				? { resolution: selectedResolution }
				: {}),
			...(selectedDurationSeconds != null && Number.isFinite(selectedDurationSeconds)
				? { duration_seconds: selectedDurationSeconds }
				: {}),
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
		supportedResolutionOptions.length,
		selectedDurationSeconds,
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
			if (!canvas) return
			const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
			if (!(elementInstance instanceof VideoElementClass)) return
			const serializedRequest = JSON.stringify(request)
			if (lastPersistedDraftRef.current === serializedRequest) {
				pendingDraftRequestRef.current = null
				return
			}
			elementInstance.saveTempGenerateVideoRequest(request)
			lastPersistedDraftRef.current = serializedRequest
			pendingDraftRequestRef.current = null
		},
		[canvas, videoElement.id],
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
			const fromElementDrafts =
				restoreOnMount === "originalRequestOnly"
					? undefined
					: elementInstance.getModeInputDrafts()
			modeDraftCacheRef.current = cloneModeDraftCache(
				(fromElementDrafts ?? {}) as Partial<Record<VideoInputMode, VideoModeInputDraft>>,
			)
			const tempRequest =
				restoreOnMount === "originalRequestOnly"
					? undefined
					: elementInstance.getTempGenerateVideoRequest()
			const currentRequest = videoElement.generateVideoRequest
			const requestToRestore = tempRequest
				? {
						...currentRequest,
						...tempRequest,
						prompt: tempRequest.prompt ?? currentRequest?.prompt,
						generation: tempRequest.generation || currentRequest?.generation,
						inputs: tempRequest.inputs || currentRequest?.inputs,
					}
				: currentRequest
			const rootStorage = canvas.magicConfigManager.config?.methods?.getRootStorage?.()
			const defaultConfig = rootStorage?.defaultGenerateVideoConfig as
				| DefaultGenerateVideoConfig
				| undefined
			const config = requestToRestore || defaultConfig
			const modelId =
				config?.model_id &&
				videoModelList.some((model) => model.model_id === config.model_id)
					? config.model_id
					: videoModelList[0]?.model_id
			const fallbackModel =
				videoModelList.find((model) => model.model_id === modelId) || videoModelList[0]

			if (modelId) {
				setSelectedModelId(modelId)
			}
			const restoredInputMode = resolveInputModeFromRequest(requestToRestore, fallbackModel)
			setSelectedInputMode(restoredInputMode)
			const restoredModeConfig = getInputModeConfig(fallbackModel, restoredInputMode)
			const restoredReferenceInfos = clampReferenceAssetsToLimits(
				buildReferenceAssetInfos(requestToRestore?.inputs),
				restoredModeConfig,
			)
			const restoredVariantCode = resolveReferenceAssetLimits(
				restoredModeConfig,
				restoredReferenceInfos,
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
			const fromTempDuration = requestToRestore?.generation?.duration_seconds
			const resolvedDuration =
				fromTempDuration != null && fallbackDurations.includes(fromTempDuration)
					? fromTempDuration
					: fallbackDurations[0]
			setSelectedDurationSeconds(fallbackDurations.length > 0 ? resolvedDuration : undefined)

			const qualityOpts =
				fallbackGen?.supports_compression_quality &&
				fallbackGen.compression_quality_options?.length
					? fallbackGen.compression_quality_options.filter(Boolean)
					: []
			const fromTempQuality = requestToRestore?.generation?.compression_quality
			setSelectedCompressionQuality(
				fromTempQuality && qualityOpts.includes(fromTempQuality)
					? fromTempQuality
					: qualityOpts[0],
			)
			if (!modeDraftCacheRef.current[restoredInputMode]) {
				const draftFromRequest = buildModeDraftFromRequest(
					restoredInputMode,
					requestToRestore,
					fallbackModel,
				)
				const draftFromRequestReferenceInfos = draftFromRequest.referenceAssetInfos ?? []
				modeDraftCacheRef.current = mergeCurrentUiIntoModeDraftCache(
					modeDraftCacheRef.current,
					restoredInputMode,
					draftFromRequest.prompt ?? "",
					resolveModeDraftInputTab(
						restoredInputMode,
						fallbackModel,
						draftFromRequest.activeInputTab,
					),
					draftFromRequest.frameImageInfos ?? [],
					draftFromRequestReferenceInfos,
				)
			}
			const restoredModeDraft = getModeDraftForView(
				restoredInputMode,
				fallbackModel,
				modeDraftCacheRef.current,
			)
			const restoredReferenceInfosForDraft = restoredModeDraft.referenceAssetInfos ?? []
			const restoredFrameInfosForDraft = restoredModeDraft.frameImageInfos ?? []
			const restoredActiveInputTabForDraft = resolveModeDraftInputTab(
				restoredInputMode,
				fallbackModel,
				restoredModeDraft.activeInputTab,
			)
			const rawRestoredPrompt =
				requestToRestore?.prompt && requestToRestore.prompt.trim().length > 0
					? requestToRestore.prompt
					: (restoredModeDraft.prompt ?? "")
			const restoredPrompt = decodeVideoPromptPlaceholdersToMentions(
				rawRestoredPrompt,
				resolveVideoPromptPlaceholderReferences({
					mode: restoredInputMode,
					referenceImageInfos: restoredReferenceInfosForDraft,
				}),
				restoredInputMode,
				promptPlaceholderTokenConfig,
			)
			setPrompt(restoredPrompt)
			setFrameImageInfos(restoredFrameInfosForDraft)
			setActiveInputTab(restoredActiveInputTabForDraft)
			setReferenceImageInfos(restoredReferenceInfosForDraft)
			applyBindingStateFromPromptAndReferences(restoredPrompt, restoredReferenceInfosForDraft)

			const mergedDrafts = mergeCurrentUiIntoModeDraftCache(
				modeDraftCacheRef.current,
				restoredInputMode,
				restoredPrompt,
				restoredActiveInputTabForDraft,
				restoredFrameInfosForDraft,
				restoredReferenceInfosForDraft,
			)
			modeDraftCacheRef.current = mergedDrafts
			elementInstance.saveModeInputDrafts(mergedDrafts as StoredVideoModeDraftsMap)

			hasRestoredRef.current = true
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
		videoElement.generateVideoRequest,
		videoModelList,
		resolveModeDraftInputTab,
		promptPlaceholderTokenConfig,
		restoreOnMount,
	])

	const restoreOriginalGenerateVideoRequestToUi = useCallback(() => {
		if (!canvas) return
		if (isApplyingRestoreRef.current) return
		const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
		if (!(elementInstance instanceof VideoElementClass)) return
		if (!videoElement.generateVideoRequest) return

		cancelPendingDraftPersistence()
		elementInstance.clearTempGenerateVideoRequest()
		lastPersistedDraftRef.current = ""
		modeDraftCacheRef.current = {}
		hasRestoredRef.current = false
		restoreConfig()
	}, [
		canvas,
		videoElement.id,
		videoElement.generateVideoRequest,
		cancelPendingDraftPersistence,
		restoreConfig,
	])

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
			pruneProtectedReferencePaths(currentReferenceImages, protectedReferencePaths),
		)
	}, [currentReferenceImages, protectedReferencePaths, updateProtectedReferencePaths])

	useLayoutEffect(() => {
		if (!canvas || !hasRestoredRef.current || isRestoringRef.current) return
		const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
		if (!(elementInstance instanceof VideoElementClass)) return
		const merged = mergeCurrentUiIntoModeDraftCache(
			modeDraftCacheRef.current,
			selectedInputMode,
			prompt,
			activeInputTab,
			frameImageInfos,
			referenceImageInfos,
		)
		modeDraftCacheRef.current = merged
		elementInstance.saveModeInputDrafts(merged as StoredVideoModeDraftsMap)
	}, [
		activeInputTab,
		canvas,
		videoElement.id,
		selectedInputMode,
		prompt,
		frameImageInfos,
		referenceImageInfos,
	])

	useUpdateEffect(() => {
		if (isRestoringRef.current) return
		scheduleDraftPersistence(buildRequestParams())
	}, [buildRequestParams, scheduleDraftPersistence])

	useUnmount(() => {
		if (canvas && hasRestoredRef.current && !isRestoringRef.current) {
			const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
			if (elementInstance instanceof VideoElementClass) {
				const merged = mergeCurrentUiIntoModeDraftCache(
					modeDraftCacheRef.current,
					selectedInputMode,
					prompt,
					activeInputTab,
					frameImageInfos,
					referenceImageInfos,
				)
				modeDraftCacheRef.current = merged
				elementInstance.saveModeInputDrafts(merged as StoredVideoModeDraftsMap)
			}
		}
		cancelPendingDraftPersistence()
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
		}
	})

	const handlers = useMemo(
		() => ({
			setPrompt,
			setPopoverOpen: setIsPopoverOpen,
			setReferenceProjectPanelOpen: setIsReferenceProjectPanelOpen,
			handleModelChange,
			handleResolutionChange,
			handleRatioChange,
			handleDurationChange,
			handleCompressionQualityChange,
			handleInputModeChange,
			handleInputTabChange,
			handleReferenceMentionPathsChange,
			prepareResourceSlotSelection,
			replaceFrameImageAt,
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
			triggerFileSelect,
			uploadReferenceFiles,
			handleFileChange,
			syncReferenceImagesFromElement,
		}),
		[
			handleModelChange,
			handleResolutionChange,
			handleRatioChange,
			handleDurationChange,
			handleCompressionQualityChange,
			handleInputModeChange,
			handleInputTabChange,
			handleReferenceMentionPathsChange,
			prepareResourceSlotSelection,
			replaceFrameImageAt,
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
			triggerFileSelect,
			uploadReferenceFiles,
			handleFileChange,
			syncReferenceImagesFromElement,
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
		selectedCompressionQuality,
		currentFrameImages,
		frameImageInfos,
		currentReferenceImages,
		protectedReferencePaths,
		referenceBindingMode,
		referenceImageInfos,
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
		supportsReferenceImages,
		supportsReferenceVideos,
		supportsReferenceAudios,
		referenceResourceType,
		fileInputAccept,
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		supportedDurationOptions,
		supportedCompressionQualityOptions,
		currentSelectValue,
		ratioOption,
		isPopoverOpen,
		isReferenceProjectPanelOpen,
		selectedResourceSlot,
		hasRestoredRef,
		isRestoringRef,
		handlers,
		fileInputRef,
	}
}
