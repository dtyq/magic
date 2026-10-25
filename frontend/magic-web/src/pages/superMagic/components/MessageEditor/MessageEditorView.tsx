import MentionContextMenu from "./components/MentionContextMenu"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { EditorContent, type Editor } from "@/infrastructure/editors/tiptap/react"
import FlexBox from "@/components/base/FlexBox"
import DragOverlay from "./components/DragOverlay"
import { memo } from "react"
import type { RefObject, DragEvent, ClipboardEvent, ReactNode } from "react"
import type { MessageEditorSize } from "./types"
import TabIcon from "./assets/tab.svg"
import { cn } from "@/utils/cn"
import { useEditorPortalSync } from "./hooks/useEditorPortalSync"
import {
	messageEditorContainerVariants,
	messageEditorInnerVariants,
	messageEditorContentVariants,
	messageEditorToolbarVariants,
	messageEditorToolbarLeftVariants,
	messageEditorToolbarRightVariants,
	messageEditorTextContainerVariants,
} from "./variants"
import AiCompletionTip from "@/pages/chatNew/components/MessageEditor/components/AiCompletionTip"
import { SummaryGuideDOMId } from "@/pages/superMagic/components/MessagePanel/components/TopicExamples/SummaryGuide"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface MessageEditorViewProps {
	className?: string
	containerClassName?: string
	headerContent?: ReactNode
	size: MessageEditorSize
	getWorkspaceFilesList?: () => AttachmentItem[]
	getCurrentProjectId?: () => string | undefined
	tiptapEditor: Editor | null
	domRef: RefObject<HTMLDivElement>
	isDragOver: boolean
	dragEvents: {
		onDragEnter: (e: DragEvent) => void
		onDragLeave: (e: DragEvent) => void
		onDragOver: (e: DragEvent) => void
		onDrop: (e: DragEvent) => void
	}
	onPaste: (e: ClipboardEvent) => void
	onCompositionStart: () => void
	onCompositionEnd: () => void
	topBarLeftContent?: ReactNode
	topBarRightContent?: ReactNode
	bottomLeftContent?: ReactNode
	bottomRightContent?: ReactNode
	outsideBottomContent?: ReactNode
	outsideTopContent?: ReactNode
	uploadModal?: ReactNode
	promptCarouselNode?: ReactNode
	taskDataNode?: ReactNode
	messageQueueNode?: ReactNode
	showAiCompletion: boolean
	previewActiveId?: string | null
	wechatScrollRef?: RefObject<HTMLDivElement>
}

function MessageEditorView({
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
	previewActiveId,
	wechatScrollRef,
}: MessageEditorViewProps) {
	const isMobile = useIsMobile()

	// Fix: ensure EditorContent re-renders when editor.contentComponent changes
	// (works around tiptap PureEditorContent stale portal reference bug)
	useEditorPortalSync(tiptapEditor)

	return (
		<>
			<FlexBox vertical className="h-full gap-2">
				{outsideTopContent}
				<div
					className={cn(
						messageEditorContainerVariants({
							size,
							focused: tiptapEditor?.isFocused ?? false,
							mobile: isMobile,
						}),
						containerClassName,
						previewActiveId && "h-full max-h-none min-h-0",
					)}
					onDragEnter={dragEvents.onDragEnter}
					onDragLeave={dragEvents.onDragLeave}
					onDragOver={dragEvents.onDragOver}
					onDrop={dragEvents.onDrop}
					onPasteCapture={onPaste}
					data-testid="super-message-editor-container"
					data-queue-editor-surface
					data-guide-anchor="message-editor-container"
				>
					<FlexBox
						vertical
						className={cn(messageEditorInnerVariants({ size }))}
						data-testid="super-message-editor-inner"
					>
						{(topBarLeftContent || topBarRightContent || headerContent) && (
							<div
								className="flex shrink-0 items-center gap-2 [&:empty]:hidden"
								data-testid="super-message-editor-header"
							>
								<div className="shrink-0 [&:empty]:hidden">{topBarLeftContent}</div>
								<div className="min-w-0 flex-1 [&:empty]:hidden">
									{headerContent}
								</div>
								{topBarRightContent && (
									<div className="ml-auto shrink-0">{topBarRightContent}</div>
								)}
							</div>
						)}
						<div
							className={cn(messageEditorTextContainerVariants({ size }))}
							data-guide-anchor="message-editor-content"
						>
							<MentionContextMenu
								editor={tiptapEditor}
								getWorkspaceFilesList={getWorkspaceFilesList}
								getCurrentProjectId={getCurrentProjectId}
							>
								{/*
								 * The scroll box is built out of flex, not out of percentages, and that is the
								 * whole point of the classes below.
								 *
								 * The viewport used to take `height: 100%` and the Radix content layer
								 * `min-height: 100%`. A percentage only resolves when every box above it has a
								 * definite height, and this composer does not have one: it grows with its
								 * content up to a `max-h`, and the host that renders it may give it no height
								 * at all (`absolute` with only `top` — the home page's centred state). Every
								 * ancestor is then `auto`, the percentages fall back to `auto`, the viewport
								 * grows to the height of the whole document instead of the box, and the text
								 * that overflows is clipped by the composer's `overflow: hidden` — visible,
								 * but impossible to scroll.
								 *
								 * Sized by flex instead, the viewport fills the box and is allowed to shrink
								 * below its content, while the Radix content layer below it does the
								 * opposite — it takes the content's height and never shrinks. Short content
								 * still fills the click area (the viewport grows); long content overflows and
								 * scrolls (the layer does not shrink).
								 */}
								<ScrollArea
									className="flex min-h-0 flex-1 flex-col"
									viewportRef={wechatScrollRef}
									viewportClassName="flex min-h-0 shrink basis-auto grow flex-col !h-auto [&>div]:!flex [&>div]:shrink-0 [&>div]:basis-auto [&>div]:grow [&>div]:flex-col"
								>
									<EditorContent
										ref={domRef}
										editor={tiptapEditor}
										className={cn(
											messageEditorContentVariants({ size }),
											"flex h-auto flex-col overflow-visible [&_.ProseMirror]:h-auto [&_.ProseMirror]:flex-1",
											className,
											previewActiveId && "[&_.ProseMirror>p]:hidden",
										)}
										onCompositionStart={onCompositionStart}
										onCompositionEnd={onCompositionEnd}
										data-testid="super-message-editor-content"
										id={SummaryGuideDOMId.MessageEditorContent}
									/>
								</ScrollArea>
							</MentionContextMenu>
							{promptCarouselNode}
						</div>
						{showAiCompletion && <AiCompletionTip icon={TabIcon as string} />}
						<div
							className={messageEditorToolbarVariants({ size })}
							data-testid="super-message-editor-toolbar"
							data-guide-anchor="message-editor-toolbar"
						>
							<div
								className={messageEditorToolbarLeftVariants({ size })}
								data-testid="super-message-editor-toolbar-left"
							>
								{bottomLeftContent}
							</div>
							<div
								className={messageEditorToolbarRightVariants({ size })}
								data-testid="super-message-editor-toolbar-right"
							>
								{bottomRightContent}
							</div>
						</div>
					</FlexBox>
					<DragOverlay visible={isDragOver} />
				</div>
				{uploadModal}
			</FlexBox>
			{outsideBottomContent}
		</>
	)
}

const MemoizedMessageEditorView = memo(MessageEditorView)

export { MemoizedMessageEditorView as MessageEditorView }
