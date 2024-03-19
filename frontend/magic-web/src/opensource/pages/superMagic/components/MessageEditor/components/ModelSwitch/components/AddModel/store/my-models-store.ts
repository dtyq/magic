import { makeAutoObservable, runInAction } from "mobx"
import type { ServiceProviderModel } from "@/opensource/apis/modules/org-ai-model-provider"
import superMagicCustomModelService from "@/opensource/services/superMagic/SuperMagicCustomModelService"

export class MyModelsStore {
	myModels: ServiceProviderModel[] = []

	isLoadingMyModels = false

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

	async loadMyModels() {
		this.isLoadingMyModels = true
		try {
			const list = await superMagicCustomModelService.getMyModels({ force: true })
			runInAction(() => {
				this.myModels = list
			})
		} catch {
			runInAction(() => {
				this.myModels = []
			})
		} finally {
			runInAction(() => {
				this.isLoadingMyModels = false
			})
		}
	}
}
