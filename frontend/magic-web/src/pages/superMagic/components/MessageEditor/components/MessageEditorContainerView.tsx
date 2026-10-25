import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import type { ReactNode } from "react"
import type { MessageEditorStore } from "../stores"
import { MessageEditorStoreProvider } from "../stores"
import { MessageEditorView } from "../MessageEditorView"
import type { MessageEditorSize } from "../types"
import type { WechatChatImportController } from "../hooks/useWechatChatImport"
import EditorHost from "./WechatChatHistory/EditorHost"
import { useRef } from "react"

interface MessageEditorContainerViewProps {
	parentStore: MessageEditorStore | null
	store: MessageEditorStore
	className?: string
	containerClassName?: string
	headerContent?: ReactNode
	size: MessageEditorSize
	getWorkspaceFilesList?: () => AttachmentItem[]
	getCurrentProjectId?: () => string | undefined
	tiptapEditor: Editor | null
	domRef: React.RefObject<HTMLDivElement>
	isDragOver: boolean
	dragEvents: {
		onDragEnter: (e: React.DragEvent) => void
		onDragOver: (e: React.DragEvent) => void
		onDragLeave: (e: React.DragEvent) => void
		onDrop: (e: React.DragEvent) => void
	}
	onPaste: (e: React.ClipboardEvent) => void
	onCompositionStart: () => void
	onCompositionEnd: () => void
	topBarLeftContent: ReactNode
	topBarRightContent: ReactNode
	bottomLeftContent: ReactNode
	bottomRightContent: ReactNode
	outsideBottomContent: ReactNode
	outsideTopContent: ReactNode
	uploadModal: ReactNode
	promptCarouselNode: ReactNode
	showAiCompletion: boolean
	wechatChat: WechatChatImportController
}

export default function MessageEditorContainerView({
	parentStore,
	store,
	className,
	containerClassName,
	headerContent,
	size,
	tiptapEditor,
	getWorkspaceFilesList,
	getCurrentProjectId,
	domRef,
	isDragOver,
	dragEvents,
	onPaste,
	onCompositionStart,
	onCompositionEnd,
	topBarLeftContent,
	topBarRightContent,
	bottomLeftContent,
	bottomRightContent,
	outsideBottomContent,
	outsideTopContent,
	uploadModal,
	promptCarouselNode,
	showAiCompletion,
	wechatChat,
}: MessageEditorContainerViewProps) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const editorView = (
		<EditorHost
			editor={tiptapEditor}
			controller={wechatChat}
			fileUploadStore={store.fileUploadStore}
			scrollRef={scrollRef}
		>
			<MessageEditorView
				className={className}
				containerClassName={containerClassName}
				headerContent={headerContent}
				size={size}
				tiptapEditor={tiptapEditor}
				getWorkspaceFilesList={getWorkspaceFilesList}
				getCurrentProjectId={getCurrentProjectId}
				domRef={domRef}
				isDragOver={isDragOver}
				dragEvents={dragEvents}
				onPaste={onPaste}
				onCompositionStart={onCompositionStart}
				onCompositionEnd={onCompositionEnd}
				topBarLeftContent={topBarLeftContent}
				topBarRightContent={topBarRightContent}
				bottomLeftContent={bottomLeftContent}
				bottomRightContent={bottomRightContent}
				outsideBottomContent={outsideBottomContent}
				outsideTopContent={outsideTopContent}
				uploadModal={uploadModal}
				promptCarouselNode={promptCarouselNode}
				showAiCompletion={showAiCompletion}
				previewActiveId={wechatChat.activeId}
				wechatScrollRef={scrollRef}
			/>
		</EditorHost>
	)

	if (parentStore) {
		return editorView
	}

	return <MessageEditorStoreProvider store={store}>{editorView}</MessageEditorStoreProvider>
}
