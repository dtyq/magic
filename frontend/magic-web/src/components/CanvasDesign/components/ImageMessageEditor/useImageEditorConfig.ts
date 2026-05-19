import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMount, useUnmount, useUpdateEffect } from "ahooks"
import type { CropConfig, ImageElement } from "../../canvas/types"
import { useCanvas } from "../../context/CanvasContext"
import { useMagic } from "../../context/MagicContext"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import type { GenerateImageRequest, UploadFileResponse } from "../../types.magic"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { useFileInput } from "../MessageEditor/useFileInput"
import { useReferenceImagesState } from "./useReferenceImagesState"
import type {
	ReferenceResourceFileInfo,
	ReferenceResourceType,
} from "../MessageEditor/reference-assets/reference-resource.types"
import { buildReferenceImageOptions } from "../../canvas/utils/imageCropUtils"
import {
	encodePromptMentionsToPlaceholders,
	type PromptPlaceholderReference,
} from "../MessageEditor/reference-assets/promptPlaceholderCodec"
import { appendMentionToString } from "../MessageEditor/tiptap/contentUtils"
import {
	decodePromptPlaceholdersWithLabels,
	createPromptPlaceholderTokenFactory,
	resolvePromptPlaceholderDecodeLabels,
	resolvePromptPlaceholderTokenConfig,
} from "../MessageEditor/reference-assets/promptPlaceholderTokenConfig"
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
} from "../MessageEditor/reference-assets/referenceBinding"

interface UseImageEditorConfigOptions {
	imageElement: ImageElement
	originalImageSrc?: string
	originalImageName?: string
	/** 编辑器 focus 的 ref，上传完成后用于聚焦 */
	editorFocusRef?: React.RefObject<{ focus: () => void } | null>
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
	matchableItems: Array<{ name: string; path?: string; disabled?: boolean }>
	modelOptions: ImageModelOption[]
	modelOptionGroups: ImageModelOptionGroup[]
	selectedModelOption: ImageModelOption | undefined
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
	referenceResourceType: ReferenceResourceType
	fileInputAccept: string
	/** 画布图片的源图裁剪，用于参考列表「当前图片」缩略图与画布可视区域一致 */
	referenceSourceCrop: CropConfig | undefined
	hasRestoredRef: React.RefObject<boolean>
	isRestoringRef: React.RefObject<boolean>
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
		triggerFileSelect: () => void
		uploadFiles: (files: File[]) => Promise<void>
		handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
		/** 从 elementInstance 同步参考文件状态到 config，用于 @ 面板添加后的闭环 */
		syncReferenceFilesFromElement: () => void
		/** prompt 中一旦出现显式图片绑定，就把对应 legacy 保护引用升级为普通 prompt 绑定。 */
		handlePromptReferencePathsChange: (paths: string[]) => void
	}
	fileInputRef: React.MutableRefObject<HTMLInputElement | null>
}

export function useImageEditorConfig(options: UseImageEditorConfigOptions): ImageEditorConfig {
	const { imageElement, originalImageSrc, originalImageName, editorFocusRef } = options
	const { imageModelList, methods } = useMagic()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const referenceResourceType: ReferenceResourceType = "image"
	const fileInputAccept = "image/*"

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

	// 标记是否已经恢复过临时数据
	const hasRestoredRef = useRef<boolean>(false)
	// 标记是否正在恢复配置（用于避免恢复时触发保存）
	const isRestoringRef = useRef<boolean>(false)
	// Popover 关闭延迟的 timeout ID
	const popoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const draftPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingDraftRequestRef = useRef<Partial<GenerateImageRequest> | null>(null)
	const lastPersistedDraftRef = useRef("")
	const isApplyingRestoreRef = useRef<boolean>(false)
	// 标记是否正在删除参考图（用于防止删除时弹窗关闭）
	const isRemovingReferenceImageRef = useRef<boolean>(false)

	// 获取当前模型的最大参考文件数量限制（需要提前计算，供 useReferenceImagesState 使用）
	const maxReferenceFiles = useMemo(() => {
		const selectedModel = imageModelList.find((model) => model.model_id === selectedModelId)
		return selectedModel?.image_size_config?.max_reference_images
	}, [imageModelList, selectedModelId])

	// 使用新的参考文件状态管理 hook
	const referenceFilesState = useReferenceImagesState({
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
		const width = imageElement.width ?? imageElement.crop?.displayWidth ?? 0
		const height = imageElement.height ?? imageElement.crop?.displayHeight ?? 0
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			return undefined
		}
		return width / height
	}, [
		imageElement.width,
		imageElement.height,
		imageElement.crop?.displayWidth,
		imageElement.crop?.displayHeight,
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
				.find((info) => info.path === originalImageSrc)

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

	// 跟踪待添加到 prompt 的文件名（用于等待 matchableItems 更新）
	const pendingFileNameRef = useRef<string | null>(null)
	const promptPlaceholderTokenConfig = useMemo(() => resolvePromptPlaceholderTokenConfig(t), [t])
	const buildImagePromptPlaceholderToken = useMemo(
		() =>
			createPromptPlaceholderTokenFactory(
				promptPlaceholderTokenConfig.imageLabel,
				promptPlaceholderTokenConfig,
			),
		[promptPlaceholderTokenConfig],
	)

	const updateProtectedReferencePaths = useCallback((nextPaths: string[]) => {
		setProtectedReferencePaths((prev) => {
			return areOrderedPathsEqual(prev, nextPaths) ? prev : nextPaths
		})
	}, [])

	const applyBindingStateFromPromptAndReferences = useCallback(
		(nextPrompt: string, nextReferenceFileInfos: ReferenceResourceFileInfo[]) => {
			const bindingState = resolveReferenceBindingState({
				prompt: nextPrompt,
				referenceFileInfos: nextReferenceFileInfos,
				tokenConfig: promptPlaceholderTokenConfig,
			})
			updateProtectedReferencePaths(bindingState.protectedReferencePaths)
			return bindingState
		},
		[promptPlaceholderTokenConfig, updateProtectedReferencePaths],
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
				referenceFileInfos.map((info) => [info.path, info.fileName || ""]),
			)
			return paths
				.map((path) => {
					const fileName = pathToFileName.get(path) || path.split("/").pop() || ""
					if (!fileName) return null
					return { path, fileName }
				})
				.filter((item): item is PromptPlaceholderReference => Boolean(item))
		},
		[referenceFileInfos],
	)

	// 使用文件输入 hook
	const { fileInputRef, triggerFileSelect, uploadFiles, handleFileChange, isUploading } =
		useFileInput({
			methods,
			currentReferenceFiles,
			canvas: canvas || undefined,
			elementId: imageElement.id,
			maxReferenceFiles,
			accept: fileInputAccept,
			onFileUploaded: useCallback(
				(result: UploadFileResponse) => {
					// 同步参考文件状态（从 Element 读取最新数据，包含新上传的文件）
					// syncFromElement 会立即更新 referenceFileInfos，从而更新 matchableItems
					syncFromElement()

					// 记录待添加的文件名，等待 matchableItems 更新后再添加到 prompt
					const fileName = result.fileName || result.path?.split("/").pop() || ""
					if (fileName) {
						pendingFileNameRef.current = fileName
					}
				},
				[syncFromElement],
			),
		})

	// 监听 matchableItems 的变化，当检测到新上传的文件时，自动追加到 prompt
	useEffect(() => {
		const pendingFileName = pendingFileNameRef.current
		if (!pendingFileName) return

		// 检查 matchableItems 中是否包含待添加的文件
		const matchedItem = matchableItems.find(
			(item) => item.name === pendingFileName || item.path?.endsWith(pendingFileName),
		)

		if (matchedItem && !matchedItem.disabled) {
			// matchableItems 已更新，可以安全地添加到 prompt
			setPrompt((prev) => {
				const trimmed = prev.trimEnd()
				return trimmed + (trimmed ? " " : "") + `@${pendingFileName}`
			})
			// 清空待添加的文件名
			pendingFileNameRef.current = null
			// 延迟一帧聚焦，确保 prompt 更新后编辑器已渲染
			setTimeout(() => editorFocusRef?.current?.focus(), 0)
		}
	}, [matchableItems, editorFocusRef])

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
						const fileName = pathToFileName[path] || path.split("/").pop() || path
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
				protectedReferencePaths.filter((protectedPath) => protectedPath !== path),
			)
			// 延迟清除删除标记，确保删除操作完成后再允许关闭
			setTimeout(() => {
				isRemovingReferenceImageRef.current = false
			}, 200)
		},
		[protectedReferencePaths, removeReferenceFile, updateProtectedReferencePaths],
	)

	// 从 elementInstance 同步参考文件状态，用于 @ 面板添加后的数据闭环
	const syncReferenceFilesFromElement = useCallback(() => {
		syncFromElement()
	}, [syncFromElement])

	const handlePromptReferencePathsChange = useCallback(
		(paths: string[]) => {
			updateProtectedReferencePaths(
				unprotectPromptBoundReferencePaths(protectedReferencePaths, paths),
			)
		},
		[protectedReferencePaths, updateProtectedReferencePaths],
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
			imageElement.crop && originalImageSrc && referenceImages?.[0] === originalImageSrc
				? buildReferenceImageOptions({
						filePath: originalImageSrc,
						crop: imageElement.crop,
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
		imageElement.crop,
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
			if (!canvas) return
			const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
			if (!(elementInstance instanceof ImageElementClass)) return
			const serializedRequest = JSON.stringify(request)
			if (lastPersistedDraftRef.current === serializedRequest) {
				pendingDraftRequestRef.current = null
				return
			}
			elementInstance.saveTempGenerateImageRequest(request)
			lastPersistedDraftRef.current = serializedRequest
			pendingDraftRequestRef.current = null
		},
		[canvas, imageElement.id],
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

		if (imageModelList.length === 0) return

		const sourceRequest = imageElement.generateImageRequest
		const restoredModelId = resolveQuickEditModelId(sourceRequest)

		if (!restoredModelId) return

		const restoredModel = imageModelList.find((m) => m.model_id === restoredModelId)
		const shouldSeedQuickEditReference = Boolean(
			originalImageSrc && supportsReferenceImages(restoredModel),
		)
		const quickEditReferenceName =
			originalImageName || originalImageSrc?.split("/").pop() || undefined

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
			const scaleSet = new Set(sizes.map((size) => size.scale).filter(Boolean))
			const availableScales = Array.from(scaleSet)
			const nextResolution = availableScales.length
				? getDefaultResolutionForModel(
						restoredModel,
						isSameModelAsSavedRequest ? sourceRequest?.resolution : undefined,
					)
				: undefined
			const matchedSize = isSameModelAsSavedRequest
				? sourceRequest?.size
					? sizes.find(
							(size) =>
								size.value === sourceRequest.size &&
								(size.scale || undefined) ===
									(sourceRequest.resolution || undefined),
						)
					: undefined
				: undefined
			const targetSize =
				matchedSize ||
				findBestSizeForResolution(
					sizes,
					nextResolution,
					undefined,
					originalImageSrc ? currentImageVisibleAspectRatio : undefined,
				) ||
				(isSameModelAsSavedRequest && sourceRequest?.size
					? sizes.find((size) => size.value === sourceRequest.size)
					: undefined) ||
				sizes[0]

			setSelectedLabel(targetSize.label)
			setSelectedSize(targetSize.value)
			setSelectedScale(targetSize.scale || undefined)

			if (availableScales.length) {
				setSelectedResolution(nextResolution || targetSize.scale || undefined)
			} else {
				setSelectedResolution(undefined)
			}
		} else {
			setSelectedLabel(undefined)
			setSelectedSize(undefined)
			setSelectedScale(undefined)
			setSelectedResolution(undefined)
		}
	}, [
		canvas,
		cancelPendingDraftPersistence,
		imageElement.generateImageRequest,
		imageModelList,
		resolveQuickEditModelId,
		applyQuickEditReferencePreset,
		currentImageVisibleAspectRatio,
		originalImageName,
		originalImageSrc,
		updateProtectedReferencePaths,
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

		// 获取临时请求（统一使用 tempGenerateImageRequest）
		const tempRequest = elementInstance.getTempGenerateImageRequest()
		const currentRequest = imageElement.generateImageRequest
		const requestToRestore = tempRequest
			? {
					...currentRequest,
					...tempRequest,
					prompt: tempRequest.prompt ?? currentRequest?.prompt,
					reference_images:
						tempRequest.reference_images ?? currentRequest?.reference_images,
				}
			: currentRequest

		if (requestToRestore) {
			// 恢复模型ID
			const restoredModelId =
				requestToRestore.model_id &&
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
			const restoredPrompt = decodePromptPlaceholdersWithLabels(
				requestToRestore.prompt || "",
				restoredPromptReferences,
				resolvePromptPlaceholderDecodeLabels("image", promptPlaceholderTokenConfig),
				promptPlaceholderTokenConfig,
			)
			setPrompt(restoredPrompt)
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
						const fileName = path.split("/").pop() || path
						return {
							path,
							src: path,
							fileName,
						}
					})
				elementInstance.setReferenceImageInfos(
					restoredReferenceFileInfos as UploadFileResponse[],
				)
				applyBindingStateFromPromptAndReferences(restoredPrompt, restoredReferenceFileInfos)
			} else {
				elementInstance.clearReferenceImageInfos()
				updateProtectedReferencePaths([])
			}

			// 恢复尺寸配置
			const sizes = restoredModel?.image_size_config?.sizes
			if (sizes?.length) {
				const matchedSize = requestToRestore.size
					? sizes.find(
							(size) =>
								size.value === requestToRestore.size &&
								(size.scale || undefined) ===
									(requestToRestore.resolution || undefined),
						)
					: undefined

				const targetSize = matchedSize || sizes[0]
				setSelectedLabel(targetSize.label)
				setSelectedSize(targetSize.value)
				setSelectedScale(targetSize.scale || undefined)
			} else {
				setSelectedLabel(undefined)
				setSelectedSize(undefined)
				setSelectedScale(undefined)
			}

			// 恢复分辨率配置
			if (sizes?.length) {
				const scaleSet = new Set(sizes.map((size) => size.scale).filter(Boolean))
				const availableScales = Array.from(scaleSet)

				if (availableScales.length) {
					const matchedResolution = getDefaultResolutionForModel(
						restoredModel,
						requestToRestore.resolution,
					)
					setSelectedResolution(matchedResolution)
				} else {
					setSelectedResolution(undefined)
				}
			} else {
				setSelectedResolution(undefined)
			}
		} else {
			// 没有 tempRequest，尝试从 rootStorage 恢复
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
					const matchedSize = defaultConfig.size
						? sizes.find(
								(size) =>
									size.value === defaultConfig.size &&
									(size.scale || undefined) ===
										(defaultConfig.resolution || undefined),
							)
						: undefined

					const targetSize =
						matchedSize ||
						findBestSizeForResolution(sizes, targetResolution, undefined) ||
						sizes[0]
					setSelectedLabel(targetSize.label)
					setSelectedSize(targetSize.value)
					setSelectedScale(targetSize.scale || undefined)
				} else {
					setSelectedLabel(undefined)
					setSelectedSize(undefined)
					setSelectedScale(undefined)
				}

				// 恢复分辨率配置
				if (sizes?.length) {
					const scaleSet = new Set(sizes.map((size) => size.scale).filter(Boolean))
					const availableScales = Array.from(scaleSet)

					if (availableScales.length) {
						const matchedResolution = getDefaultResolutionForModel(
							restoredModel,
							defaultConfig.resolution,
						)
						setSelectedResolution(matchedResolution)
					} else {
						setSelectedResolution(undefined)
					}
				} else {
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
						const targetSize =
							findBestSizeForResolution(sizes, targetResolution, undefined) ||
							sizes[0]
						setSelectedLabel(targetSize.label)
						setSelectedSize(targetSize.value)
						setSelectedScale(targetSize.scale || undefined)

						const scaleSet = new Set(sizes.map((size) => size.scale).filter(Boolean))
						const availableScales = Array.from(scaleSet)
						if (availableScales.length) {
							setSelectedResolution(targetResolution)
						} else {
							setSelectedResolution(undefined)
						}
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
		}, 0)
	}, [
		canvas,
		imageElement.id,
		imageElement.generateImageRequest,
		syncFromElement,
		imageModelList,
		resolvePromptReferencesByPaths,
		promptPlaceholderTokenConfig,
		applyBindingStateFromPromptAndReferences,
		updateProtectedReferencePaths,
	])

	/** 清除草稿后按已落库的 generateImageRequest 完整回填编辑器（与「快捷编辑」仅恢复模型配置区分） */
	const restoreOriginalGenerateImageRequestToUi = useCallback(() => {
		if (!canvas) return
		if (isApplyingRestoreRef.current) return
		if (imageModelList.length === 0) return
		const source = imageElement.generateImageRequest
		if (!source?.model_id) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!(elementInstance instanceof ImageElementClass)) return

		cancelPendingDraftPersistence()
		elementInstance.clearTempGenerateImageRequest()
		lastPersistedDraftRef.current = ""
		hasRestoredRef.current = false
		restoreConfig()
	}, [
		canvas,
		imageModelList.length,
		imageElement.generateImageRequest,
		imageElement.id,
		cancelPendingDraftPersistence,
		restoreConfig,
	])

	// 初始化：从 Element 同步参考图信息
	useMount(() => {
		// 同步参考图状态
		syncFromElement()
	})

	// 从 tempRequest 恢复之前填写的内容（等待模型列表加载完成后执行）
	useEffect(() => {
		if (
			!canvas ||
			hasRestoredRef.current ||
			isRestoringRef.current ||
			imageModelList.length === 0
		)
			return
		restoreConfig()
	}, [canvas, imageModelList, restoreConfig])

	useEffect(() => {
		updateProtectedReferencePaths(
			pruneProtectedReferencePaths(currentReferenceFiles, protectedReferencePaths),
		)
	}, [currentReferenceFiles, protectedReferencePaths, updateProtectedReferencePaths])

	// 当用户填写的内容变化时，防抖写入 tempRequest（使用 useUpdateEffect 避免首次挂载时触发）
	useUpdateEffect(() => {
		if (isRestoringRef.current) return
		scheduleDraftPersistence(buildRequestParams())
	}, [buildRequestParams, scheduleDraftPersistence])

	// 组件卸载时清理定时器
	useUnmount(() => {
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
		referenceSourceCrop: imageElement.crop,
		currentReferenceFiles,
		protectedReferencePaths,
		referenceBindingMode,
		referenceFileInfos,
		matchableItems,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		maxReferenceFiles,
		isReferenceFileLimitReached,
		isUploading,
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		supportedImageSettingOptions,
		currentSelectValue,
		ratioOption,
		isPopoverOpen,
		referenceResourceType,
		fileInputAccept,
		hasRestoredRef,
		isRestoringRef,
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
			triggerFileSelect,
			uploadFiles,
			handleFileChange,
			syncReferenceFilesFromElement,
			handlePromptReferencePathsChange,
		},
		fileInputRef,
	}
}
