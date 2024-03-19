import { EditorContent, type Editor } from "@tiptap/react"
import FlexBox from "@/opensource/components/base/FlexBox"
import DragOverlay from "./components/DragOverlay"
import { memo } from "react"
import type { RefObject, DragEvent, ClipboardEvent, MouseEvent, ReactNode } from "react"
import type { MessageEditorSize } from "./types"
import TabIcon from "./assets/tab.svg"
import { cn } from "@/opensource/lib/utils"
import {
	messageEditorContainerVariants,
	messageEditorInnerVariants,
	messageEditorContentVariants,
	messageEditorToolbarVariants,
	messageEditorToolbarLeftVariants,
	messageEditorToolbarRightVariants,
	messageEditorTextContainerVariants,
} from "./variants"
import AiCompletionTip from "@/opensource/pages/chatNew/components/MessageEditor/components/AiCompletionTip"
import { SummaryGuideDOMId } from "@/opensource/pages/superMagic/components/MessagePanel/components/TopicExamples/SummaryGuide"
import { GuideTourElementId } from "@/opensource/pages/superMagic/components/LazyGuideTour"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { createPortal } from "react-dom"
import usePortalTarget from "@/opensource/hooks/usePortalTarget"
import { SCENE_INPUT_IDS } from "../MainInputContainer/constants"

interface MessageEditorViewProps {
	className?: string
	containerClassName?: string
	size: MessageEditorSize
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
	onClick: (e: MouseEvent) => void
	topBarLeftContent?: ReactNode
	topBarRightContent?: ReactNode
	bottomLeftContent?: ReactNode
	bottomRightContent?: ReactNode
	outsideBottomContent?: ReactNode
	outsideTopContent?: ReactNode
	uploadModal?: ReactNode
	taskDataNode?: ReactNode
	messageQueueNode?: ReactNode
	showAiCompletion: boolean
}

function MessageEditorView({
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
	onClick,
	topBarLeftContent,
	topBarRightContent,
	bottomLeftContent,
	bottomRightContent,
	outsideBottomContent,
	outsideTopContent,
	uploadModal,
	showAiCompletion,
}: MessageEditorViewProps) {
	const isMobile = useIsMobile()

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
					)}
					onDragEnter={dragEvents.onDragEnter}
					onDragLeave={dragEvents.onDragLeave}
					onDragOver={dragEvents.onDragOver}
					onDrop={dragEvents.onDrop}
					onPaste={onPaste}
					data-testid="super-message-editor-container"
				>
					<FlexBox
						vertical
						className={cn(messageEditorInnerVariants({ size }))}
						data-testid="super-message-editor-inner"
					>
						{(topBarLeftContent || topBarRightContent) && (
							<div
								className="relative [&:empty]:hidden"
								data-testid="super-message-editor-header"
							>
								{topBarLeftContent}
								{topBarRightContent && (
									<div className="absolute right-0 top-0">
										{topBarRightContent}
									</div>
								)}
							</div>
						)}
						<div className={cn(messageEditorTextContainerVariants({ size }))}>
							<EditorContent
								ref={domRef}
								editor={tiptapEditor}
								className={cn(messageEditorContentVariants({ size }), className)}
								onCompositionStart={onCompositionStart}
								onCompositionEnd={onCompositionEnd}
								onClick={onClick}
								data-testid="super-message-editor-content"
								id={SummaryGuideDOMId.MessageEditorContent}
							/>
						</div>
						{showAiCompletion && <AiCompletionTip icon={TabIcon as string} />}
						<div
							className={messageEditorToolbarVariants({ size })}
							data-testid="super-message-editor-toolbar"
						>
							<div
								className={messageEditorToolbarLeftVariants({ size })}
								id={GuideTourElementId.ModelSelector}
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
