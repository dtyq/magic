import { useRequest } from "ahooks"
import { SuperMagicApi } from "@/opensource/apis"
import { playbookToSceneItem } from "../utils"
import type { SceneItem } from "../../../types"

/**
 * Fetch scene detail by playbook ID via getSceneConfig API.
 * Returns loading state, error, and SceneItem for the edit panel.
 */
export function useSceneByPlaybookId(playbookId: string | null) {
	const {
		data: scene,
		loading,
		error,
		refresh,
	} = useRequest(
		async (): Promise<SceneItem | null> => {
			if (!playbookId) return null
			const playbook = await SuperMagicApi.getSceneConfig(playbookId)
			return playbookToSceneItem(playbook)
		},
		{
			ready: !!playbookId,
			refreshDeps: [playbookId],
		},
	)

	return {
		scene: scene ?? null,
		loading,
		error: error ? (error instanceof Error ? error.message : String(error)) : null,
		refresh,
	}
}
