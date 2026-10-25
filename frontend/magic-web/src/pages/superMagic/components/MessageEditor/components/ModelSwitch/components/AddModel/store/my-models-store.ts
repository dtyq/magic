import { makeAutoObservable, runInAction } from "mobx"
import type { ServiceProviderModel } from "@/apis/modules/org-ai-model-provider"
import superMagicCustomModelService from "@/services/superMagic/SuperMagicCustomModelService"

export class MyModelsStore {
	myModels: ServiceProviderModel[] = []

	isLoadingMyModels = false

	hasLoadedMyModels = false

	private loadPromise: Promise<void> | null = null

	deletingModelId: string | null = null

	constructor() {
		makeAutoObservable(this)
	}

	openDeleteModel(modelId: string) {
		this.deletingModelId = modelId
	}

	closeDeleteModel() {
		this.deletingModelId = null
	}

	async loadMyModels(force = true) {
		if (this.loadPromise) return this.loadPromise

		this.isLoadingMyModels = true
		const loadPromise = superMagicCustomModelService
			.getMyModels({ force })
			.then((list) => {
				runInAction(() => {
					this.myModels = list
				})
			})
			.catch(() => {
				runInAction(() => {
					this.myModels = []
				})
			})
			.finally(() => {
				runInAction(() => {
					this.isLoadingMyModels = false
					this.hasLoadedMyModels = true
					this.loadPromise = null
				})
			})
		this.loadPromise = loadPromise

		return loadPromise
	}
}
