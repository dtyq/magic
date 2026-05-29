import type { FloatingMenuAnchor } from "../MobileShellRecentFloatingMenu"

/** Reads pointer coordinates from touch or mouse long-press events. */
export function getRecentItemActionAnchor(event: MouseEvent | TouchEvent): FloatingMenuAnchor {
	// Use `touches` to narrow without relying on global TouchEvent (keeps SSR-safe typing).
	if ("touches" in event) {
		const touch = event.changedTouches[0] ?? event.touches[0]
		return {
			clientX: touch?.clientX ?? 0,
			clientY: touch?.clientY ?? 0,
		}
	}

	return {
		clientX: event.clientX,
		clientY: event.clientY,
	}
}
