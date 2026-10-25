import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { RefreshCw } from "lucide-react"
import { useCanvasEvent } from "../../../../../app/hooks/canvas"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { getActiveContent, getContentById } from "../../../../../runtime/document/elementContent"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "../../image/ImageCropButton/index.module.css"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function AudioReplaceButton() {
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const { t } = useCanvasDesignI18n()
	const tool = useElementToolResolution()
	const [replacingElementId, setReplacingElementId] = useState<string | null>(
		() => canvas?.mediaReplaceController?.getReplacingElementId?.() ?? null,
	)
	const selected = selectedElements[0]
	const selectedAudio = selected?.type === ElementTypeEnum.Audio ? selected : undefined
	const audioSrc =
		selectedAudio && tool
			? tool.target.contentId
				? getContentById(selectedAudio, tool.target.contentId)?.src
				: undefined
			: selectedAudio
				? getActiveContent(selectedAudio)?.src
				: undefined
	const isReplacing = replacingElementId === selectedAudio?.id
	const isReplacementBusy = replacingElementId !== null

	useEffect(() => {
		setReplacingElementId(canvas?.mediaReplaceController?.getReplacingElementId?.() ?? null)
	}, [canvas])

	useCanvasEvent(
		"element:audio:replaceStateChanged",
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
			!selectedAudio ||
			isReplacementBusy
		)
			return
		if (tool) {
			if (tool.visibility !== "visible") return
			void tool.execute?.({
				anchorElement: event.currentTarget,
				clientX: event.clientX,
				clientY: event.clientY,
			})
			return
		}
		canvas.eventEmitter.emit({
			type: "element:audio:replaceClick",
			data: {
				elementId: selectedAudio.id,
				clientX: event.clientX,
				clientY: event.clientY,
			},
		})
	}

	const label = isReplacing
		? t("audio.replacing", "替换中")
		: audioSrc
			? t("elementTools.audioReplace.title", "替换音频")
			: t("elementTools.audioReplace.upload", "上传音频")

	return (
		<IconButton
			onClick={handleReplace}
			className={styles.imageCropButton}
			title={label}
			disabled={
				!canvas ||
				!canvas.permissionManager.can("document.write") ||
				!selectedAudio ||
				isReplacementBusy
			}
		>
			<RefreshCw size={16} />
			<span className={styles.buttonText}>{label}</span>
		</IconButton>
	)
}
