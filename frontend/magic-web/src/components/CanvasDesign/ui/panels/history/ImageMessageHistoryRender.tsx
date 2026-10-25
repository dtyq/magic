import { type ImageElement, type ImageElementContent } from "../../../runtime/document/types"
import styles from "./index.module.css"
import IconButton from "../../primitives/custom/IconButton/index"
import { CircleCheck, CircleX, Copy, ImagePlus, Loader2, X } from "lucide-react"
import { useMemo, useCallback, useState } from "react"
import { toast } from "sonner"
import useCanvasSelectionFloatingPanel from "../../../app/hooks/layout/useCanvasSelectionFloatingPanel"
import { useCanvasPanelUI } from "../../../app/providers/CanvasUIProvider"
import { useMagic } from "../../../app/providers/MagicProvider"
import ReferenceImageItem from "./ReferenceImageItem"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { ImageElement as ImageElementClass } from "../../../runtime/elements/image/ImageElement"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { getReferenceImageCrop } from "../../../runtime/resources/image/imageCropUtils"
import {
	GenerationStatus,
	ImageGenerationTaskTypeMap,
	type GenerateImageRequest,
} from "../../../public/magic-types"
import type { MediaResourceFullscreenPreviewItem } from "../../fullscreen/media-resource/index"
import { resolvePromptPlaceholderTokenConfig } from "../../editors/message/reference-assets/promptPlaceholderTokenConfig"
import { copyHistoryPromptToClipboard } from "./historyPromptClipboard"
import { MessageHistoryCollapsiblePrompt } from "./MessageHistoryCollapsiblePrompt"
import { PromptPlaceholderPreviewText } from "./PromptPlaceholderPreviewText"
import { useCanvasEvent, useGenerationRuntime } from "../../../app/hooks/canvas"
import {
	getActiveImageContent,
	getImageContentById,
} from "../../../runtime/document/elementContent"
import { isImageGenerationTimedOut } from "../../../runtime/elements/image/imageGenerationTiming"
import { normalizeImageSizeValue } from "../../element-tools/editors/image/image-editor-config.utils"
import { cn } from "@/utils/cn"

interface ImageMessageHistoryRenderProps {
	imageElement: ImageElement
	contentId?: string
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
}

export default function ImageMessageHistoryRender(props: ImageMessageHistoryRenderProps) {
	const { imageElement, contentId, onPreviewMediaResource } = props
	const { closeMessageHistory } = useCanvasPanelUI()
	const { imageModelList, convertHightConfig, methods } = useMagic()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const generationRuntime = useGenerationRuntime(imageElement.id, contentId)
	const [, refreshDisplayState] = useState(0)
	useCanvasEvent(
		"element:image:displayStateChanged",
		({ data }) => {
			if (data.elementId === imageElement.id) refreshDisplayState((revision) => revision + 1)
		},
		[imageElement.id],
	)
	const promptPlaceholderTokenConfig = useMemo(() => resolvePromptPlaceholderTokenConfig(t), [t])
	// 卡片指定版本时直接读取它；不存在时显示缺失，不回退到用户当前看的另一版。
	const imageContent = contentId
		? getImageContentById(imageElement, contentId)
		: (canvas?.getEffectiveContent<ImageElementContent>(imageElement.id) ??
			getActiveImageContent(imageElement))

	// 获取请求信息
	const request = generationRuntime?.generateImageRequest || imageContent?.generateImageRequest

	const imageGenerationTaskMeta =
		generationRuntime?.imageGenerationTaskMeta || imageContent?.imageGenerationTaskMeta
	const pending =
		Boolean(generationRuntime) ||
		imageContent?.status === GenerationStatus.Pending ||
		imageContent?.status === GenerationStatus.Processing
	const failed = !pending && imageContent?.status === GenerationStatus.Failed
	const completed = !pending && imageContent?.status === GenerationStatus.Completed
	const missingContent = Boolean(contentId && !imageContent)

	// 获取元素实例以访问 getImageInfo 方法
	const elementInstance = useMemo(() => {
		if (!canvas || !imageElement.id) return undefined
		return canvas.elementManager.getElementInstance(imageElement.id) as
			ImageElementClass | undefined
	}, [canvas, imageElement.id])
	const timing =
		(imageContent ? elementInstance?.getGenerationTiming(imageContent.contentId) : undefined) ??
		imageContent?.generationTiming
	const timedOut = Boolean(imageContent && isImageGenerationTimedOut(imageContent, timing))
	const generationStatus = timedOut
		? t("image.timedOut", "生成已超时")
		: generationRuntime
			? t("image.generating", "正在生成中...")
			: imageContent?.status === "failed"
				? t("messageHistory.generationFailed", "生成失败")
				: imageContent?.src || imageContent?.status === "completed"
					? t("messageHistory.generationCompleted", "生成完成")
					: t("image.generating", "正在生成中...")

	// 获取尺寸
	const sizes = useMemo(() => {
		const result =
			(imageGenerationTaskMeta?.type === ImageGenerationTaskTypeMap.High
				? imageGenerationTaskMeta.size
				: undefined) || request?.size
		if (result) {
			return normalizeImageSizeValue(result)
		}
		const imageInfo =
			!contentId || contentId === canvas?.getEffectiveContentId(imageElement.id)
				? elementInstance?.getImageInfo()
				: undefined
		if (imageInfo) {
			return `${imageInfo.naturalWidth}x${imageInfo.naturalHeight}`
		}
		return undefined
	}, [
		imageGenerationTaskMeta?.type,
		imageGenerationTaskMeta?.size,
		request?.size,
		elementInstance,
		canvas,
		contentId,
		imageElement.id,
	])

	const handleClose = useCallback(() => {
		closeMessageHistory()
	}, [closeMessageHistory])
	const { setRefs } = useCanvasSelectionFloatingPanel({
		id: "image-message-history",
		elementId: imageElement.id,
		onClose: handleClose,
	})

	const promptText = request?.prompt?.trim() ?? ""
	const referenceImagePaths = useMemo(
		() => request?.reference_images ?? [],
		[request?.reference_images],
	)

	const handleCopyPrompt = useCallback(() => {
		if (!promptText) return
		void copyHistoryPromptToClipboard({
			text: request?.prompt ?? "",
			tokenConfig: promptPlaceholderTokenConfig,
			placeholderPaths: { image: referenceImagePaths },
			resolveResourceReference: methods?.resolveResourceReference,
		})
			.then(() => {
				toast.success(t("menu.copySuccess", "复制成功"))
			})
			.catch(() => undefined)
	}, [
		methods?.resolveResourceReference,
		promptPlaceholderTokenConfig,
		promptText,
		referenceImagePaths,
		request?.prompt,
		t,
	])

	// 根据 modelId 查找对应的模型信息
	const modelInfo = useMemo(() => {
		if (!request?.model_id) return undefined
		return imageModelList.find((model) => model.model_id === request?.model_id)
	}, [imageModelList, request?.model_id])
	const modelDisplayName = modelInfo?.model_name || request?.model_id

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
				{!missingContent && (pending || failed || completed) && (
					<span
						className={cn(
							styles.generationStatus,
							pending ? styles.generating : failed ? styles.failed : styles.completed,
						)}
						aria-live="polite"
					>
						{pending ? (
							<Loader2 size={16} />
						) : failed ? (
							<CircleX size={16} />
						) : (
							<CircleCheck size={16} />
						)}
						{pending
							? t("messageHistory.generating", "生成中")
							: failed
								? t("messageHistory.failed", "生成失败")
								: t("messageHistory.completed", "已生成")}
					</span>
				)}
				<IconButton className={styles.closeButton} onClick={handleClose}>
					<X size={16} />
				</IconButton>
			</div>
			<div className={styles.divider}></div>
			<div className={styles.body}>
				{!missingContent && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.generationStatus", "生成状态")}
						</div>
						<div className={styles.itemContent}>{generationStatus}</div>
						{timing?.source === "observed" ? (
							<div className={styles.itemContent}>
								{t(
									"messageHistory.generationTimeObserved",
									"缺少原始开始时间，等待时长从首次查看起计算。",
								)}
							</div>
						) : null}
					</div>
				)}
				{missingContent || !request ? (
					<div className={styles.itemContent} role="status">
						{missingContent
							? t("messageHistory.contentMissing", "该图片版本已不存在")
							: pending
								? t("messageHistory.syncing", "生成信息正在同步")
								: t("messageHistory.unavailable", "未记录生成信息")}
					</div>
				) : (
					<>
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
											resolveResourceReference={
												methods?.resolveResourceReference
											}
											deletedSuffix={t(
												"messageHistory.deletedSuffix",
												"（已删除）",
											)}
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
												referenceImageOptions:
													request?.reference_image_options,
											})
											return (
												<ReferenceImageItem
													key={index}
													path={path}
													mediaType="image"
													sourceCrop={sourceCrop}
													onPreviewMediaResource={onPreviewMediaResource}
													resolveResourceReference={
														methods?.resolveResourceReference
													}
												/>
											)
										})}
									</div>
								</div>
							</div>
						)}

						{/* 模型可能要等生成服务确认后才补齐，缺失时不展示空信息行。 */}
						{!!modelDisplayName && (
							<div className={styles.item}>
								<div className={styles.itemTitle}>
									{t("messageHistory.model", "模型")}
								</div>
								<div className={styles.itemContent}>
									<div className={styles.model}>
										<div className={styles.modelIcon}>
											{modelInfo?.model_icon ? (
												<img
													src={modelInfo.model_icon}
													alt={modelDisplayName}
												/>
											) : (
												<ImagePlus size={16} />
											)}
										</div>
										<div className={styles.modelName}>{modelDisplayName}</div>
									</div>
								</div>
							</div>
						)}

						{/* 尺寸 */}
						{!!sizes && (
							<div className={styles.item}>
								<div className={styles.itemTitle}>
									{t("messageHistory.size", "尺寸")}
								</div>
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
					</>
				)}
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
