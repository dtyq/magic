import { makeAutoObservable } from "mobx"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
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
	private presetSuffixContentSources = new Map<string, JSONContent | undefined>()

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
		this.clearPresetSuffixContentSources()
	}

	setPresetSuffixContent(content: JSONContent | undefined) {
		this.setPresetSuffixContentForSource("default", content)
	}

	setPresetSuffixContentForSource(sourceKey: string, content: JSONContent | undefined) {
		if (content?.content?.length) {
			this.presetSuffixContentSources.set(sourceKey, content)
		} else {
			this.presetSuffixContentSources.delete(sourceKey)
		}
		this.presetSuffixContent = joinPresetSuffixContentSources(this.presetSuffixContentSources)
	}

	incrementSendCount() {
		this.sendCount += 1
	}

	setCurrentScene(scene: SceneItem | null) {
		this.currentScene = scene
		this.clearPresetSuffixContentSources()
		if (scene) {
			this.configStore.fetchSkillConfigs(scene.id)
		}
	}

	resetState() {
		this.currentScene = null
		this.clearPresetSuffixContentSources()
		this.inputScopeKey = ""
		this.configStore.clearCache()
	}

	private clearPresetSuffixContentSources() {
		this.presetSuffixContentSources.clear()
		this.presetSuffixContent = undefined
	}
}

function joinPresetSuffixContentSources(contentSources: Map<string, JSONContent | undefined>) {
	const docs = Array.from(contentSources.values()).filter((content): content is JSONContent =>
		Boolean(content?.content?.length),
	)
	if (docs.length === 0) return undefined

	const content = docs.flatMap((doc, index) => {
		const shouldAddGap = index < docs.length - 1
		return shouldAddGap ? [...(doc.content ?? []), { type: "paragraph" }] : (doc.content ?? [])
	})

	return { type: "doc", content }
}

const createSceneStateStore = (configStore?: SceneConfigStore) => new SceneStateStore(configStore)

const sceneStateStore = createSceneStateStore()

export { SceneStateStore, createSceneStateStore, sceneStateStore }
