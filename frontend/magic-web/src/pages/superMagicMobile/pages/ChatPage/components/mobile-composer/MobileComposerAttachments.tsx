import { useEffect, useRef, useState } from "react"
import {
	AlertCircle,
	AudioWaveform,
	File,
	FileImage,
	FileSpreadsheet,
	FileText,
	Loader2,
	PlayCircle,
	Presentation,
	type LucideIcon,
	X,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import type { FileData } from "@/pages/superMagic/components/MessageEditor/types"
import { extractFileExtension } from "@/pages/superMagic/components/MessageEditor/utils/mention"
import useObjectUrl from "@/pages/superMagic/components/MessageEditor/components/AtItem/hooks/useObjectURL"

interface MobileComposerAttachmentsProps {
	files: FileData[]
	onRemove: (file: FileData) => void
}

function formatVideoDuration(totalSeconds: number) {
	if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return ""

	const total = Math.floor(totalSeconds)
	const s = total % 60
	const m = Math.floor(total / 60) % 60
	const h = Math.floor(total / 3600)
	if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
	return `${m}:${s.toString().padStart(2, "0")}`
}

const FILE_TYPE_ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
	pdf: { Icon: FileText, label: "PDF" },
	doc: { Icon: FileText, label: "DOC" },
	docx: { Icon: FileText, label: "DOCX" },
	xls: { Icon: FileSpreadsheet, label: "XLS" },
	xlsx: { Icon: FileSpreadsheet, label: "XLSX" },
	csv: { Icon: FileSpreadsheet, label: "CSV" },
	ppt: { Icon: Presentation, label: "PPT" },
	pptx: { Icon: Presentation, label: "PPTX" },
	mp4: { Icon: PlayCircle, label: "MP4" },
	mov: { Icon: PlayCircle, label: "MOV" },
	mp3: { Icon: AudioWaveform, label: "MP3" },
	wav: { Icon: AudioWaveform, label: "WAV" },
	jpg: { Icon: FileImage, label: "JPG" },
	jpeg: { Icon: FileImage, label: "JPG" },
	png: { Icon: FileImage, label: "PNG" },
	gif: { Icon: FileImage, label: "GIF" },
	webp: { Icon: FileImage, label: "WEBP" },
}

function getFileStyle(ext?: string) {
	const entry = FILE_TYPE_ICONS[ext?.toLowerCase() ?? ""]
	const fallbackLabel = (ext ?? "FILE").toUpperCase()
	return { Icon: entry?.Icon ?? File, label: entry?.label ?? fallbackLabel }
}

const IMAGE_EXT_FALLBACK = new Set([
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"bmp",
	"svg",
	"heic",
	"heif",
])
const VIDEO_EXT_FALLBACK = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v", "mpeg", "mpg"])

function inferIsImage(mime: string, extLower: string) {
	if (mime.startsWith("image/")) return true
	if (mime === "" && IMAGE_EXT_FALLBACK.has(extLower)) return true
	return false
}

function inferIsVideo(mime: string, extLower: string) {
	if (mime.startsWith("video/")) return true
	if (mime === "" && VIDEO_EXT_FALLBACK.has(extLower)) return true
	return false
}

function VideoAttachmentThumbContent({ previewUrl }: { previewUrl: string }) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const capturedRef = useRef(false)
	const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null)
	const [durationLabel, setDurationLabel] = useState("")

	useEffect(() => {
		const el = videoRef.current
		if (!el) return

		capturedRef.current = false
		setPosterDataUrl(null)
		setDurationLabel("")

		let cancelled = false

		function captureFrame() {
			if (cancelled || capturedRef.current || !el) return
			const w = el.videoWidth
			const h = el.videoHeight
			if (w < 2 || h < 2) return
			try {
				const canvas = document.createElement("canvas")
				canvas.width = w
				canvas.height = h
				const ctx = canvas.getContext("2d")
				if (!ctx) return
				ctx.drawImage(el, 0, 0, w, h)
				const url = canvas.toDataURL("image/jpeg", 0.85)
				capturedRef.current = true
				if (!cancelled) setPosterDataUrl(url)
			} catch {
				/* 部分编码无法写入 canvas */
			}
		}

		function onLoadedMetadata() {
			if (cancelled || !el) return
			const d = el.duration
			if (Number.isFinite(d) && d > 0) {
				setDurationLabel(formatVideoDuration(d))
				const seekTo = d <= 0.2 ? d / 2 : Math.min(0.12, Math.max(0.02, d * 0.02))
				el.currentTime = seekTo
			}
		}

		function onSeeked() {
			captureFrame()
		}

		function onLoadedData() {
			if (!capturedRef.current) captureFrame()
		}

		el.muted = true
		el.playsInline = true
		el.setAttribute("playsinline", "")
		el.preload = "auto"

		el.addEventListener("loadedmetadata", onLoadedMetadata)
		el.addEventListener("seeked", onSeeked)
		el.addEventListener("loadeddata", onLoadedData)

		return () => {
			cancelled = true
			el.removeEventListener("loadedmetadata", onLoadedMetadata)
			el.removeEventListener("seeked", onSeeked)
			el.removeEventListener("loadeddata", onLoadedData)
		}
	}, [previewUrl])

	return (
		<>
			<video
				ref={videoRef}
				src={previewUrl}
				className="pointer-events-none absolute h-px w-px opacity-0"
				muted
				playsInline
				preload="auto"
				aria-hidden
			/>
			{posterDataUrl ? (
				<img src={posterDataUrl} alt="" className="h-full w-full bg-black object-cover" />
			) : (
				<div className="h-full w-full bg-black" aria-hidden />
			)}
			{durationLabel ? (
				<span className="pointer-events-none absolute bottom-1 left-1.5 z-[1] rounded bg-black/55 px-1 py-0.5 text-xs font-semibold tabular-nums leading-none text-white">
					{durationLabel}
				</span>
			) : null}
		</>
	)
}

function MobileComposerAttachmentThumb({
	file,
	onRemove,
}: {
	file: FileData
	onRemove: () => void
}) {
	const { t } = useTranslation("super/mainInput")
	const ext = extractFileExtension(file.name)
	const extLower = ext.toLowerCase()
	const mime = file.file?.type ?? ""
	const isImage = inferIsImage(mime, extLower)
	const isVideo = inferIsVideo(mime, extLower)
	const needsPreviewUrl = isImage || isVideo
	const objectUrl = useObjectUrl(needsPreviewUrl ? file.file : null)
	const previewUrl = objectUrl ?? ""

	const isUploading = file.status === "uploading"
	const isError = file.status === "error"

	const { Icon: FileIcon, label: fileLabel } =
		isImage || isVideo ? { Icon: File, label: "" } : getFileStyle(ext)

	return (
		<div
			className="relative h-[90px] w-[90px] shrink-0 overflow-hidden rounded-xl border border-border/80 bg-card"
			data-testid="mobile-composer-attachment-item"
		>
			{isImage && previewUrl ? (
				<img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
			) : isVideo && previewUrl ? (
				<VideoAttachmentThumbContent previewUrl={previewUrl} />
			) : isImage && needsPreviewUrl && !previewUrl ? (
				<div className="h-full w-full bg-muted" aria-hidden />
			) : isVideo && needsPreviewUrl && !previewUrl ? (
				<div className="h-full w-full bg-black" aria-hidden />
			) : (
				<div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-background px-1.5 text-center">
					<FileIcon className="size-5 shrink-0 text-foreground/40" strokeWidth={1.5} />
					<span className="w-full truncate text-xs font-semibold uppercase leading-none tracking-wide text-foreground/40">
						{fileLabel}
					</span>
					<span className="w-full truncate text-xs leading-none text-foreground/35">
						{file.name}
					</span>
					{isUploading ? (
						<span className="text-xs text-muted-foreground">
							{Math.round(file.progress ?? 0)}%
						</span>
					) : null}
				</div>
			)}

			{isUploading ? (
				<div className="absolute inset-0 flex items-center justify-center bg-black/40">
					<Loader2 className="size-5 animate-spin text-white" strokeWidth={2} />
				</div>
			) : null}

			{isError ? (
				<div className="absolute inset-0 flex items-center justify-center bg-destructive/25">
					<AlertCircle className="size-5 text-destructive" strokeWidth={2} />
				</div>
			) : null}

			<button
				type="button"
				onClick={onRemove}
				className="absolute right-[5px] top-[5px] z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white"
				aria-label={t("attachments.removeAriaLabel", { fileName: file.name })}
				data-testid="mobile-composer-attachment-remove-button"
			>
				<X className="size-3 shrink-0" strokeWidth={2.5} />
			</button>
		</div>
	)
}

function MobileComposerAttachmentsComponent({ files, onRemove }: MobileComposerAttachmentsProps) {
	if (files.length === 0) return null

	return (
		<div
			className="no-scrollbar flex gap-3 overflow-x-auto px-3 pb-1.5 pt-3"
			data-testid="mobile-composer-attachments"
		>
			{files.map((file) => (
				<MobileComposerAttachmentThumb
					key={file.id}
					file={file}
					onRemove={() => onRemove(file)}
				/>
			))}
		</div>
	)
}

const MobileComposerAttachments = observer(MobileComposerAttachmentsComponent)

export default MobileComposerAttachments
