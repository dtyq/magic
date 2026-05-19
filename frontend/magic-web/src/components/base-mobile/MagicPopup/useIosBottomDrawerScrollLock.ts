import { useCallback, useEffect, useMemo, useRef } from "react"

interface UseIosBottomDrawerScrollLockOptions {
	position?: "bottom" | "top" | "left" | "right"
}

interface UseIosBottomDrawerScrollLockResult {
	contentRef: React.MutableRefObject<HTMLDivElement | null>
	contentStyle: React.CSSProperties | undefined
	handleContentRef: (node: HTMLDivElement | null) => void
}

export function useIosBottomDrawerScrollLock({
	position,
}: UseIosBottomDrawerScrollLockOptions): UseIosBottomDrawerScrollLockResult {
	const contentRef = useRef<HTMLDivElement | null>(null)
	const contentScrollCleanupRef = useRef<(() => void) | null>(null)
	const shouldLockIosBottomContentScroll = position === "bottom" && isIosWebKit()

	const resetContentScrollIfNeeded = useCallback(
		(element?: HTMLDivElement | null) => {
			const currentContentElement = element ?? contentRef.current
			if (!currentContentElement || !shouldLockIosBottomContentScroll) return
			if (currentContentElement.scrollTop === 0) return

			currentContentElement.scrollTop = 0
		},
		[shouldLockIosBottomContentScroll],
	)

	useEffect(() => {
		return () => {
			contentScrollCleanupRef.current?.()
			contentScrollCleanupRef.current = null
		}
	}, [])

	const handleContentRef = useCallback(
		(node: HTMLDivElement | null) => {
			contentScrollCleanupRef.current?.()
			contentScrollCleanupRef.current = null
			contentRef.current = node
			if (!node) return

			function handleContentScroll() {
				resetContentScrollIfNeeded(node)
			}

			node.addEventListener("scroll", handleContentScroll, { passive: true })
			contentScrollCleanupRef.current = () => {
				node.removeEventListener("scroll", handleContentScroll)
			}

			resetContentScrollIfNeeded(node)
		},
		[resetContentScrollIfNeeded],
	)

	const contentStyle = useMemo(
		() =>
			shouldLockIosBottomContentScroll
				? {
						overflowY: "clip" as const,
						overscrollBehaviorY: "none" as const,
					}
				: undefined,
		[shouldLockIosBottomContentScroll],
	)

	return {
		contentRef,
		contentStyle,
		handleContentRef,
	}
}

function isIosWebKit() {
	if (typeof window === "undefined") return false

	const { userAgent, platform, maxTouchPoints } = window.navigator
	const isAppleMobile =
		/iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)

	return isAppleMobile && /WebKit/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent)
}
