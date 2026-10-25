import { useEffect, useRef, useState } from "react"
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
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { usePersonaResearchStore } from "../context"
import MarkdownFilePane from "../components/MarkdownFilePane"
import { attachmentVersionKey, getAttachmentPath } from "../services/researchFiles"

/**
 * Read-only document view for the share page: the HTML report in the standard file preview,
 * Markdown documents (plan, desk research, questionnaire) as formatted text.
 */
function ShareDocumentPane({ file }: { file: AttachmentItem | null }) {
	const { t } = useTranslation("personaResearch")
	if (!file) {
		return (
			<Empty className="h-full border-0 py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileText />
					</EmptyMedia>
					<EmptyTitle className="text-sm">{t("share.noDocumentTitle")}</EmptyTitle>
					<EmptyDescription className="text-xs">{t("share.noDocument")}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}
	if (getAttachmentPath(file).endsWith(".html")) return <HtmlDocument file={file} />
	return (
		<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
			<div className="mx-auto max-w-3xl p-5 text-sm">
				<MarkdownFilePane file={file} copyable />
			</div>
		</ScrollArea>
	)
}

/**
 * The report opens in the same file preview the topic share uses, so its runtime (scripts,
 * styles, citations) behaves exactly as in the app; the share page provides the file access.
 */
const HtmlDocument = observer(function HtmlDocument({ file }: { file: AttachmentItem }) {
	const store = usePersonaResearchStore()
	const detailRef = useRef<DetailRef>(null)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const versionKey = attachmentVersionKey(file)

	useEffect(() => {
		// Wait one frame so the preview has mounted before a tab is opened in it.
		const timer = setTimeout(() => detailRef.current?.openFileTab?.(file), 100)
		return () => clearTimeout(timer)
		// versionKey covers file_id and rewrites.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [versionKey])

	return (
		<div className="h-full min-h-0">
			<Detail
				ref={detailRef}
				disPlayDetail={userSelectDetail}
				userSelectDetail={userSelectDetail}
				setUserSelectDetail={setUserSelectDetail}
				attachments={store.attachments}
				attachmentList={store.attachmentList}
				topicId={store.selectedTopic?.id}
				currentTopicStatus={TaskStatus.FINISHED}
				messages={[]}
				showPlaybackControl={false}
				projectId={store.selectedProject?.id}
				selectedProject={store.selectedProject}
				allowDownload={false}
				// Read as a document, like the in-app report pane: no file tabs or preview toolbar.
				hideTabBar
				showFileHeader={false}
			/>
		</div>
	)
})

export default observer(ShareDocumentPane)
