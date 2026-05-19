import { useEffect } from "react"
import type { SceneItem } from "@/pages/superMagic/types/skill"
import type { SceneStateStore } from "../stores"

interface UseSceneSelectionParams {
	scenes?: SceneItem[]
	sceneStateStore: SceneStateStore
}

function useSceneSelection({ scenes, sceneStateStore }: UseSceneSelectionParams) {
	const currentScene = sceneStateStore.currentScene
	const hasScenes = Boolean(scenes?.length)
	const hasOnlyScene = scenes?.length === 1
	const shouldShowCurrentSceneBadge = Boolean(currentScene && !hasOnlyScene)
	const shouldShowSceneControls = Boolean(hasScenes && !hasOnlyScene)

	useEffect(() => {
		if (!scenes) return

		if (scenes.length === 1) {
			const [onlyScene] = scenes
			if (currentScene?.id !== onlyScene.id) {
				sceneStateStore.setCurrentScene(onlyScene)
			}
			return
		}

		if (!currentScene) return

		const isSceneValid = scenes.some((scene) => scene.id === currentScene.id)
		if (!isSceneValid) {
			sceneStateStore.setCurrentScene(null)
		}
	}, [currentScene, sceneStateStore, scenes])

	return {
		currentScene,
		hasOnlyScene,
		shouldShowCurrentSceneBadge,
		shouldShowSceneControls,
	}
}

export { useSceneSelection }
