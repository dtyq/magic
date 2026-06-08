import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useLocation, useParams } from "react-router"
import { SuperMagicApi } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { AudioRecordingCardStatus } from "@/types/audioProject"
import {
	resolveAudioPreviewTarget,
	resolveAudioPreviewTargetWithFallback,
	type AudioPreviewMissingKind,
	type AudioPreviewTarget,
} from "./utils/resolve-audio-preview-target"
import { AudioRecordingsStore } from "./stores/audio-recordings-store"

interface AudioRecordingDetailLocationState {
	projectName?: string
	cardStatus?: AudioRecordingCardStatus
	audioFileId?: string
}

/** Full-width audio HTML detail page without project file tree sidebar */
function AudioRecordingDetailPage() {
	const { t } = useTranslation("audioRecordings")
	const navigate = useNavigate()
	const location = useLocation()
	const { projectId = "" } = useParams<{ projectId: string }>()
	const detailRef = useRef<DetailRef>(null)
	const storeRef = useRef(new AudioRecordingsStore())

	const [attachments, setAttachments] = useState<AttachmentItem[]>([])
	const [attachmentList, setAttachmentList] = useState<AttachmentItem[]>([])
	const [loading, setLoading] = useState(true)
	const [loadError, setLoadError] = useState(false)
	const [previewMissingKind, setPreviewMissingKind] = useState<AudioPreviewMissingKind | null>(
		null,
	)
	const [previewKind, setPreviewKind] = useState<AudioPreviewTarget["kind"] | null>(null)
	const [resolvedTitle, setResolvedTitle] = useState<string>("")

	const locationState = location.state as AudioRecordingDetailLocationState | null
	const initialTitle = locationState?.projectName?.trim() ?? ""
	const routeCardStatus = locationState?.cardStatus
	const routeAudioFileId = locationState?.audioFileId?.trim()

	useEffect(() => {
		if (initialTitle) {
			setResolvedTitle(initialTitle)
			return
		}

		if (!projectId) return

		void storeRef.current.fetchProjectName(projectId).then((name) => {
			if (name) setResolvedTitle(name)
		})
	}, [initialTitle, projectId])

	useEffect(() => {
		if (!projectId) {
			setLoading(false)
			setLoadError(true)
			return
		}

		let cancelled = false
		setLoading(true)
		setLoadError(false)
		setPreviewMissingKind(null)
		setPreviewKind(null)

		SuperMagicApi.getAttachmentsByProjectId({ projectId, temporaryToken: "" })
			.then((response) => {
				if (cancelled) return

				const processed = AttachmentDataProcessor.processAttachmentData(response)
				setAttachments(processed.tree)
				setAttachmentList(processed.list)

				const previewResult = routeCardStatus
					? {
							target: resolveAudioPreviewTarget({
								cardStatus: routeCardStatus,
								audioFileId: routeAudioFileId,
								tree: processed.tree,
								list: processed.list,
							}),
							missingKind: null as AudioPreviewMissingKind | null,
						}
					: resolveAudioPreviewTargetWithFallback({
							audioFileId: routeAudioFileId,
							tree: processed.tree,
							list: processed.list,
						})

				if (!previewResult.target) {
					const expectsRawAudio =
						routeCardStatus === "not_summarized" || routeCardStatus === "summarizing"
					setPreviewMissingKind(
						previewResult.missingKind ?? (expectsRawAudio ? "raw-audio" : "html-entry"),
					)
					return
				}

				setPreviewKind(previewResult.target.kind)

				window.setTimeout(() => {
					detailRef.current?.openFileTab?.(previewResult.target?.file)
				}, 100)
			})
			.catch(() => {
				if (cancelled) return
				setLoadError(true)
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [projectId, routeCardStatus, routeAudioFileId])

	const previewMissingMessage = useMemo(() => {
		if (previewMissingKind === "raw-audio") return t("detail.audioNotFound")
		return t("detail.entryNotFound")
	}, [previewMissingKind, t])

	const pageTitle = useMemo(() => {
		return resolvedTitle || t("detail.untitled")
	}, [resolvedTitle, t])

	/** Raw audio preview uses a white canvas to match AudioPreview; HTML summary keeps muted shell */
	const isRawAudioPreviewMode =
		previewKind === "raw-audio" ||
		routeCardStatus === "not_summarized" ||
		routeCardStatus === "summarizing" ||
		previewMissingKind === "raw-audio"

	function handleBack() {
		navigate({ name: RouteName.AudioRecordings })
	}

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
			data-testid="audio-recording-detail-page"
		>
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBack}
					data-testid="audio-recording-detail-back"
				>
					<ChevronLeft className="h-4 w-4" />
					{t("detail.back")}
				</Button>
				<h1 className="truncate text-sm font-semibold text-foreground">{pageTitle}</h1>
			</div>

			<div
				className={cn(
					"relative min-h-0 flex-1",
					isRawAudioPreviewMode ? "bg-white" : "bg-muted",
				)}
			>
				{loading ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						{t("detail.loading")}
					</div>
				) : null}

				{!loading && loadError ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
						<p className="text-sm text-muted-foreground">{t("detail.loadFailed")}</p>
						<Button variant="outline" onClick={handleBack}>
							{t("detail.back")}
						</Button>
					</div>
				) : null}

				{!loading && !loadError && previewMissingKind ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
						<p className="text-sm text-muted-foreground">{previewMissingMessage}</p>
						<Button variant="outline" onClick={handleBack}>
							{t("detail.back")}
						</Button>
					</div>
				) : null}

				{!loading && !loadError && !previewMissingKind ? (
					<Detail
						ref={detailRef}
						disPlayDetail={null}
						attachments={attachments}
						attachmentList={attachmentList}
						projectId={projectId}
						allowEdit={false}
						showPlaybackControl={false}
						showFallbackWhenEmpty={false}
						showFileHeader={false}
						hideTabBar
						showFileFooter={false}
					/>
				) : null}
			</div>
		</div>
	)
}

export default observer(AudioRecordingDetailPage)
