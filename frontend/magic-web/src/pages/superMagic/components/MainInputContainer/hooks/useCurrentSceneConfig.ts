import { useMemo } from "react"
import type { SkillPanelConfig } from "../panels/types"
import { useSceneStateStore } from "../stores"
import { SceneEditorKey } from "../../../types/skill"
import { TopicMode } from "../../../pages/Workspace/types"

/** Config with panels (SkillConfig) or scenes_config (PlaybookConfig) */
interface ConfigWithPanels {
	panels?: SkillPanelConfig[]
	config?: {
		scenes_config?: Record<string, SkillPanelConfig | undefined>
		editor_type?: SceneEditorKey
	}
	placeholder?: string
}

/**
 * Returns current scene skill config, loading state, and derived panels.
 * Panels come from config.panels or config.scenes_config (Playbook format).
 */
interface UseCurrentSceneSkillOptions {
	topicMode?: TopicMode
}

export function useCurrentSceneConfig(options: UseCurrentSceneSkillOptions = {}) {
	const sceneStateStore = useSceneStateStore()

	const isRecordSummaryMode = options.topicMode === TopicMode.RecordSummary
	const sceneConfig = sceneStateStore.currentSceneConfig as ConfigWithPanels | undefined
	const isConfigLoading = sceneStateStore.isLoading

	const configs = useMemo(() => {
		return {
			panels: Object.values(sceneConfig?.config?.scenes_config || {}).filter(
				Boolean,
			) as SkillPanelConfig[],
			editorType: sceneConfig
				? (sceneConfig.config?.editor_type ?? SceneEditorKey.General)
				: isRecordSummaryMode
					? SceneEditorKey.RecordSummary
					: undefined,
			placeholder: sceneConfig?.placeholder,
		}
	}, [isRecordSummaryMode, sceneConfig])

	return {
		sceneConfig,
		placeholder: configs.placeholder,
		editorType: configs.editorType,
		isConfigLoading,
		panels: configs.panels,
		isLoading: !sceneConfig && isConfigLoading,
	}
}
