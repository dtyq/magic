import { useEffect, useRef } from "react"
import type { NotificationCategory, NotificationId } from "./types"

export const NOTIFICATION_AUTO_READ_DELAY_MS = 1000
export const NOTIFICATION_AUTO_READ_THRESHOLD = 0.7

interface UseNotificationAutoReadOptions {
	enabled: boolean
	root: Element | null
	/** Re-bind observers when unread flags or tab membership change. */
	revision: string
	onRead: (id: NotificationId) => void
}

function isSystemUnreadTarget(element: Element) {
	return (
		element.getAttribute("data-inbox-category") === ("system" satisfies NotificationCategory) &&
		element.getAttribute("data-inbox-unread") === "true"
	)
}

/** Share of the card that currently sits inside the list scrollport. */
function visibleFraction(entry: IntersectionObserverEntry) {
	const targetArea = entry.boundingClientRect.width * entry.boundingClientRect.height
	if (targetArea > 0) {
		const visibleArea = entry.intersectionRect.width * entry.intersectionRect.height
		return visibleArea / targetArea
	}
	return entry.intersectionRatio
}

function isQualified(entry: IntersectionObserverEntry) {
	return (
		isSystemUnreadTarget(entry.target) &&
		entry.isIntersecting &&
		visibleFraction(entry) >= NOTIFICATION_AUTO_READ_THRESHOLD
	)
}

/**
 * Marks a system message read only after at least 70% of it stays inside the
 * list scrollport for about 1s. Dropping below 70% restarts that dwell.
 * The clock is kept across list re-renders so marking one card does not
 * restart the wait for cards that are still on screen. Auth cards are ignored.
 */
export function useNotificationAutoRead({
	enabled,
	root,
	revision,
	onRead,
}: UseNotificationAutoReadOptions) {
	const onReadRef = useRef(onRead)
	onReadRef.current = onRead
	const visibleSinceRef = useRef(new Map<string, number>())

	useEffect(() => {
		const visibleSince = visibleSinceRef.current
		return () => {
			visibleSince.clear()
		}
	}, [enabled, root])

	useEffect(() => {
		void revision
		if (!enabled || !root || typeof IntersectionObserver === "undefined") return

		const readTimers = new Map<string, ReturnType<typeof setTimeout>>()

		const clearTimer = (id: string) => {
			const timer = readTimers.get(id)
			if (!timer) return
			clearTimeout(timer)
			readTimers.delete(id)
		}

		const scheduleRead = (id: string, card: Element) => {
			if (readTimers.has(id)) return
			const since = visibleSinceRef.current.get(id)
			if (since == null) return
			const remaining = Math.max(0, NOTIFICATION_AUTO_READ_DELAY_MS - (Date.now() - since))
			readTimers.set(
				id,
				setTimeout(() => {
					readTimers.delete(id)
					if (!visibleSinceRef.current.has(id) || !isSystemUnreadTarget(card)) return
					visibleSinceRef.current.delete(id)
					onReadRef.current(id as NotificationId)
				}, remaining),
			)
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const now = Date.now()
				entries.forEach((entry) => {
					const card = entry.target
					const id = card.getAttribute("data-inbox-id")
					if (!id) return

					if (!isQualified(entry)) {
						visibleSinceRef.current.delete(id)
						clearTimer(id)
						return
					}

					if (!visibleSinceRef.current.has(id)) visibleSinceRef.current.set(id, now)
					scheduleRead(id, card)
				})
			},
			{ root, threshold: [0, NOTIFICATION_AUTO_READ_THRESHOLD, 1] },
		)

		const cards = root.querySelectorAll("[data-inbox-id]")
		const liveIds = new Set<string>()
		cards.forEach((card) => {
			const id = card.getAttribute("data-inbox-id")
			if (id) liveIds.add(id)
			observer.observe(card)
		})
		visibleSinceRef.current.forEach((_since, id) => {
			if (!liveIds.has(id)) visibleSinceRef.current.delete(id)
		})

		return () => {
			observer.disconnect()
			readTimers.forEach((timer) => clearTimeout(timer))
			readTimers.clear()
		}
	}, [enabled, revision, root])
}
