import { useLayoutEffect, useRef } from "react"
import { LoaderCircle } from "lucide-react"
import { MediaPreviewTrigger, type MediaPreviewSource } from "@/components/base/MediaPreview"
import { cn } from "../../../runtime/shared/lib/utils"
import { ReferenceSlotVideoIcon } from "../../primitives/icons/index"
import styles from "../../editors/message/index.module.css"
import { useReferenceVideoPoster } from "./useReferenceVideoPoster"
import { REFERENCE_MEDIA_TOOLTIP_MAX_SIZE } from "./constants"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { calculateTooltipBoundedPreviewSize } from "../../../runtime/resources/image/imagePreviewUtils"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"

export interface ReferenceVideoPosterPreviewProps {
	fileName: string
	path: string
	fillParent?: boolean
	objectFit?: "cover" | "contain"
	enableTooltip?: boolean
	tooltipSide?: "top" | "right" | "bottom" | "left"
}

/** 视频参考槽位：与画布同源，用 VideoResourceManager 解码首帧海报 */
export function ReferenceVideoPosterPreview(props: ReferenceVideoPosterPreviewProps) {
	const {
		fileName,
		path,
		fillParent,
		objectFit = "cover",
		enableTooltip = false,
		tooltipSide = "top",
	} = props
	const { loadState, posterClone, ossSrc } = useReferenceVideoPoster(path)
	const { t } = useCanvasDesignI18n()
	const portalContainer = usePortalContainer()
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const previewSize = posterClone
		? calculateTooltipBoundedPreviewSize(
				{ naturalWidth: posterClone.width, naturalHeight: posterClone.height },
				REFERENCE_MEDIA_TOOLTIP_MAX_SIZE,
			)
		: undefined

	useLayoutEffect(() => {
		const el = canvasRef.current
		if (!el || !posterClone || loadState !== "ready") return
		el.width = posterClone.width
		el.height = posterClone.height
		const ctx = el.getContext("2d")
		if (!ctx) return
		ctx.clearRect(0, 0, el.width, el.height)
		ctx.drawImage(posterClone, 0, 0)
	}, [posterClone, loadState])

	const previewWrapperClass = cn(
		styles.referenceImagePreview,
		fillParent && styles.referenceImagePreviewFill,
		fillParent && objectFit === "contain" && styles.referenceImagePreviewFillContain,
	)

	const previewVisual =
		loadState === "loading" ? (
			<div className={styles.referenceImageLoading}>
				<LoaderCircle size={12} className={styles.loadingIcon} />
			</div>
		) : loadState === "error" || !posterClone ? (
			<div className="flex h-full w-full items-center justify-center bg-muted/40">
				<ReferenceSlotVideoIcon size={28} />
			</div>
		) : (
			<canvas
				ref={canvasRef}
				className={styles.referenceImagePreviewImgCover}
				role="img"
				aria-label={fileName}
			/>
		)

	const trigger = <div className={previewWrapperClass}>{previewVisual}</div>

	if (!enableTooltip) return trigger

	const source: MediaPreviewSource = {
		mediaType: "video",
		thumbnailElement: posterClone ? (
			<canvas
				className="size-4 rounded object-cover"
				ref={(node) => {
					if (!node) return
					node.width = posterClone.width
					node.height = posterClone.height
					const context = node.getContext("2d")
					context?.drawImage(posterClone, 0, 0)
				}}
				aria-label={fileName}
			/>
		) : undefined,
		previewUrl: ossSrc,
		poster: posterClone ? (
			<canvas
				className="absolute inset-0 block h-full w-full object-contain"
				ref={(node) => {
					if (!node) return
					node.width = posterClone.width
					node.height = posterClone.height
					const context = node.getContext("2d")
					context?.drawImage(posterClone, 0, 0)
				}}
				aria-label={fileName}
			/>
		) : undefined,
		isLoading: loadState === "loading",
		hasError: loadState === "error" && !posterClone,
		previewSize:
			previewSize?.width && previewSize.height
				? { width: previewSize.width, height: previewSize.height }
				: undefined,
	}

	return (
		<MediaPreviewTrigger
			fileName={fileName}
			source={source}
			fallback={<ReferenceSlotVideoIcon size={16} />}
			renderTrigger={() => trigger}
			labels={{
				errorMessage: t(
					"mediaResourceFullscreenPreview.videoLoadFailed",
					"视频加载失败，请稍后重试",
				),
				audioLabels: {
					play: t("video.fullscreen.play", "播放"),
					pause: t("video.fullscreen.pause", "暂停"),
					loading: t("audio.loading", "正在加载音频..."),
					progress: t("video.fullscreen.progress", "播放进度"),
				},
			}}
			enableTouchTrigger
			side={tooltipSide}
			container={portalContainer}
		/>
	)
}
