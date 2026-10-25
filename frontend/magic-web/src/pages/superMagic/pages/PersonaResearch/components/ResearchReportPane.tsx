import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { FileText } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import PreviewDetailPopup, {
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import { buildMobileFilePreviewDetail } from "@/pages/superMagicMobile/pages/TopicPage/mobileFilePreview"
import { useIsMobile } from "@/hooks/useIsMobile"
import { usePersonaResearchStore } from "../context"
import { attachmentVersionKey } from "../services/researchFiles"

export interface ResearchReportPaneRef {
	enterFullscreen: () => void
	/** Reloads the report preview from the latest file. */
	refresh: () => void
}

/**
 * The study report on its own: the standard file preview without its tab bar and toolbar, so
 * the report gets the whole panel. Editing and downloading live in the files tab.
 */
const ResearchReportPane = forwardRef<
	ResearchReportPaneRef,
	{ generating: boolean; onInterceptFile?: (file: unknown) => boolean }
>(function ResearchReportPane({ generating, onInterceptFile }, ref) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const isMobile = useIsMobile()
	const detailRef = useRef<DetailRef>(null)
	// Phones render the report in place with the shared mobile preview (as the AI canvas tab does);
	// the desktop preview pane does not draw there and left the tab blank.
	const mobilePreviewRef = useRef<PreviewDetailPopupRef>(null)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [fullscreen, setFullscreen] = useState(false)
	// Bumping it remounts the preview, which refetches the file link and rereads the content.
	const [refreshKey, setRefreshKey] = useState(0)
	const report = store.studyAttachments?.report ?? null
	const versionKey = report ? attachmentVersionKey(report) : ""

	useImperativeHandle(ref, () => ({
		enterFullscreen: () => detailRef.current?.enterPreviewFullscreen(),
		refresh: () => setRefreshKey((key) => key + 1),
	}))

	// Reopen when the agent rewrites the report so the pane never shows a stale version.
	useEffect(() => {
		if (!report) return
		if (isMobile) {
			const detail = buildMobileFilePreviewDetail(report, store.attachmentList)
			if (detail)
				mobilePreviewRef.current?.open(detail, store.attachments, store.attachmentList)
			return
		}
		const timer = setTimeout(() => detailRef.current?.openFileTab?.(report), 100)
		return () => clearTimeout(timer)
		// versionKey covers file_id and rewrites; refreshKey remounts the preview, which must reopen it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [versionKey, refreshKey, isMobile])

	useEffect(() => {
		// Keep the phone preview's file context current without reloading the report.
		mobilePreviewRef.current?.updateAttachments(store.attachments, store.attachmentList)
	}, [store.attachments, store.attachmentList])

	const project = store.selectedProject
	if (!report || !project) {
		return (
			<Empty className="h-full border-0 py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileText />
					</EmptyMedia>
					<EmptyTitle className="text-sm">
						{generating ? t("report.generatingTitle") : t("report.emptyTitle")}
					</EmptyTitle>
					<EmptyDescription className="text-xs">
						{generating ? t("console.reportGenerating") : t("report.empty")}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	if (isMobile) {
		return (
			<div className="h-full min-h-0" data-testid="persona-research-report">
				<PreviewDetailPopup
					key={`${store.selectedTopic?.id}-report-${refreshKey}`}
					ref={mobilePreviewRef}
					inline
					// The toolbar would only repeat the tab bar's actions above.
					showFileHeader={false}
					selectedProject={project}
					selectedTopic={store.selectedTopic}
					allowEdit={false}
					setUserSelectDetail={(detail) => {
						if (detail)
							mobilePreviewRef.current?.open(
								detail,
								store.attachments,
								store.attachmentList,
							)
					}}
				/>
			</div>
		)
	}

	return (
		<div className="h-full min-h-0" data-testid="persona-research-report">
			<Detail
				key={`${store.selectedTopic?.id}-report-${refreshKey}`}
				ref={detailRef}
				projectFilesStore={store.projectFilesStore}
				attachmentLoadState={store.projectFilesStore.attachmentLoadState}
				disPlayDetail={userSelectDetail}
				userSelectDetail={userSelectDetail}
				setUserSelectDetail={setUserSelectDetail}
				attachments={store.attachments}
				attachmentList={store.attachmentList}
				topicId={store.selectedTopic?.id}
				currentTopicStatus={store.selectedTopic?.task_status}
				messages={[]}
				selectedTopic={store.selectedTopic}
				selectedProject={project}
				projectId={project.id}
				allowDownload={false}
				persistFileTabs={false}
				hideTabBar
				// The inline pane hides the file header to give the report room; fullscreen shows it
				// again because it holds the exit-fullscreen control.
				showFileHeader={fullscreen}
				onFullscreenChange={setFullscreen}
				// Links inside the report (voice cards, mentions) open contract files in their own UI
				// instead of replacing the report with raw JSON.
				interceptFileOpen={onInterceptFile}
			/>
		</div>
	)
})

export default observer(ResearchReportPane)
