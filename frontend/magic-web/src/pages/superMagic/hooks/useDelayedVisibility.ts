import { useEffect, useState } from "react"

interface UseDelayedVisibilityOptions {
	visible: boolean
	delayMs?: number
}

export function useDelayedVisibility({ visible, delayMs = 180 }: UseDelayedVisibilityOptions) {
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		if (!visible) {
			setIsVisible(false)
			return
		}

		if (delayMs <= 0) {
			setIsVisible(true)
			return
		}

		const timerId = window.setTimeout(() => {
			setIsVisible(true)
		}, delayMs)

		return () => window.clearTimeout(timerId)
	}, [delayMs, visible])

	return isVisible
}
