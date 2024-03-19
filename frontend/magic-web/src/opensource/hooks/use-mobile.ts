import * as React from "react"

const DEFAULT_BREAKPOINT = 768

/**
 * Hook to detect mobile viewport based on breakpoint.
 * Uses matchMedia for efficient resize detection.
 *
 * @param breakpoint - Width in px, below which is considered mobile (default: 768)
 */
export function useIsMobile(breakpoint = DEFAULT_BREAKPOINT) {
	const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
		const onChange = () => {
			setIsMobile(window.innerWidth < breakpoint)
		}
		mql.addEventListener("change", onChange)
		setIsMobile(window.innerWidth < breakpoint)
		return () => mql.removeEventListener("change", onChange)
	}, [breakpoint])

	return !!isMobile
}
