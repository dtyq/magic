import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMount, useUnmount, useUpdateEffect } from "ahooks"
import type { ImageElement } from "../../canvas/types"
import { useCanvas } from "../../context/CanvasContext"
import { useMagic } from "../../context/MagicContext"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import type { GenerateImageRequest, UploadImageResponse, ImageModelItem } from "../../types.magic"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { useFileInput } from "./useFileInput"
import { useReferenceImagesState } from "./useReferenceImagesState"

interface UseImageEditorConfigOptions {
	imageElement: ImageElement
	protectedReferenceImageIndex?: number
	originalImageSrc?: string
	originalImageName?: string
	/** 编辑器 focus 的 ref，上传完成后用于聚焦 */
	editorFocusRef?: React.RefObject<{ focus: () => void } | null>
}

interface ImageModelOption {
	label: string
	value: string
	model: ImageModelItem
}

interface ImageModelOptionGroup {
	id: string
	label: string
	icon?: string
	sort: number
	source: "official" | "custom"
	options: ImageModelOption[]
}

export interface ImageEditorConfig {
	selectedModelId: string
	prompt: string
	selectedResolution?: string
	selectedSize?: string
	selectedLabel?: string
	selectedScale?: string
	currentReferenceImages: string[]
	referenceImageInfos: Array<{ src: string; fileName: string; path: string }>
	matchableItems: Array<{ name: string; path?: string; disabled?: boolean }>
	modelOptions: ImageModelOption[]
	modelOptionGroups: ImageModelOptionGroup[]
	selectedModelOption: ImageModelOption | undefined
	maxReferenceImages: number | undefined
	isReferenceImageLimitReached: boolean
	isUploading: boolean
	supportedAspectRatioOptions: Array<{
		value: string
		label: string
		width: number
		height: number
		iconWidth: number
		iconHeight: number
		originalLabel: string
		originalValue: string
		originalScale?: string
	}>
	supportedResolutionOptions: Array<{
		label: string
		value: string
		data: { label: string; value: string; scale: string }
	}>
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
	hasRestoredRef: React.RefObject<boolean>
	isRestoringRef: React.RefObject<boolean>
	handlers: {
		setSelectedModelId: (id: string) => void
		setPrompt: (prompt: string) => void
		setSelectedResolution: (value: string | undefined) => void
		setSelectedSize: (value: string | undefined) => void
		setSelectedLabel: (value: string | undefined) => void
		setSelectedScale: (value: string | undefined) => void
		handleModelChange: (modelId: string) => void
		handleResolutionChange: (value: string) => void
		handleRatioChange: (value: string) => void
		handleReferenceImageRemove: (path: string) => void
		handlePopoverMouseEnter: () => void
		handlePopoverMouseLeave: () => void
		buildRequestParams: () => Partial<GenerateImageRequest>
		triggerFileSelect: () => void
		handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
		/** 从 elementInstance 同步参考图状态到 config，用于 @ 面板添加后的闭环 */
		syncReferenceImagesFromElement: () => void
	}
	fileInputRef: React.MutableRefObject<HTMLInputElement | null>
}

export function useImageEditorConfig(options: UseImageEditorConfigOptions): ImageEditorConfig {
	const {
		imageElement,
		protectedReferenceImageIndex,
		originalImageSrc,
		originalImageName,
		editorFocusRef,
	} = options
	const { imageModelList, methods } = useMagic()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()

	// 本地 state 管理配置
	const [selectedModelId, setSelectedModelId] = useState<string>("")
	const [prompt, setPrompt] = useState<string>("")
	const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined)
	const [selectedResolution, setSelectedResolution] = useState<string | undefined>(undefined)
	const [selectedScale, setSelectedScale] = useState<string | undefined>(undefined)
	const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined)
	const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false)

	// 标记是否已经恢复过临时数据
	const hasRestoredRef = useRef<boolean>(false)
	// 标记是否正在恢复配置（用于避免恢复时触发保存）
	const isRestoringRef = useRef<boolean>(false)
	// Popover 关闭延迟的 timeout ID
	const popoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	// 标记是否正在删除参考图（用于防止删除时弹窗关闭）
	const isRemovingReferenceImageRef = useRef<boolean>(false)

	// 获取当前模型的最大参考图数量限制（需要提前计算，供 useReferenceImagesState 使用）
	const maxReferenceImages = useMemo(() => {
		const selectedModel = imageModelList.find((model) => model.model_id === selectedModelId)
		return selectedModel?.image_size_config?.max_reference_images
	}, [imageModelList, selectedModelId])

	// 使用新的参考图状态管理 hook
	const referenceImagesState = useReferenceImagesState({
		canvas,
		imageElementId: imageElement.id,
		maxReferenceImages,
		protectedReferenceImageIndex,
	})

	const {
		referenceImages: currentReferenceImages,
		referenceImageInfos,
		matchableItems,
		isReferenceImageLimitReached,
		removeReferenceImage,
		syncFromElement,
	} = referenceImagesState

	// 辅助函数：构建包含 label、value、scale 的唯一 value（用于 select）
	const buildSelectValue = useCallback((label: string, value: string, scale?: string) => {
		return JSON.stringify([label, value, scale || null])
	}, [])

	// 辅助函数：从 select value 中解析出 label、value 和 scale
	const parseSelectValue = useCallback((value: string) => {
		const parsed = JSON.parse(value)
		if (Array.isArray(parsed) && parsed.length >= 2) {
			return {
				label: parsed[0],
				value: parsed[1],
				scale: parsed[2] || undefined,
			}
		}
		return { label: "", value: "", scale: undefined }
	}, [])

	// 辅助函数：根据分辨率和当前label匹配最佳size
	const findBestSizeForResolution = useCallback(
		(
			allSizes: Array<{ label: string; value: string; scale?: string }>,
			targetResolution: string | undefined,
			currentLabel: string | undefined,
		) => {
			const sizesForResolution = targetResolution
				? allSizes.filter((size) => size.scale === targetResolution)
				: allSizes

			if (sizesForResolution.length === 0) {
				return null
			}

			let targetSize = sizesForResolution.find((size) => size.label === currentLabel)

			if (!targetSize) {
				targetSize = sizesForResolution[0]
			}

			return targetSize
		},
		[],
	)

	// 将模型列表转换为 Select 组件需要的格式
	const modelOptions = useMemo<ImageModelOption[]>(() => {
		return imageModelList.map((model) => ({
			label: model.model_name,
			value: model.model_id,
			model,
		}))
	}, [imageModelList])

	const modelOptionGroups = useMemo<ImageModelOptionGroup[]>(() => {
		const groupMap = new Map<string, ImageModelOptionGroup>()

		modelOptions.forEach((option) => {
			const groupId =
				option.model.model_group?.id || option.model.group_id || option.model.model_id
			const groupLabel = option.model.model_group?.name || t("imageEditor.model", "模型")
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

	// 当前选中的模型选项
	const selectedModelOption = useMemo(() => {
		return modelOptions.find((opt) => opt.value === selectedModelId)
	}, [modelOptions, selectedModelId])

	// 从 image_size_config 转换为宽高比选项格式（根据选中的分辨率筛选）
	const supportedAspectRatioOptions = useMemo(() => {
		if (!selectedModelOption?.model?.image_size_config?.sizes) {
			return []
		}
		const filteredSizes = selectedModelOption.model.image_size_config.sizes.filter((size) => {
			if (!selectedResolution) {
				return true
			}
			return size.scale === selectedResolution
		})

		return filteredSizes
			.map((size) => {
				const [width, height] = size.value.split("x").map(Number)
				const baseSize = 16
				const aspectRatio = width / height
				let iconWidth: number
				let iconHeight: number
				if (aspectRatio >= 1) {
					iconWidth = baseSize
					iconHeight = Math.round(baseSize / aspectRatio)
				} else {
					iconHeight = baseSize
					iconWidth = Math.round(baseSize * aspectRatio)
				}
				const value = buildSelectValue(size.label, size.value, size.scale)
				return {
					value,
					label: size.label,
					width,
					height,
					iconWidth,
					iconHeight,
					originalLabel: size.label,
					originalValue: size.value,
					originalScale: size.scale,
				}
			})
			.sort((a, b) => {
				const parseNFromLabel = (label: string): number => {
					const match = label.match(/^(\d+):(\d+)/)
					if (match) {
						return parseInt(match[1], 10)
					}
					return Infinity
				}
				const nA = parseNFromLabel(a.originalLabel)
				const nB = parseNFromLabel(b.originalLabel)
				return nA - nB
			})
	}, [selectedModelOption, buildSelectValue, selectedResolution])

	// 当前模型支持的分辨率选项（从 image_size_config.sizes.scale 聚合）
	const supportedResolutionOptions = useMemo(() => {
		if (!selectedModelOption?.model?.image_size_config?.sizes) {
			return []
		}
		const scaleMap = new Map<string, { label: string; value: string; scale: string }>()
		selectedModelOption.model.image_size_config.sizes.forEach((size) => {
			if (size.scale && !scaleMap.has(size.scale)) {
				scaleMap.set(size.scale, {
					label: size.label,
					value: size.value,
					scale: size.scale,
				})
			}
		})
		return Array.from(scaleMap.entries()).map(([scale, sizeData]) => ({
			label: scale,
			value: scale,
			data: sizeData,
		}))
	}, [selectedModelOption?.model?.image_size_config?.sizes])

	// 构建当前选中的 select value（用于匹配选项）
	const currentSelectValue = useMemo(() => {
		if (!selectedLabel || !selectedSize) return undefined
		return buildSelectValue(selectedLabel, selectedSize, selectedScale)
	}, [selectedLabel, selectedSize, selectedScale, buildSelectValue])

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

	// 确保原图在参考图列表的第一个位置
	const ensureOriginalImageFirst = useCallback(async () => {
		if (!originalImageSrc || !canvas) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!(elementInstance instanceof ImageElementClass)) return

		// 请求原图 Resource（确保 ossSrc 可用）
		const resource = await canvas.imageResourceManager.getResource(originalImageSrc)
		const ossSrc = resource?.ossSrc ?? undefined

		const infos = elementInstance.getReferenceImageInfos()
		const paths = infos.map((info) => info.path)

		// 如果第一个不是原图，需要调整
		if (paths.length === 0 || paths[0] !== originalImageSrc) {
			// 如果原图不在列表中，需要添加
			if (!paths.includes(originalImageSrc)) {
				// 创建原图的参考图信息（使用 ossSrc 作为 src，path 作为标识）
				const originalInfo: UploadImageResponse = {
					path: originalImageSrc,
					src: ossSrc || originalImageSrc,
					fileName: originalImageName || t("imageEditor.originalImage", "原图"),
				}
				// 将原图插入到第一个位置
				const newInfos = [originalInfo, ...infos]
				elementInstance.saveReferenceImageInfos(newInfos)
			} else {
				// 原图在列表中，需要移到第一个位置并更新 src
				const originalIndex = paths.indexOf(originalImageSrc)
				const existingInfo = infos[originalIndex]
				const updatedInfo: UploadImageResponse = {
					...existingInfo,
					src: ossSrc || existingInfo.src,
					fileName: originalImageName || existingInfo.fileName,
				}
				const newInfos = [
					updatedInfo,
					...infos.filter((_, index) => index !== originalIndex),
				]
				elementInstance.saveReferenceImageInfos(newInfos)
			}
		} else {
			// 原图已经在第一个位置，更新其 src 为 ossSrc
			const existingInfo = infos[0]
			if (existingInfo && (ossSrc || originalImageName)) {
				const updatedInfo: UploadImageResponse = {
					...existingInfo,
					src: ossSrc || existingInfo.src,
					fileName: originalImageName || existingInfo.fileName,
				}
				const newInfos = [updatedInfo, ...infos.slice(1)]
				elementInstance.saveReferenceImageInfos(newInfos)
			}
		}

		// 同步到 referenceImagesState
		syncFromElement()
	}, [originalImageSrc, originalImageName, canvas, imageElement.id, t, syncFromElement])

	// 跟踪待添加到 prompt 的文件名（用于等待 matchableItems 更新）
	const pendingFileNameRef = useRef<string | null>(null)

	// 使用文件输入 hook
	const { fileInputRef, triggerFileSelect, handleFileChange, isUploading } = useFileInput({
		methods,
		currentReferenceImages,
		canvas: canvas || undefined,
		imageElementId: imageElement.id,
		maxReferenceImages,
		onFileUploaded: useCallback(
			(result: UploadImageResponse) => {
				// 同步参考图状态（从 Element 读取最新数据，包含新上传的文件）
				// syncFromElement 会立即更新 referenceImageInfos，从而更新 matchableItems
				syncFromElement()

				// 确保原图在第一个位置（SecondEdit 模式）
				if (originalImageSrc) {
					ensureOriginalImageFirst()
				}

				// 记录待添加的文件名，等待 matchableItems 更新后再添加到 prompt
				const fileName = result.fileName || result.path?.split("/").pop() || ""
				if (fileName) {
					pendingFileNameRef.current = fileName
				}
			},
			[syncFromElement, originalImageSrc, ensureOriginalImageFirst],
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
				// 检查当前 prompt 中是否已经包含这个文件的 @ 提及，避免重复添加
				const mentionPattern = new RegExp(
					`@${pendingFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
					"i",
				)
				if (mentionPattern.test(prev)) {
					// 已经包含，不重复添加
					return prev
				}
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
			const effectiveMaxImages =
				newMaxReferenceImages === undefined ? Infinity : newMaxReferenceImages

			// 从多到少：当前参考图数量超过新模型限制时裁剪
			if (currentReferenceImages.length > effectiveMaxImages) {
				const pathsToRemove = currentReferenceImages.slice(effectiveMaxImages)
				const pathToFileName = Object.fromEntries(
					referenceImageInfos.map((info) => [info.path, info.fileName]),
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
							new RegExp(`@${escapeRegex(fileName)}`, "g"),
							"",
						)
					}
					newPrompt = newPrompt.replace(/\s+/g, " ").trim()
					setPrompt(newPrompt)
				}
			}

			if (newModelOption?.model?.image_size_config?.sizes) {
				const sizes = newModelOption.model.image_size_config.sizes

				// 先处理分辨率（从 sizes.scale 聚合）
				const scaleSet = new Set<string>()
				sizes.forEach((size) => {
					if (size.scale) {
						scaleSet.add(size.scale)
					}
				})
				const availableScales = Array.from(scaleSet)
				let targetResolution = selectedResolution

				if (availableScales.length > 0) {
					const currentResolution = availableScales.find(
						(scale) => scale === selectedResolution,
					)
					if (!currentResolution) {
						targetResolution = availableScales[0]
						setSelectedResolution(targetResolution)
					}
				} else {
					targetResolution = undefined
					setSelectedResolution(undefined)
				}

				// 再处理size（基于确定的分辨率）
				if (sizes.length > 0) {
					const targetSize = findBestSizeForResolution(
						sizes,
						targetResolution,
						selectedLabel,
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
		},
		[
			modelOptions,
			currentReferenceImages,
			referenceImageInfos,
			canvas,
			imageElement,
			selectedResolution,
			findBestSizeForResolution,
			selectedLabel,
			originalImageSrc,
			prompt,
			setPrompt,
			syncFromElement,
		],
	)

	// 处理尺寸选择变化
	const handleRatioChange = useCallback(
		(value: string) => {
			const parsed = parseSelectValue(value)
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
		[canvas, imageElement, supportedAspectRatioOptions, parseSelectValue, originalImageSrc],
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
		[
			selectedModelOption,
			selectedLabel,
			imageElement,
			canvas,
			findBestSizeForResolution,
			originalImageSrc,
		],
	)

	// 处理参考图删除（通过 referenceImagesState 统一管理）
	const handleReferenceImageRemove = useCallback(
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
			removeReferenceImage(path)
			// 延迟清除删除标记，确保删除操作完成后再允许关闭
			setTimeout(() => {
				isRemovingReferenceImageRef.current = false
			}, 200)
		},
		[removeReferenceImage],
	)

	// 从 elementInstance 同步参考图状态，用于 @ 面板添加后的数据闭环
	const syncReferenceImagesFromElement = useCallback(() => {
		syncFromElement()
	}, [syncFromElement])

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
		// 对于 SecondEdit，原图应该始终作为参考图（即使模型不支持参考图）
		const isSecondEdit = !!originalImageSrc
		const shouldIncludeReferenceImages =
			maxReferenceImages !== undefined &&
			maxReferenceImages > 0 &&
			currentReferenceImages.length > 0

		// 如果是 SecondEdit 且有原图，确保原图在参考图列表中
		let referenceImages: string[] | undefined
		if (isSecondEdit && originalImageSrc) {
			// SecondEdit 模式：原图应该始终作为参考图
			referenceImages =
				currentReferenceImages.length > 0 ? currentReferenceImages : [originalImageSrc]
		} else if (shouldIncludeReferenceImages) {
			// 普通模式：只有当模型支持参考图时才包含
			referenceImages = currentReferenceImages
		} else {
			referenceImages = undefined
		}

		return {
			model_id: selectedModelId || undefined,
			prompt: prompt.trim() || undefined,
			size: selectedSize,
			resolution: selectedResolution || undefined,
			reference_images: referenceImages,
		}
	}, [
		selectedModelId,
		prompt,
		selectedSize,
		selectedResolution,
		currentReferenceImages,
		maxReferenceImages,
		originalImageSrc,
	])

	// 恢复配置的辅助函数
	const restoreConfig = useCallback(() => {
		if (!canvas) return

		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!(elementInstance instanceof ImageElementClass)) return

		// 标记正在恢复配置
		isRestoringRef.current = true

		// 获取临时请求（统一使用 tempGenerateImageRequest）
		const tempRequest = elementInstance.getTempGenerateImageRequest()

		if (tempRequest) {
			// 恢复模型ID
			const restoredModelId =
				tempRequest.model_id &&
				imageModelList.some((model) => model.model_id === tempRequest.model_id)
					? tempRequest.model_id
					: imageModelList[0]?.model_id

			if (restoredModelId) {
				setSelectedModelId(restoredModelId)
			}

			const restoredModel = imageModelList.find((model) => model.model_id === restoredModelId)

			// 恢复提示词
			if (tempRequest.prompt) {
				setPrompt(tempRequest.prompt)
			}
			// 恢复参考图：将 tempRequest.reference_images 的 paths 恢复到 Element 的 referenceImageInfos
			if (tempRequest.reference_images && tempRequest.reference_images.length > 0) {
				const referenceImageInfos: UploadImageResponse[] = tempRequest.reference_images.map(
					(path) => {
						const fileName = path.split("/").pop() || path
						return {
							path,
							src: path, // 先用 path，Resource 加载后会更新
							fileName,
						}
					},
				)
				elementInstance.setReferenceImageInfos(referenceImageInfos)
			}

			// 恢复尺寸配置
			const sizes = restoredModel?.image_size_config?.sizes
			if (sizes?.length) {
				const matchedSize = tempRequest.size
					? sizes.find(
							(size) =>
								size.value === tempRequest.size &&
								(size.scale || undefined) === (tempRequest.resolution || undefined),
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
					const matchedResolution =
						tempRequest.resolution && availableScales.includes(tempRequest.resolution)
							? tempRequest.resolution
							: availableScales[0]
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

				// 恢复尺寸配置
				const sizes = restoredModel?.image_size_config?.sizes
				if (sizes?.length) {
					const matchedSize = defaultConfig.size
						? sizes.find(
								(size) =>
									size.value === defaultConfig.size &&
									(size.scale || undefined) ===
										(defaultConfig.resolution || undefined),
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
						const matchedResolution =
							defaultConfig.resolution &&
							availableScales.includes(defaultConfig.resolution)
								? defaultConfig.resolution
								: availableScales[0]
						setSelectedResolution(matchedResolution)
					} else {
						setSelectedResolution(undefined)
					}
				} else {
					setSelectedResolution(undefined)
				}
			} else {
				// rootStorage 也没有，使用模型列表第一个作为默认配置
				const defaultModel = imageModelList[0]
				if (defaultModel) {
					setSelectedModelId(defaultModel.model_id)

					const sizes = defaultModel?.image_size_config?.sizes
					if (sizes?.length) {
						const firstSize = sizes[0]
						setSelectedLabel(firstSize.label)
						setSelectedSize(firstSize.value)
						setSelectedScale(firstSize.scale || undefined)

						const scaleSet = new Set(sizes.map((size) => size.scale).filter(Boolean))
						const availableScales = Array.from(scaleSet)
						if (availableScales.length) {
							setSelectedResolution(availableScales[0])
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
		// 恢复完成，重置标记（使用 setTimeout 确保所有 state 更新完成后再重置）
		setTimeout(() => {
			isRestoringRef.current = false
		}, 0)

		// 同步参考图状态（确保恢复的 referenceImageInfos 同步到 state）
		syncFromElement()
	}, [canvas, imageElement.id, imageModelList, syncFromElement])

	// 初始化：从 Element 同步参考图信息
	useMount(() => {
		// 同步参考图状态
		syncFromElement()

		// 确保原图在第一个位置（SecondEdit 模式）
		if (originalImageSrc) {
			ensureOriginalImageFirst()
		}
	})

	// 从 tempRequest 恢复之前填写的内容（等待模型列表加载完成后执行）
	useEffect(() => {
		if (!canvas || hasRestoredRef.current || imageModelList.length === 0) return
		restoreConfig()
	}, [canvas, imageModelList, restoreConfig])

	// 当用户填写的内容变化时，保存到 tempRequest（使用 useUpdateEffect 避免首次挂载时触发）
	useUpdateEffect(() => {
		if (!canvas) return
		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (elementInstance && elementInstance instanceof ImageElementClass) {
			const tempRequest = buildRequestParams()
			// 统一使用 tempGenerateImageRequest
			elementInstance.saveTempGenerateImageRequest(tempRequest)
		}
	}, [canvas, imageElement.id, buildRequestParams])

	// 组件卸载时清理定时器
	useUnmount(() => {
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
		currentReferenceImages,
		referenceImageInfos,
		matchableItems,
		modelOptions,
		modelOptionGroups,
		selectedModelOption,
		maxReferenceImages,
		isReferenceImageLimitReached,
		isUploading,
		supportedAspectRatioOptions,
		supportedResolutionOptions,
		currentSelectValue,
		ratioOption,
		isPopoverOpen,
		hasRestoredRef,
		isRestoringRef,
		handlers: {
			setSelectedModelId,
			setPrompt,
			setSelectedResolution,
			setSelectedSize,
			setSelectedLabel,
			setSelectedScale,
			handleModelChange,
			handleResolutionChange,
			handleRatioChange,
			handleReferenceImageRemove,
			handlePopoverMouseEnter,
			handlePopoverMouseLeave,
			buildRequestParams,
			triggerFileSelect,
			handleFileChange,
			syncReferenceImagesFromElement,
		},
		fileInputRef,
	}
}
