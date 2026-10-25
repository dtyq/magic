import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import PreviewDetailPopup, {
	type PreviewDetail,
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import { buildMobileFilePreviewDetail } from "@/pages/superMagicMobile/pages/TopicPage/mobileFilePreview"
import KnowledgeBasePreviewPopup from "@/pages/superMagic/components/KnowledgeBasePreviewPopup"
import MicroAppPreviewPopup from "@/pages/superMagic/components/MicroAppPreviewPopup"
import { useMobileFilePreviewPubSub } from "@/pages/superMagic/hooks/useMobileFilePreviewPubSub"
import { useMobileKnowledgeBasePreview } from "@/pages/superMagic/hooks/useMobileKnowledgeBasePreview"
import { useMobileMicroAppPreview } from "@/pages/superMagic/hooks/useMobileMicroAppPreview"
import { usePersonaResearchStore } from "../context"

export interface ResearchMobilePreviewRef {
	/** Opens a study file (attachment item or message metadata) in the preview popup. */
	openFile: (fileItem?: unknown) => void
	/** Opens a ready-made detail, e.g. a tool step picked in the conversation. */
	openDetail: (detail?: unknown) => void
}

interface ResearchMobilePreviewProps {
	/** Claims contract files that have their own UI; returns true when handled. */
	routeFile: (fileItem?: unknown) => boolean
}

/**
 * File previews on phones, wired the way the topic page does it: the shared mobile preview popup
 * (with a second one for links opened from inside a preview), plus the knowledge base and micro
 * app popups, all opened by the same message events. The study's files tab is only a list here,
 * and the desktop preview pane is never mounted, so this is the only host of those events.
 */
const ResearchMobilePreview = forwardRef<ResearchMobilePreviewRef, ResearchMobilePreviewProps>(
	function ResearchMobilePreview({ routeFile }, ref) {
		const store = usePersonaResearchStore()
		const { selectedProject, selectedTopic, attachments, attachmentList } = store
		const previewRef = useRef<PreviewDetailPopupRef>(null)
		const linkPreviewRef = useRef<PreviewDetailPopupRef>(null)

		const openDetail = useMemoizedFn((detail?: unknown) => {
			if (!detail) return
			previewRef.current?.open(detail as PreviewDetail, attachments, attachmentList)
		})

		const openFile = useMemoizedFn((fileItem?: unknown) => {
			if (routeFile(fileItem)) return
			// Open straight from the file metadata; the project tree is merged in when it is there.
			const detail = buildMobileFilePreviewDetail(fileItem, attachmentList)
			if (detail) openDetail(detail)
		})

		useImperativeHandle(ref, () => ({ openFile, openDetail }), [openDetail, openFile])

		useEffect(() => {
			// A file clicked before the project tree arrives is enriched once it does.
			previewRef.current?.updateAttachments(attachments, attachmentList)
		}, [attachments, attachmentList])

		// Message cards publish file / path events instead of calling the host directly.
		useMobileFilePreviewPubSub({
			attachmentList,
			setUserSelectDetail: openDetail,
			onFileClick: openFile,
		})
		const knowledgeBasePreviewState = useMobileKnowledgeBasePreview()
		const microAppPreviewState = useMobileMicroAppPreview()

		return (
			<>
				<PreviewDetailPopup
					ref={previewRef}
					setUserSelectDetail={(detail) => openDetail(detail)}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					allowEdit={!store.isReadOnly}
					onOpenNewPopup={(detail, tree, list) =>
						linkPreviewRef.current?.open(detail, tree, list)
					}
				/>
				{/* A second popup for links opened from inside a preview. */}
				<PreviewDetailPopup
					ref={linkPreviewRef}
					setUserSelectDetail={(detail) => {
						if (detail)
							linkPreviewRef.current?.open(detail, attachments, attachmentList)
					}}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					allowEdit={!store.isReadOnly}
				/>
				<KnowledgeBasePreviewPopup state={knowledgeBasePreviewState} />
				<MicroAppPreviewPopup state={microAppPreviewState} />
			</>
		)
	},
)

export default observer(ResearchMobilePreview)
