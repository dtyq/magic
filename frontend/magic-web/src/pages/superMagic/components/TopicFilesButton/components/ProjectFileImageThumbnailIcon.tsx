import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/utils/cn"
import type { AttachmentItem } from "../hooks/types"
import {
	resolveProjectFileImagePreviewSource,
	useProjectFileImagePreviewContext,
	useProjectFileImagePreviewState,
} from "./ProjectFileImagePreviewProvider"
import { isProjectFileImagePreviewDirectUrlUsable } from "./projectFileImagePreviewCoordinator"
import { observeProjectFileImagePreviewVisibility } from "./projectFileImagePreviewRuntime"

type ImageLoadPhase = "loading" | "loaded" | "error"

interface ProjectFileImageThumbnailIconProps {
	item: AttachmentItem
	size?: number
	className?: string
	dataTestId?: string
	fallback: ReactNode
}

/** Displays project image thumbnails from the list-level preview manager. */
export function ProjectFileImageThumbnailIcon({
	item,
	size = 16,
	className,
	dataTestId = "project-file-image-thumbnail",
	fallback,
}: ProjectFileImageThumbnailIconProps) {
	const manager = useProjectFileImagePreviewContext()
	const source = resolveProjectFileImagePreviewSource(item)
	const sourceRef = useRef(source)
	sourceRef.current = source
	const previewState = useProjectFileImagePreviewState(source)
	const previewUrl = previewState?.url
	const [imagePhase, setImagePhase] = useState<ImageLoadPhase>("loading")
	const containerRef = useRef<HTMLDivElement>(null)
	const setPreviewVisible = manager?.setPreviewVisible

	useEffect(() => {
		setImagePhase("loading")
	}, [previewUrl, source?.cacheKey])

	useEffect(() => {
		const element = containerRef.current
		const observedSource = sourceRef.current
		if (
			!element ||
			!observedSource ||
			!observedSource.fileId ||
			!setPreviewVisible ||
			isProjectFileImagePreviewDirectUrlUsable(observedSource)
		) {
			return
		}

		let isVisible = false
		return observeProjectFileImagePreviewVisibility(element, (nextVisible) => {
			if (isVisible === nextVisible) return
			isVisible = nextVisible
			setPreviewVisible(observedSource, nextVisible)
		})
	}, [
		setPreviewVisible,
		source?.cacheKey,
		source?.directThumbnailExpiresAt,
		source?.directThumbnailUrl,
		source?.fileId,
	])

	if (!source || (!manager && !isProjectFileImagePreviewDirectUrlUsable(source))) {
		return <>{fallback}</>
	}

	const shouldShowFallback =
		previewState?.status === "error" ||
		previewState?.status === "unavailable" ||
		(previewUrl && imagePhase === "error")

	return (
		<div
			ref={containerRef}
			className={cn("relative shrink-0 overflow-hidden rounded bg-muted", className)}
			style={{
				width: size,
				height: size,
				minWidth: size,
				minHeight: size,
				maxWidth: size,
				maxHeight: size,
			}}
			data-testid={dataTestId}
			aria-hidden
		>
			{shouldShowFallback ? (
				<div className="flex h-full w-full items-center justify-center">{fallback}</div>
			) : null}
			{!shouldShowFallback && (!previewUrl || imagePhase !== "loaded") && (
				<div
					className={cn(
						"absolute inset-0 rounded bg-muted",
						"animate-pulse motion-reduce:animate-none",
					)}
					data-testid={`${dataTestId}-loading`}
				/>
			)}
			{!shouldShowFallback && previewUrl && (
				<img
					key={previewUrl}
					src={previewUrl}
					alt=""
					className={cn(
						"absolute inset-0 block h-full w-full object-cover",
						imagePhase === "loaded" ? "opacity-100" : "opacity-0",
					)}
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
					data-testid={`${dataTestId}-image`}
					onLoad={() => {
						setImagePhase("loaded")
					}}
					onError={() => {
						setImagePhase("error")
						manager?.markPreviewImageError(source)
					}}
				/>
			)}
		</div>
	)
}
