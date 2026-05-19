import { useCallback, useEffect, type RefObject } from "react"

type OverflowAxis = "x" | "y"

interface UseOverflowChangeOptions<T extends HTMLElement> {
	targetRef: RefObject<T | null>
	axis: OverflowAxis
	enabled?: boolean
	onOverflowChange?: (hasOverflow: boolean) => void
	observeTargets?: (target: T) => Array<Element | null | undefined>
}

function hasOverflowByAxis(element: HTMLElement, axis: OverflowAxis): boolean {
	if (axis === "x") {
		return element.scrollWidth > element.clientWidth + 1
	}
	return element.scrollHeight > element.clientHeight + 1
}

export function useOverflowChange<T extends HTMLElement>({
	targetRef,
	axis,
	enabled = true,
	onOverflowChange,
	observeTargets,
}: UseOverflowChangeOptions<T>) {
	const checkOverflow = useCallback(() => {
		if (!enabled || !onOverflowChange) {
			onOverflowChange?.(false)
			return false
		}

		const target = targetRef.current
		if (!target) {
			onOverflowChange(false)
			return false
		}

		const hasOverflow = hasOverflowByAxis(target, axis)
		onOverflowChange(hasOverflow)
		return hasOverflow
	}, [axis, enabled, onOverflowChange, targetRef])

	useEffect(() => {
		if (!enabled || !onOverflowChange) {
			onOverflowChange?.(false)
			return
		}

		const target = targetRef.current
		if (!target) {
			onOverflowChange(false)
			return
		}

		const nodes = [target, ...(observeTargets?.(target) ?? [])].filter(
			(node): node is Element => node instanceof Element,
		)

		const resizeObserver = new ResizeObserver(() => {
			checkOverflow()
		})
		nodes.forEach((node) => resizeObserver.observe(node))
		checkOverflow()
		window.addEventListener("resize", checkOverflow)

		return () => {
			resizeObserver.disconnect()
			window.removeEventListener("resize", checkOverflow)
		}
	}, [checkOverflow, enabled, observeTargets, onOverflowChange, targetRef])

	return {
		checkOverflow,
	}
}
