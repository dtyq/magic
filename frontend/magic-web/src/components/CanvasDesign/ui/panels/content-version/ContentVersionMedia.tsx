import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import { Headphones, LoaderCircle, Pause, Play } from "lucide-react"
import { GenerationStatus, ImageGenerationTaskTypeMap } from "../../../public/magic-types"
import { useReferenceImageUrls } from "../../../app/hooks/resources/useReferenceImageUrls"
import { useCanvasEvent, useGenerationSubmissionState } from "../../../app/hooks/canvas"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { isImageGenerationTimedOut } from "../../../runtime/elements/image/imageGenerationTiming"
import type { ContentState } from "../../../runtime/document/elementContent"
import type {
	AudioElement,
	ImageElement,
	ImageElementContent,
	VideoElement,
} from "../../../runtime/document/types"
import { getCanvasResourceFileName } from "../../../runtime/shared/path/canvasResourcePath"
import { useReferenceAudioSrc } from "../../previews/reference-media/useReferenceAudioSrc"
import { useReferenceVideoPoster } from "../../previews/reference-media/useReferenceVideoPoster"
import ContentVersionStatusPlaceholder from "./ContentVersionStatusPlaceholder"
import styles from "./index.module.css"

type VersionMediaContent =
	| ImageElement["contents"][number]
	| VideoElement["contents"][number]
	| AudioElement["contents"][number]

interface ContentVersionMediaProps {
	element: ImageElement | VideoElement | AudioElement
	content: VersionMediaContent
	contentState: ContentState
	playing: boolean
}

function getContentStatus(content: VersionMediaContent): GenerationStatus | undefined {
	return "status" in content ? content.status : undefined
}

function getAudioFileName(path: string | undefined, fallback: string): string {
	return path ? getCanvasResourceFileName(path) || fallback : fallback
}

function ImageVersionMedia({ path }: { path: string }) {
	const { t } = useCanvasDesignI18n()
	const { lowUrl, isLoading } = useReferenceImageUrls(path)

	if (lowUrl) return <img className={styles.media} src={lowUrl} alt="" />
	if (isLoading) {
		return (
			<ContentVersionStatusPlaceholder
				kind="loading"
				label={t("elementBottomToolbar.versionStatusLoading", "加载中")}
			/>
		)
	}
	return (
		<ContentVersionStatusPlaceholder
			kind="failed"
			label={t("image.loadError", "图片加载失败")}
		/>
	)
}

function VideoVersionMedia({ path, playing }: { path: string; playing: boolean }) {
	const { t } = useCanvasDesignI18n()
	const containerRef = useRef<HTMLDivElement>(null)
	const posterRef = useRef<HTMLCanvasElement>(null)
	const videoRef = useRef<HTMLVideoElement>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined")
	const shouldLoad = inView || playing
	const { posterClone, loadState, ossSrc } = useReferenceVideoPoster(path, {
		enabled: shouldLoad,
	})

	useEffect(() => {
		const node = containerRef.current
		if (!node || typeof IntersectionObserver === "undefined") {
			setInView(true)
			return
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setInView(true)
					observer.disconnect()
				}
			},
			{ rootMargin: "120px" },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [])

	useLayoutEffect(() => {
		const canvas = posterRef.current
		if (!canvas || !posterClone) return
		canvas.width = posterClone.width
		canvas.height = posterClone.height
		const context = canvas.getContext("2d")
		context?.clearRect(0, 0, canvas.width, canvas.height)
		context?.drawImage(posterClone, 0, 0)
	}, [posterClone])

	useEffect(() => {
		const video = videoRef.current
		if (!video || !ossSrc) {
			setIsPlaying(false)
			return
		}
		if (!playing) {
			video.pause()
			if (video.readyState > 0) {
				try {
					video.currentTime = 0
				} catch {
					// Some remote media streams are not seekable until enough data arrives.
				}
			}
			setIsPlaying(false)
			return
		}

		video.muted = true
		video.loop = true
		try {
			const playPromise = video.play()
			void playPromise?.catch(() => setIsPlaying(false))
		} catch {
			setIsPlaying(false)
		}
		return () => video.pause()
	}, [ossSrc, playing])

	if (!shouldLoad || loadState === "loading") {
		return (
			<div ref={containerRef} className={styles.videoStage}>
				<ContentVersionStatusPlaceholder
					kind="loading"
					label={t("elementBottomToolbar.versionStatusLoading", "加载中")}
				/>
			</div>
		)
	}
	if (loadState === "error" || !posterClone) {
		return (
			<div ref={containerRef} className={styles.videoStage}>
				<ContentVersionStatusPlaceholder
					kind="failed"
					label={t("video.loadError", "视频加载失败")}
				/>
			</div>
		)
	}

	return (
		<div ref={containerRef} className={styles.videoStage}>
			<canvas ref={posterRef} className={styles.media} aria-hidden />
			{ossSrc && (
				<video
					ref={videoRef}
					className={styles.videoPlayback}
					data-visible={isPlaying}
					src={ossSrc}
					muted
					loop
					playsInline
					preload="metadata"
					onPlaying={() => setIsPlaying(true)}
					onPause={() => setIsPlaying(false)}
					aria-hidden
				/>
			)}
		</div>
	)
}

function AudioVersionMedia({ path }: { path?: string }) {
	const { t } = useCanvasDesignI18n()
	const fileName = getAudioFileName(path, t("audio.defaultName", "音频"))

	return (
		<div className={styles.audioVisual}>
			<Headphones size={16} className={styles.audioIcon} aria-hidden />
			<span className={styles.audioFileName}>{fileName}</span>
		</div>
	)
}

interface ContentVersionAudioControlProps {
	contentId: string
	path: string
	activeAudioContentId?: string
	onPlaybackChange: (contentId: string, playing: boolean) => void
}

export function ContentVersionAudioControl({
	contentId,
	path,
	activeAudioContentId,
	onPlaybackChange,
}: ContentVersionAudioControlProps) {
	const { t } = useCanvasDesignI18n()
	const { src, isLoading, hasError, load } = useReferenceAudioSrc(path)
	const audioRef = useRef<HTMLAudioElement>(null)
	const [playing, setPlaying] = useState(false)
	const [playAfterLoad, setPlayAfterLoad] = useState(false)
	const [playbackFailed, setPlaybackFailed] = useState(false)
	const fileName = getAudioFileName(path, t("audio.defaultName", "音频"))

	useEffect(() => {
		setPlaying(false)
		setPlayAfterLoad(false)
		setPlaybackFailed(false)
		onPlaybackChange(contentId, false)
	}, [contentId, onPlaybackChange, path])

	useEffect(() => {
		if (playing && activeAudioContentId && activeAudioContentId !== contentId) {
			audioRef.current?.pause()
		}
	}, [activeAudioContentId, contentId, playing])

	useEffect(
		() => () => {
			audioRef.current?.pause()
			onPlaybackChange(contentId, false)
		},
		[contentId, onPlaybackChange],
	)

	useEffect(() => {
		if (hasError) setPlayAfterLoad(false)
	}, [hasError])

	useEffect(() => {
		const audio = audioRef.current
		if (!audio || !src || !playAfterLoad) return
		setPlayAfterLoad(false)
		void audio.play().catch(() => {
			setPlaybackFailed(true)
			setPlaying(false)
		})
	}, [playAfterLoad, src])

	const togglePlayback = useCallback(async () => {
		const audio = audioRef.current
		if (!audio) return
		if (playing) {
			audio.pause()
			return
		}
		if (src) {
			try {
				await audio.play()
				setPlaybackFailed(false)
			} catch {
				setPlaybackFailed(true)
			}
			return
		}
		setPlayAfterLoad(true)
		await load()
	}, [load, playing, src])

	const loading = isLoading || (playAfterLoad && !src && !hasError)
	const failed = hasError || playbackFailed
	const label = loading
		? t("elementBottomToolbar.versionAudioLoading", {
				defaultValue: "{{name}} 加载中",
				name: fileName,
			})
		: t("elementBottomToolbar.versionAudioLoadFailed", {
				defaultValue: "{{name}} 加载失败",
				name: fileName,
			})
	const buttonLabel = loading
		? t("audio.loading", "正在加载音频...")
		: playing
			? t("video.fullscreen.pause", "暂停")
			: t("video.fullscreen.play", "播放")

	return (
		<>
			{(loading || failed) && (
				<div className={styles.audioStatusOverlay}>
					<ContentVersionStatusPlaceholder
						kind={failed ? "failed" : "loading"}
						label={label}
					/>
				</div>
			)}
			<button
				type="button"
				className={styles.audioToggle}
				aria-label={buttonLabel}
				disabled={loading}
				onClick={(event) => {
					event.stopPropagation()
					void togglePlayback()
				}}
			>
				{loading ? (
					<LoaderCircle size={14} className={styles.spinner} aria-hidden />
				) : playing ? (
					<Pause size={14} />
				) : (
					<Play size={14} />
				)}
			</button>
			<audio
				ref={audioRef}
				src={src}
				onPlay={() => {
					setPlaying(true)
					onPlaybackChange(contentId, true)
				}}
				onPause={() => {
					setPlaying(false)
					onPlaybackChange(contentId, false)
				}}
				onEnded={() => {
					setPlaying(false)
					onPlaybackChange(contentId, false)
				}}
			/>
		</>
	)
}

export default function ContentVersionMedia({
	element,
	content,
	contentState,
	playing,
}: ContentVersionMediaProps) {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const [, refreshReplacementState] = useReducer((revision: number) => revision + 1, 0)
	useCanvasEvent(
		"element:media:replaceStateChanged",
		({ data }) => {
			if (data.elementId === element.id) refreshReplacementState()
		},
		[element.id],
	)
	const status = getContentStatus(content)
	const submissionRuntime = useGenerationSubmissionState(element.id, content.contentId)
	const replacementState = canvas?.mediaReplaceController?.getReplacementState?.(element.id)
	const isReplacementForContent = replacementState?.contentId === content.contentId
	const isReplacementUploading =
		isReplacementForContent &&
		replacementState?.source === "local-upload" &&
		replacementState.phase === "uploading"
	const isReplacementApplying = isReplacementForContent && replacementState?.phase === "applying"
	const isComplianceActive = element.type === "video" && submissionRuntime?.phase === "validating"
	const isCompositionActive =
		element.type === "video" &&
		canvas?.getEffectiveContentId(element.id) === content.contentId &&
		Boolean(canvas?.videoCompositionManager?.isComposingResult?.(element.id))
	const imageContent = element.type === "image" ? (content as ImageElementContent) : undefined
	const isTimedOut = imageContent
		? (status === GenerationStatus.Pending || status === GenerationStatus.Processing) &&
			isImageGenerationTimedOut(imageContent, imageContent.generationTiming)
		: false
	const imageTaskType =
		"imageGenerationTaskMeta" in content ? content.imageGenerationTaskMeta?.type : undefined
	const generatingLabel =
		element.type === "image"
			? imageTaskType === ImageGenerationTaskTypeMap.Expand
				? t("image.status.expanding", "扩展中")
				: imageTaskType === ImageGenerationTaskTypeMap.Eraser
					? t("image.status.erasing", "擦除中")
					: imageTaskType === ImageGenerationTaskTypeMap.RemoveBackground
						? t("image.status.removingBackground", "去背景中")
						: t("image.status.generating", "生成中")
			: element.type === "video" && status === GenerationStatus.Pending
				? t("elementBottomToolbar.versionStatusUploading", "上传中")
				: t("elementBottomToolbar.versionStatusGenerating", "生成中")

	if (isReplacementUploading) {
		return (
			<ContentVersionStatusPlaceholder
				kind="loading"
				label={t("elementBottomToolbar.versionStatusUploading", "上传中")}
			/>
		)
	}
	if (isReplacementApplying) {
		return (
			<ContentVersionStatusPlaceholder
				kind="loading"
				label={t("elementBottomToolbar.versionStatusReplacing", "替换中")}
			/>
		)
	}
	if (isComplianceActive) {
		return (
			<ContentVersionStatusPlaceholder
				kind="loading"
				label={t("video.complianceChecking", "正在校验")}
			/>
		)
	}
	if (isCompositionActive) {
		return (
			<ContentVersionStatusPlaceholder
				kind="loading"
				label={t("video.merging", "正在合并中...")}
			/>
		)
	}
	if (isTimedOut) {
		return (
			<ContentVersionStatusPlaceholder
				kind="failed"
				label={t("image.timedOut", "生成已超时")}
			/>
		)
	}

	if (contentState === "pending" || contentState === "processing") {
		return <ContentVersionStatusPlaceholder kind="loading" label={generatingLabel} />
	}
	if (contentState === "failed") {
		const failureLabel =
			element.type === "image"
				? status === GenerationStatus.Terminated
					? t("image.generateTerminated", "生图已终止")
					: t("image.generateFailed", "图片生成失败")
				: status === GenerationStatus.Terminated
					? t("elementBottomToolbar.versionStatusTerminated", "已终止")
					: t("video.generateFailed", "视频生成失败")
		return <ContentVersionStatusPlaceholder kind="failed" label={failureLabel} />
	}
	if (contentState === "empty" || !content.src) {
		return (
			<ContentVersionStatusPlaceholder
				kind="empty"
				label={t("elementBottomToolbar.versionStatusEmpty", "暂无内容")}
			/>
		)
	}

	if (element.type === "audio") return <AudioVersionMedia path={content.src} />
	if (element.type === "image") return <ImageVersionMedia path={content.src} />
	return <VideoVersionMedia path={content.src} playing={playing} />
}
