import { makeAutoObservable } from "mobx"

const DEFAULT_ORGANIZATION_SWITCH_Z_INDEX = 1200

class GlobalSidebarStore {
	_open = false

	organizationSwitchOpen = false

	organizationSwitchZIndex = DEFAULT_ORGANIZATION_SWITCH_Z_INDEX

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

	openOrganizationSwitch = (zIndex = DEFAULT_ORGANIZATION_SWITCH_Z_INDEX) => {
		this.organizationSwitchZIndex = zIndex
		this.organizationSwitchOpen = true
	}

	closeOrganizationSwitch = () => {
		this.organizationSwitchOpen = false
		this.organizationSwitchZIndex = DEFAULT_ORGANIZATION_SWITCH_Z_INDEX
	}
}

export default new GlobalSidebarStore()
