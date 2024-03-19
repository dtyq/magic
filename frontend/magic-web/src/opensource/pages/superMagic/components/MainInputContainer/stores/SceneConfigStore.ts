import { makeAutoObservable, runInAction } from "mobx"
import { SuperMagicApi } from "@/opensource/apis"
import { PlaybookItem } from "@/opensource/apis/modules/crew"

class SceneConfigStore {
	sceneConfigs: Map<string, PlaybookItem> = new Map()

	configLoading: Map<string, boolean> = new Map()

	pendingRequests: Map<string, Promise<PlaybookItem>> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	async fetchSkillConfigs(playbookId: string, forceRefresh = false) {
		// Return existing request if in progress
		const pendingRequest = this.pendingRequests.get(playbookId)
		if (pendingRequest && !forceRefresh) {
			return pendingRequest
		}

		// Return cached config if exists, then refresh in background
		const cachedConfig = this.sceneConfigs.get(playbookId)
		if (cachedConfig && !forceRefresh) {
			// Return cached data immediately for rendering
			this.refreshInBackground(playbookId)
			return cachedConfig
		}

		// Create new request
		const request = this.executeRequest(playbookId)
		this.pendingRequests.set(playbookId, request)

		try {
			const config = await request
			return config
		} finally {
			this.pendingRequests.delete(playbookId)
		}
	}

	private async refreshInBackground(playbookId: string) {
		// Skip if already refreshing
		if (this.pendingRequests.has(playbookId)) return

		const request = this.executeRequest(playbookId)
		this.pendingRequests.set(playbookId, request)

		try {
			await request
		} finally {
			this.pendingRequests.delete(playbookId)
		}
	}

	private async executeRequest(playbookId: string): Promise<PlaybookItem> {
		runInAction(() => {
			this.configLoading.set(playbookId, true)
		})

		try {
			const configs = await SuperMagicApi.getSceneConfig(playbookId)
			runInAction(() => {
				this.setSkillConfigs(playbookId, configs)
			})
			return configs
		} finally {
			runInAction(() => {
				this.configLoading.delete(playbookId)
			})
		}
	}

	setSkillConfigs(playbookId: string, config: PlaybookItem) {
		this.sceneConfigs.set(playbookId, config)
	}

	getSkillConfigs(playbookId: string) {
		return this.sceneConfigs.get(playbookId)
	}

	isSkillConfigLoading(playbookId: string) {
		return this.configLoading.get(playbookId) || false
	}

	getPendingRequest(playbookId: string) {
		return this.pendingRequests.get(playbookId)
	}

	clearCache(playbookId?: string) {
		if (playbookId) {
			this.sceneConfigs.delete(playbookId)
			this.configLoading.delete(playbookId)
			this.pendingRequests.delete(playbookId)
		} else {
			this.sceneConfigs.clear()
			this.configLoading.clear()
			this.pendingRequests.clear()
		}
	}
}

const sceneConfigStore = new SceneConfigStore()

export { SceneConfigStore, sceneConfigStore }
