import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import {
	holdIframeAnimations,
	observeIframeAnimationPreparation,
	prepareIframeAnimations,
	releaseIframeAnimations,
	renewIframeAnimationHold,
} from "../utils/pptAnimationHold"

interface Options {
	content: string
	documentKey: string
	canReplayInPlace: boolean
	isActive: boolean
	isPresented: boolean
	isEditing: boolean
	isCodeView: boolean
	iframeMounted: boolean
	ready: boolean
	getIframe: () => HTMLIFrameElement | null
	restartDocument: () => void
	onReadyChange: (ready: boolean) => void
}

/** Prepare bounded resident frames; custom scripts retain the full-document replay contract. */
export function usePPTSlideReplay(options: Options) {
	const {
		content,
		documentKey,
		canReplayInPlace,
		isActive,
		isPresented,
		isEditing,
		isCodeView,
		iframeMounted,
		ready,
	} = options
	const getIframe = useMemoizedFn(options.getIframe)
	const [isPreparingReplay, setIsPreparingReplay] = useState(false)
	const isReplayPendingRef = useRef(false)
	const frameRef = useRef(0)
	const generationRef = useRef(0)
	const heldRef = useRef(false)
	const preparedAtRef = useRef<number | null>(null)
	const prepareRequestRef = useRef<string | null>(null)
	const unsupportedRef = useRef(false)
	const wasActiveRef = useRef(options.isActive)
	const wasPresentedRef = useRef(options.isPresented)
	const latestRef = useRef(options)
	latestRef.current = options

	const cancel = useMemoizedFn(() => {
		generationRef.current++
		window.cancelAnimationFrame(frameRef.current)
	})
	const finish = useMemoizedFn(() => {
		isReplayPendingRef.current = false
		setIsPreparingReplay(false)
		options.onReadyChange(true)
	})
	const afterPaint = useMemoizedFn((generation: number) => {
		frameRef.current = window.requestAnimationFrame(() => {
			if (generation !== generationRef.current) return
			frameRef.current = window.requestAnimationFrame(() => {
				if (generation === generationRef.current) finish()
			})
		})
	})
	const prepare = useMemoizedFn(() => {
		if (isReplayPendingRef.current) return
		cancel()
		const generation = generationRef.current
		isReplayPendingRef.current = true
		setIsPreparingReplay(true)
		options.onReadyChange(false)
		if (!options.canReplayInPlace || unsupportedRef.current) {
			options.restartDocument()
			return
		}
		const requestId = `ppt-prepare-${generation}`
		prepareRequestRef.current = requestId
		void prepareIframeAnimations(getIframe(), options.documentKey, requestId).then((ready) => {
			if (generation !== generationRef.current) return
			if (!ready) {
				unsupportedRef.current = true
				// Background failures do not reload speculative pages. Navigation retains the fallback.
				if (latestRef.current.isActive) latestRef.current.restartDocument()
				else finish()
				return
			}
			heldRef.current = true
			preparedAtRef.current = performance.now()
			afterPaint(generation)
		})
	})
	const onRenderReady = useMemoizedFn(() => {
		if (isReplayPendingRef.current) {
			cancel()
			const generation = generationRef.current
			heldRef.current = true
			void holdIframeAnimations(getIframe()).then(() => {
				if (generation === generationRef.current) afterPaint(generation)
			})
		} else if (
			options.canReplayInPlace &&
			!unsupportedRef.current &&
			!options.isPresented &&
			!options.isActive &&
			!options.isEditing &&
			!options.isCodeView
		) {
			// Freeze and paint the next page while the current one is still being read.
			prepare()
		} else {
			options.onReadyChange(true)
		}
	})

	useLayoutEffect(() => {
		cancel()
		if (heldRef.current) releaseIframeAnimations(getIframe())
		preparedAtRef.current = null
		prepareRequestRef.current = null
		unsupportedRef.current = false
		heldRef.current = false
		isReplayPendingRef.current = false
		setIsPreparingReplay(false)
	}, [content, documentKey, isEditing, isCodeView, cancel, getIframe])

	useEffect(() => {
		if (!iframeMounted || !canReplayInPlace || isEditing || isCodeView) return
		return observeIframeAnimationPreparation(getIframe(), documentKey, (requestId) => {
			if (prepareRequestRef.current !== requestId) return
			if (latestRef.current.isPresented) return
			// 样式晚到时重新证明当前文档可重播；不能继续沿用之前的 ready 和动画起点。
			cancel()
			preparedAtRef.current = null
			heldRef.current = false
			isReplayPendingRef.current = false
			prepare()
		})
	}, [
		iframeMounted,
		canReplayInPlace,
		isEditing,
		isCodeView,
		documentKey,
		getIframe,
		cancel,
		prepare,
	])

	useLayoutEffect(() => {
		const becameActive = isActive && !wasActiveRef.current
		const becameHidden = !isPresented && wasPresentedRef.current
		wasActiveRef.current = isActive
		wasPresentedRef.current = isPresented
		if (isPresented || isEditing || isCodeView) return
		if (!iframeMounted || !ready) return
		// The bridge's five-second safety release bounds prepared-frame reuse. Expired frames
		// rewind in place again; they still avoid shell, font, image and script loading.
		const prepared =
			preparedAtRef.current !== null && performance.now() - preparedAtRef.current < 4000
		if (becameActive && prepared) renewIframeAnimationHold(getIframe())
		else if (becameActive) prepare()
		else if (becameHidden && canReplayInPlace && !unsupportedRef.current) prepare()
	}, [
		isActive,
		isPresented,
		isEditing,
		isCodeView,
		iframeMounted,
		ready,
		canReplayInPlace,
		getIframe,
		prepare,
	])

	useLayoutEffect(() => {
		if (!isPresented || !heldRef.current || isReplayPendingRef.current) return
		heldRef.current = false
		preparedAtRef.current = null
		releaseIframeAnimations(getIframe())
	}, [isPresented, isPreparingReplay, getIframe])

	useEffect(() => {
		if (!isPreparingReplay) return
		const timer = window.setTimeout(() => {
			cancel()
			finish()
		}, 4000)
		return () => window.clearTimeout(timer)
	}, [isPreparingReplay, cancel, finish])
	useEffect(() => () => cancel(), [cancel])
	return { isPreparingReplay, isReplayPendingRef, onRenderReady }
}
