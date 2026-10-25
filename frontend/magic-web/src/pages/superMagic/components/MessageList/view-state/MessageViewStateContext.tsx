import {
	createContext,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"

const MAX_VIEW_STATE_ENTRIES = 10_000

class MessageViewStateRegistry {
	private processRevision = 0
	private processListeners = new Set<() => void>()
	getProcessRevision = () => this.processRevision
	subscribeProcesses = (listener: () => void) => {
		this.processListeners.add(listener)
		return () => {
			this.processListeners.delete(listener)
		}
	}

	private values = new Map<string, unknown>()
	private listeners = new Map<string, Set<() => void>>()

	has(key: string) {
		return this.values.has(key)
	}

	get<T>(key: string): T | undefined {
		return this.values.get(key) as T | undefined
	}

	set<T>(key: string, value: T) {
		if (this.values.has(key) && Object.is(this.values.get(key), value)) return
		if (!this.values.has(key) && this.values.size >= MAX_VIEW_STATE_ENTRIES) {
			const oldestKey = this.values.keys().next().value as string | undefined
			if (oldestKey) {
				this.values.delete(oldestKey)
				this.listeners.delete(oldestKey)
			}
		}
		this.values.set(key, value)
		if (key.includes("\u0000process:")) {
			this.processRevision += 1
			this.processListeners.forEach((listener) => listener())
		}
		this.listeners.get(key)?.forEach((listener) => listener())
	}

	subscribe(key: string, listener: () => void) {
		const listeners = this.listeners.get(key) || new Set<() => void>()
		listeners.add(listener)
		this.listeners.set(key, listeners)
		return () => {
			listeners.delete(listener)
			if (listeners.size === 0) this.listeners.delete(key)
		}
	}
}

interface MessageViewStateProviderValue {
	registry: MessageViewStateRegistry
	topicKey: string
}

interface MessageViewStateScopeValue extends MessageViewStateProviderValue {
	messageKey: string
}

const ProviderContext = createContext<MessageViewStateProviderValue | null>(null)
const ScopeContext = createContext<MessageViewStateScopeValue | null>(null)

export function MessageViewStateProvider({
	topicKey,
	children,
}: PropsWithChildren<{ topicKey: string }>) {
	const registryRef = useRef<MessageViewStateRegistry | null>(null)
	if (!registryRef.current) registryRef.current = new MessageViewStateRegistry()
	const value = useMemo(
		() => ({ registry: registryRef.current as MessageViewStateRegistry, topicKey }),
		[topicKey],
	)

	return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>
}

export function MessageViewStateScopeProvider({
	messageKey,
	children,
}: PropsWithChildren<{ messageKey: string }>) {
	const provider = useContext(ProviderContext)
	const value = useMemo(
		() => (provider ? { ...provider, messageKey } : null),
		[messageKey, provider],
	)
	if (!value) return children

	return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

/**
 * Persists only semantic user choices across virtual row lifecycles. Components rendered outside
 * MessageList keep normal local state so isolated stories and tests do not share global values.
 */
export function useMessageViewState<T>(
	controlKey: string,
	initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
	const scope = useContext(ScopeContext)
	const [localValue, setLocalValue] = useState(initialValue)
	const initialValueRef = useRef(localValue)
	const stateKey = scope ? `${scope.topicKey}\u0000${scope.messageKey}\u0000${controlKey}` : ""

	const subscribe = useCallback(
		(listener: () => void) =>
			scope ? scope.registry.subscribe(stateKey, listener) : () => undefined,
		[scope, stateKey],
	)
	const getSnapshot = useCallback(() => {
		if (!scope || !scope.registry.has(stateKey)) return initialValueRef.current
		return scope.registry.get<T>(stateKey) as T
	}, [scope, stateKey])
	const persistedValue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

	const setValue = useCallback<Dispatch<SetStateAction<T>>>(
		(nextValue) => {
			if (!scope) {
				setLocalValue(nextValue)
				return
			}
			const currentValue = scope.registry.has(stateKey)
				? (scope.registry.get<T>(stateKey) as T)
				: initialValueRef.current
			const resolvedValue =
				typeof nextValue === "function"
					? (nextValue as (previousValue: T) => T)(currentValue)
					: nextValue
			scope.registry.set(stateKey, resolvedValue)
		},
		[scope, stateKey],
	)

	return scope ? [persistedValue, setValue] : [localValue, setValue]
}

/** 展开选择使用同一有容量上限的登记表；切换话题或重新开启模式开始新的阅读周期。 */
export function useMessageProcessViewState(enabled: boolean) {
	const provider = useContext(ProviderContext)
	const topicKey = provider?.topicKey || ""
	const cycle = useRef({ enabled, topicKey, generation: 0 })
	if (cycle.current.enabled !== enabled || cycle.current.topicKey !== topicKey) {
		cycle.current = { enabled, topicKey, generation: cycle.current.generation + 1 }
	}
	const revision = useSyncExternalStore(
		enabled
			? (provider?.registry.subscribeProcesses ?? (() => () => undefined))
			: () => () => undefined,
		enabled ? (provider?.registry.getProcessRevision ?? (() => 0)) : () => 0,
		() => 0,
	)
	const prefix = `${provider?.topicKey || ""}\u0000process:${cycle.current.generation}\u0000`
	return {
		interactionKey: `${cycle.current.generation}:${revision}`,
		isExpanded: (key: string) => provider?.registry.get<boolean>(prefix + key) === true,
		toggle: (key: string) =>
			provider?.registry.set(
				prefix + key,
				provider.registry.get<boolean>(prefix + key) !== true,
			),
	}
}
