import MagicPopup from "@/components/base-mobile/MagicPopup"
import BottomInputBar from "@/pages/superMagicMobile/pages/ChatPage/components/BottomInputBar"
import { useMemoizedFn } from "ahooks"
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { JSONContent } from "@tiptap/core"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { Button } from "@/components/shadcn-ui/button"
import { Files } from "lucide-react"
import { Skills } from "@/enhance/lucide-react"
import { useTranslation } from "react-i18next"

const MODES_WITHOUT_AUTO_FOCUS = new Set<TopicMode>([TopicMode.RecordSummary])

export interface ClawMobileInputContainerRef {
	closeRealInput: () => void
}

interface ClawMobileInputContainerProps {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
	onOpenFilesDrawer: () => void
	onOpenSkillsDrawer: () => void
}

const ClawMobileInputContainer = forwardRef<
	ClawMobileInputContainerRef,
	ClawMobileInputContainerProps
>(function ClawMobileInputContainer(
	{ editorContext, editorNodes, onOpenFilesDrawer, onOpenSkillsDrawer },
	ref,
) {
	const { t: tSuper } = useTranslation("super")
	const { t: tSidebar } = useTranslation("sidebar")
	const [showRealInput, setShowRealInput] = useState(false)
	const [isRealInputFocused, setIsRealInputFocused] = useState(false)
	const [pendingContent, setPendingContent] = useState<JSONContent | null>(null)
	const [sharedContent, setSharedContent] = useState<JSONContent | null>(null)
	const proxyInputRef = useRef<HTMLInputElement>(null)

	const shouldAutoFocus = !MODES_WITHOUT_AUTO_FOCUS.has(editorContext.topicMode)

	const handleOpenRealInput = useMemoizedFn((content: JSONContent | null) => {
		if (shouldAutoFocus) proxyInputRef.current?.focus()
		setPendingContent(content)
		setShowRealInput(true)
	})

	const handleContentChange = useMemoizedFn((content: JSONContent) => {
		setSharedContent(content)
	})

	type SendSuccessParams = Parameters<NonNullable<SceneEditorContext["onSendSuccess"]>>[0]
	const handleSendSuccess = useMemoizedFn((params: SendSuccessParams) => {
		closeRealInput()
		editorContext.onSendSuccess?.(params)
	})

	const handleEditorFocus = useMemoizedFn(() => {
		setIsRealInputFocused(true)
	})

	const handleEditorBlur = useMemoizedFn(() => {
		setIsRealInputFocused(false)
	})

	const closeRealInput = useMemoizedFn(() => {
		setShowRealInput(false)
		setIsRealInputFocused(false)
		setPendingContent(null)
	})

	useImperativeHandle(ref, () => ({ closeRealInput }), [closeRealInput])

	const mobileEditorContext = useMemo<SceneEditorContext>(
		() => ({
			...editorContext,
			autoFocus: shouldAutoFocus,
			size: "mobile",
			initialContent: pendingContent ?? undefined,
			onContentChange: handleContentChange,
			onEditorFocus: handleEditorFocus,
			onEditorBlur: handleEditorBlur,
			onSendSuccess: handleSendSuccess,
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[editorContext, pendingContent],
	)

	return (
		<>
			<input
				ref={proxyInputRef}
				aria-hidden="true"
				tabIndex={-1}
				className="pointer-events-none absolute opacity-0"
				style={{ top: -9999, left: -9999, width: 1, height: 1 }}
			/>

			<div
				className="flex w-full flex-col gap-2 bg-sidebar pb-1.5 pt-2"
				data-testid="claw-mobile-input-section"
			>
				<div className="flex gap-2 px-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 gap-1 rounded-full border-input px-2.5 text-xs font-normal"
						data-testid="claw-mobile-input-files-pill"
						onClick={onOpenFilesDrawer}
					>
						<Files className="size-4 shrink-0" aria-hidden />
						{tSuper("chatActions.projectFiles")}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 gap-1 rounded-full border-input px-2.5 text-xs font-normal"
						data-testid="claw-mobile-input-skills-pill"
						onClick={onOpenSkillsDrawer}
					>
						<Skills className="size-4 shrink-0" aria-hidden />
						{tSidebar("skillsLibrary.title")}
					</Button>
				</div>

				<BottomInputBar
					show={!showRealInput}
					onInputClick={handleOpenRealInput}
					syncContent={sharedContent}
					editorNodes={editorNodes}
					showModeSelector={false}
					isTaskRunning={
						editorContext.isTaskRunning ?? editorContext.showLoading ?? false
					}
					stopEventLoading={editorContext.stopEventLoading ?? false}
					onInterrupt={editorContext.handleInterrupt}
				/>
			</div>

			<MagicPopup
				overlayClassName="backdrop-blur-sm ![animation-name:none]"
				visible={showRealInput}
				onClose={closeRealInput}
				handlerClassName="!hidden"
				withSafeBottom={!isRealInputFocused}
			>
				<DefaultMessageEditorContainer editorContext={mobileEditorContext} />
			</MagicPopup>
		</>
	)
})

export default ClawMobileInputContainer
