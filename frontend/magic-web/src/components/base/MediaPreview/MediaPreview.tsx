import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import type { MediaPreviewThumbnailProps } from "./types"

export function MediaPreviewThumbnail(props: MediaPreviewThumbnailProps) {
	const {
		mediaType,
		thumbnailUrl,
		src,
		posterUrl,
		poster,
		alt = "",
		fallback,
		className = "",
		style,
		objectFit = "cover",
		onError,
	} = props
	const resolvedSrc = thumbnailUrl ?? src
	const resolvedPoster = posterUrl ?? poster
	const [hasLoadError, setHasLoadError] = useState(false)

	useEffect(() => setHasLoadError(false), [mediaType, resolvedSrc, resolvedPoster])
	const handleLoadError = () => {
		setHasLoadError(true)
		const recovery = onError?.()
		// 地址服务可能返回同一 URL；只有获取层确实启动了一次恢复，才重新挂载媒体。
		if (recovery) void recovery.then(() => setHasLoadError(false))
	}

	if (hasLoadError || (!resolvedSrc && !resolvedPoster)) {
		return (
			<>
				{fallback ?? (
					<LoaderCircle
						size={16}
						className="size-4 shrink-0 animate-spin text-muted-foreground"
						aria-label="Loading"
					/>
				)}
			</>
		)
	}

	if (mediaType === "image") {
		return (
			<img
				src={resolvedSrc ?? resolvedPoster ?? undefined}
				alt={alt}
				draggable={false}
				className={className}
				style={{ objectFit, ...style }}
				onError={handleLoadError}
			/>
		)
	}

	if (mediaType === "video") {
		if (!resolvedPoster) return <>{fallback}</>
		return (
			<video
				poster={resolvedPoster ?? undefined}
				muted
				playsInline
				preload="metadata"
				aria-label={alt}
				className={className}
				style={{ objectFit, ...style }}
				onError={handleLoadError}
			/>
		)
	}

	return <>{fallback}</>
}
