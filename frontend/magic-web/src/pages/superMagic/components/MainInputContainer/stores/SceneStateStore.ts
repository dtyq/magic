import { makeAutoObservable } from "mobx"
import type { JSONContent } from "@tiptap/core"
import { SceneItem } from "@/pages/superMagic/types/skill"
import { SceneConfigStore, sceneConfigStore } from "./SceneConfigStore"

/**
 * Stable scope for template panels: topicMode, topic id, agent (order matters).
 * Uses ASCII record sep to avoid clashes with ids.
 */
export function buildTopicInputScopeKey(topicMode: string, topicId = "", agentCode = ""): string {
	return `${topicMode}\u001e${topicId}\u001e${agentCode}`
}

class SceneStateStore {
	currentScene: SceneItem | null = null
	presetSuffixContent: JSONContent | undefined = undefined
	sendCount = 0

	/**
	 * Bumped when input is bound to a new scope (topicMode, topic, agent).
	 * Template panels use this to re-run initialize when config ref is unchanged.
	 */
	inputScopeKey = ""

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

	setInputScopeKey(scopeKey: string) {
		if (this.inputScopeKey === scopeKey) return

		this.inputScopeKey = scopeKey
		this.presetSuffixContent = undefined
	}

	setPresetSuffixContent(content: JSONContent | undefined) {
		this.presetSuffixContent = content
	}

	incrementSendCount() {
		this.sendCount += 1
	}

	setCurrentScene(scene: SceneItem | null) {
		this.currentScene = scene
		this.presetSuffixContent = undefined
		if (scene) {
			this.configStore.fetchSkillConfigs(scene.id)
		}
	}

	resetState() {
		this.currentScene = null
		this.presetSuffixContent = undefined
		this.inputScopeKey = ""
		this.configStore.clearCache()
	}
}

const createSceneStateStore = (configStore?: SceneConfigStore) => new SceneStateStore(configStore)

const sceneStateStore = createSceneStateStore()

export { SceneStateStore, createSceneStateStore, sceneStateStore }
