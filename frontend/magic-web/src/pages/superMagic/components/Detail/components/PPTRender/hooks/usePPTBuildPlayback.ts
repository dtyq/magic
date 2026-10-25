import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { setPPTBuildFrame, type PPTBuildFrameState } from "../utils/pptBuildBridge"

export interface PPTBuildController {
	state: PPTBuildFrameState
	acceptsMessage: (event: MessageEvent) => boolean
	setStep: (step: number, animate?: boolean) => Promise<boolean>
}

/** One controller per real slide. The deck owns navigation; the frame only acknowledges visibility. */
export function usePPTBuildPlayback(options: {
	documentKey: string
	hasBuilds: boolean
	enabled: boolean
	active: boolean
	startAtEnd?: boolean
	getIframe: () => HTMLIFrameElement | null
	onController: (controller: PPTBuildController | null) => void
	onAction?: () => void
	onFailure: () => void
	onIgnored?: () => void
}) {
	const [failed, setFailed] = useState(false)
	const [ready, setReady] = useState(false)
	const warnedDocument = useRef<string | null>(null)
	const generation = useRef(0)
	const busy = useRef(false)
	const abortRef = useRef<AbortController | null>(null)
	const previous = useRef({ active: false, enabled: false })
	const desiredStep = useRef(0)
	const pending = useRef<Promise<boolean> | null>(null)
	const readyFrame = useRef<{ iframe: HTMLIFrameElement; key: string } | null>(null)
	const latest = useRef(options)
	latest.current = options
	const state = useRef<PPTBuildFrameState>({ step: 0, total: 0 })
	const enabled = options.enabled && !failed
	const setStep = useMemoizedFn(async (step: number, animate = false) => {
		if (busy.current) return false
		const current = latest.current
		const iframe = current.getIframe()
		if (!current.hasBuilds) return true
		if (!iframe) return false
		busy.current = true
		desiredStep.current = step
		const operation = generation.current
		const abort = new AbortController()
		abortRef.current = abort
		try {
			const result = await setPPTBuildFrame(
				iframe,
				current.documentKey,
				enabled,
				step,
				animate,
				abort.signal,
			)
			if (operation !== generation.current || abort.signal.aborted) return false
			if (!result) {
				// Rebuilding without hiding is a fail-open fallback even if the old runtime is dead.
				setFailed(true)
				state.current = { step: 0, total: 0 }
				current.onController(null)
				current.onFailure()
				return false
			}
			state.current = enabled ? result : { step: 0, total: 0 }
			setReady(true)
			if (
				enabled &&
				current.active &&
				result.ignored &&
				warnedDocument.current !== current.documentKey
			) {
				warnedDocument.current = current.documentKey
				current.onIgnored?.()
			}
			if (current.active)
				current.onController({ state: state.current, setStep, acceptsMessage })
			return true
		} finally {
			if (operation === generation.current) busy.current = false
		}
	})
	const acceptsMessage = useMemoizedFn((event: MessageEvent) => {
		const iframe = latest.current.getIframe()
		return Boolean(
			iframe &&
			event.source === iframe.contentWindow &&
			event.origin ===
				new URL(iframe.src || window.location.href, window.location.href).origin,
		)
	})
	const initialize = useMemoizedFn((fromReady = false) => {
		const current = latest.current
		const iframe = current.getIframe()
		if (!current.hasBuilds) return Promise.resolve(true)
		if (fromReady && iframe) readyFrame.current = { iframe, key: current.documentKey }
		// Cold/new frames do not receive commands until their runtime is ready. A resident
		// frame can initialize on activation without waiting for another load event.
		if (
			!iframe ||
			readyFrame.current?.iframe !== iframe ||
			readyFrame.current.key !== current.documentKey
		)
			return Promise.resolve(false)
		if (failed) {
			if (!fromReady) return Promise.resolve(false)
			if (latest.current.active)
				latest.current.onController({
					state: { step: 0, total: 0 },
					setStep,
					acceptsMessage,
				})
			return Promise.resolve(true)
		}
		if (pending.current) return pending.current
		const promise = setStep(desiredStep.current)
		pending.current = promise
		void promise.finally(() => {
			if (pending.current === promise) pending.current = null
		})
		return promise
	})

	useLayoutEffect(() => {
		setFailed(false)
	}, [options.documentKey])
	useLayoutEffect(() => {
		abortRef.current?.abort()
		setReady(false)
		generation.current++
		busy.current = false
		state.current = { step: 0, total: 0 }
		const entering =
			options.active && enabled && (!previous.current.active || !previous.current.enabled)
		desiredStep.current = entering && latest.current.startAtEnd ? Number.MAX_SAFE_INTEGER : 0
		previous.current = { active: options.active, enabled }
		pending.current = null
		return () => {
			abortRef.current?.abort()
			busy.current = false
		}
	}, [options.documentKey, options.active, enabled])

	useEffect(() => {
		const current = latest.current
		if (!current.hasBuilds) return
		if (!current.active) {
			current.onController(null)
			return
		}
		void initialize()
		return () => current.onController(null)
	}, [
		options.active,
		enabled,
		options.documentKey,
		options.hasBuilds,
		initialize,
		options.onController,
	])
	useEffect(() => {
		if (!options.active || !enabled || !options.hasBuilds) return
		const onMessage = (event: MessageEvent) => {
			const current = latest.current
			const iframe = current.getIframe()
			if (
				!iframe ||
				event.source !== iframe.contentWindow ||
				event.origin !==
					new URL(iframe.src || window.location.href, window.location.href).origin ||
				event.data?.type !== "ppt-build:action" ||
				event.data.documentKey !== current.documentKey ||
				event.data.direction !== "next"
			)
				return
			current.onAction?.()
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [enabled, options.active, options.hasBuilds])
	return {
		failed,
		initialize,
		preparing: options.enabled && options.hasBuilds && !failed && !ready,
	}
}
