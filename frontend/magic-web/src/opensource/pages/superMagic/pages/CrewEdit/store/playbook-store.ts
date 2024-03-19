import { makeAutoObservable, runInAction } from "mobx"
import type { CreatePlaybookParams } from "@/opensource/apis/modules/crew"
import { crewService } from "@/opensource/services/crew/CrewService"
import { createDefaultScene } from "../components/StepDetailPanel/PlaybookPanel/data"
import type { SceneItem } from "../components/StepDetailPanel/PlaybookPanel/types"
import { CREW_EDIT_ERROR } from "../constants/errors"
import { mapPlaybookToScene, mapSceneToPlaybookParams } from "./mappers/playbook-mapper"
import { type CrewCodeController, getCrewCodeRequiredMessage, resolveCrewEditError } from "./shared"

export class CrewPlaybookStore {
	scenes: SceneItem[] = []
	playbookIdMap: Map<string, string> = new Map()
	scenesLoading = false
	scenesError: string | null = null

	private readonly _getCrewCode: CrewCodeController["getCrewCode"]

	constructor({ getCrewCode }: CrewCodeController) {
		this._getCrewCode = getCrewCode

		makeAutoObservable(this, { _getCrewCode: false }, { autoBind: true })
	}

	/** Fetch playbooks from API. Requires crewCode to be set. */
	async fetchScenes(crewCodeParam?: string | null): Promise<void> {
		const code = crewCodeParam ?? this._getCrewCode()

		if (this.scenesLoading) return

		if (!code) {
			runInAction(() => {
				this.scenesError = getCrewCodeRequiredMessage()
			})
			return
		}

		this.scenesLoading = true
		this.scenesError = null

		try {
			const playbooks = await crewService.getPlaybooks(code)
			const scenes = playbooks.map((playbook) =>
				mapPlaybookToScene({
					id: playbook.id,
					name: playbook.name,
					description: playbook.description,
					icon: playbook.icon,
					enabled: playbook.enabled,
					updatedAt: playbook.updatedAt,
					config: playbook.config,
				}),
			)

			runInAction(() => {
				this.playbookIdMap.clear()
				playbooks.forEach((playbook) => {
					this.playbookIdMap.set(String(playbook.id), playbook.id)
				})
				this.scenes = scenes
				this.scenesLoading = false
			})
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.loadScenesFailed,
			})

			runInAction(() => {
				this.scenesError = message
				this.scenesLoading = false
			})
		}
	}

	/** Toggle a scene's enabled state and persist to API. Requires crewCode. */
	async toggleSceneEnabled(id: string): Promise<void> {
		const code = this._getCrewCode()
		const scene = this.scenes.find((item) => item.id === id)

		if (!scene) return

		if (!code) {
			runInAction(() => {
				this.scenesError = getCrewCodeRequiredMessage()
			})
			return
		}

		scene.enabled = !scene.enabled
		const playbookId = this.playbookIdMap.get(id)
		if (playbookId === undefined) return

		try {
			await crewService.togglePlaybookEnabled(code, playbookId, scene.enabled)
		} catch (error) {
			scene.enabled = !scene.enabled

			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.toggleSceneFailed,
			})

			runInAction(() => {
				this.scenesError = message
			})
		}
	}

	/** Delete a scene and persist to API. Requires crewCode. */
	async deleteScene(id: string): Promise<void> {
		const code = this._getCrewCode()

		if (!code) {
			runInAction(() => {
				this.scenesError = getCrewCodeRequiredMessage()
			})
			return
		}

		const playbookId = this.playbookIdMap.get(id)
		const previousScenes = [...this.scenes]
		this.scenes = this.scenes.filter((scene) => scene.id !== id)

		if (playbookId === undefined) return

		try {
			await crewService.deletePlaybook(code, playbookId)
			runInAction(() => {
				this.playbookIdMap.delete(id)
			})
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.deleteSceneFailed,
			})

			runInAction(() => {
				this.scenes = previousScenes
				this.scenesError = message
			})
		}
	}

	/** Reorder scenes and persist to API. Requires crewCode. */
	async reorderScenes(activeId: string, overId: string): Promise<void> {
		const code = this._getCrewCode()

		if (!code) {
			runInAction(() => {
				this.scenesError = getCrewCodeRequiredMessage()
			})
			return
		}

		const oldIndex = this.scenes.findIndex((scene) => scene.id === activeId)
		const newIndex = this.scenes.findIndex((scene) => scene.id === overId)
		if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

		const previousScenes = this.scenes
		const nextScenes = [...this.scenes]
		const [removedScene] = nextScenes.splice(oldIndex, 1)
		nextScenes.splice(newIndex, 0, removedScene)
		this.scenes = nextScenes

		const playbookIds = nextScenes
			.map((scene) => this.playbookIdMap.get(scene.id))
			.filter((id): id is string => id !== undefined)
		if (playbookIds.length === 0) return

		try {
			await crewService.reorderPlaybooks(code, playbookIds)
		} catch (error) {
			this.scenes = previousScenes

			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.reorderScenesFailed,
			})

			runInAction(() => {
				this.scenesError = message
			})
		}
	}

	/**
	 * Create a scene locally (sync, returns immediately) and persist to API in background.
	 * The returned SceneItem can be used immediately by the UI.
	 */
	createScene(): SceneItem {
		const scene = createDefaultScene()
		this.scenes = [scene, ...this.scenes]
		void this.persistCreateScene(scene)
		return scene
	}

	/**
	 * Update a scene's data and persist to API. Requires crewCode.
	 * Call this after editing a scene in the SceneEditPanel.
	 */
	async updateScene(scene: SceneItem): Promise<void> {
		const code = this._getCrewCode()

		if (!code) {
			runInAction(() => {
				this.scenesError = getCrewCodeRequiredMessage()
			})
			return
		}

		const playbookId = this.playbookIdMap.get(scene.id)
		if (playbookId === undefined) return

		const index = this.scenes.findIndex((item) => {
			if (item.id === scene.id) return true
			return this.playbookIdMap.get(item.id) === playbookId
		})
		if (index === -1) return

		const previousScene = this.scenes[index]
		this.scenes[index] = scene

		try {
			await crewService.updatePlaybook(code, playbookId, mapSceneToPlaybookParams(scene))
		} catch (error) {
			this.scenes[index] = previousScene

			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.updateSceneFailed,
			})

			runInAction(() => {
				this.scenesError = message
			})

			throw error
		}
	}

	reset() {
		this.scenes = []
		this.playbookIdMap = new Map()
		this.scenesLoading = false
		this.scenesError = null
	}

	private async persistCreateScene(scene: SceneItem): Promise<void> {
		const code = this._getCrewCode()

		if (!code) {
			runInAction(() => {
				this.scenes = this.scenes.filter((item) => item.id !== scene.id)
				this.scenesError = resolveCrewEditError({
					error: null,
					fallbackKey: CREW_EDIT_ERROR.createSceneFailed,
				}).message
			})
			return
		}

		try {
			const createdPlaybookId = await crewService.createPlaybook(
				code,
				mapSceneToPlaybookParams(scene) as CreatePlaybookParams,
			)

			runInAction(() => {
				const tempSceneId = scene.id
				scene.id = createdPlaybookId
				this.playbookIdMap.set(tempSceneId, createdPlaybookId)
				this.playbookIdMap.set(scene.id, createdPlaybookId)
			})
		} catch (error) {
			const { message } = resolveCrewEditError({
				error,
				fallbackKey: CREW_EDIT_ERROR.createSceneFailed,
			})

			runInAction(() => {
				this.scenes = this.scenes.filter((item) => item.id !== scene.id)
				this.scenesError = message
			})
		}
	}
}
