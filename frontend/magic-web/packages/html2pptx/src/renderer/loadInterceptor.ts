import { log, LogLevel } from "../logger"

interface LoadListenerRecord {
	original: EventListenerOrEventListenerObject
	wrapped: EventListener
	options?: boolean | AddEventListenerOptions
	called: boolean
	removed: boolean
	pendingTask: Promise<void> | null
}

interface DomReadyListenerRecord {
	original: EventListenerOrEventListenerObject
	wrapped: EventListener
	options?: boolean | AddEventListenerOptions
	called: boolean
	removed: boolean
	pendingTask: Promise<void> | null
}

export interface LoadInterceptor {
	activateCaptureOnly: () => void
	waitForNativeLoad: (timeoutMs?: number) => Promise<void>
	fireAll: () => Promise<void>
	restore: () => void
}

const INTERCEPTOR_PHASE = {
	INITIALIZED: "initialized",
	CAPTURE_ONLY: "capture-only",
	REPLAYING: "replaying",
	RESTORED: "restored",
} as const

type InterceptorPhase = (typeof INTERCEPTOR_PHASE)[keyof typeof INTERCEPTOR_PHASE]

const ALLOWED_TRANSITIONS: Record<InterceptorPhase, InterceptorPhase[]> = {
	[INTERCEPTOR_PHASE.INITIALIZED]: [
		INTERCEPTOR_PHASE.CAPTURE_ONLY,
		INTERCEPTOR_PHASE.REPLAYING,
		INTERCEPTOR_PHASE.RESTORED,
	],
	[INTERCEPTOR_PHASE.CAPTURE_ONLY]: [
		INTERCEPTOR_PHASE.REPLAYING,
		INTERCEPTOR_PHASE.RESTORED,
	],
	[INTERCEPTOR_PHASE.REPLAYING]: [
		INTERCEPTOR_PHASE.CAPTURE_ONLY,
		INTERCEPTOR_PHASE.RESTORED,
	],
	[INTERCEPTOR_PHASE.RESTORED]: [INTERCEPTOR_PHASE.RESTORED],
}

export function installLoadInterceptor(win: Window): LoadInterceptor {
	let phase: InterceptorPhase = INTERCEPTOR_PHASE.INITIALIZED
	const loadListeners: LoadListenerRecord[] = []
	const domReadyListeners: DomReadyListenerRecord[] = []
	let capturedOnload: ((this: Window, ev: Event) => unknown) | null = null
	let onloadCalled = false
	let nativeLoadFired = false
	const inFlightTasks = new Set<Promise<void>>()

	const originalAddEventListener = win.addEventListener.bind(win)
	const originalRemoveEventListener = win.removeEventListener.bind(win)
	const originalOnloadDescriptor = Object.getOwnPropertyDescriptor(win, "onload")
	const originalDocumentAddEventListener = win.document.addEventListener.bind(win.document)
	const originalDocumentRemoveEventListener = win.document.removeEventListener.bind(win.document)

	function transitionPhase(nextPhase: InterceptorPhase): void {
		const allowedPhases = ALLOWED_TRANSITIONS[phase]
		if (!allowedPhases.includes(nextPhase)) {
			log(LogLevel.L3, "invalid interceptor phase transition", { from: phase, to: nextPhase })
			return
		}
		phase = nextPhase
	}

	function isNativeDispatchPhase(): boolean {
		return phase === INTERCEPTOR_PHASE.INITIALIZED
	}

	function isRestored(): boolean {
		return phase === INTERCEPTOR_PHASE.RESTORED
	}

	function invokeListener(
		listener: EventListenerOrEventListenerObject,
		event: Event,
		target: Window,
	): Promise<void> {
		let result: unknown
		try {
			if (typeof listener === "function")
				result = listener.call(target, event)
			else result = listener.handleEvent(event)
		} catch (error) {
			log(LogLevel.L3, "load callback sync failed", { error: String(error) })
			return Promise.resolve()
		}

		return Promise.resolve(result)
			.then(() => undefined)
			.catch((error) => {
				log(LogLevel.L3, "load callback async failed", { error: String(error) })
			})
	}

	function trackTask(task: Promise<void>): Promise<void> {
		inFlightTasks.add(task)
		task.finally(() => {
			inFlightTasks.delete(task)
		})
		return task
	}

	win.addEventListener = function (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void {
		if (isRestored()) {
			originalAddEventListener(type, listener, options)
			return
		}
		if (type !== "load") {
			originalAddEventListener(type, listener, options)
			return
		}

		const record: LoadListenerRecord = {
			original: listener,
			options,
			called: false,
			removed: false,
			wrapped: () => {},
			pendingTask: null,
		}

		record.wrapped = (event: Event) => {
			record.called = true
			record.pendingTask = trackTask(invokeListener(listener, event, win))
		}
		loadListeners.push(record)

		if (isNativeDispatchPhase()) originalAddEventListener("load", record.wrapped, options)
	} as typeof win.addEventListener

	win.removeEventListener = function (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void {
		if (isRestored()) {
			originalRemoveEventListener(type, listener, options)
			return
		}
		if (type !== "load") {
			originalRemoveEventListener(type, listener, options)
			return
		}

		for (const record of loadListeners) {
			if (record.original !== listener) continue
			record.removed = true
			originalRemoveEventListener(
				"load",
				record.wrapped,
				record.options as boolean | EventListenerOptions,
			)
		}
	} as typeof win.removeEventListener

	win.document.addEventListener = function (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void {
		if (isRestored()) {
			originalDocumentAddEventListener(type, listener, options)
			return
		}
		if (type !== "DOMContentLoaded") {
			originalDocumentAddEventListener(type, listener, options)
			return
		}

		const record: DomReadyListenerRecord = {
			original: listener,
			options,
			called: false,
			removed: false,
			wrapped: () => {},
			pendingTask: null,
		}
		record.wrapped = (event: Event) => {
			record.called = true
			record.pendingTask = trackTask(invokeListener(listener, event, win))
		}
		domReadyListeners.push(record)

		if (isNativeDispatchPhase() && win.document.readyState === "loading")
			originalDocumentAddEventListener("DOMContentLoaded", record.wrapped, options)
	} as typeof win.document.addEventListener

	win.document.removeEventListener = function (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void {
		if (isRestored()) {
			originalDocumentRemoveEventListener(type, listener, options)
			return
		}
		if (type !== "DOMContentLoaded") {
			originalDocumentRemoveEventListener(type, listener, options)
			return
		}
		for (const record of domReadyListeners) {
			if (record.original !== listener) continue
			record.removed = true
			originalDocumentRemoveEventListener(
				"DOMContentLoaded",
				record.wrapped,
				record.options as boolean | EventListenerOptions,
			)
		}
	} as typeof win.document.removeEventListener

	try {
		Object.defineProperty(win, "onload", {
			get() {
				return capturedOnload
			},
			set(handler: ((this: Window, ev: Event) => unknown) | null) {
				capturedOnload = typeof handler === "function" ? handler : null
			},
			configurable: true,
		})
	} catch (error) {
		log(LogLevel.L3, "failed to intercept window.onload", { error: String(error) })
	}

	return {
		activateCaptureOnly() {
			if (isRestored()) return
			transitionPhase(INTERCEPTOR_PHASE.CAPTURE_ONLY)
		},
		waitForNativeLoad(timeoutMs: number = 1500) {
			if (isRestored()) return Promise.resolve()
			if (win.document.readyState === "complete") return Promise.resolve()
			return new Promise<void>((resolve) => {
				let done = false
				const finish = () => {
					if (done) return
					done = true
					originalRemoveEventListener("load", onLoad)
					resolve()
				}
				const onLoad = () => {
					nativeLoadFired = true
					finish()
				}
				originalAddEventListener("load", onLoad, { once: true })
				setTimeout(finish, timeoutMs)
			})
		},
		async fireAll() {
			if (isRestored()) return
			const previousPhase = phase
			transitionPhase(INTERCEPTOR_PHASE.REPLAYING)

			const fakeLoadEvent = new Event("load")
			const calledBeforeReplay = loadListeners.filter((record) => record.called).length
			const onloadCalledBeforeReplay = onloadCalled
			let replayedLoadCount = 0
			let replayedDomReadyCount = 0
			const pendingTasks: Promise<void>[] = []

			if (!onloadCalled && capturedOnload) {
				try {
					onloadCalled = true
					replayedLoadCount += 1
					pendingTasks.push(
						trackTask(Promise.resolve(capturedOnload.call(win, fakeLoadEvent)).then(() => undefined)),
					)
				} catch (error) {
					log(LogLevel.L3, "window.onload callback failed", { error: String(error) })
				}
			}

			for (const record of loadListeners) {
				if (record.called || record.removed) continue
				try {
					record.called = true
					replayedLoadCount += 1
					const task = trackTask(invokeListener(record.original, fakeLoadEvent, win))
					record.pendingTask = task
					pendingTasks.push(task)
				} catch (error) {
					log(LogLevel.L3, "load listener callback failed", { error: String(error) })
				}
			}

			const fakeDomReadyEvent = new Event("DOMContentLoaded")
			for (const record of domReadyListeners) {
				if (record.called || record.removed) continue
				try {
					record.called = true
					replayedDomReadyCount += 1
					const task = trackTask(invokeListener(record.original, fakeDomReadyEvent, win))
					record.pendingTask = task
					pendingTasks.push(task)
				} catch (error) {
					log(LogLevel.L3, "DOMContentLoaded callback failed", { error: String(error) })
				}
			}

			for (const record of loadListeners) {
				if (!record.pendingTask) continue
				if (pendingTasks.includes(record.pendingTask)) continue
				pendingTasks.push(record.pendingTask)
			}
			for (const record of domReadyListeners) {
				if (!record.pendingTask) continue
				if (pendingTasks.includes(record.pendingTask)) continue
				pendingTasks.push(record.pendingTask)
			}
			for (const task of inFlightTasks) {
				if (pendingTasks.includes(task)) continue
				pendingTasks.push(task)
			}

			await Promise.allSettled(pendingTasks)

			if (!isRestored()) {
				if (previousPhase === INTERCEPTOR_PHASE.INITIALIZED)
					transitionPhase(INTERCEPTOR_PHASE.INITIALIZED)
				else transitionPhase(INTERCEPTOR_PHASE.CAPTURE_ONLY)
			}
		},
		restore() {
			if (isRestored()) return
			transitionPhase(INTERCEPTOR_PHASE.RESTORED)
			win.addEventListener = originalAddEventListener
			win.removeEventListener = originalRemoveEventListener
			win.document.addEventListener = originalDocumentAddEventListener
			win.document.removeEventListener = originalDocumentRemoveEventListener
			try {
				if (originalOnloadDescriptor) {
					Object.defineProperty(win, "onload", originalOnloadDescriptor)
					return
				}
				delete (win as { onload?: unknown }).onload
			} catch (error) {
				log(LogLevel.L3, "restore window.onload failed", { error: String(error) })
			}
		},
	}
}
