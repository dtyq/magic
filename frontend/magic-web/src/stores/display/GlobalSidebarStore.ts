import { makeAutoObservable } from "mobx"

class GlobalSidebarStore {
	_open = false

	organizationSwitchOpen = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get isOpen() {
		return this._open
	}

	open = () => {
		this._open = true
	}

	close = () => {
		this._open = false
	}

	get isOrganizationSwitchOpen() {
		return this.organizationSwitchOpen
	}

	openOrganizationSwitch = () => {
		this.organizationSwitchOpen = true
	}

	closeOrganizationSwitch = () => {
		this.organizationSwitchOpen = false
	}
}

export default new GlobalSidebarStore()
