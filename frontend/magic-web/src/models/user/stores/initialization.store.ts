import { makeAutoObservable } from "mobx"

export const INIT_DOMAINS = {
	chat: "chat",
	super: "super",
} as const

type InitializationDomain = (typeof INIT_DOMAINS)[keyof typeof INIT_DOMAINS]

interface InitializationKey {
	magicId?: string
	organizationCode?: string
	domain?: InitializationDomain
}

const KEY_SEPARATOR = "::"

export class InitializationStore {
	private initializedKeys: Set<string> = new Set()
	private initializingKeys: Map<string, Promise<unknown>> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	isInitialized = ({ magicId, organizationCode, domain }: InitializationKey) => {
		if (!magicId || !organizationCode || !domain) return false
		return this.initializedKeys.has(this.buildKey({ magicId, organizationCode, domain }))
	}

	isInitializing = ({ magicId, organizationCode, domain }: InitializationKey) => {
		if (!magicId || !organizationCode || !domain) return false
		return this.initializingKeys.has(this.buildKey({ magicId, organizationCode, domain }))
	}

	markInitialized = ({ magicId, organizationCode, domain }: InitializationKey) => {
		if (!magicId || !organizationCode || !domain) return
		this.initializedKeys.add(this.buildKey({ magicId, organizationCode, domain }))
	}

	runInitialization = <T>(
		{ magicId, organizationCode, domain }: InitializationKey,
		initializer: () => Promise<T>,
	): Promise<T> => {
		if (!magicId || !organizationCode || !domain) {
			return initializer()
		}

		const key = this.buildKey({ magicId, organizationCode, domain })
		const pendingInitialization = this.initializingKeys.get(key)
		if (pendingInitialization) {
			return pendingInitialization as Promise<T>
		}

		if (this.initializedKeys.has(key)) {
			return Promise.resolve(undefined as T)
		}

		const initializationPromise = initializer()
			.then((result) => {
				this.initializedKeys.add(key)
				return result
			})
			.finally(() => {
				this.initializingKeys.delete(key)
			})

		this.initializingKeys.set(key, initializationPromise)
		return initializationPromise
	}

	resetInitialized = () => {
		this.initializedKeys.clear()
		this.initializingKeys.clear()
	}

	private buildKey = ({
		magicId,
		organizationCode,
		domain,
	}: Required<InitializationKey>): string => {
		return [magicId, organizationCode, domain].join(KEY_SEPARATOR)
	}
}

export const initializationStore = new InitializationStore()
