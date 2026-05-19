import { action, makeAutoObservable } from "mobx"

class AppStore {
	isInitialing = false
	appInitPromise: Promise<unknown> | null = null
	languageReadyPromise: Promise<void> | null = null

	/**
	 * Set by AppService when public config init runs. May reject on init failure.
	 * Not deep-observable (ref only) to avoid tracking promise internals.
	 */
	publicConfigInitPromise: Promise<void> | null = null

	constructor() {
		makeAutoObservable(
			this,
			{
				appInitPromise: false,
				setAppInitPromise: action,
				languageReadyPromise: false,
				setLanguageReadyPromise: action,
				publicConfigInitPromise: false,
				setPublicConfigInitPromise: action,
			},
			{ autoBind: true },
		)
	}

	setIsInitialing(isInitialing: boolean) {
		this.isInitialing = isInitialing
	}

	setAppInitPromise(promise: Promise<unknown> | null) {
		this.appInitPromise = promise
	}

	setLanguageReadyPromise(promise: Promise<void> | null) {
		this.languageReadyPromise = promise
	}

	setPublicConfigInitPromise(promise: Promise<void> | null) {
		this.publicConfigInitPromise = promise
	}
}

export const appStore = new AppStore()
