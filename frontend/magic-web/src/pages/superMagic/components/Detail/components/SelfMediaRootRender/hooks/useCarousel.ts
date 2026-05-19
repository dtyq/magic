import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

interface UseCarouselArgs {
	total: number
	initialIndex?: number
	enableKeyboard?: boolean
	enableWheel?: boolean
	enableDrag?: boolean
	dragThreshold?: number
}

interface UseCarouselResult<E extends HTMLElement> {
	index: number
	setIndex: (next: number) => void
	next: () => void
	prev: () => void
	goTo: (next: number) => void
	dragging: boolean
	dragOffset: number
	bind: {
		ref: React.RefObject<E>
		onPointerDown: React.PointerEventHandler<E>
		onPointerMove: React.PointerEventHandler<E>
		onPointerUp: React.PointerEventHandler<E>
		onPointerCancel: React.PointerEventHandler<E>
		onWheel: React.WheelEventHandler<E>
	}
}

/** Accumulate wheel delta; one step after this many px (trackpads fire often). */
const WHEEL_AGGREGATE_PX = 80

type WheelNavContext = {
	enableWheel: boolean
	total: number
	dragging: boolean
	next: () => void
	prev: () => void
}

/** Generic carousel state machine (drag + keyboard). */
export function useCarousel<E extends HTMLElement = HTMLDivElement>({
	total,
	initialIndex = 0,
	enableKeyboard = true,
	enableWheel = true,
	enableDrag = true,
	dragThreshold = 60,
}: UseCarouselArgs): UseCarouselResult<E> {
	const [index, setIndexState] = useState(initialIndex)
	const [dragging, setDragging] = useState(false)
	const [dragOffset, setDragOffset] = useState(0)
	const dragOffsetRef = useRef(0)
	const dragFinishConsumedRef = useRef(false)
	const wheelAccumRef = useRef(0)
	const startXRef = useRef(0)
	const pointerIdRef = useRef<number | null>(null)
	const ref = useRef<E>(null)
	const wheelContextRef = useRef<WheelNavContext>({
		enableWheel: true,
		total: 0,
		dragging: false,
		next: () => undefined,
		prev: () => undefined,
	})

	const clamp = useCallback(
		(value: number) => {
			if (total <= 0) return 0
			if (value < 0) return 0
			if (value > total - 1) return total - 1
			return value
		},
		[total],
	)

	const setIndex = useCallback(
		(next: number) => {
			setIndexState((prev) => {
				const safe = clamp(next)
				return safe === prev ? prev : safe
			})
		},
		[clamp],
	)

	const next = useCallback(() => {
		setIndexState((prevIdx) => {
			const safe = clamp(prevIdx + 1)
			return safe === prevIdx ? prevIdx : safe
		})
	}, [clamp])

	const prev = useCallback(() => {
		setIndexState((prevIdx) => {
			const safe = clamp(prevIdx - 1)
			return safe === prevIdx ? prevIdx : safe
		})
	}, [clamp])

	wheelContextRef.current = { enableWheel, total, dragging, next, prev }

	const goTo = useCallback((target: number) => setIndex(target), [setIndex])

	useEffect(() => {
		if (index >= total) setIndex(Math.max(0, total - 1))
	}, [index, setIndex, total])

	useEffect(() => {
		setIndex(initialIndex)
	}, [initialIndex, setIndex])

	useEffect(() => {
		if (!enableKeyboard) return
		const handler = (event: KeyboardEvent) => {
			if (event.key === "ArrowRight") next()
			else if (event.key === "ArrowLeft") prev()
		}
		window.addEventListener("keydown", handler)
		return () => window.removeEventListener("keydown", handler)
	}, [enableKeyboard, next, prev])

	const resetDrag = useCallback((target?: E | null) => {
		if (pointerIdRef.current !== null) {
			target?.releasePointerCapture?.(pointerIdRef.current)
			pointerIdRef.current = null
		}
		setDragging(false)
		dragOffsetRef.current = 0
		setDragOffset(0)
	}, [])

	const onPointerDown: React.PointerEventHandler<E> = useCallback(
		(event) => {
			if (!enableDrag) return
			const shouldStartDrag = !(event.pointerType === "mouse" && event.button !== 0)
			if (!shouldStartDrag) return
			startXRef.current = event.clientX
			pointerIdRef.current = event.pointerId
			setDragging(true)
			wheelAccumRef.current = 0
			dragOffsetRef.current = 0
			setDragOffset(0)
			;(event.currentTarget as E | undefined)?.setPointerCapture?.(event.pointerId)
		},
		[enableDrag],
	)

	const onPointerMove: React.PointerEventHandler<E> = useCallback(
		(event) => {
			if (!enableDrag || !dragging) return
			const o = event.clientX - startXRef.current
			dragOffsetRef.current = o
			setDragOffset(o)
		},
		[dragging, enableDrag],
	)

	const finishDrag = useCallback(
		(target?: E | null) => {
			if (!dragging) return
			if (dragFinishConsumedRef.current) return
			dragFinishConsumedRef.current = true
			queueMicrotask(() => {
				dragFinishConsumedRef.current = false
			})
			const offset = dragOffsetRef.current
			resetDrag(target)
			if (Math.abs(offset) < dragThreshold) return
			if (offset < 0) next()
			else prev()
		},
		[dragThreshold, dragging, next, prev, resetDrag],
	)

	const onPointerUp: React.PointerEventHandler<E> = useCallback(
		(event) => {
			finishDrag(event.currentTarget)
		},
		[finishDrag],
	)

	const onPointerCancel: React.PointerEventHandler<E> = useCallback(
		(event) => {
			resetDrag(event.currentTarget)
		},
		[resetDrag],
	)

	const applyWheel = useCallback(
		(event: Pick<WheelEvent, "deltaX" | "deltaY" | "preventDefault" | "stopPropagation">) => {
			const c = wheelContextRef.current
			if (!c.enableWheel || c.total <= 1 || c.dragging) return
			const dominantDelta =
				Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
			if (dominantDelta === 0) return
			event.preventDefault()
			event.stopPropagation()
			wheelAccumRef.current += dominantDelta
			const sum = wheelAccumRef.current
			if (sum >= WHEEL_AGGREGATE_PX) {
				wheelAccumRef.current -= WHEEL_AGGREGATE_PX
				c.next()
			} else if (sum <= -WHEEL_AGGREGATE_PX) {
				wheelAccumRef.current += WHEEL_AGGREGATE_PX
				c.prev()
			}
		},
		[],
	)

	const onWheel: React.WheelEventHandler<E> = useCallback(
		(event) => {
			const wheelLike =
				event.nativeEvent ??
				(event as unknown as Pick<
					WheelEvent,
					"deltaX" | "deltaY" | "preventDefault" | "stopPropagation"
				>)
			applyWheel(wheelLike)
		},
		[applyWheel],
	)

	useLayoutEffect(() => {
		const el = ref.current
		if (!el || !enableWheel || total <= 1) return

		const listener = (event: WheelEvent) => applyWheel(event)
		el.addEventListener("wheel", listener, { passive: false })
		return () => el.removeEventListener("wheel", listener)
	}, [applyWheel, enableWheel, total])

	useEffect(() => {
		if (!dragging) return
		const handleWindowPointerUp = () => finishDrag(ref.current)
		const handleWindowPointerCancel = () => resetDrag(ref.current)
		window.addEventListener("pointerup", handleWindowPointerUp)
		window.addEventListener("pointercancel", handleWindowPointerCancel)
		window.addEventListener("blur", handleWindowPointerCancel)
		return () => {
			window.removeEventListener("pointerup", handleWindowPointerUp)
			window.removeEventListener("pointercancel", handleWindowPointerCancel)
			window.removeEventListener("blur", handleWindowPointerCancel)
		}
	}, [dragging, finishDrag, resetDrag])

	return {
		index,
		setIndex,
		next,
		prev,
		goTo,
		dragging,
		dragOffset,
		bind: {
			ref,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel,
			onWheel,
		},
	}
}
