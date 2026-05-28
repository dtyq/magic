import { useRef, useEffect } from "react"
import type { TFunction } from "i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { buildAgentPromptContent } from "@/components/business/ElementInspector"
import type { useElementInspector } from "@/components/business/ElementInspector"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { roleStore } from "@/pages/superMagic/stores"

type ElementInspector = ReturnType<typeof useElementInspector>

/** Minimal file info needed to build a project-file @mention in the prompt */
export interface InspectorFileInfo {
	fileId: string
	fileName: string
	filePath: string
}

/**
 * Manages the "toolbar mode" for the element inspector.
 *
 * When activated via `startInToolbarMode()`:
 *  - The inspector runs but the info card is hidden.
 *  - On element selection: creates a new topic then — once navigation is
 *    complete — inserts a pre-filled prompt with a super-placeholder into
 *    the new topic's chat editor.
 */
export function useInspectorToolbarMode(
	elementInspector: ElementInspector,
	t: TFunction<"super">,
	fileInfo?: InspectorFileInfo,
) {
	const inspectorModeRef = useRef<"devConsole" | "toolbar" | "appendToEditor">("devConsole")

	useEffect(() => {
		if (inspectorModeRef.current === "devConsole") return
		if (!elementInspector.selectedElement) return

		const currentMode = inspectorModeRef.current

		elementInspector.clearSelection()
		elementInspector.stop()
		inspectorModeRef.current = "devConsole"

		if (currentMode === "appendToEditor") {
			// Append inspector-detail rich node to the current editor
			const content = buildAgentPromptContent(elementInspector.selectedElement, t, fileInfo)
			pubsub.publish(PubSubEvents.Append_Suggestion_To_Editor, content)
			return
		}

		// toolbar mode — create new topic with rich content
		const content = buildAgentPromptContent(elementInspector.selectedElement, t, fileInfo)

		// In crew/skill/MagiClaw scenarios there's no Create_New_Topic listener;
		// fall back to setting the input message directly in the current editor.
		if (!pubsub.hasListeners(PubSubEvents.Create_New_Topic)) {
			pubsub.publish(PubSubEvents.Set_Input_Message, content)
			return
		}

		// Only specify General mode if it's available in the current project
		const topicMode = superMagicModeService.isModeValid(TopicMode.General)
			? TopicMode.General
			: undefined

		// Sync the role store so tabPattern is consistent with the new topic's mode
		if (topicMode) {
			roleStore.setCurrentRole(topicMode)
		}

		// Pass content via afterCreate so it is inserted AFTER navigation completes
		pubsub.publish(PubSubEvents.Create_New_Topic, {
			topicMode,
			afterCreate: { content, extraData: { hasInput: true } },
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [elementInspector.selectedElement])

	const startInToolbarMode = () => {
		inspectorModeRef.current = "toolbar"
		elementInspector.start()
	}

	const startInAppendMode = () => {
		inspectorModeRef.current = "appendToEditor"
		elementInspector.start()
	}

	return {
		/** Pass to `hideInfoCard` prop of ElementInspectorOverlay */
		hideInfoCard: inspectorModeRef.current !== "devConsole",
		/** Whether the inspector is currently active in append-to-editor mode */
		isAppendPicking: elementInspector.active && inspectorModeRef.current === "appendToEditor",
		/** Call from useImperativeHandle to trigger toolbar-mode inspection */
		startInToolbarMode,
		/** Call to trigger inspector; selection appends element info to current editor */
		startInAppendMode,
		inspectorModeRef,
	}
}
