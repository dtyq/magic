import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMount, useUnmount, useUpdateEffect } from "ahooks"
import type { CropConfig, ImageElement } from "../../../../runtime/document/types"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import type { GenerateImageRequest, UploadFileResponse } from "../../../../public/magic-types"
import { ImageElement as ImageElementClass } from "../../../../runtime/elements/image/ImageElement"
import { getActiveImageContent } from "../../../../runtime/document/elementContent"
import { useFileInput } from "../../../editors/message/useFileInput"
import {
	CanvasUploadMentionController,
	type CanvasUploadMentionHandle,
} from "../../../editors/message/CanvasUploadMentionController"
import type { MessageEditorRef } from "../../../editors/message/MessageEditor"
import { useReferenceImagesState } from "./useReferenceImagesState"
import type {
	ReferenceResourceFileInfo,
	ReferenceResourceType,
} from "../../../editors/message/reference-assets/reference-resource.types"
import { buildReferenceImageOptions } from "../../../../runtime/resources/image/imageCropUtils"
import {
	encodePromptMentionsToPlaceholders,
	type PromptPlaceholderReference,
} from "../../../editors/message/reference-assets/promptPlaceholderCodec"
import {
	appendMentionToString,
	areMentionPathBindingsEqual,
	type MentionPathBinding,
} from "../../../editors/message/tiptap/contentUtils"
import { createReferenceResourcePanelItemFromPath } from "../../../editors/message/reference-assets/createReferenceResourcePanelItem"
import {
	decodePromptPlaceholdersWithLabels,
	createPromptPlaceholderTokenFactory,
	resolvePromptPlaceholderDecodeLabels,
	resolvePromptPlaceholderTokenConfig,
} from "../../../editors/message/reference-assets/promptPlaceholderTokenConfig"
import {
	buildDefaultImageGenerationConfig,
	buildImageModelOptionGroups,
	buildImageModelOptions,
	buildImageSelectValue,
	buildSupportedAspectRatioOptions,
	buildSupportedResolutionOptions,
	findBestSizeForResolution,
	getDefaultResolutionForModel,
	getImageGenerationSettings,
	getSerializableImageGenerationConfig,
	parseImageSelectValue,
	resolveImageSizeOptionFromRequest,
	restoreImageGenerationConfig,
	supportsReferenceImages,
	type ImageGenerationSettingConfig,
	type ImageModelOption,
	type ImageModelOptionGroup,
	type SupportedAspectRatioOption,
	type SupportedResolutionOption,
} from "./image-editor-config.utils"
import {
	areOrderedPathsEqual,
	pruneProtectedReferencePaths,
	resolveReferenceBindingState,
	unprotectPromptBoundReferencePaths,
	type ReferenceBindingMode,
} from "../../../editors/message/reference-assets/referenceBinding"
import {
	areCanvasResourceReferencesSame,
	getCanvasResourceFileName,
	getCanvasResourceReferenceIdentity,
} from "../../../../runtime/shared/path/canvasResourcePath"
import { createCanvasMentionPathMatcher } from "../../../editors/connection/linkedMediaMentionMatcher"
import {
	buildMediaEditSourceFingerprint,
	type MediaEditIntent,
} from "../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"

interface UseImageEditorConfigOptions {
	readOnly?: boolean
	request?: GenerateImageRequest
	imageElement: ImageElement
	originalImageSrc?: string
	originalImageName?: string
	/** 编辑器 focus 的 ref，上传完成后用于聚焦 */
	editorFocusRef?: React.RefObject<MessageEditorRef | null>
	/** 是否由该配置 hook 管理普通 Canvas 内存恢复；二次编辑由外层意图会话管理。 */
	manageRecoverySession?: boolean
	recoveryIntent?: MediaEditIntent
}

export interface ImageReferenceSlotInfo {
	slotIndex: number
	slotKey?: string
	path?: string
}

export interface ImageEditSessionSnapshot {
	request: Partial<GenerateImageRequest>
	/** 按 prompt 中 mention 出现顺序保存的结构化路径绑定。 */
	mentionBindings?: MentionPathBinding[]
}

export interface ImageEditorConfig {
	selectedModelId: string
	prompt: string
	selectedResolution?: string
	selectedSize?: string
	selectedLabel?: string
	selectedScale?: string
	selectedImageGenerationConfig: Record<string, string>
	currentReferenceFiles: string[]
	protectedReferencePaths: string[]
	referenceBindingMode: ReferenceBindingMode
	referenceFileInfos: ReferenceResourceFileInfo[]
	mentionBindings: MentionPathBinding[]
	matchableItems: Array<{ name: string; path?: string; disabled?: boolean }>
	modelOptions: ImageModelOption[]
	modelOptionGroups: ImageModelOptionGroup[]
	selectedModelOption: ImageModelOption | undefined
	isReferencePolicyReady: boolean
	maxReferenceFiles: number | undefined
	isReferenceFileLimitReached: boolean
	isUploading: boolean
	supportedAspectRatioOptions: SupportedAspectRatioOption[]
	supportedResolutionOptions: SupportedResolutionOption[]
	supportedImageSettingOptions: ImageGenerationSettingConfig[]
	currentSelectValue: string | undefined
	ratioOption:
		| {
				value: string
				label: string
				width: number
				height: number
				iconWidth: number
				iconHeight: number
				originalLabel: string
				originalValue: string
				originalScale?: string
		  }
		| undefined
	isPopoverOpen: boolean
	selectedReferenceSlot: ImageReferenceSlotInfo | null
	referenceResourceType: ReferenceResourceType
	fileInputAccept: string
	/** 画布图片的源图裁剪，用于参考列表「当前图片」预览与画布可视区域一致 */
	referenceSourceCrop: CropConfig | undefined
	hasRestoredRef: React.RefObject<boolean>
	isRestoringRef: React.RefObject<boolean>
	hasGenerationRequest: boolean
	restoreRevision: number
	handlers: {
		setSelectedModelId: (id: string) => void
		setPrompt: (prompt: string) => void
		setSelectedResolution: (value: string | undefined) => void
		setSelectedSize: (value: string | undefined) => void
		setSelectedLabel: (value: string | undefined) => void
		setSelectedScale: (value: string | undefined) => void
		setSelectedImageGenerationConfig: (value: Record<string, string>) => void
		handleModelChange: (modelId: string) => void
		handleResolutionChange: (value: string) => void
		handleRatioChange: (value: string) => void
		handleImageSettingChange: (key: string, value: string) => void
		handleReferenceFileRemove: (path: string) => void
		setPopoverOpen: (open: boolean) => void
		handlePopoverMouseEnter: () => void
		handlePopoverMouseLeave: () => void
		buildRequestParams: () => Partial<GenerateImageRequest>
		saveDraftRequest: (request: Partial<GenerateImageRequest>) => void
		cancelPendingDraftPersistence: () => void
		/** 二次编辑「快捷编辑」：对齐生成配置，并仅保留当前图片作为参考图 */
		restoreQuickEditConfigToUi: () => void
		/** 二次编辑「重新生成」：清除临时草稿后，将 UI 完整恢复为元素上已保存的 generateImageRequest */
		restoreOriginalGenerateImageRequestToUi: () => void
		prepareReferenceSlotSelection: (
			slotIndex: number,
			options?: {
				slotKey?: string
				path?: string
			},
		) => void
		replaceReferenceFileAt: (
			slotIndex: number,
			fileInfo: UploadFileResponse,
			options?: {
				retainReferenceSlot?: boolean
				/** 用户显式选择已有素材时，确保编辑器存在对应的 @mention。 */
				ensurePromptMention?: boolean
				mentionPlacement?: "cursor" | "documentEnd"
			},
		) => void
		triggerFileSelect: () => void
		uploadFiles: (
			files: File[],
			options?: {
				ignoreSelectedReferenceSlot?: boolean
				retainSelectedReferenceSlot?: boolean
				isCurrent?: () => boolean
				suppressPromptMention?: boolean
				pendingMentionHandles?: Array<CanvasUploadMentionHandle | undefined>
			},
		) => Promise<UploadFileResponse[]>
		uploadMentionController?: CanvasUploadMentionController
		handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
		resetSelectedReferenceSlot: (expectedSlot?: ImageReferenceSlotInfo) => void
		/** 从 elementInstance 同步参考文件状态到 config，用于 @ 面板添加后的闭环 */
		syncReferenceFilesFromElement: () => void
		/** prompt 中一旦出现显式图片绑定，就把对应 legacy 保护引用升级为普通 prompt 绑定。 */
		handlePromptReferencePathsChange: (paths: string[]) => void
		/** 更新当前编辑器的有序 mention identity 快照，供跨卸载恢复使用。 */
		updateMentionBindings: (bindings: MentionPathBinding[]) => void
	}
	fileInputRef: React.MutableRefObject<HTMLInputElement | null>
	editSession: {
		buildSnapshot: () => ImageEditSessionSnapshot
		restoreSnapshotToUi: (snapshot: ImageEditSessionSnapshot) => void
	}
}

export function useImageEditorConfig(options: UseImageEditorConfigOptions): ImageEditorConfig {
	const {
		imageElement,
		readOnly = false,
		request,
		originalImageSrc,
		originalImageName,
		editorFocusRef,
		manageRecoverySession = true,
		recoveryIntent = "generate",
	} = options
	const activeImageContent = getActiveImageContent(imageElement)
	const { imageModelList, isLoadingImageModelList, methods } = useMagic()
	const resolveResourceReference = methods?.resolveResourceReference
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const referenceResourceType: ReferenceResourceType = "image"
	const fileInputAccept = "image/*"
	const recoveryKey = useMemo(
		() =>
			manageRecoverySession
				? {
						elementId: imageElement.id,
						contentId: activeImageContent.contentId,
						intent: recoveryIntent,
					}
				: null,
		[activeImageContent.contentId, imageElement.id, manageRecoverySession, recoveryIntent],
	)
	const recoverySourceFingerprint = buildMediaEditSourceFingerprint(
		activeImageContent.contentId,
		activeImageContent.src,
	)

	// 本地 state 管理配置
	const [selectedModelId, setSelectedModelId] = useState<string>("")
	const [prompt, setPrompt] = useState<string>("")
	const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined)
	const [selectedResolution, setSelectedResolution] = useState<string | undefined>(undefined)
	const [selectedScale, setSelectedScale] = useState<string | undefined>(undefined)
	const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined)
	const [selectedImageGenerationConfig, setSelectedImageGenerationConfig] = useState<
		Record<string, string>
	>({})
	const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false)
	const [protectedReferencePaths, setProtectedReferencePaths] = useState<string[]>([])
	const [selectedReferenceSlot, setSelectedReferenceSlot] =
		useState<ImageReferenceSlotInfo | null>(null)

	// 标记是否已经恢复过临时数据
	const hasRestoredRef = useRef<boolean>(false)
	// 标记是否正在恢复配置（用于避免恢复时触发保存）
	const isRestoringRef = useRef<boolean>(false)
	const [restoreRevision, setRestoreRevision] = useState(0)
	// Popover 关闭延迟的 timeout ID
	const popoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const draftPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingDraftRequestRef = useRef<Partial<GenerateImageRequest> | null>(null)
	const isApplyingRestoreRef = useRef<boolean>(false)
	const sessionRestoreRequestRef = useRef<Partial<GenerateImageRequest> | null>(null)
	// 标记是否正在删除参考图（用于防止删除时弹窗关闭）
	const isRemovingReferenceImageRef = useRef<boolean>(false)
	const selectedReferenceSlotRef = useRef<ImageReferenceSlotInfo | null>(null)
	const fileUploadSlotRef = useRef<ImageReferenceSlotInfo | null>(null)
	const retainFileUploadSlotSelectionRef = useRef(false)
	const fileUploadSessionGuardRef = useRef<(() => boolean) | undefined>(undefined)
	const suppressPromptMentionRef = useRef(false)
	const uploadMentionController = useMemo(
		() => (editorFocusRef ? new CanvasUploadMentionController(editorFocusRef) : undefined),
		[editorFocusRef],
	)
	const latestMentionBindingsRef = useRef<MentionPathBinding[]>([])
	const sessionRestoreMentionBindingsRef = useRef<MentionPathBinding[] | null>(null)
	const [mentionBindings, setMentionBindings] = useState<MentionPathBinding[]>([])

	const updateMentionBindings = useCallback((bindings: MentionPathBinding[]) => {
		const nextBindings = bindings.map((binding) => ({ ...binding }))
		latestMentionBindingsRef.current = nextBindings
		setMentionBindings((previous) =>
			areMentionPathBindingsEqual(previous, nextBindings) ? previous : nextBindings,
		)
	}, [])

	const resetSelectedReferenceSlot = useCallback((expectedSlot?: ImageReferenceSlotInfo) => {
		const currentSlot = selectedReferenceSlotRef.current
		if (
			expectedSlot &&
			(!currentSlot ||
				currentSlot.slotIndex !== expectedSlot.slotIndex ||
				currentSlot.slotKey !== expectedSlot.slotKey ||
				currentSlot.path !== expectedSlot.path)
		) {
			return
		}
		selectedReferenceSlotRef.current = null
		setSelectedReferenceSlot(null)
	}, [])

	const prepareReferenceSlotSelection = useCallback(
		(
			slotIndex: number,
			options?: {
				slotKey?: string
				path?: string
			},
		) => {
			const nextSlot: ImageReferenceSlotInfo = {
				slotIndex,
				slotKey: options?.slotKey,
				path: options?.path,
			}
			selectedReferenceSlotRef.current = nextSlot
			setSelectedReferenceSlot(nextSlot)
		},
		[],
	)

	// 获取当前模型的最大参考文件数量限制（需要提前计算，供 useReferenceImagesState 使用）
	const selectedModel = useMemo(
		() => imageModelList.find((model) => model.model_id === selectedModelId),
		[imageModelList, selectedModelId],
	)
	const isReferencePolicyReady = !isLoadingImageModelList && Boolean(selectedModel)
	const maxReferenceFiles = selectedModel?.image_size_config?.max_reference_images

	// 使用新的参考文件状态管理 hook
	const readOnlyPaths = useMemo(
		() =>
			readOnly
				? (request?.reference_images ??
					activeImageContent.generateImageRequest?.reference_images ??
					[])
				: undefined,
		[readOnly, request, activeImageContent.generateImageRequest],
	)
	const referenceFilesState = useReferenceImagesState({
		readOnlyPaths,
		canvas,
		imageElementId: imageElement.id,
		maxReferenceFiles,
	})

	const {
		referenceFilePaths: currentReferenceFiles,
		referenceFileInfos,
		matchableItems,
		isReferenceFileLimitReached,
		removeReferenceFile,
		syncFromElement,
	} = referenceFilesState

	const currentImageVisibleAspectRatio = useMemo(() => {
		const width = imageElement.width ?? activeImageContent.crop?.displayWidth ?? 0
		const height = imageElement.height ?? activeImageContent.crop?.displayHeight ?? 0
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			return undefined
		}
		return width / height
	}, [
		imageElement.width,
		imageElement.height,
		activeImageContent.crop?.displayWidth,
		activeImageContent.crop?.displayHeight,
	])

	// 将模型列表转换为 Select 组件需要的格式
	const modelOptions = useMemo<ImageModelOption[]>(() => {
		return buildImageModelOptions(imageModelList)
	}, [imageModelList])

	const modelOptionGroups = useMemo<ImageModelOptionGroup[]>(() => {
		return buildImageModelOptionGroups(modelOptions, t)
	}, [modelOptions, t])

	// 当前选中的模型选项
	const selectedModelOption = useMemo(() => {
		return modelOptions.find((opt) => opt.value === selectedModelId)
	}, [modelOptions, selectedModelId])

	const supportedImageSettingOptions = useMemo<ImageGenerationSettingConfig[]>(() => {
		return getImageGenerationSettings(selectedModelOption?.model)
	}, [selectedModelOption?.model])

	// 从 image_size_config 转换为宽高比选项格式（根据选中的分辨率筛选）
	const supportedAspectRatioOptions = useMemo(() => {
		return buildSupportedAspectRatioOptions(
			selectedModelOption?.model,
			buildImageSelectValue,
			selectedResolution,
		)
	}, [selectedModelOption?.model, selectedResolution])

	// 当前模型支持的分辨率选项（从 image_size_config.sizes.scale 聚合）
	const supportedResolutionOptions = useMemo(() => {
		return buildSupportedResolutionOptions(selectedModelOption?.model)
	}, [selectedModelOption?.model])

	// 构建当前选中的 select value（用于匹配选项）
	const currentSelectValue = useMemo(() => {
		if (!selectedLabel || !selectedSize) return undefined
		return buildImageSelectValue(selectedLabel, selectedSize, selectedScale)
	}, [selectedLabel, selectedSize, selectedScale])

	// 当前选中的宽高比选项
	const ratioOption = useMemo(() => {
		if (!currentSelectValue) return undefined
		return supportedAspectRatioOptions.find((option) => {
			return (
				option.originalLabel === selectedLabel &&
				option.originalValue === selectedSize &&
				(option.originalScale || undefined) === (selectedScale || undefined)
			)
		})
	}, [
		currentSelectValue,
		supportedAspectRatioOptions,
		selectedLabel,
		selectedSize,
		selectedScale,
	])

	const applyQuickEditReferencePreset = useCallback(
		(modelId: string | undefined) => {
			if (!canvas) return

			const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
			if (!(elementInstance instanceof ImageElementClass)) return

			const selectedModel = imageModelList.find((model) => model.model_id === modelId)
			if (!originalImageSrc || !supportsReferenceImages(selectedModel)) {
				elementInstance.clearReferenceImageInfos()
				syncFromElement()
				return
			}

			const currentOriginalInfo = elementInstance
				.getReferenceImageInfos()
				.find((info) =>
					areCanvasResourceReferencesSame(
						info.path,
						originalImageSrc,
						resolveResourceReference,
					),
				)

			elementInstance.setReferenceImageInfos([
				{
					...currentOriginalInfo,
					path: originalImageSrc,
					src: currentOriginalInfo?.src || originalImageSrc,
					fileName:
						originalImageName ||
						currentOriginalInfo?.fileName ||
						t("imageEditor.originalImage", "原图"),
				},
			])
			syncFromElement()
		},
		[
			canvas,
			imageElement.id,
			imageModelList,
			resolveResourceReference,
			originalImageName,
			originalImageSrc,
			syncFromElement,
			t,
		],
	)

	const resolveQuickEditModelId = useCallback(
		(sourceRequest?: GenerateImageRequest) => {
			if (imageModelList.length === 0) return undefined

			const currentModel = sourceRequest?.model_id
				? imageModelList.find((model) => model.model_id === sourceRequest.model_id)
				: undefined

			if (currentModel && supportsReferenceImages(currentModel)) {
				return currentModel.model_id
			}

			const preferredReferenceModel = imageModelList.find((model) =>
				supportsReferenceImages(model),
			)
			if (preferredReferenceModel) {
				return preferredReferenceModel.model_id
			}

			return currentModel?.model_id || imageModelList[0]?.model_id
		},
		[imageModelList],
	)

	const promptPlaceholderTokenConfig = useMemo(() => resolvePromptPlaceholderTokenConfig(t), [t])
	const buildImagePromptPlaceholderToken = useMemo(
		() =>
			createPromptPlaceholderTokenFactory(
				promptPlaceholderTokenConfig.imageLabel,
				promptPlaceholderTokenConfig,
			),
		[promptPlaceholderTokenConfig],
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
			nextReferenceFileInfos: ReferenceResourceFileInfo[],
			nextMentionBindings?: MentionPathBinding[],
		) => {
			const bindingState = resolveReferenceBindingState({
				prompt: nextPrompt,
				referenceFileInfos: nextReferenceFileInfos,
				tokenConfig: promptPlaceholderTokenConfig,
				defaultAssetType: "image",
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
		const referenceCount = currentReferenceFiles.length
		if (protectedCount === 0) return "prompt-linked"
		if (protectedCount >= referenceCount) return "detached-legacy"
		return "mixed"
	}, [currentReferenceFiles.length, protectedReferencePaths.length])

	const resolvePromptReferencesByPaths = useCallback(
		(paths: string[] | undefined): PromptPlaceholderReference[] => {
			if (!paths || paths.length === 0) return []
			const pathToFileName = new Map(
				referenceFileInfos.map((info) => [
					getCanvasResourceReferenceIdentity(info.path, resolveResourceReference),
					info.fileName || "",
				]),
			)
			return paths
				.map((path) => {
					const fileName =
						pathToFileName.get(
							getCanvasResourceReferenceIdentity(path, resolveResourceReference),
						) || getCanvasResourceFileName(path)
					if (!fileName) return null
					return { path, fileName }
				})
				.filter((item): item is PromptPlaceholderReference => Boolean(item))
		},
		[referenceFileInfos, resolveResourceReference],
	)

	const appendReferenceFile = useCallback(
		(fileInfo: UploadFileResponse) => {
			if (!canvas) return false
			const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
			if (!(elementInstance instanceof ImageElementClass)) return false

			const currentInfos = elementInstance.getReferenceImageInfos()
			if (
				currentInfos.some((info) =>
					areCanvasResourceReferencesSame(
						info.path,
						fileInfo.path,
						resolveResourceReference,
					),
				)
			) {
				syncFromElement()
				return false
			}
			if (maxReferenceFiles !== undefined && currentInfos.length >= maxReferenceFiles) {
				syncFromElement()
				return false
			}

			elementInstance.saveReferenceImageInfos([
				{
					path: fileInfo.path,
					src: fileInfo.src || fileInfo.path,
					fileName:
						fileInfo.fileName ||
						getCanvasResourceFileName(fileInfo.path) ||
						fileInfo.path,
				},
			])
			syncFromElement()
			return true
		},
		[canvas, imageElement.id, maxReferenceFiles, resolveResourceReference, syncFromElement],
	)

	const replaceReferenceFileAt = useCallback(
		(
			slotIndex: number,
			fileInfo: UploadFileResponse,
			options?: {
				retainReferenceSlot?: boolean
				ensurePromptMention?: boolean
				mentionPlacement?: "cursor" | "documentEnd"
			},
		) => {
			if (!canvas) return
			const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
			if (!(elementInstance instanceof ImageElementClass)) return

			const currentInfos =
				elementInstance.getReferenceImageInfos() as ReferenceResourceFileInfo[]
			const previousInfo = currentInfos[slotIndex]

			const mentionItem = createReferenceResourcePanelItemFromPath(
				fileInfo.path,
				fileInfo.fileName || getCanvasResourceFileName(fileInfo.path) || fileInfo.path,
				{
					fileId: fileInfo.file_id,
					sourceFileId: fileInfo.source_file_id,
					sourceProjectId: fileInfo.source_project_id,
					projectId: fileInfo.project_id,
					mediaType: "image",
				},
			)
			const ensurePromptMention = () => {
				if (!options?.ensurePromptMention) return
				const editor = editorFocusRef?.current
				if (!editor) return
				const alreadyMentioned = editor
					.getMentionBindings()
					.some((binding) =>
						areCanvasResourceReferencesSame(
							binding.path,
							fileInfo.path,
							resolveResourceReference,
						),
					)
				if (alreadyMentioned) return
				editor.insertMentionItems([mentionItem], {
					placement: options.mentionPlacement ?? "cursor",
				})
			}

			if (
				Boolean(
					previousInfo?.path &&
					areCanvasResourceReferencesSame(
						previousInfo.path,
						fileInfo.path,
						resolveResourceReference,
					),
				) ||
				currentInfos.some(
					(info, index) =>
						index !== slotIndex &&
						areCanvasResourceReferencesSame(
							info.path,
							fileInfo.path,
							resolveResourceReference,
						),
				)
			) {
				ensurePromptMention()
				if (!options?.retainReferenceSlot) {
					resetSelectedReferenceSlot()
				}
				return
			}

			const normalizedInfo: ReferenceResourceFileInfo = {
				path: fileInfo.path,
				src: fileInfo.src || fileInfo.path,
				fileName:
					fileInfo.fileName || getCanvasResourceFileName(fileInfo.path) || fileInfo.path,
			}
			const nextInfos = [...currentInfos]
			nextInfos[slotIndex] = normalizedInfo
			const compactNextInfos = nextInfos.filter(Boolean)

			elementInstance.setReferenceImageInfos(compactNextInfos)
			syncFromElement()

			let replacedMention = false
			if (previousInfo?.path) {
				const nextProtectedReferencePaths = protectedReferencePaths.map((path) =>
					areCanvasResourceReferencesSame(
						path,
						previousInfo.path,
						resolveResourceReference,
					)
						? normalizedInfo.path
						: path,
				)
				updateProtectedReferencePaths(
					pruneProtectedReferencePaths(
						compactNextInfos.map((info) => info.path),
						nextProtectedReferencePaths,
						resolveResourceReference,
					),
				)
				replacedMention =
					editorFocusRef?.current?.replaceMentionItems(
						createCanvasMentionPathMatcher(previousInfo.path, resolveResourceReference),
						mentionItem,
					) ?? false
			}
			if (options?.ensurePromptMention && !replacedMention) ensurePromptMention()

			if (!options?.retainReferenceSlot) {
				resetSelectedReferenceSlot()
			}
		},
		[
			canvas,
			imageElement.id,
			resolveResourceReference,
			protectedReferencePaths,
			syncFromElement,
			updateProtectedReferencePaths,
			editorFocusRef,
			resetSelectedReferenceSlot,
		],
	)

	// 使用文件输入 hook
	const {
		fileInputRef,
		triggerFileSelect: rawTriggerFileSelect,
		uploadFiles: rawUploadFiles,
		handleFileChange,
		isUploading,
	} = useFileInput({
		methods,
		currentReferenceFiles,
		canvas: canvas || undefined,
		elementId: imageElement.id,
		maxReferenceFiles,
		accept: fileInputAccept,
		shouldSaveToElement: false,
		onFileUploaded: useCallback(
			(result: UploadFileResponse, fileIndexInBatch = 0) => {
				if (fileUploadSessionGuardRef.current?.() === false) return
				const selectedUploadSlot = fileUploadSlotRef.current
				// An empty selected slot receives only the first file. Remaining files
				// append in order; otherwise a multi-file paste would overwrite the
				// same empty slot repeatedly because the upload session ref survives
				// until the whole batch settles.
				if (selectedUploadSlot && (selectedUploadSlot.path || fileIndexInBatch === 0)) {
					replaceReferenceFileAt(selectedUploadSlot.slotIndex, result, {
						retainReferenceSlot: retainFileUploadSlotSelectionRef.current,
					})
					return
				}

				const didAppend = appendReferenceFile(result)
				if (!didAppend) return
			},
			[appendReferenceFile, replaceReferenceFileAt],
		),
		onUploadSessionEnd: useCallback(() => {
			fileUploadSlotRef.current = null
			retainFileUploadSlotSelectionRef.current = false
			fileUploadSessionGuardRef.current = undefined
		}, []),
		pendingUploadMentionController: uploadMentionController,
		shouldInsertPendingMention: useCallback(
			() => !suppressPromptMentionRef.current && !fileUploadSlotRef.current?.path,
			[],
		),
	})

	const triggerFileSelect = useCallback(() => {
		const selectedSlot = selectedReferenceSlotRef.current
		fileUploadSlotRef.current = selectedSlot
		rawTriggerFileSelect({
			maxSelectedFiles: selectedSlot?.path ? 1 : undefined,
			ignoreReferenceFileCapacity: Boolean(selectedSlot?.path),
		})
	}, [rawTriggerFileSelect])

	const uploadFiles = useCallback(
		async (
			files: File[],
			options?: {
				ignoreSelectedReferenceSlot?: boolean
				retainSelectedReferenceSlot?: boolean
				isCurrent?: () => boolean
				suppressPromptMention?: boolean
				pendingMentionHandles?: Array<CanvasUploadMentionHandle | undefined>
			},
		) => {
			const selectedSlot = options?.ignoreSelectedReferenceSlot
				? null
				: selectedReferenceSlotRef.current
			fileUploadSlotRef.current = selectedSlot
			retainFileUploadSlotSelectionRef.current = options?.retainSelectedReferenceSlot === true
			fileUploadSessionGuardRef.current = options?.isCurrent
			suppressPromptMentionRef.current = options?.suppressPromptMention === true
			try {
				return await rawUploadFiles(files, {
					maxSelectedFiles: selectedSlot?.path ? 1 : files.length,
					ignoreReferenceFileCapacity: Boolean(selectedSlot?.path),
					pendingMentionHandles: options?.pendingMentionHandles,
				})
			} finally {
				suppressPromptMentionRef.current = false
			}
		},
		[rawUploadFiles],
	)

	// 处理模型选择变化
	const handleModelChange = useCallback(
		(modelId: string) => {
			setSelectedModelId(modelId)
			const newModelOption = modelOptions.find((opt) => opt.value === modelId)

			// 检查新模型的参考图限制，处理参考图数据
			// max_reference_images 场景：0=不支持参考图，undefined=未配置（不裁剪），>0=支持 N 张
			const newMaxReferenceImages =
				newModelOption?.model?.image_size_config?.max_reference_images
			const effectiveMaxFiles =
				newMaxReferenceImages === undefined ? Infinity : newMaxReferenceImages

			// 从多到少：当前参考图数量超过新模型限制时裁剪
			if (currentReferenceFiles.length > effectiveMaxFiles) {
				const pathsToRemove = currentReferenceFiles.slice(effectiveMaxFiles)
				const pathToFileName = Object.fromEntries(
					referenceFileInfos.map((info) => [info.path, info.fileName]),
				)

				// 从元素实例中移除被裁剪的参考图（会触发资源释放，并自动同步到 referenceImagesState）
				if (canvas) {
					const elementInstance = canvas.elementManager.getElementInstance(
						imageElement.id,
					)
					if (elementInstance && elementInstance instanceof ImageElementClass) {
						pathsToRemove.forEach((path) => {
							elementInstance.removeReferenceImageInfo(path)
						})
					}
				}

				// 同步到 referenceImagesState
				syncFromElement()

				// 同步 prompt：移除被裁剪的 @ 提及，避免孤儿引用
				if (pathsToRemove.length > 0) {
					const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
					let newPrompt = prompt
					for (const path of pathsToRemove) {
						const fileName =
							pathToFileName[path] || getCanvasResourceFileName(path) || path
						newPrompt = newPrompt.replace(
							// 仅移除一次，避免同名不同路径被全部清空。
							new RegExp(`@${escapeRegex(fileName)}`),
							"",
						)
					}
					newPrompt = newPrompt.replace(/\s+/g, " ").trim()
					setPrompt(newPrompt)
				}
			}

			if (newModelOption?.model?.image_size_config?.sizes) {
				const sizes = newModelOption.model.image_size_config.sizes

				// 手动切换模型时使用模型下发的默认分辨率，未配置时再回退到首个档位
				const targetResolution = getDefaultResolutionForModel(newModelOption.model)
				setSelectedResolution(targetResolution)

				// 再处理size（基于确定的分辨率）
				if (sizes.length > 0) {
					const targetSize = findBestSizeForResolution(
						sizes,
						targetResolution,
						selectedLabel,
						originalImageSrc ? currentImageVisibleAspectRatio : undefined,
					)

					if (targetSize) {
						setSelectedLabel(targetSize.label)
						setSelectedSize(targetSize.value)
						setSelectedScale(targetSize.scale || undefined)

						// SecondEdit 模式下不更新元素尺寸（配置是针对新图片的）
						if (!originalImageSrc && imageElement && canvas) {
							const [w, h] = targetSize.value.split("x").map(Number)
							canvas.elementManager.update(imageElement.id, {
								width: w,
								height: h,
							})
						}
					} else {
						setSelectedLabel(undefined)
						setSelectedSize(undefined)
						setSelectedScale(undefined)
					}
				} else {
					setSelectedLabel(undefined)
					setSelectedSize(undefined)
					setSelectedScale(undefined)
				}
			} else {
				setSelectedLabel(undefined)
				setSelectedSize(undefined)
				setSelectedScale(undefined)
				setSelectedResolution(undefined)
			}
			setSelectedImageGenerationConfig(
				buildDefaultImageGenerationConfig(
					getImageGenerationSettings(newModelOption?.model),
				),
			)
		},
		[
			modelOptions,
			currentReferenceFiles,
			referenceFileInfos,
			canvas,
			imageElement,
			selectedLabel,
			currentImageVisibleAspectRatio,
			originalImageSrc,
			prompt,
			setPrompt,
			syncFromElement,
		],
	)

	// 处理尺寸选择变化
	const handleRatioChange = useCallback(
		(value: string) => {
			const parsed = parseImageSelectValue(value)
			setSelectedLabel(parsed.label)
			setSelectedSize(parsed.value)
			setSelectedScale(parsed.scale)
			const option = supportedAspectRatioOptions.find((opt) => opt.value === value)
			// SecondEdit 模式下不更新元素尺寸（配置是针对新图片的）
			if (option && !originalImageSrc && imageElement && canvas) {
				canvas.elementManager.update(imageElement.id, {
					width: option.width,
					height: option.height,
				})
			}
		},
		[canvas, imageElement, supportedAspectRatioOptions, originalImageSrc],
	)

	// 处理分辨率选择变化
	const handleResolutionChange = useCallback(
		(value: string) => {
			setSelectedResolution(value)
			if (selectedModelOption?.model?.image_size_config?.sizes) {
				const sizes = selectedModelOption.model.image_size_config.sizes
				const targetSize = findBestSizeForResolution(sizes, value, selectedLabel)

				if (targetSize) {
					setSelectedLabel(targetSize.label)
					setSelectedSize(targetSize.value)
					setSelectedScale(targetSize.scale || undefined)

					// SecondEdit 模式下不更新元素尺寸（配置是针对新图片的）
					if (!originalImageSrc && imageElement && canvas) {
						const [w, h] = targetSize.value.split("x").map(Number)
						canvas.elementManager.update(imageElement.id, {
							width: w,
							height: h,
						})
					}
				}
			}
		},
		[selectedModelOption, selectedLabel, imageElement, canvas, originalImageSrc],
	)

	const handleImageSettingChange = useCallback((key: string, value: string) => {
		setSelectedImageGenerationConfig((prev) => ({
			...prev,
			[key]: value,
		}))
	}, [])

	// 处理参考图删除（通过 referenceImagesState 统一管理）
	const handleReferenceFileRemove = useCallback(
		(path: string) => {
			// 设置删除标记，防止弹窗关闭
			isRemovingReferenceImageRef.current = true
			// 确保弹窗保持打开
			setIsPopoverOpen(true)
			// 清除可能存在的关闭延迟
			if (popoverCloseTimeoutRef.current) {
				clearTimeout(popoverCloseTimeoutRef.current)
				popoverCloseTimeoutRef.current = null
			}
			removeReferenceFile(path)
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
			// 延迟清除删除标记，确保删除操作完成后再允许关闭
			setTimeout(() => {
				isRemovingReferenceImageRef.current = false
			}, 200)
		},
		[
			resolveResourceReference,
			protectedReferencePaths,
			removeReferenceFile,
			updateProtectedReferencePaths,
		],
	)

	// 从 elementInstance 同步参考文件状态，用于 @ 面板添加后的数据闭环
	const syncReferenceFilesFromElement = useCallback(() => {
		syncFromElement()
	}, [syncFromElement])

	const handlePromptReferencePathsChange = useCallback(
		(paths: string[]) => {
			updateProtectedReferencePaths(
				unprotectPromptBoundReferencePaths(
					protectedReferencePaths,
					paths,
					resolveResourceReference,
				),
			)
		},
		[protectedReferencePaths, resolveResourceReference, updateProtectedReferencePaths],
	)

	// 处理 Popover 鼠标进入
	const handlePopoverMouseEnter = useCallback(() => {
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
			popoverCloseTimeoutRef.current = null
		}
		setIsPopoverOpen(true)
	}, [])

	// 处理 Popover 鼠标离开
	const handlePopoverMouseLeave = useCallback(() => {
		// 如果正在删除参考图，不关闭弹窗
		if (isRemovingReferenceImageRef.current) {
			return
		}
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
		}
		popoverCloseTimeoutRef.current = setTimeout(() => {
			setIsPopoverOpen(false)
			popoverCloseTimeoutRef.current = null
		}, 100)
	}, [])

	// 构建请求参数的公共方法
	const buildRequestParams = useCallback((): Partial<GenerateImageRequest> => {
		const shouldIncludeReferenceFiles =
			maxReferenceFiles !== undefined &&
			maxReferenceFiles > 0 &&
			currentReferenceFiles.length > 0

		const referenceImages = shouldIncludeReferenceFiles ? currentReferenceFiles : undefined

		const referenceImageOptions =
			activeImageContent.crop && originalImageSrc && referenceImages?.[0] === originalImageSrc
				? buildReferenceImageOptions({
						filePath: originalImageSrc,
						crop: activeImageContent.crop,
					})
				: undefined
		const imageGenerationConfig = getSerializableImageGenerationConfig(
			selectedImageGenerationConfig,
			supportedImageSettingOptions,
		)
		const promptReferences = resolvePromptReferencesByPaths(referenceImages)
		const encodedPrompt = encodePromptMentionsToPlaceholders(prompt.trim(), promptReferences, {
			buildToken: buildImagePromptPlaceholderToken,
		})

		return {
			model_id: selectedModelId || undefined,
			prompt: encodedPrompt || undefined,
			size: selectedSize,
			resolution: selectedResolution || undefined,
			reference_images: referenceImages,
			reference_image_options: referenceImageOptions,
			image_generation_config: imageGenerationConfig,
		}
	}, [
		activeImageContent.crop,
		selectedModelId,
		prompt,
		selectedSize,
		selectedResolution,
		selectedImageGenerationConfig,
		supportedImageSettingOptions,
		currentReferenceFiles,
		maxReferenceFiles,
		originalImageSrc,
		resolvePromptReferencesByPaths,
		buildImagePromptPlaceholderToken,
	])

	const saveDraftRequest = useCallback(
		(request: Partial<GenerateImageRequest>) => {
			if (isRestoringRef.current) {
				pendingDraftRequestRef.current = null
				return
			}
			if (!canvas || !manageRecoverySession || !recoveryKey) return
			const capturedMentionBindings =
				editorFocusRef?.current?.getMentionBindings?.() ?? latestMentionBindingsRef.current
			updateMentionBindings(capturedMentionBindings)
			canvas.mediaEditRecoveryManager.saveDraft(recoveryKey, recoverySourceFingerprint, {
				request,
				mentionBindings: capturedMentionBindings,
			})
			pendingDraftRequestRef.current = null
		},
		[
			canvas,
			editorFocusRef,
			latestMentionBindingsRef,
			manageRecoverySession,
			recoveryKey,
			recoverySourceFingerprint,
			updateMentionBindings,
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
		(request: Partial<GenerateImageRequest>) => {
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

	const restoreQuickEditConfigToUi = useCallback(() => {
		if (!canvas) return

		cancelPendingDraftPersistence()
		setPrompt("")
		updateMentionBindings([])

		if (imageModelList.length === 0) {
			return
		}

		const sourceRequest = activeImageContent.generateImageRequest
		const restoredModelId = resolveQuickEditModelId(sourceRequest)

		if (!restoredModelId) {
			return
		}

		const restoredModel = imageModelList.find((m) => m.model_id === restoredModelId)
		const shouldSeedQuickEditReference = Boolean(
			originalImageSrc && supportsReferenceImages(restoredModel),
		)
		const quickEditReferenceName =
			originalImageName || getCanvasResourceFileName(originalImageSrc) || undefined

		setSelectedModelId(restoredModelId)
		applyQuickEditReferencePreset(restoredModelId)
		updateProtectedReferencePaths([])
		setPrompt(
			shouldSeedQuickEditReference
				? appendMentionToString("", originalImageSrc || "", quickEditReferenceName)
				: "",
		)

		const imageSettings = getImageGenerationSettings(restoredModel)
		const isSameModelAsSavedRequest = sourceRequest?.model_id === restoredModelId
		setSelectedImageGenerationConfig(
			isSameModelAsSavedRequest
				? restoreImageGenerationConfig(
						imageSettings,
						sourceRequest?.image_generation_config,
					)
				: buildDefaultImageGenerationConfig(imageSettings),
		)

		const sizes = restoredModel?.image_size_config?.sizes
		if (sizes?.length) {
			const nextResolution = getDefaultResolutionForModel(
				restoredModel,
				isSameModelAsSavedRequest ? sourceRequest?.resolution : undefined,
			)
			const restoredSize = resolveImageSizeOptionFromRequest({
				sizes,
				request: isSameModelAsSavedRequest ? sourceRequest : undefined,
				preferredResolution: nextResolution,
				fallbackAspectRatio: originalImageSrc ? currentImageVisibleAspectRatio : undefined,
			})
			const targetSize = restoredSize?.size ?? sizes[0]

			setSelectedLabel(targetSize.label)
			setSelectedSize(targetSize.value)
			setSelectedScale(targetSize.scale || undefined)
			setSelectedResolution(restoredSize?.resolution)
		} else {
			setSelectedLabel(undefined)
			setSelectedSize(undefined)
			setSelectedScale(undefined)
			setSelectedResolution(undefined)
		}
	}, [
		canvas,
		cancelPendingDraftPersistence,
		activeImageContent.generateImageRequest,
		imageModelList,
		resolveQuickEditModelId,
		applyQuickEditReferencePreset,
		currentImageVisibleAspectRatio,
		originalImageName,
		originalImageSrc,
		updateProtectedReferencePaths,
		updateMentionBindings,
	])

	// 恢复配置的辅助函数
	const restoreConfig = useCallback(() => {
		if (!canvas) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!(elementInstance instanceof ImageElementClass)) return
		if (isApplyingRestoreRef.current) return
		isApplyingRestoreRef.current = true

		// 标记正在恢复配置
		isRestoringRef.current = true

		// 优先恢复外层传入的二次编辑快照，再恢复当前普通生成意图的会话草稿。
		const sessionRequest = sessionRestoreRequestRef.current
		sessionRestoreRequestRef.current = null
		const recoverySnapshot =
			manageRecoverySession && recoveryKey
				? canvas.mediaEditRecoveryManager.get<ImageEditSessionSnapshot>(
						recoveryKey,
						recoverySourceFingerprint,
					)?.draft
				: undefined
		const recoveryRequest = recoverySnapshot?.request
		const restoredMentionBindings =
			sessionRestoreMentionBindingsRef.current ?? recoverySnapshot?.mentionBindings ?? []
		sessionRestoreMentionBindingsRef.current = null
		updateMentionBindings(restoredMentionBindings)
		const currentRequest = request ?? activeImageContent.generateImageRequest
		const requestToRestore = readOnly
			? currentRequest
			: (sessionRequest ?? recoveryRequest ?? currentRequest)
		if (requestToRestore) {
			// 恢复模型ID
			const restoredModelId = readOnly
				? requestToRestore.model_id
				: requestToRestore.model_id &&
					  imageModelList.some((model) => model.model_id === requestToRestore.model_id)
					? requestToRestore.model_id
					: imageModelList[0]?.model_id

			if (restoredModelId) {
				setSelectedModelId(restoredModelId)
			}

			const restoredModel = imageModelList.find((model) => model.model_id === restoredModelId)

			// 恢复提示词：优先按参考图列表把占位符还原为 @ 文件名；无法匹配的占位符保持原文
			const restoredReferencePaths = requestToRestore.reference_images || []
			const restoredPromptReferences = resolvePromptReferencesByPaths(restoredReferencePaths)
			const promptToRestore = decodePromptPlaceholdersWithLabels(
				requestToRestore.prompt || "",
				restoredPromptReferences,
				resolvePromptPlaceholderDecodeLabels("image", promptPlaceholderTokenConfig),
				promptPlaceholderTokenConfig,
			)
			setPrompt(promptToRestore)
			setSelectedImageGenerationConfig(
				restoreImageGenerationConfig(
					getImageGenerationSettings(restoredModel),
					requestToRestore.image_generation_config,
				),
			)
			// 恢复参考文件：将 reference_images 还原为元素上的引用列表，并同时建立本次编辑会话的绑定策略。
			if (requestToRestore.reference_images && requestToRestore.reference_images.length > 0) {
				const restoredReferenceFileInfos: ReferenceResourceFileInfo[] =
					requestToRestore.reference_images.map((path) => {
						const fileName = getCanvasResourceFileName(path) || path
						return {
							path,
							src: path,
							fileName,
						}
					})
				if (!readOnly)
					elementInstance.setReferenceImageInfos(
						restoredReferenceFileInfos as UploadFileResponse[],
					)
				applyBindingStateFromPromptAndReferences(
					promptToRestore,
					restoredReferenceFileInfos,
					restoredMentionBindings,
				)
			} else {
				if (!readOnly) elementInstance.clearReferenceImageInfos()
				updateProtectedReferencePaths([])
			}

			// 恢复尺寸配置
			const sizes = restoredModel?.image_size_config?.sizes
			if (sizes?.length) {
				const targetResolution = getDefaultResolutionForModel(
					restoredModel,
					requestToRestore.resolution,
				)
				const restoredSize = resolveImageSizeOptionFromRequest({
					sizes,
					request: requestToRestore,
					preferredResolution: targetResolution,
				})
				const targetSize = restoredSize?.size ?? sizes[0]
				setSelectedLabel(targetSize.label)
				setSelectedSize(targetSize.value)
				setSelectedScale(targetSize.scale || undefined)
				setSelectedResolution(restoredSize?.resolution)
			} else {
				setSelectedLabel(undefined)
				setSelectedSize(undefined)
				setSelectedScale(undefined)
				setSelectedResolution(undefined)
			}
			if (readOnly) {
				setSelectedSize(requestToRestore.size)
				setSelectedResolution(requestToRestore.resolution)
			}
		} else if (readOnly) {
			setPrompt("")
			setSelectedModelId("")
			setSelectedSize(undefined)
			setSelectedResolution(undefined)
		} else {
			// 没有会话草稿时，尝试从 rootStorage 恢复
			const methods = canvas.magicConfigManager.config?.methods
			const rootStorage = methods?.getRootStorage?.()
			const defaultConfig = rootStorage?.defaultGenerateImageConfig

			if (defaultConfig) {
				updateProtectedReferencePaths([])
				// 从 rootStorage 恢复配置
				const restoredModelId =
					defaultConfig.model_id &&
					imageModelList.some((model) => model.model_id === defaultConfig.model_id)
						? defaultConfig.model_id
						: imageModelList[0]?.model_id

				if (restoredModelId) {
					setSelectedModelId(restoredModelId)
				}

				const restoredModel = imageModelList.find(
					(model) => model.model_id === restoredModelId,
				)
				setSelectedImageGenerationConfig(
					restoreImageGenerationConfig(
						getImageGenerationSettings(restoredModel),
						defaultConfig.image_generation_config,
					),
				)

				// 恢复尺寸配置
				const sizes = restoredModel?.image_size_config?.sizes
				if (sizes?.length) {
					const targetResolution = getDefaultResolutionForModel(
						restoredModel,
						defaultConfig.resolution,
					)
					const restoredSize = resolveImageSizeOptionFromRequest({
						sizes,
						request: defaultConfig,
						preferredResolution: targetResolution,
					})
					const targetSize = restoredSize?.size ?? sizes[0]
					setSelectedLabel(targetSize.label)
					setSelectedSize(targetSize.value)
					setSelectedScale(targetSize.scale || undefined)
					setSelectedResolution(restoredSize?.resolution)
				} else {
					setSelectedLabel(undefined)
					setSelectedSize(undefined)
					setSelectedScale(undefined)
					setSelectedResolution(undefined)
				}
			} else {
				updateProtectedReferencePaths([])
				// rootStorage 也没有，使用模型列表第一个作为默认配置
				const defaultModel = imageModelList[0]
				if (defaultModel) {
					setSelectedModelId(defaultModel.model_id)
					const imageSettings = getImageGenerationSettings(defaultModel)
					setSelectedImageGenerationConfig(
						buildDefaultImageGenerationConfig(imageSettings),
					)

					const sizes = defaultModel?.image_size_config?.sizes
					if (sizes?.length) {
						const targetResolution = getDefaultResolutionForModel(defaultModel)
						const restoredSize = resolveImageSizeOptionFromRequest({
							sizes,
							preferredResolution: targetResolution,
						})
						const targetSize = restoredSize?.size ?? sizes[0]
						setSelectedLabel(targetSize.label)
						setSelectedSize(targetSize.value)
						setSelectedScale(targetSize.scale || undefined)
						setSelectedResolution(restoredSize?.resolution)
					} else {
						setSelectedLabel(undefined)
						setSelectedSize(undefined)
						setSelectedScale(undefined)
						setSelectedResolution(undefined)
					}
				}
			}
		}

		hasRestoredRef.current = true

		// 同步参考文件状态（确保恢复的 Element 文件 infos 同步到 state）
		syncFromElement()

		// 恢复完成后统一释放恢复期标记，避免 restore/persist 交叉重入。
		setTimeout(() => {
			isRestoringRef.current = false
			isApplyingRestoreRef.current = false
			// 参数或模型列表可能在恢复期间到达；释放标记后通知下一轮，不能漏掉新快照。
			setRestoreRevision((revision) => revision + 1)
		}, 0)
	}, [
		canvas,
		imageElement.id,
		manageRecoverySession,
		recoveryKey,
		recoverySourceFingerprint,
		activeImageContent.generateImageRequest,
		readOnly,
		request,
		syncFromElement,
		imageModelList,
		resolvePromptReferencesByPaths,
		promptPlaceholderTokenConfig,
		applyBindingStateFromPromptAndReferences,
		updateProtectedReferencePaths,
		updateMentionBindings,
	])

	/** 清除草稿后按已落库的 generateImageRequest 完整回填编辑器（与「快捷编辑」仅恢复模型配置区分） */
	const restoreOriginalGenerateImageRequestToUi = useCallback(() => {
		if (!canvas) return
		if (isApplyingRestoreRef.current) return
		if (imageModelList.length === 0) return
		const source = activeImageContent.generateImageRequest
		if (!source?.model_id) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!(elementInstance instanceof ImageElementClass)) return

		cancelPendingDraftPersistence()
		hasRestoredRef.current = false
		restoreConfig()
	}, [
		canvas,
		imageModelList.length,
		activeImageContent.generateImageRequest,
		imageElement.id,
		cancelPendingDraftPersistence,
		restoreConfig,
	])

	const restoreSessionSnapshotToUi = useCallback(
		(snapshot: ImageEditSessionSnapshot) => {
			if (!canvas) return
			if (isApplyingRestoreRef.current) return

			cancelPendingDraftPersistence()
			sessionRestoreRequestRef.current = snapshot.request
			sessionRestoreMentionBindingsRef.current = snapshot.mentionBindings ?? []
			hasRestoredRef.current = false
			if (imageModelList.length > 0) restoreConfig()
		},
		[canvas, cancelPendingDraftPersistence, imageModelList.length, restoreConfig],
	)

	const buildSessionSnapshot = useCallback((): ImageEditSessionSnapshot => {
		const capturedMentionBindings =
			editorFocusRef?.current?.getMentionBindings?.() ?? latestMentionBindingsRef.current
		updateMentionBindings(capturedMentionBindings)
		return {
			request: buildRequestParams(),
			mentionBindings: capturedMentionBindings,
		}
	}, [buildRequestParams, editorFocusRef, updateMentionBindings])

	// 首次完成初始化后建立普通生成意图的 baseline；已有失败/中断草稿则保留原 baseline。
	useEffect(() => {
		if (
			!manageRecoverySession ||
			!canvas ||
			!recoveryKey ||
			!hasRestoredRef.current ||
			isRestoringRef.current
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
	])

	// 初始化：从 Element 同步参考图信息
	useMount(() => {
		// 同步参考图状态
		syncFromElement()
	})

	// 从 Canvas 恢复管理器恢复之前填写的内容（等待模型列表加载完成后执行）
	useEffect(() => {
		if (readOnly) hasRestoredRef.current = false
	}, [readOnly, request, activeImageContent.generateImageRequest, imageModelList])

	useEffect(() => {
		if (
			!canvas ||
			hasRestoredRef.current ||
			isRestoringRef.current ||
			(!readOnly && imageModelList.length === 0)
		)
			return
		restoreConfig()
	}, [canvas, imageModelList, restoreConfig, readOnly, restoreRevision])

	useEffect(() => {
		updateProtectedReferencePaths(
			pruneProtectedReferencePaths(
				currentReferenceFiles,
				protectedReferencePaths,
				resolveResourceReference,
			),
		)
	}, [
		currentReferenceFiles,
		resolveResourceReference,
		protectedReferencePaths,
		updateProtectedReferencePaths,
	])

	// 当用户填写的内容变化时，防抖写入 Canvas 恢复管理器。
	useUpdateEffect(() => {
		if (readOnly) return
		if (isRestoringRef.current) return
		scheduleDraftPersistence(buildRequestParams())
	}, [buildRequestParams, scheduleDraftPersistence])

	// 组件卸载时清理定时器
	useUnmount(() => {
		if (manageRecoverySession && hasRestoredRef.current && !isRestoringRef.current) {
			saveDraftRequest(buildRequestParams())
		}
		cancelPendingDraftPersistence()
		if (popoverCloseTimeoutRef.current) {
			clearTimeout(popoverCloseTimeoutRef.current)
		}
	})

	return {
		selectedModelId,
		prompt,
		selectedResolution,
		selectedSize,
		selectedLabel,
		selectedScale,
		selectedImageGenerationConfig,
		referenceSourceCrop: activeImageContent.crop,
		currentReferenceFiles,
		protectedReferencePaths,
		referenceBindingMode,
		referenceFileInfos,
		mentionBindings,
		matchableItems,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		isReferencePolicyReady,
		maxReferenceFiles,
		isReferenceFileLimitReached,
		isUploading,
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		supportedImageSettingOptions,
		currentSelectValue,
		ratioOption,
		isPopoverOpen,
		selectedReferenceSlot,
		referenceResourceType,
		fileInputAccept,
		hasRestoredRef,
		isRestoringRef,
		hasGenerationRequest: Boolean(request ?? activeImageContent.generateImageRequest),
		restoreRevision,
		handlers: {
			setSelectedModelId,
			setPrompt,
			setSelectedResolution,
			setSelectedSize,
			setSelectedLabel,
			setSelectedScale,
			setSelectedImageGenerationConfig,
			handleModelChange,
			handleResolutionChange,
			handleRatioChange,
			handleImageSettingChange,
			handleReferenceFileRemove,
			setPopoverOpen: setIsPopoverOpen,
			handlePopoverMouseEnter,
			handlePopoverMouseLeave,
			buildRequestParams,
			saveDraftRequest,
			cancelPendingDraftPersistence,
			restoreQuickEditConfigToUi,
			restoreOriginalGenerateImageRequestToUi,
			prepareReferenceSlotSelection,
			replaceReferenceFileAt,
			triggerFileSelect,
			uploadFiles,
			uploadMentionController,
			handleFileChange,
			resetSelectedReferenceSlot,
			syncReferenceFilesFromElement,
			handlePromptReferencePathsChange,
			updateMentionBindings,
		},
		fileInputRef,
		editSession: {
			buildSnapshot: buildSessionSnapshot,
			restoreSnapshotToUi: restoreSessionSnapshotToUi,
		},
	}
}
