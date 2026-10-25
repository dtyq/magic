import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { LiveRenderSlide } from "./usePPTLiveRenderCache"
import type { SlideItem } from "../PPTSidebar/types"
import type { PPTTransition } from "../utils/pptTransitions"
import { animatePPTTransition } from "../utils/pptTransitionAnimation"

export interface PPTSlideTransitionOptions {
	enabled: boolean
	getTransition: (slide: SlideItem) => PPTTransition
	/** Change this when leaving fullscreen, switching versions, or hiding the host tab. */
	lifecycleKey?: string
	/** Only sequential previous-page navigation reverses the configured direction. */
	backward?: boolean
}

interface TransitionRun {
	outgoingKey: string
	incomingKey: string
	outgoingRevision: string
	incomingRevision: string
	transition: PPTTransition
	backward: boolean
	lifecycleKey?: string
}

interface Options {
	activeEntry?: LiveRenderSlide
	entriesByKey: Map<string, LiveRenderSlide>
	readyRevisionByKey: Map<string, string>
	readyVersion: number
	transition?: PPTSlideTransitionOptions
}

/** Owns presentation commits; the cache owns loading and residency, never a second display state. */
export function usePPTSlideTransition({
	activeEntry,
	entriesByKey,
	readyRevisionByKey,
	readyVersion,
	transition,
}: Options) {
	const [presentedKey, setPresentedKey] = useState<string | null>(activeEntry?.key ?? null)
	const [run, setRun] = useState<TransitionRun | null>(null)
	const [reducedMotion, setReducedMotion] = useState(
		() =>
			typeof matchMedia === "function" &&
			matchMedia("(prefers-reduced-motion: reduce)").matches,
	)
	const layersRef = useRef(new Map<string, HTMLDivElement>())
	const animationRef = useRef<ReturnType<typeof animatePPTTransition> | null>(null)
	const generationRef = useRef(0)
	const skipAnimationForKeyRef = useRef<string | null>(null)
	const runRef = useRef(run)
	runRef.current = run
	const registerTransitionLayer = useCallback((key: string, element: HTMLDivElement | null) => {
		if (element) layersRef.current.set(key, element)
		else layersRef.current.delete(key)
	}, [])
	const cancelAnimation = useCallback(() => {
		generationRef.current++
		animationRef.current?.cancel()
		animationRef.current = null
	}, [])

	useEffect(() => {
		if (typeof matchMedia !== "function") return
		const query = matchMedia("(prefers-reduced-motion: reduce)")
		const update = () => setReducedMotion(query.matches)
		query.addEventListener?.("change", update)
		return () => query.removeEventListener?.("change", update)
	}, [])

	// A new navigation cancels to the ready incoming page, then uses it as the next origin.
	// Revision/scope changes invalidate callbacks before they can commit an obsolete iframe.
	useLayoutEffect(() => {
		if (skipAnimationForKeyRef.current !== activeEntry?.key)
			skipAnimationForKeyRef.current = null
		const isReady = (key: string, revision?: string) => {
			const entry = entriesByKey.get(key)
			return Boolean(
				entry &&
				(!revision || entry.revision === revision) &&
				readyRevisionByKey.get(key) === entry.revision,
			)
		}
		if (run) {
			const valid =
				activeEntry?.key === run.incomingKey &&
				isReady(run.incomingKey, run.incomingRevision) &&
				isReady(run.outgoingKey, run.outgoingRevision) &&
				transition?.enabled &&
				!reducedMotion &&
				transition.lifecycleKey === run.lifecycleKey
			if (valid) return
			cancelAnimation()
			runRef.current = null
			if (activeEntry?.key === run.incomingKey)
				skipAnimationForKeyRef.current = activeEntry.key
			setRun(null)
			setPresentedKey(
				isReady(run.incomingKey, run.incomingRevision)
					? run.incomingKey
					: entriesByKey.has(run.outgoingKey)
						? run.outgoingKey
						: (activeEntry?.key ?? null),
			)
			return
		}
		if (!presentedKey || !entriesByKey.has(presentedKey)) {
			setPresentedKey(activeEntry?.key ?? null)
			return
		}
		if (!activeEntry || activeEntry.key === presentedKey) {
			skipAnimationForKeyRef.current = null
			return
		}
		if (!isReady(activeEntry.key)) return
		const outgoing = entriesByKey.get(presentedKey)
		const effect =
			transition?.enabled && !reducedMotion
				? transition.getTransition(activeEntry.slide)
				: { effect: "none" as const }
		if (
			!outgoing ||
			!isReady(presentedKey) ||
			effect.effect === "none" ||
			skipAnimationForKeyRef.current === activeEntry.key ||
			activeEntry.slide.loadingState !== "loaded" ||
			!activeEntry.slide.content?.trim() ||
			!layersRef.current.has(presentedKey) ||
			!layersRef.current.has(activeEntry.key)
		) {
			setPresentedKey(activeEntry.key)
			skipAnimationForKeyRef.current = null
			return
		}
		setRun({
			outgoingKey: presentedKey,
			incomingKey: activeEntry.key,
			outgoingRevision: outgoing.revision,
			incomingRevision: activeEntry.revision,
			transition: effect,
			backward: transition?.backward ?? activeEntry.index === outgoing.index - 1,
			lifecycleKey: transition?.lifecycleKey,
		})
	}, [
		run,
		presentedKey,
		entriesByKey,
		activeEntry,
		transition,
		reducedMotion,
		readyRevisionByKey,
		readyVersion,
		cancelAnimation,
	])

	// Run only after React has made both existing outer layers visible; scaling stays inside them.
	useLayoutEffect(() => {
		if (!run || runRef.current !== run) return
		const outgoing = layersRef.current.get(run.outgoingKey)
		const incoming = layersRef.current.get(run.incomingKey)
		if (!outgoing || !incoming) return
		const generation = ++generationRef.current
		const animation = animatePPTTransition(outgoing, incoming, run.transition, run.backward)
		animationRef.current = animation
		void animation.finished.then(() => {
			if (generationRef.current !== generation) return
			setPresentedKey(run.incomingKey)
			setRun(null)
		})
		return cancelAnimation
	}, [run, cancelAnimation])

	useLayoutEffect(() => cancelAnimation, [cancelAnimation])
	return { presentedKey, transitionState: run, registerTransitionLayer }
}
