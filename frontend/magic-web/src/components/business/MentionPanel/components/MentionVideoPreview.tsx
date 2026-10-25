import { cn } from "@/utils/cn"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
	useFileMediaSource,
	type FileMediaMetadata,
} from "@/pages/superMagic/services/useFileMediaSource"
import { MentionItemType, type MentionItem, type ProjectFileMentionData } from "../types"

interface MentionVideoPreviewProps {
	item: MentionItem
	fallback: ReactNode
}

function buildProjectVideoMetadata(item: MentionItem): FileMediaMetadata | null {
	if (item.type !== MentionItemType.PROJECT_FILE) return null

	const data = item.data as ProjectFileMentionData | undefined
	if (!data?.file_id) return null

	return {
		spaceType: "project",
		fileId: data.file_id,
		projectId: data.project_id,
		fileName: data.file_name || item.name,
		fileExtension: data.file_extension,
		fileVersion: data.file_version,
		updatedAt: data.updated_at,
		resourceVersion:
			data.resource_version || (data.version != null ? String(data.version) : undefined),
		path: data.relative_file_path || data.file_path,
	}
}

export default function MentionVideoPreview(props: MentionVideoPreviewProps) {
	const { item, fallback } = props
	const metadata = useMemo(() => buildProjectVideoMetadata(item), [item])
	const source = useFileMediaSource(metadata)
	const containerRef = useRef<HTMLDivElement>(null)
	const previewLoadRequestedRef = useRef(false)
	const [mediaInView, setMediaInView] = useState(false)
	const [previewReady, setPreviewReady] = useState(false)
	const [previewFailed, setPreviewFailed] = useState(false)

	useEffect(() => {
		previewLoadRequestedRef.current = false
		setMediaInView(false)
		setPreviewReady(false)
		setPreviewFailed(false)
	}, [metadata?.fileId])

	useEffect(() => {
		const container = containerRef.current
		if (!container || typeof IntersectionObserver === "undefined") {
			setMediaInView(true)
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				setMediaInView(true)
				observer.disconnect()
			},
			{ rootMargin: "80px" },
		)
		observer.observe(container)
		return () => observer.disconnect()
	}, [metadata?.fileId])

	useEffect(() => {
		if (
			!mediaInView ||
			!source ||
			source.previewUrl ||
			source.hasError ||
			previewLoadRequestedRef.current
		)
			return
		previewLoadRequestedRef.current = true
		void source.loadPreview?.().catch(() => undefined)
	}, [mediaInView, source])

	if (!source || source.hasError || previewFailed) return fallback

	return (
		<div ref={containerRef} className="relative h-full w-full bg-black/5">
			{(!source.previewUrl || !previewReady) && (
				<div className="absolute inset-0 animate-pulse bg-muted motion-reduce:animate-none" />
			)}
			{source.previewUrl && (
				<video
					className={cn(
						"block h-full w-full object-contain transition-opacity",
						previewReady ? "opacity-100" : "opacity-0",
					)}
					src={source.previewUrl}
					poster={source.posterUrl ?? undefined}
					muted
					playsInline
					preload="auto"
					aria-label={item.name}
					onLoadedMetadata={(event) => {
						const video = event.currentTarget
						if (!Number.isFinite(video.duration) || video.duration <= 0) return
						try {
							video.currentTime = Math.min(0.05, video.duration)
						} catch {
							// Some browsers reject seeking before enough media data is available.
						}
					}}
					onLoadedData={() => setPreviewReady(true)}
					onCanPlay={() => setPreviewReady(true)}
					onError={() => setPreviewFailed(true)}
					data-testid="mention-panel-gallery-video"
				/>
			)}
		</div>
	)
}
