import { Download } from "lucide-react"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "../DownloadButton/index.module.css"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { ElementTypeEnum, type LayerElement } from "../../../../../runtime/document/types"

export function getMediaDownloadLabel(
	elementType: LayerElement["type"] | undefined,
	translate: (key: string, fallback: string) => string,
) {
	return elementType === ElementTypeEnum.Audio
		? translate("menu.downloadAudio", "下载音频")
		: translate("elementTools.mediaDownload.title", "下载")
}

/** 下载当前选中媒体的原始资源，而不是将元素导出为 PNG。 */
export default function MediaDownloadButton() {
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const { t } = useCanvasDesignI18n()
	const tool = useElementToolResolution()
	const targetElement = tool?.target.elementId
		? canvas?.elementManager.getElementData(tool.target.elementId)
		: selectedElements[0]
	const label = getMediaDownloadLabel(targetElement?.type, t)
	const canDownload = tool?.visibility === "visible"

	const handleDownload = async () => {
		if (!canvas || !canDownload) return
		if (tool?.id !== ElementToolTypeEnum.ContentDownload) return
		await tool.execute({ downloadMode: "default" })
	}

	return (
		<IconButton
			onClick={handleDownload}
			className={styles.downloadButton}
			title={label}
			disabled={!canDownload}
		>
			<Download size={16} />
			<span className={styles.buttonText}>{label}</span>
		</IconButton>
	)
}
