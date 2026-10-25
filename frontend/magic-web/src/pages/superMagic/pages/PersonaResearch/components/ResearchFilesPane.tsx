import { forwardRef } from "react"
import { observer } from "mobx-react-lite"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import { usePersonaResearchStore } from "../context"

interface ResearchFilesPaneProps {
	userSelectDetail: unknown
	/** Latest tool step of the conversation; the playback tab falls back to it. */
	autoDetail: unknown
	setUserSelectDetail: (detail: unknown) => void
	activeFileId: string | null
	onActiveFileChange: (fileId: string | null) => void
	/** Claims contract files opened from links inside a previewed HTML file. */
	onInterceptFile?: (file: unknown) => boolean
}

/**
 * Hosts the standard file preview for the research studio. The HTML report, plan, desk
 * research and any file or tool result clicked in the conversation open here as tabs.
 * Tool steps open in the playback tab, which follows the latest step until one is picked.
 */
const ResearchFilesPane = forwardRef<DetailRef, ResearchFilesPaneProps>(function ResearchFilesPane(
	{
		userSelectDetail,
		autoDetail,
		setUserSelectDetail,
		activeFileId,
		onActiveFileChange,
		onInterceptFile,
	},
	ref,
) {
	const store = usePersonaResearchStore()
	const selectedProject = store.selectedProject
	const selectedTopic = store.selectedTopic
	if (!selectedProject) return null

	return (
		<div className="h-full min-h-0" data-testid="persona-research-files">
			{/* Every study shares one project: keep preview tabs per study, never project-wide. */}
			<Detail
				key={selectedTopic?.id}
				ref={ref}
				// The research store owns a separate files store; pass it so the file manager tab and
				// attachment loading state follow the research project, not the global workspace.
				projectFilesStore={store.projectFilesStore}
				attachmentLoadState={store.projectFilesStore.attachmentLoadState}
				disPlayDetail={userSelectDetail || autoDetail}
				userSelectDetail={userSelectDetail}
				autoDetail={autoDetail}
				setUserSelectDetail={setUserSelectDetail}
				attachments={store.attachments}
				attachmentList={store.attachmentList}
				topicId={selectedTopic?.id}
				baseShareUrl={`${window.location.origin}/share`}
				currentTopicStatus={selectedTopic?.task_status}
				messages={[]}
				allowEdit
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				activeFileId={activeFileId}
				onActiveFileChange={onActiveFileChange}
				projectId={selectedProject.id}
				showFallbackWhenEmpty
				allowDownload
				persistFileTabs={false}
				// The pane sits flush between the file list, the divider and the footer, so the card's
				// default rounded corners would show white notches at the tab bar's top corners.
				className="rounded-none"
				previewSurfaceFrame={{ radius: "0px" }}
				interceptFileOpen={onInterceptFile}
			/>
		</div>
	)
})

export default observer(ResearchFilesPane)
