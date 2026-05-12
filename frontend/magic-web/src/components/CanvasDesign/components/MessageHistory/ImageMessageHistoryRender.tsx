import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import styles from "./index.module.css"
import IconButton from "../ui/custom/IconButton"
import { Copy, ImagePlus, X } from "lucide-react"
import { useMemo, useCallback } from "react"
import { toast } from "sonner"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useCanvasPanelUI, useCanvasSelectionUI } from "../../context/CanvasUIContext"
import { useMagic } from "../../context/MagicContext"
import ReferenceImageItem from "./ReferenceImageItem"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { useCanvas } from "../../context/CanvasContext"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { getImageGenerationTaskMeta } from "../../canvas/utils/imageGenerationTaskMeta"
import { getReferenceImageCrop } from "../../canvas/utils/imageCropUtils"
import { ImageGenerationTaskTypeMap, type GenerateImageRequest } from "../../types.magic"
import type { MediaResourceFullscreenPreviewItem } from "../MediaResourceFullscreenPreview"
import { resolvePromptPlaceholderTokenConfig } from "../MessageEditor/reference-assets/promptPlaceholderTokenConfig"
import { MessageHistoryCollapsiblePrompt } from "./MessageHistoryCollapsiblePrompt"
import { PromptPlaceholderPreviewText } from "./PromptPlaceholderPreviewText"

interface ImageMessageHistoryRenderProps {
	imageElement: ImageElement
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
}

export default function ImageMessageHistoryRender(props: ImageMessageHistoryRenderProps) {
	const { imageElement, onPreviewMediaResource } = props
	const { selectedElements } = useCanvasSelectionUI()
	const { setMessageHistoryElementId } = useCanvasPanelUI()
	const { imageModelList, convertHightConfig } = useMagic()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const promptPlaceholderTokenConfig = useMemo(() => resolvePromptPlaceholderTokenConfig(t), [t])

	// 获取请求信息
	const request = imageElement.generateImageRequest

	const imageGenerationTaskMeta = getImageGenerationTaskMeta(imageElement)

	// 获取元素实例以访问 getImageInfo 方法
	const elementInstance = useMemo(() => {
		if (!canvas || !imageElement.id) return undefined
		return canvas.elementManager.getElementInstance(imageElement.id) as
			| ImageElementClass
			| undefined
	}, [canvas, imageElement.id])

	// 获取尺寸
	const sizes = useMemo(() => {
		const result =
			(imageGenerationTaskMeta?.type === ImageGenerationTaskTypeMap.High
				? imageGenerationTaskMeta.size
				: undefined) || request?.size
		if (result) {
			return result
		}
		const imageInfo = elementInstance?.getImageInfo()
		if (imageInfo) {
			return `${imageInfo.naturalWidth}x${imageInfo.naturalHeight}`
		}
		return undefined
	}, [
		imageGenerationTaskMeta?.type,
		imageGenerationTaskMeta?.size,
		request?.size,
		elementInstance,
	])

	// 容器位置
	const { containerRef: positionRef } = useElementPositionEffect({
		position: "right",
		offset: 8,
		verticalAlign: "top",
		shouldShow: () => {
			return selectedElements.some((element) => element?.type === ElementTypeEnum.Image)
		},
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "image-message-history",
		enableWheelForwarding: true,
	})

	// 合并 refs
	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	// 关闭按钮点击事件
	const handleClose = useCallback(() => {
		setMessageHistoryElementId(null)
	}, [setMessageHistoryElementId])

	const promptText = request?.prompt?.trim() ?? ""
	const referenceImagePaths = request?.reference_images ?? []

	const handleCopyPrompt = useCallback(() => {
		if (!promptText) return
		void navigator.clipboard
			.writeText(promptText)
			.then(() => {
				toast.success(t("menu.copySuccess", "复制成功"))
			})
			.catch(() => undefined)
	}, [promptText, t])

	// 根据 modelId 查找对应的模型信息
	const modelInfo = useMemo(() => {
		if (!request?.model_id) return undefined
		return imageModelList.find((model) => model.model_id === request?.model_id)
	}, [imageModelList, request?.model_id])

	// 从模型的 image_size_config 或高清图配置中查找匹配的尺寸选项
	const sizeOptionLabel = useMemo(() => {
		if (!sizes) return undefined

		// 如果存在高清任务，从高清图配置中查找
		if (imageGenerationTaskMeta?.type === ImageGenerationTaskTypeMap.High) {
			return convertHightConfig?.image_size_config?.sizes.find((item) => {
				return item.value === sizes
			})?.label
		}

		// 否则从模型的 image_size_config 中查找
		return modelInfo?.image_size_config?.sizes.find((item) => {
			const sameSize = item.value === sizes
			if (item.scale !== undefined && request?.resolution !== undefined) {
				return sameSize && item.scale === request?.resolution
			}
			return sameSize
		})?.label
	}, [
		imageGenerationTaskMeta?.type,
		convertHightConfig?.image_size_config?.sizes,
		modelInfo?.image_size_config?.sizes,
		request?.resolution,
		sizes,
	])

	const imageGenerationSettings = useMemo(() => {
		return resolveImageGenerationSettings({
			settings: modelInfo?.image_size_config?.image_settings,
			config: request?.image_generation_config,
		})
	}, [modelInfo?.image_size_config?.image_settings, request?.image_generation_config])

	return (
		<div ref={setRefs} className={styles.messageHistory} data-canvas-ui-component>
			<div className={styles.header}>
				<div className={styles.name}>{t("messageHistory.title", "生成记录")}</div>
				<IconButton className={styles.closeButton} onClick={handleClose}>
					<X size={16} />
				</IconButton>
			</div>
			<div className={styles.divider}></div>
			<div className={styles.body}>
				{/* 提示词 */}
				<div className={styles.item}>
					<div className={styles.itemTitleRow}>
						<div className={styles.itemTitle}>
							{t("messageHistory.prompt", "提示词")}
						</div>
						<IconButton
							aria-label={t("messageHistory.copyPrompt", "复制")}
							className={styles.promptCopyButton}
							disabled={!promptText}
							title={t("messageHistory.copyPrompt", "复制")}
							onClick={handleCopyPrompt}
						>
							<Copy size={16} />
						</IconButton>
					</div>
					<div className={styles.itemContent}>
						<MessageHistoryCollapsiblePrompt
							text={request?.prompt ?? ""}
							content={
								<PromptPlaceholderPreviewText
									text={request?.prompt ?? ""}
									tokenConfig={promptPlaceholderTokenConfig}
									placeholderPaths={{ image: referenceImagePaths }}
									onPreviewMediaResource={onPreviewMediaResource}
								/>
							}
							emptyLabel={t("messageHistory.noPrompt", "暂无提示词")}
							expandLabel={t("messageHistory.expandPrompt", "展开")}
						/>
					</div>
				</div>

				{/* 参考图 */}
				{!!referenceImagePaths.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceImage", "参考图")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{referenceImagePaths.map((path, index) => {
									const sourceCrop = getReferenceImageCrop({
										filePath: path,
										referenceImageOptions: request?.reference_image_options,
									})
									return (
										<ReferenceImageItem
											key={index}
											path={path}
											sourceCrop={sourceCrop}
											onPreviewMediaResource={onPreviewMediaResource}
										/>
									)
								})}
							</div>
						</div>
					</div>
				)}

				{/* 模型 */}
				<div className={styles.item}>
					<div className={styles.itemTitle}>{t("messageHistory.model", "模型")}</div>
					<div className={styles.itemContent}>
						<div className={styles.model}>
							<div className={styles.modelIcon}>
								{modelInfo?.model_icon ? (
									<img
										src={modelInfo.model_icon}
										alt={modelInfo.model_name || request?.model_id}
									/>
								) : (
									<ImagePlus size={16} />
								)}
							</div>
							<div className={styles.modelName}>
								{modelInfo?.model_name || request?.model_id}
							</div>
						</div>
					</div>
				</div>

				{/* 尺寸 */}
				{!!sizes && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>{t("messageHistory.size", "尺寸")}</div>
						<div className={styles.itemContent}>
							<span>
								{sizeOptionLabel} {sizes} {request?.resolution}
							</span>
						</div>
					</div>
				)}
				{!!imageGenerationSettings.length &&
					imageGenerationSettings.map((setting) => (
						<div key={setting.key} className={styles.item}>
							<div className={styles.itemTitle}>{setting.label}</div>
							<div className={styles.itemContent}>
								<span>{setting.valueLabel}</span>
							</div>
						</div>
					))}
			</div>
		</div>
	)
}

function resolveImageGenerationSettings(params: {
	settings?: Array<{
		key: string
		label: string
		options?: Array<{ label: string; value: string }>
	}>
	config?: GenerateImageRequest["image_generation_config"]
}): Array<{ key: string; label: string; valueLabel: string }> {
	const { settings, config } = params
	if (!settings?.length || !config) return []

	return settings
		.map((setting) => {
			const requestKey = getImageGenerationRequestKey(setting.key)
			const value = config[requestKey]
			if (!value) return null

			const option = setting.options?.find((item) => item.value === value)
			return {
				key: requestKey,
				label: setting.label || requestKey,
				valueLabel: option?.label || value,
			}
		})
		.filter((setting): setting is { key: string; label: string; valueLabel: string } =>
			Boolean(setting),
		)
}

function getImageGenerationRequestKey(key: string): string {
	const prefix = "image_generation_config."
	if (key.startsWith(prefix)) return key.slice(prefix.length)
	return key
}
