import { MediaPreviewTrigger, type MediaPreviewSource } from "@/components/base/MediaPreview"
import { cn } from "../../../runtime/shared/lib/utils"
import styles from "../../editors/message/index.module.css"
import { ReferenceSlotAudioIcon } from "../../primitives/icons/index"
import { useReferenceAudioSrc } from "./useReferenceAudioSrc"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"

interface ReferenceAudioPreviewProps {
	fileName: string
	path: string
	fillParent?: boolean
	objectFit?: "cover" | "contain"
	enableTooltip?: boolean
	tooltipSide?: "top" | "right" | "bottom" | "left"
}

export function ReferenceAudioPreview(props: ReferenceAudioPreviewProps) {
	const {
		fileName,
		path,
		fillParent,
		objectFit = "cover",
		enableTooltip = false,
		tooltipSide = "top",
	} = props
	const { src, isLoading, hasError, load } = useReferenceAudioSrc(path)
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	const previewWrapperClass = cn(
		styles.referenceImagePreview,
		fillParent && styles.referenceImagePreviewFill,
		fillParent && objectFit === "contain" && styles.referenceImagePreviewFillContain,
	)
	const previewVisual = (
		<div className="flex h-full w-full items-center justify-center bg-muted/40">
			<ReferenceSlotAudioIcon size={28} />
		</div>
	)

	if (!enableTooltip) {
		return <div className={previewWrapperClass}>{previewVisual}</div>
	}

	const source: MediaPreviewSource = {
		mediaType: "audio",
		previewUrl: src,
		audioUrl: src,
		isLoading,
		hasError,
		loadPreview: load,
	}

	return (
		<MediaPreviewTrigger
			fileName={fileName}
			source={source}
			fallback={<ReferenceSlotAudioIcon size={16} />}
			renderTrigger={() => <div className={previewWrapperClass}>{previewVisual}</div>}
			labels={{
				errorMessage: t("mediaResourceFullscreenPreview.audioLoadFailed", "音频加载失败"),
				audioLabels: {
					play: t("video.fullscreen.play", "播放"),
					pause: t("video.fullscreen.pause", "暂停"),
					loading: t("audio.loading", "正在加载音频..."),
					progress: t("video.fullscreen.progress", "播放进度"),
				},
			}}
			enableTouchTrigger
			container={portalContainer}
			side={tooltipSide}
		/>
	)
}
