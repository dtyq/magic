import { comparer, reaction } from "mobx"
import type { ApmContext, BrowserApm, BrowserApmConfig } from "@dtyq/browser-apm"

interface Dependencies {
	apm: BrowserApm
	readContext: () => ApmContext
	readConfig: () => BrowserApmConfig
}

/** Application-owned subscriptions and scheduling. The APM package knows nothing about MobX. */
export class BrowserApmService {
	private started = false
	private disposed = false
	private unsubscribe?: () => void
	private cancelSchedule?: () => void
	constructor(private readonly dependencies: Dependencies) {}

	initialize(): void {
		if (this.started || this.disposed) return
		this.started = true
		try {
			const { apm, readContext, readConfig } = this.dependencies
			const config = readConfig()
			if (config.provider.enabled === false) return
			// Observe only scalar identifiers. First synchronization precedes any SDK work;
			// later login/logout and cluster changes replace the complete context snapshot.
			this.unsubscribe = reaction(readContext, (context) => apm.updateContext(context), {
				fireImmediately: true,
				equals: comparer.structural,
			})
			let initialized = false
			let timeout: number | undefined
			let idle: number | undefined
			const cancel = () => {
				window.removeEventListener("load", schedule)
				window.clearTimeout(timeout)
				if (idle !== undefined) window.cancelIdleCallback?.(idle)
			}
			const initialize = () => {
				if (initialized || this.disposed) return
				initialized = true
				cancel()
				void apm.initialize(config).catch(() => {
					this.unsubscribe?.()
					// Keep optional monitoring failures independent from business logging and auth.
					console.warn("[BrowserAPM] Optional monitoring initialization failed")
				})
			}
			const schedule = () => {
				timeout = window.setTimeout(initialize, 2000)
				if (window.requestIdleCallback)
					idle = window.requestIdleCallback(initialize, { timeout: 2000 })
			}
			this.cancelSchedule = cancel
			if (document.readyState === "complete") schedule()
			else window.addEventListener("load", schedule, { once: true })
		} catch {
			this.unsubscribe?.()
			console.warn("[BrowserAPM] Optional monitoring configuration failed")
		}
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.cancelSchedule?.()
		this.unsubscribe?.()
		this.dependencies.apm.dispose()
	}
}
