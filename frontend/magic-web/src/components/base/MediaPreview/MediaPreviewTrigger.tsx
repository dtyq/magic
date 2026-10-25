import { LoaderCircle } from "lucide-react"
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactElement,
	type ReactNode,
} from "react"
import { MediaPreviewThumbnail } from "./MediaPreview"
import { MediaPreviewTooltip } from "./MediaPreviewTooltip"
import type { MediaPreviewSource } from "./types"

export interface MediaPreviewTriggerLabels {
	errorMessage: ReactNode
	audioLabels: {
		play: string
		pause: string
		loading?: string
		progress: string
	}
}

export interface MediaPreviewTriggerProps {
	fileName: string
	source?: MediaPreviewSource | null
	fallback: ReactNode
	/** Builds the business-specific trigger while receiving the shared thumbnail. */
	renderTrigger: (thumbnail: ReactNode) => ReactElement
	labels: MediaPreviewTriggerLabels
	enabled?: boolean
	enableTouchTrigger?: boolean
	disabled?: boolean
	side?: "top" | "right" | "bottom" | "left"
	sideOffset?: number
	container?: HTMLElement | null
	open?: boolean
	onOpenChange?: (open: boolean) => void
	thumbnailClassName?: string
	thumbnailStyle?: CSSProperties
}

/**
 * Shared media mention presenter. Resource owners provide source state while this
 * component owns thumbnail fallback, tooltip composition and open-time loading.
 */
export function MediaPreviewTrigger(props: MediaPreviewTriggerProps) {
	const {
		fileName,
		source,
		fallback,
		renderTrigger,
		labels,
		enabled = true,
		enableTouchTrigger = true,
		disabled = false,
		side = "top",
		sideOffset,
		container,
		open,
		onOpenChange,
		thumbnailClassName = "size-4 shrink-0 rounded object-cover",
		thumbnailStyle,
	} = props
	// 行内图框由预览组件负责，不能被宿主 Markdown 的 height:auto 改成原图比例。
	const resolvedThumbnailStyle = { width: 16, height: 16, ...thumbnailStyle }

	const [previewOpen, setPreviewOpen] = useState(false)
	const retries = useRef({ thumbnail: false, preview: false })
	const resourceKey = source?.resourceKey
	useEffect(() => {
		retries.current = { thumbnail: false, preview: false }
		setPreviewOpen(false)
	}, [resourceKey])
	const refreshSource = source?.refreshSource
	const recover = useCallback(
		(rendition: "thumbnail" | "preview") => {
			if (!enabled || disabled || !refreshSource || retries.current[rendition]) return
			retries.current[rendition] = true
			return refreshSource(rendition)
		},
		[enabled, disabled, refreshSource],
	)
	const refreshAt = source?.refreshAt
	const hasError = source?.hasError
	useEffect(() => {
		if (
			!(open ?? previewOpen) ||
			!enabled ||
			disabled ||
			hasError ||
			!refreshAt ||
			!refreshSource
		)
			return
		// 只给打开的预览续期；隐藏引用没有计时器，也不会持续刷新签名地址。
		const timer = setTimeout(
			() => {
				void refreshSource("preview")
			},
			Math.max(0, refreshAt - Date.now()),
		)
		return () => clearTimeout(timer)
	}, [open, previewOpen, enabled, disabled, hasError, refreshAt, refreshSource])

	const loadPreview = useCallback(
		(nextOpen: boolean) => {
			setPreviewOpen(nextOpen)
			if (nextOpen) void source?.loadPreview?.()
			onOpenChange?.(nextOpen)
		},
		[onOpenChange, source],
	)
	// Keep the loading slot on the same box as the ready thumbnail (default size-4 /
	// 16px) so mention chips do not jitter when the spinner swaps to icon or image.
	const thumbnailFallback = source?.isLoading ? (
		<span
			className={`${thumbnailClassName} inline-flex items-center justify-center`}
			style={resolvedThumbnailStyle}
			aria-label="Loading"
		>
			<LoaderCircle className="size-full animate-spin text-muted-foreground" aria-hidden />
		</span>
	) : (
		fallback
	)

	const thumbnail = source
		? (source.thumbnailElement ?? (
				<MediaPreviewThumbnail
					mediaType={source.mediaType}
					thumbnailUrl={source.thumbnailUrl}
					posterUrl={source.posterUrl}
					alt={fileName}
					fallback={thumbnailFallback}
					className={thumbnailClassName}
					style={resolvedThumbnailStyle}
					onError={() => recover("thumbnail")}
				/>
			))
		: fallback

	const trigger = renderTrigger(thumbnail)
	const canPreview = Boolean(
		source &&
		(source.thumbnailElement ||
			source.previewUrl ||
			source.posterUrl ||
			source.audioUrl ||
			source.isLoading ||
			source.hasError ||
			source.loadPreview),
	)
	if (!enabled || !source || !canPreview) return trigger

	return (
		<MediaPreviewTooltip
			key={resourceKey}
			mediaType={source.mediaType}
			resourceKey={source.resourceKey}
			imageActions={source.imageActions}
			fileName={fileName}
			previewUrl={source.previewUrl}
			posterUrl={source.posterUrl}
			audioUrl={source.audioUrl}
			poster={source.poster}
			crop={source.crop}
			isLoading={source.isLoading}
			hasError={source.hasError}
			errorMessage={labels.errorMessage}
			audioLabels={labels.audioLabels}
			enableTouchTrigger={enableTouchTrigger}
			disabled={disabled}
			side={side}
			sideOffset={sideOffset}
			previewSize={source.previewSize}
			sourceSize={source.sourceSize}
			container={container}
			open={open}
			onOpenChange={loadPreview}
			onMediaError={() => recover("preview")}
		>
			{trigger}
		</MediaPreviewTooltip>
	)
}
