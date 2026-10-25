import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { RefreshCw } from "lucide-react"
import { useCanvasEvent } from "../../../../../app/hooks/canvas"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import {
	getActiveContent,
	getContentById,
	getContentState,
} from "../../../../../runtime/document/elementContent"
import {
	ElementTypeEnum,
	type CanvasFileElement,
	type LayerElement,
} from "../../../../../runtime/document/types"
import { ElementToolTypeEnum } from "../../../../../public/props"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "../DownloadButton/index.module.css"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

function isMediaElement(element: LayerElement | undefined): element is CanvasFileElement {
	return (
		element?.type === ElementTypeEnum.Image ||
		element?.type === ElementTypeEnum.Video ||
		element?.type === ElementTypeEnum.Audio
	)
}

export default function MediaReplaceButton() {
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const { t } = useCanvasDesignI18n()
	const [replacingElementId, setReplacingElementId] = useState<string | null>(
		() => canvas?.mediaReplaceController?.getReplacingElementId?.() ?? null,
	)
	const tool = useElementToolResolution()
	const selected = selectedElements[0]
	const targetElementId = tool?.target.elementId
	const targetContentId = tool?.target.contentId
	const selectedTarget = targetElementId
		? canvas?.elementManager.getElementData(targetElementId)
		: selected
	const selectedMedia = isMediaElement(selectedTarget) ? selectedTarget : undefined
	const activeContent =
		selectedMedia && tool
			? targetContentId
				? getContentById(selectedMedia, targetContentId)
				: undefined
			: selectedMedia
				? getActiveContent(selectedMedia)
				: undefined
	const activeContentState = getContentState(activeContent)
	const activeIsProcessing =
		activeContentState === "pending" || activeContentState === "processing"
	const isReplacing = replacingElementId === selectedMedia?.id
	const isReplacementBusy = replacingElementId !== null
	const hasSource = Boolean(activeContent?.src)

	useEffect(() => {
		setReplacingElementId(canvas?.mediaReplaceController?.getReplacingElementId?.() ?? null)
	}, [canvas])

	useCanvasEvent(
		"element:media:replaceStateChanged",
		useCallback(({ data }) => {
			setReplacingElementId((current) => {
				if (data.status === "uploading" || data.status === "applying") {
					return data.elementId
				}
				return current === data.elementId ? null : current
			})
		}, []),
		[],
	)

	const handleReplace = (event: MouseEvent<HTMLDivElement>) => {
		if (
			!canvas ||
			!canvas.permissionManager.can("document.write") ||
			!selectedMedia ||
			activeIsProcessing ||
			isReplacementBusy
		)
			return
		if (tool?.id === ElementToolTypeEnum.ContentReplace) {
			void tool.execute({ anchorElement: event.currentTarget })
			return
		}
		if (!activeContent) return
		canvas.eventEmitter.emit({
			type: "element:media:replaceClick",
			data: {
				elementId: selectedMedia.id,
				mediaType: selectedMedia.type,
				contentId: activeContent.contentId,
				anchorElement: event.currentTarget,
			},
		})
	}

	const label = (() => {
		if (isReplacing) return t("elementTools.mediaReplace.replacing", "替换中")
		switch (selectedMedia?.type) {
			case ElementTypeEnum.Image:
				return hasSource
					? t("elementTools.mediaReplace.image", "替换图片")
					: t("elementTools.mediaReplace.uploadImage", "上传图片")
			case ElementTypeEnum.Video:
				return hasSource
					? t("elementTools.mediaReplace.video", "替换视频")
					: t("elementTools.mediaReplace.uploadVideo", "上传视频")
			case ElementTypeEnum.Audio:
				return hasSource
					? t("elementTools.mediaReplace.audio", "替换音频")
					: t("elementTools.mediaReplace.uploadAudio", "上传音频")
			default:
				return t("elementTools.mediaReplace.title", "替换媒体")
		}
	})()

	return (
		<IconButton
			onClick={handleReplace}
			className={styles.downloadButton}
			title={label}
			disabled={
				!canvas ||
				!canvas.permissionManager.can("document.write") ||
				!selectedMedia ||
				activeIsProcessing ||
				isReplacementBusy
			}
		>
			<RefreshCw size={16} />
			<span className={styles.buttonText}>{label}</span>
		</IconButton>
	)
}
