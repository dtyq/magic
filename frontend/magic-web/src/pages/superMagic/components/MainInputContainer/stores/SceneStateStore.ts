import { makeAutoObservable } from "mobx"
import { SceneItem } from "@/pages/superMagic/types/skill"
import { SceneConfigStore, sceneConfigStore } from "./SceneConfigStore"

class SceneStateStore {
	currentScene: SceneItem | null = null
	presetSuffixContent = ""

	private readonly configStore: SceneConfigStore

	constructor(configStore: SceneConfigStore = sceneConfigStore) {
		this.configStore = configStore
		makeAutoObservable<SceneStateStore, "configStore">(
			this,
			{ configStore: false },
			{ autoBind: true },
		)
	}

	get currentSceneConfig() {
		const sceneKey = this.currentScene?.id
		if (!sceneKey) return undefined

		return this.configStore.getSkillConfigs(sceneKey)
	}

	get isLoading() {
		const sceneKey = this.currentScene?.id
		if (!sceneKey) return false

		return this.configStore.isSkillConfigLoading(sceneKey)
	}

	get pendingRequest() {
		const sceneKey = this.currentScene?.id
		if (!sceneKey) return undefined

		return this.configStore.getPendingRequest(sceneKey)
	}

	setPresetSuffixContent(content: string) {
		this.presetSuffixContent = content
	}

	setCurrentScene(scene: SceneItem | null) {
		this.currentScene = scene
		this.presetSuffixContent = ""
		if (scene) {
			this.configStore.fetchSkillConfigs(scene.id)
		}
	}

	resetState() {
		this.currentScene = null
		this.presetSuffixContent = ""
		this.configStore.clearCache()
	}
}

const createSceneStateStore = (configStore?: SceneConfigStore) => new SceneStateStore(configStore)

const sceneStateStore = createSceneStateStore()

export { SceneStateStore, createSceneStateStore, sceneStateStore }
