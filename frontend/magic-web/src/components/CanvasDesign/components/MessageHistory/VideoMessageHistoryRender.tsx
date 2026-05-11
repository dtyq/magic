import { ElementTypeEnum, type VideoElement } from "../../canvas/types"
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
import { useCanvasDesignI18n } from "../../context/I18nContext"
import type { MediaResourceFullscreenPreviewItem } from "../MediaResourceFullscreenPreview"
import { resolvePromptPlaceholderTokenConfig } from "../MessageEditor/reference-assets/promptPlaceholderTokenConfig"
import { MessageHistoryCollapsiblePrompt } from "./MessageHistoryCollapsiblePrompt"
import { PromptPlaceholderPreviewText } from "./PromptPlaceholderPreviewText"

interface VideoMessageHistoryRenderProps {
	videoElement: VideoElement
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
}

/** 右侧浮层：展示选中视频元素最近一次生成请求的摘要 */
export default function VideoMessageHistoryRender(props: VideoMessageHistoryRenderProps) {
	const { videoElement, onPreviewMediaResource } = props
	const { selectedElements } = useCanvasSelectionUI()
	const { setMessageHistoryElementId } = useCanvasPanelUI()
	const { videoModelList } = useMagic()
	const { t } = useCanvasDesignI18n()
	const promptPlaceholderTokenConfig = useMemo(() => resolvePromptPlaceholderTokenConfig(t), [t])

	const request = videoElement.generateVideoRequest

	const { containerRef: positionRef } = useElementPositionEffect({
		position: "right",
		offset: 8,
		verticalAlign: "top",
		shouldShow: () => {
			return selectedElements.some((element) => element?.type === ElementTypeEnum.Video)
		},
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "video-message-history",
		enableWheelForwarding: true,
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	const handleClose = useCallback(() => {
		setMessageHistoryElementId(null)
	}, [setMessageHistoryElementId])

	const promptText = request?.prompt?.trim() ?? ""

	const handleCopyPrompt = useCallback(() => {
		if (!promptText) return
		void navigator.clipboard
			.writeText(promptText)
			.then(() => {
				toast.success(t("menu.copySuccess", "复制成功"))
			})
			.catch(() => undefined)
	}, [promptText, t])

	const modelInfo = useMemo(() => {
		if (!request?.model_id) return undefined
		return videoModelList.find((model) => model.model_id === request.model_id)
	}, [videoModelList, request?.model_id])

	const frameInputs = request?.inputs?.frames || []
	const startFrame = frameInputs.find((frame) => frame.role === "start")
	const endFrame = frameInputs.find((frame) => frame.role === "end")
	const referenceImages = request?.inputs?.reference_images || []
	const referenceVideos = request?.inputs?.reference_videos || []
	const referenceAudios = request?.inputs?.reference_audios || []
	const promptPlaceholderPaths = useMemo(
		() => ({
			image: referenceImages.map((item) => item.uri),
			video: referenceVideos.map((item) => item.uri),
			audio: referenceAudios.map((item) => item.uri),
		}),
		[referenceAudios, referenceImages, referenceVideos],
	)
	const aspectRatio = request?.generation?.aspect_ratio
	const resolution = request?.generation?.resolution

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
									placeholderPaths={promptPlaceholderPaths}
									onPreviewMediaResource={onPreviewMediaResource}
								/>
							}
							emptyLabel={t("messageHistory.noPrompt", "暂无提示词")}
							expandLabel={t("messageHistory.expandPrompt", "展开")}
						/>
					</div>
				</div>

				{!!startFrame && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.startFrame", "首帧")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								<ReferenceImageItem
									path={startFrame.uri}
									onPreviewMediaResource={onPreviewMediaResource}
								/>
							</div>
						</div>
					</div>
				)}

				{!!endFrame && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.endFrame", "尾帧")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								<ReferenceImageItem
									path={endFrame.uri}
									onPreviewMediaResource={onPreviewMediaResource}
								/>
							</div>
						</div>
					</div>
				)}

				{!!referenceImages.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceImage", "参考图")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{referenceImages.map((item, index) => (
									<ReferenceImageItem
										key={`${item.uri}-${index}`}
										path={item.uri}
										onPreviewMediaResource={onPreviewMediaResource}
									/>
								))}
							</div>
						</div>
					</div>
				)}

				{!!referenceVideos.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceVideo", "参考视频")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{referenceVideos.map((item, index) => (
									<ReferenceImageItem
										key={`${item.uri}-${index}`}
										path={item.uri}
										onPreviewMediaResource={onPreviewMediaResource}
									/>
								))}
							</div>
						</div>
					</div>
				)}

				{!!referenceAudios.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceAudio", "参考音频")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{referenceAudios.map((item, index) => (
									<ReferenceImageItem
										key={`${item.uri}-${index}`}
										path={item.uri}
										onPreviewMediaResource={onPreviewMediaResource}
									/>
								))}
							</div>
						</div>
					</div>
				)}

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

				{(!!aspectRatio || !!resolution) && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>{t("messageHistory.size", "尺寸")}</div>
						<div className={styles.itemContent}>
							<span>{[aspectRatio, resolution].filter(Boolean).join(" / ")}</span>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
