import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useLocation, useParams } from "react-router"
import { SuperMagicApi } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { findAudioEntryFile } from "./utils/find-audio-entry-file"
import { AudioRecordingsStore } from "./stores/audio-recordings-store"

interface AudioRecordingDetailLocationState {
	projectName?: string
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
	const [entryMissing, setEntryMissing] = useState(false)
	const [resolvedTitle, setResolvedTitle] = useState<string>("")

	const locationState = location.state as AudioRecordingDetailLocationState | null
	const initialTitle = locationState?.projectName?.trim() ?? ""

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
		setEntryMissing(false)

		SuperMagicApi.getAttachmentsByProjectId({ projectId, temporaryToken: "" })
			.then((response) => {
				if (cancelled) return

				const processed = AttachmentDataProcessor.processAttachmentData(response)
				setAttachments(processed.tree)
				setAttachmentList(processed.list)

				const audioEntry = findAudioEntryFile(processed.tree)
				if (!audioEntry) {
					setEntryMissing(true)
					return
				}

				window.setTimeout(() => {
					detailRef.current?.openFileTab?.(audioEntry)
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
	}, [projectId])

	const pageTitle = useMemo(() => {
		return resolvedTitle || t("detail.untitled")
	}, [resolvedTitle, t])

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

			<div className="relative min-h-0 flex-1 bg-muted">
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

				{!loading && !loadError && entryMissing ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
						<p className="text-sm text-muted-foreground">{t("detail.entryNotFound")}</p>
						<Button variant="outline" onClick={handleBack}>
							{t("detail.back")}
						</Button>
					</div>
				) : null}

				{!loading && !loadError && !entryMissing ? (
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
