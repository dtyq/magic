import { memo, useEffect, useRef, type ReactNode } from "react"
import {
	useFileMediaSource,
	type FileMediaMetadata,
} from "@/pages/superMagic/services/useFileMediaSource"
import { cn } from "@/utils/cn"

interface CanvasMediaImageProps {
	file: FileMediaMetadata | null | undefined
	className?: string
	/** Rendered while the URL resolves, when there is no image, or after a failed refresh. */
	fallback: ReactNode
	/** Lazy-load below-the-fold cards; the hero board loads eagerly. */
	loading?: "lazy" | "eager"
}

/**
 * Project image rendered through useFileMediaSource, which owns the signed-URL lifecycle
 * (identity-scoped cache, expiry and renewal). A load error forces one thumbnail refresh;
 * if that also fails the fallback stays, so the card never loops on requests.
 */
function CanvasMediaImage({ file, className, fallback, loading = "lazy" }: CanvasMediaImageProps) {
	const source = useFileMediaSource(file, { enabled: Boolean(file) })
	const url = source?.thumbnailUrl || source?.previewUrl || null
	const refreshedRef = useRef(false)

	useEffect(() => {
		refreshedRef.current = false
	}, [file?.fileId])

	if (!url || source?.hasError) return <>{fallback}</>

	return (
		<img
			src={url}
			alt=""
			loading={loading}
			draggable={false}
			className={cn("size-full object-cover", className)}
			onError={() => {
				if (refreshedRef.current) return
				refreshedRef.current = true
				void source?.refreshSource?.("thumbnail")
			}}
		/>
	)
}

export default memo(CanvasMediaImage)
