import type { Editor } from "@tiptap/react"
import type { ReactNode } from "react"
import type { MessageEditorStore } from "../stores"
import { MessageEditorStoreProvider } from "../stores"
import { MessageEditorView } from "../MessageEditorView"
import type { MessageEditorSize } from "../types"

interface MessageEditorContainerViewProps {
	parentStore: MessageEditorStore | null
	store: MessageEditorStore
	className?: string
	containerClassName?: string
	size: MessageEditorSize
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
	showAiCompletion: boolean
}

export default function MessageEditorContainerView({
	parentStore,
	store,
	className,
	containerClassName,
	size,
	tiptapEditor,
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
	showAiCompletion,
}: MessageEditorContainerViewProps) {
	const editorView = (
		<MessageEditorView
			className={className}
			containerClassName={containerClassName}
			size={size}
			tiptapEditor={tiptapEditor}
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
			showAiCompletion={showAiCompletion}
		/>
	)

	if (parentStore) {
		return editorView
	}

	return <MessageEditorStoreProvider store={store}>{editorView}</MessageEditorStoreProvider>
}
