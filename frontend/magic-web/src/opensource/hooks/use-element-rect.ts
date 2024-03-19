"use client"

import * as React from "react"
import { useThrottledCallback } from "./use-throttled-callback"

export type RectState = Omit<DOMRect, "toJSON">

export interface ElementRectOptions {
	/**
	 * The element to track. Can be an Element, ref, or selector string.
	 * Defaults to document.body if not provided.
	 */
	element?: Element | React.RefObject<Element> | string | null
	/**
	 * Whether to enable rect tracking
	 */
	enabled?: boolean
	/**
	 * Throttle delay in milliseconds for rect updates
	 */
	throttleMs?: number
	/**
	 * Whether to use ResizeObserver for more accurate tracking
	 */
	useResizeObserver?: boolean
}

const initialRect: RectState = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	top: 0,
	right: 0,
	bottom: 0,
	left: 0,
}

const isSSR = typeof window === "undefined"
const hasResizeObserver = !isSSR && typeof ResizeObserver !== "undefined"

/**
 * Helper function to check if code is running on client side
 */
const isClientSide = (): boolean => !isSSR

/**
 * Custom hook that tracks an element's bounding rectangle and updates on resize, scroll, etc.
 *
 * @param options Configuration options for element rect tracking
 * @returns The current bounding rectangle of the element
 */
export function useElementRect({
	element,
	enabled = true,
	throttleMs = 100,
	useResizeObserver = true,
}: ElementRectOptions = {}): RectState {
	const [rect, setRect] = React.useState<RectState>(initialRect)

	const getTargetElement = React.useCallback((): Element | null => {
		if (!enabled || !isClientSide()) return null

		if (!element) {
			return document.body
		}

		if (typeof element === "string") {
			return document.querySelector(element)
		}

		if ("current" in element) {
			return element.current
		}

		return element
	}, [element, enabled])

	const updateRect = useThrottledCallback(
		() => {
			if (!enabled || !isClientSide()) return

			const targetElement = getTargetElement()
			if (!targetElement) {
				setRect(initialRect)
				return
			}

			const newRect = targetElement.getBoundingClientRect()
			setRect({
				x: newRect.x,
				y: newRect.y,
				width: newRect.width,
				height: newRect.height,
				top: newRect.top,
				right: newRect.right,
				bottom: newRect.bottom,
				left: newRect.left,
			})
		},
		throttleMs,
		[enabled, getTargetElement],
		{ leading: true, trailing: true },
	)

	React.useEffect(() => {
		if (!enabled || !isClientSide()) {
			setRect(initialRect)
			return
		}

		const targetElement = getTargetElement()
		if (!targetElement) return

		updateRect()

		const cleanup: (() => void)[] = []

		if (useResizeObserver && hasResizeObserver) {
			const resizeObserver = new ResizeObserver(() => {
				window.requestAnimationFrame(updateRect)
			})
			resizeObserver.observe(targetElement)
			cleanup.push(() => resizeObserver.disconnect())
		}

		const handleUpdate = () => updateRect()

		window.addEventListener("scroll", handleUpdate, { passive: true })
		window.addEventListener("resize", handleUpdate, { passive: true })

		cleanup.push(() => {
			window.removeEventListener("scroll", handleUpdate)
			window.removeEventListener("resize", handleUpdate)
		})

		return () => {
			cleanup.forEach((fn) => fn())
			setRect(initialRect)
		}
	}, [enabled, getTargetElement, updateRect, useResizeObserver])

	return rect
}

/**
 * Convenience hook for tracking document.body rect
 */
export function useBodyRect(options: Omit<ElementRectOptions, "element"> = {}): RectState {
	return useElementRect({
		...options,
		element: isClientSide() ? document.body : null,
	})
}

/**
 * Convenience hook for tracking a ref element's rect
 */
export function useRefRect<T extends Element>(
	ref: React.RefObject<T>,
	options: Omit<ElementRectOptions, "element"> = {},
): RectState {
	return useElementRect({ ...options, element: ref })
}
