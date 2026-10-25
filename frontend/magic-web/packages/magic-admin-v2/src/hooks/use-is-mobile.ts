import { useEffect, useState } from "react"

const mobileMediaQuery = "(max-width: 767px)"

/** Returns whether the viewport currently matches the Admin mobile breakpoint. */
export function useIsMobile() {
	const [isMobile, setIsMobile] = useState(() =>
		typeof window === "undefined" ? false : window.matchMedia(mobileMediaQuery).matches,
	)

	useEffect(() => {
		const mediaQuery = window.matchMedia(mobileMediaQuery)
		const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

		setIsMobile(mediaQuery.matches)
		mediaQuery.addEventListener("change", handleChange)
		return () => mediaQuery.removeEventListener("change", handleChange)
	}, [])

	return isMobile
}
