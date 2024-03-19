import { makeAutoObservable } from "mobx"

class RouterStore {
	constructor() {
		makeAutoObservable(this)
	}

	isBack = false

	setIsBack(isBack: boolean) {
		this.isBack = isBack
	}
}

export default new RouterStore()
