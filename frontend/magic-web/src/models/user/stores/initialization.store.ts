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

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	isInitialized = ({ magicId, organizationCode, domain }: InitializationKey) => {
		if (!magicId || !organizationCode || !domain) return false
		return this.initializedKeys.has(this.buildKey({ magicId, organizationCode, domain }))
	}

	markInitialized = ({ magicId, organizationCode, domain }: InitializationKey) => {
		if (!magicId || !organizationCode || !domain) return
		this.initializedKeys.add(this.buildKey({ magicId, organizationCode, domain }))
	}

	resetInitialized = () => {
		this.initializedKeys.clear()
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
