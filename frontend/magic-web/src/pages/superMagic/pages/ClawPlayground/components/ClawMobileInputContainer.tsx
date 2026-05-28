import { useMemoizedFn } from "ahooks"
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import MobileInputContainer, {
	type MobileInputContainerRef,
} from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import MobileComposerModeSelector from "@/pages/superMagicMobile/pages/ChatPage/components/mobile-composer/MobileComposerModeSelector"
import { ClawPlaygroundInputToolbar } from "./ClawPlaygroundInputToolbar"

export interface ClawMobileInputContainerRef {
	closeRealInput: () => void
}

interface ClawMobileInputContainerProps {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
	isTaskRunning?: boolean
	onNewChat: () => void
	onOpenFilesDrawer: () => void
	onOpenSkillsDrawer: () => void
}

const ClawMobileInputContainer = forwardRef<
	ClawMobileInputContainerRef,
	ClawMobileInputContainerProps
>(function ClawMobileInputContainer(
	{
		editorContext,
		editorNodes,
		isTaskRunning = false,
		onNewChat,
		onOpenFilesDrawer,
		onOpenSkillsDrawer,
	},
	ref,
) {
	const toolbarTaskRunning =
		isTaskRunning ?? editorContext.isTaskRunning ?? editorContext.showLoading ?? false
	const mobileInputContainerRef = useRef<MobileInputContainerRef>(null)

	type SendSuccessParams = Parameters<NonNullable<SceneEditorContext["onSendSuccess"]>>[0]
	const handleSendSuccess = useMemoizedFn((params: SendSuccessParams) => {
		mobileInputContainerRef.current?.closeRealInput()
		editorContext.onSendSuccess?.(params)
	})

	const closeRealInput = useMemoizedFn(() => {
		mobileInputContainerRef.current?.closeRealInput()
	})

	useImperativeHandle(ref, () => ({ closeRealInput }), [closeRealInput])

	const mobileEditorContext = useMemo<SceneEditorContext>(
		() => ({
			...editorContext,
			mobileModeSelectorVariant: "claw",
			onSendSuccess: handleSendSuccess,
		}),
		[editorContext, handleSendSuccess],
	)

	return (
		<div
			className="flex w-full flex-col bg-mobile-background pt-2"
			data-testid="claw-mobile-input-section"
		>
			<ClawPlaygroundInputToolbar
				variant="mobile"
				isTaskRunning={toolbarTaskRunning}
				leadingContent={
					<MobileComposerModeSelector
						selectedTopic={mobileEditorContext.selectedTopic}
						selectedProject={mobileEditorContext.selectedProject}
						topicMode={mobileEditorContext.topicMode}
						agentCode={mobileEditorContext.agentCode}
						selectorVariant="claw"
						topicModelStore={mobileEditorContext.topicModelStore}
						messagesLength={mobileEditorContext.messagesLength}
						onModeChange={mobileEditorContext.setTopicMode}
					/>
				}
				onNewChat={onNewChat}
				onOpenFiles={onOpenFilesDrawer}
				onOpenSkills={onOpenSkillsDrawer}
			/>

			<MobileInputContainer
				ref={mobileInputContainerRef}
				editorContext={mobileEditorContext}
				editorNodes={editorNodes}
			/>
		</div>
	)
})

export default ClawMobileInputContainer
