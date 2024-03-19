import { makeAutoObservable } from "mobx"

class AppStore {
	isInitialing = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setIsInitialing(isInitialing: boolean) {
		this.isInitialing = isInitialing
	}
}

export const appStore = new AppStore()
