import type { ReactNode } from "react"
import { MediaPreviewTrigger } from "@/components/base/MediaPreview"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { useLayerMediaPreviewSource, type LayerMediaElement } from "./useLayerMediaPreviewSource"
import styles from "../drawer/index.module.css"

interface LayerMediaPreviewProps {
	element: LayerMediaElement
	fileName: string
	children: (thumbnail: ReactNode) => ReactNode
	disabled?: boolean
}

/** 图层列表媒体预览：整行主体（含操作区）触发，展开按钮仍由 Tree 独立处理。 */
export default function LayerMediaPreview({
	element,
	fileName,
	children,
	disabled = false,
}: LayerMediaPreviewProps) {
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	const { source, observeRef, fallback } = useLayerMediaPreviewSource(element, fileName)

	return (
		<MediaPreviewTrigger
			fileName={fileName}
			source={source}
			fallback={fallback}
			renderTrigger={(thumbnail) => (
				<div ref={observeRef} className={styles.layerMediaPreviewTrigger}>
					{children(thumbnail)}
				</div>
			)}
			labels={{
				errorMessage: t(
					"mediaResourceFullscreenPreview.imageLoadFailed",
					"媒体加载失败，请稍后重试",
				),
				audioLabels: {
					play: t("video.fullscreen.play", "播放"),
					pause: t("video.fullscreen.pause", "暂停"),
					loading: t("audio.loading", "正在加载音频..."),
					progress: t("video.fullscreen.progress", "播放进度"),
				},
			}}
			enableTouchTrigger
			disabled={disabled}
			side="right"
			container={portalContainer}
		/>
	)
}
