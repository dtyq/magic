import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react"
import {
	type SceneEditorContext,
	type SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import {
	SceneStateProvider,
	sceneStateStore as globalSceneStateStore,
	useOptionalSceneStateStore,
} from "@/pages/superMagic/components/MainInputContainer/stores"
import { ScenePanelVariant } from "@/pages/superMagic/components/MainInputContainer/components/LazyScenePanel/types"
import type { SceneItem } from "@/pages/superMagic/types/skill"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import MobileComposer from "../mobile-composer/MobileComposer"
import {
	applyTaskHomeRecordingEditorContext,
	shouldShowMobileHomeRecordStart,
} from "../mobile-composer/shouldShowMobileHomeRecordStart"
import useMobileEditorType from "../mobile-composer/useMobileEditorType"
import MobileRecordSummaryRoute from "../record-summary/MobileRecordSummaryRoute"
import { clearMobileSceneSelectionOnSendSuccess } from "./sceneSelection"

export interface MobileInputContainerRef {
	closeRealInput: () => void
}

interface MobileInputContainerProps {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
	enableReEditMessageFromPubSub?: boolean
}

function MobileInputRouteRenderer({
	editorContext,
	editorNodes,
	scenes,
	enableReEditMessageFromPubSub,
}: {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
	scenes?: SceneItem[]
	enableReEditMessageFromPubSub?: boolean
}) {
	const { isRecordSummaryEditor } = useMobileEditorType({
		editorContext,
	})

	// Project and topic pages already use this panel. The task homepage uses it too,
	// so recording starts in the selected workspace instead of the text composer.
	const showSharedRecordingExpert =
		isRecordSummaryEditor &&
		(!editorContext.deferProjectCreationUntilSend ||
			shouldShowMobileHomeRecordStart({
				deferProjectCreationUntilSend: editorContext.deferProjectCreationUntilSend,
				showModeToggle: editorContext.showModeToggle,
				isRecordSummaryEditor,
			}))

	// Resolve the task-homepage recording overrides here, once. The route stays a pure
	// presenter, so it can never re-decide which context the recording panel receives.
	const recordingEditorContext = useMemo(
		() => applyTaskHomeRecordingEditorContext(editorContext, isRecordSummaryEditor),
		[editorContext, isRecordSummaryEditor],
	)

	if (showSharedRecordingExpert) {
		return (
			<MobileRecordSummaryRoute
				editorContext={recordingEditorContext}
				editorNodes={editorNodes}
				scenes={scenes}
			/>
		)
	}

	return (
		<MobileComposer
			editorContext={editorContext}
			editorNodes={editorNodes}
			scenes={scenes}
			enableReEditMessageFromPubSub={enableReEditMessageFromPubSub}
		/>
	)
}

type SendSuccessParams = Parameters<NonNullable<SceneEditorContext["onSendSuccess"]>>[0]

const MobileInputContainer = observer(
	forwardRef<MobileInputContainerRef, MobileInputContainerProps>(function MobileInputContainer(
		{ editorContext, editorNodes, enableReEditMessageFromPubSub },
		ref,
	) {
		const sceneStateStore = useOptionalSceneStateStore() ?? globalSceneStateStore
		const scenes = useMemo(
			() =>
				superMagicModeService.getModeConfigWithLegacy(
					editorContext.topicMode,
					undefined,
					false,
					editorContext.agentCode ?? editorContext.selectedTopic?.agent_code,
				)?.mode.playbooks,
			[
				editorContext.agentCode,
				editorContext.selectedTopic?.agent_code,
				editorContext.topicMode,
			],
		)

		useEffect(() => {
			const currentScene = sceneStateStore.currentScene
			if (!currentScene || !scenes) return

			const isSceneValid = scenes.some((scene) => scene.id === currentScene.id)
			if (!isSceneValid) sceneStateStore.setCurrentScene(null)
		}, [editorContext.topicMode, scenes, sceneStateStore])

		const handleCloseRealInput = useMemoizedFn(() => {
			if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
		})

		const handleSendSuccess = useMemoizedFn((params: SendSuccessParams) => {
			// Clear the one-time scene choice before switching topics so the next mobile chat starts fresh.
			clearMobileSceneSelectionOnSendSuccess(sceneStateStore)
			handleCloseRealInput()
			editorContext.onSendSuccess?.(params)
		})

		useImperativeHandle(
			ref,
			() => ({
				closeRealInput: handleCloseRealInput,
			}),
			[handleCloseRealInput],
		)

		const mobileEditorContext = useMemo<SceneEditorContext>(
			() => ({
				...editorContext,
				autoFocus: false,
				size: "mobile",
				onSendSuccess: handleSendSuccess,
			}),
			[editorContext, handleSendSuccess],
		)

		return (
			<SceneStateProvider store={sceneStateStore} variant={ScenePanelVariant.Mobile}>
				<MobileInputRouteRenderer
					editorContext={mobileEditorContext}
					editorNodes={editorNodes}
					scenes={scenes}
					enableReEditMessageFromPubSub={enableReEditMessageFromPubSub}
				/>
			</SceneStateProvider>
		)
	}),
)

export default MobileInputContainer
