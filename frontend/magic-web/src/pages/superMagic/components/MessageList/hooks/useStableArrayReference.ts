import { useRef } from "react"

/**
 * Reuses the previous array only when it represents the exact same element collection.
 * This is intentionally shallow: message objects remain canonical and are never copied here.
 */
export function useStableArrayReference<T>(next: T[]): T[] {
	const previousRef = useRef<T[] | undefined>(undefined)
	const previous = previousRef.current

	if (
		previous &&
		previous.length === next.length &&
		previous.every((item, index) => Object.is(item, next[index]))
	) {
		return previous
	}

	previousRef.current = next
	return next
}
