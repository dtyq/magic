import { type VideoElement, type VideoElementContent } from "../../../runtime/document/types"
import styles from "./index.module.css"
import IconButton from "../../primitives/custom/IconButton/index"
import { Copy, ImagePlus, X } from "lucide-react"
import { useMemo, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import useCanvasSelectionFloatingPanel from "../../../app/hooks/layout/useCanvasSelectionFloatingPanel"
import { useCanvasPanelUI } from "../../../app/providers/CanvasUIProvider"
import { useMagic } from "../../../app/providers/MagicProvider"
import ReferenceImageItem from "./ReferenceImageItem"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import type { MediaResourceFullscreenPreviewItem } from "../../fullscreen/media-resource/index"
import { resolvePromptPlaceholderTokenConfig } from "../../editors/message/reference-assets/promptPlaceholderTokenConfig"
import { copyHistoryPromptToClipboard } from "./historyPromptClipboard"
import { MessageHistoryCollapsiblePrompt } from "./MessageHistoryCollapsiblePrompt"
import { PromptPlaceholderPreviewText } from "./PromptPlaceholderPreviewText"
import { GenerationStatus, type VideoGenerationInfo } from "../../../public/magic-types"
import { useGenerationRuntime } from "../../../app/hooks/canvas"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { getActiveContent } from "../../../runtime/document/elementContent"

interface VideoMessageHistoryRenderProps {
	videoElement: VideoElement
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
}

interface MessageHistoryInfoRow {
	key: string
	label: string
	value: string
}

/** 右侧浮层：展示选中视频元素最近一次生成请求的摘要 */
export default function VideoMessageHistoryRender(props: VideoMessageHistoryRenderProps) {
	const { videoElement, onPreviewMediaResource } = props
	const { canvas } = useCanvas()
	const { closeMessageHistory } = useCanvasPanelUI()
	const { videoModelList, methods } = useMagic()
	const { t } = useCanvasDesignI18n()
	const generationRuntime = useGenerationRuntime(videoElement.id)
	const videoContent =
		(canvas?.getEffectiveContent(videoElement.id) as
			ReturnType<typeof getActiveContent> | undefined) ?? getActiveContent(videoElement)
	const promptPlaceholderTokenConfig = useMemo(() => resolvePromptPlaceholderTokenConfig(t), [t])

	const request = generationRuntime?.generateVideoRequest || videoContent?.generateVideoRequest
	const resultMeta = videoContent?.videoGenerationResultMeta
	const runtime = resultMeta?.runtime
	const isGenerationRunning = isVideoGenerationRunning({
		status: videoContent?.status,
		hasSource: Boolean(videoContent?.src),
		hasVideoId: Boolean(request?.video_id),
	})
	const [nowMs, setNowMs] = useState(() => Date.now())

	const handleClose = useCallback(() => {
		closeMessageHistory()
	}, [closeMessageHistory])
	const { setRefs } = useCanvasSelectionFloatingPanel({
		id: "video-message-history",
		elementId: videoElement.id,
	})

	const promptText = request?.prompt?.trim() ?? ""

	const modelInfo = useMemo(() => {
		if (!request?.model_id) return undefined
		return videoModelList.find((model) => model.model_id === request.model_id)
	}, [videoModelList, request?.model_id])
	const modelDisplayName = modelInfo?.model_name || request?.model_id

	const frameInputs = useMemo(() => request?.inputs?.frames ?? [], [request?.inputs?.frames])
	const startFrame = frameInputs.find((frame) => frame.role === "start")
	const endFrame = frameInputs.find((frame) => frame.role === "end")
	const referenceImages = useMemo(
		() => request?.inputs?.reference_images ?? [],
		[request?.inputs?.reference_images],
	)
	const referenceVideos = useMemo(
		() => request?.inputs?.reference_videos ?? [],
		[request?.inputs?.reference_videos],
	)
	const referenceAudios = useMemo(
		() => request?.inputs?.reference_audios ?? [],
		[request?.inputs?.reference_audios],
	)
	const promptPlaceholderPaths = useMemo(
		() => ({
			image: referenceImages.map((item) => item.uri),
			video: referenceVideos.map((item) => item.uri),
			audio: referenceAudios.map((item) => item.uri),
		}),
		[referenceAudios, referenceImages, referenceVideos],
	)

	const handleCopyPrompt = useCallback(() => {
		if (!promptText) return
		void copyHistoryPromptToClipboard({
			text: request?.prompt ?? "",
			tokenConfig: promptPlaceholderTokenConfig,
			placeholderPaths: promptPlaceholderPaths,
			resolveResourceReference: methods?.resolveResourceReference,
		})
			.then(() => {
				toast.success(t("menu.copySuccess", "复制成功"))
			})
			.catch(() => undefined)
	}, [
		methods?.resolveResourceReference,
		promptPlaceholderPaths,
		promptPlaceholderTokenConfig,
		promptText,
		request?.prompt,
		t,
	])

	const generationInfoRows = useMemo(
		() =>
			buildGenerationInfoRows({
				billingPoints: resultMeta?.billing?.points,
				generationInfo: resultMeta?.generation_info ?? null,
				request,
				t,
			}),
		[resultMeta?.billing?.points, resultMeta?.generation_info, request, t],
	)
	const runtimeRows = useMemo(
		() =>
			buildRuntimeRows({
				runtime: runtime ?? null,
				isRunning: isGenerationRunning,
				status: videoContent?.status,
				hasSource: Boolean(videoContent?.src),
				nowMs,
				t,
			}),
		[runtime, isGenerationRunning, videoContent?.status, videoContent?.src, nowMs, t],
	)

	useEffect(() => {
		if (!isGenerationRunning || !runtime?.started_at) return undefined
		setNowMs(Date.now())
		const timer = window.setInterval(() => {
			setNowMs(Date.now())
		}, 1000)
		return () => window.clearInterval(timer)
	}, [isGenerationRunning, runtime?.started_at])

	return (
		<div ref={setRefs} className={styles.messageHistory} data-canvas-ui-component>
			<div className={styles.header}>
				<div className={styles.name}>{t("messageHistory.title", "生成记录")}</div>
				<IconButton className={styles.closeButton} onClick={handleClose}>
					<X size={16} />
				</IconButton>
			</div>
			<div className={styles.divider}></div>
			<div className={styles.body}>
				<div className={styles.item}>
					<div className={styles.itemTitleRow}>
						<div className={styles.itemTitle}>
							{t("messageHistory.prompt", "提示词")}
						</div>
						<IconButton
							aria-label={t("messageHistory.copyPrompt", "复制")}
							className={styles.promptCopyButton}
							disabled={!promptText}
							title={t("messageHistory.copyPrompt", "复制")}
							onClick={handleCopyPrompt}
						>
							<Copy size={16} />
						</IconButton>
					</div>
					<div className={styles.itemContent}>
						<MessageHistoryCollapsiblePrompt
							text={request?.prompt ?? ""}
							content={
								<PromptPlaceholderPreviewText
									text={request?.prompt ?? ""}
									tokenConfig={promptPlaceholderTokenConfig}
									placeholderPaths={promptPlaceholderPaths}
									onPreviewMediaResource={onPreviewMediaResource}
									resolveResourceReference={methods?.resolveResourceReference}
									deletedSuffix={t("messageHistory.deletedSuffix", "（已删除）")}
								/>
							}
							emptyLabel={t("messageHistory.noPrompt", "暂无提示词")}
							expandLabel={t("messageHistory.expandPrompt", "展开")}
						/>
					</div>
				</div>

				{!!startFrame && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.startFrame", "首帧")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								<ReferenceImageItem
									path={startFrame.uri}
									mediaType="image"
									onPreviewMediaResource={onPreviewMediaResource}
									resolveResourceReference={methods?.resolveResourceReference}
								/>
							</div>
						</div>
					</div>
				)}

				{!!endFrame && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.endFrame", "尾帧")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								<ReferenceImageItem
									path={endFrame.uri}
									mediaType="image"
									onPreviewMediaResource={onPreviewMediaResource}
									resolveResourceReference={methods?.resolveResourceReference}
								/>
							</div>
						</div>
					</div>
				)}

				{!!referenceImages.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceImage", "参考图")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{referenceImages.map((item, index) => (
									<ReferenceImageItem
										key={`${item.uri}-${index}`}
										path={item.uri}
										mediaType="image"
										onPreviewMediaResource={onPreviewMediaResource}
										resolveResourceReference={methods?.resolveResourceReference}
									/>
								))}
							</div>
						</div>
					</div>
				)}

				{!!referenceVideos.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceVideo", "参考视频")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{referenceVideos.map((item, index) => (
									<ReferenceImageItem
										key={`${item.uri}-${index}`}
										path={item.uri}
										mediaType="video"
										onPreviewMediaResource={onPreviewMediaResource}
										resolveResourceReference={methods?.resolveResourceReference}
									/>
								))}
							</div>
						</div>
					</div>
				)}

				{!!referenceAudios.length && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>
							{t("messageHistory.referenceAudio", "参考音频")}
						</div>
						<div className={styles.itemContent}>
							<div className={styles.imageContent}>
								{referenceAudios.map((item, index) => (
									<ReferenceImageItem
										key={`${item.uri}-${index}`}
										path={item.uri}
										mediaType="audio"
										onPreviewMediaResource={onPreviewMediaResource}
										resolveResourceReference={methods?.resolveResourceReference}
									/>
								))}
							</div>
						</div>
					</div>
				)}

				{/* 模型可能要等生成服务确认后才补齐，缺失时不展示空信息行。 */}
				{!!modelDisplayName && (
					<div className={styles.item}>
						<div className={styles.itemTitle}>{t("messageHistory.model", "模型")}</div>
						<div className={styles.itemContent}>
							<div className={styles.model}>
								<div className={styles.modelIcon}>
									{modelInfo?.model_icon ? (
										<img src={modelInfo.model_icon} alt={modelDisplayName} />
									) : (
										<ImagePlus size={16} />
									)}
								</div>
								<div className={styles.modelName}>{modelDisplayName}</div>
							</div>
						</div>
					</div>
				)}

				{[...generationInfoRows, ...runtimeRows].map((row) => (
					<div key={row.key} className={styles.item}>
						<div className={styles.itemTitle}>{row.label}</div>
						<div className={styles.itemContent}>
							<span>{row.value}</span>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function buildGenerationInfoRows(params: {
	billingPoints?: number | null
	generationInfo: VideoGenerationInfo | null
	request: VideoElementContent["generateVideoRequest"]
	t: ReturnType<typeof useCanvasDesignI18n>["t"]
}): MessageHistoryInfoRow[] {
	const { billingPoints, generationInfo, request, t } = params
	const rows: MessageHistoryInfoRow[] = []

	if (typeof billingPoints === "number" && Number.isFinite(billingPoints)) {
		rows.push({
			key: "billingPoints",
			label: t("messageHistory.billingPoints", "积分消耗"),
			value: t("messageHistory.pointsValue", {
				defaultValue: "{{points}}积分",
				points: formatCompactNumber(billingPoints),
			}),
		})
	}

	const inputMode = generationInfo?.input_mode ?? request?.input_mode
	const inputModeLabel = resolveVideoInputModeLabel(inputMode, t)
	if (inputModeLabel) {
		rows.push({
			key: "generationMode",
			label: t("messageHistory.generationMode", "生成方式"),
			value: inputModeLabel,
		})
	}

	const durationSeconds = getFiniteNumber(
		generationInfo?.duration_seconds ?? request?.generation?.duration_seconds,
	)

	const aspectRatio = generationInfo?.aspect_ratio ?? request?.generation?.aspect_ratio
	const resolution = generationInfo?.resolution ?? request?.generation?.resolution
	const durationLabel =
		durationSeconds !== null ? `${formatCompactNumber(durationSeconds)}s` : undefined
	const spec = [aspectRatio, durationLabel, resolution].filter(Boolean).join(" · ")
	if (spec) {
		rows.push({
			key: "generationSpec",
			label: t("messageHistory.generationSpec", "生成规格"),
			value: spec,
		})
	}

	return rows
}

function buildRuntimeRows(params: {
	runtime: NonNullable<VideoElementContent["videoGenerationResultMeta"]>["runtime"] | null
	isRunning: boolean
	status?: VideoElementContent["status"]
	hasSource: boolean
	nowMs: number
	t: ReturnType<typeof useCanvasDesignI18n>["t"]
}): MessageHistoryInfoRow[] {
	const { runtime, isRunning, status, hasSource, nowMs, t } = params
	if (!runtime) return []

	const rows: MessageHistoryInfoRow[] = []
	const startedAtText = formatDateTimeText(runtime.started_at)
	if (startedAtText) {
		rows.push({
			key: "startedAt",
			label: t("messageHistory.startedAt", "开始时间"),
			value: startedAtText,
		})
	}

	const isCompleted =
		status === GenerationStatus.Completed || Boolean(hasSource && runtime.finished_at)
	if (isCompleted) {
		const finishedAtText = formatDateTimeText(runtime.finished_at)
		if (finishedAtText) {
			rows.push({
				key: "finishedAt",
				label: t("messageHistory.finishedAt", "完成时间"),
				value: finishedAtText,
			})
		}

		const elapsedSeconds =
			getFiniteNumber(runtime.elapsed_seconds) ??
			diffDateTimeSeconds(runtime.started_at, runtime.finished_at)
		if (elapsedSeconds !== null) {
			rows.push({
				key: "generationElapsed",
				label: t("messageHistory.generationElapsed", "生成耗时"),
				value: formatDurationText(elapsedSeconds),
			})
		}
		return rows
	}

	if (isRunning) {
		const startedAtMs = parseDateTimeToMs(runtime.started_at)
		if (startedAtMs !== null) {
			rows.push({
				key: "elapsed",
				label: t("messageHistory.elapsed", "已耗时"),
				value: formatDurationText(Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))),
			})
		}
	}

	return rows
}

function isVideoGenerationRunning(params: {
	status?: VideoElementContent["status"]
	hasSource: boolean
	hasVideoId: boolean
}): boolean {
	const { status, hasSource, hasVideoId } = params
	if (status === GenerationStatus.Pending || status === GenerationStatus.Processing) {
		return true
	}
	if (status === GenerationStatus.Completed || status === GenerationStatus.Failed || hasSource) {
		return false
	}
	return hasVideoId
}

function resolveVideoInputModeLabel(
	inputMode: string | null | undefined,
	t: ReturnType<typeof useCanvasDesignI18n>["t"],
): string {
	if (!inputMode) return ""
	const labels: Record<string, string> = {
		standard: t("messageHistory.videoInputModes.standard", "标准模式"),
		omni_reference: t("messageHistory.videoInputModes.omniReference", "全能模式"),
		image_reference: t("messageHistory.videoInputModes.imageReference", "参考图"),
		keyframe_guided: t("messageHistory.videoInputModes.keyframeGuided", "首尾帧"),
		video_edit: t("messageHistory.videoInputModes.videoEdit", "视频编辑"),
		draft_task: t("messageHistory.videoInputModes.draftTask", "样片成片"),
	}
	return labels[inputMode] || inputMode
}

function getFiniteNumber(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null
	return value
}

function formatCompactNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function formatDurationText(totalSeconds: number): string {
	const safeSeconds = Math.max(0, Math.floor(totalSeconds))
	const days = Math.floor(safeSeconds / 86400)
	const hours = Math.floor((safeSeconds % 86400) / 3600)
	const minutes = Math.floor((safeSeconds % 3600) / 60)
	const seconds = safeSeconds % 60
	const parts: string[] = []
	if (days > 0) parts.push(`${days}天`)
	if (hours > 0) parts.push(`${hours}小时`)
	if (minutes > 0) parts.push(`${minutes}分`)
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`)
	return parts.join("")
}

function diffDateTimeSeconds(startedAt?: string | null, finishedAt?: string | null): number | null {
	const startedAtMs = parseDateTimeToMs(startedAt)
	const finishedAtMs = parseDateTimeToMs(finishedAt)
	if (startedAtMs === null || finishedAtMs === null) return null
	return Math.max(0, Math.floor((finishedAtMs - startedAtMs) / 1000))
}

function formatDateTimeText(value?: string | null): string {
	const timestamp = parseDateTimeToMs(value)
	if (timestamp === null) return value?.trim() ?? ""
	return formatDateFromMs(timestamp)
}

function parseDateTimeToMs(value?: string | null): number | null {
	if (!value) return null
	const trimmed = value.trim()
	if (!trimmed) return null
	const matched = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|T)(\d{2}):(\d{2}):(\d{2})/)
	if (matched) {
		const [, year, month, day, hour, minute, second] = matched
		return new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second),
		).getTime()
	}
	const timestamp = Date.parse(trimmed)
	return Number.isFinite(timestamp) ? timestamp : null
}

function formatDateFromMs(timestamp: number): string {
	const date = new Date(timestamp)
	const pad = (value: number) => String(value).padStart(2, "0")
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
