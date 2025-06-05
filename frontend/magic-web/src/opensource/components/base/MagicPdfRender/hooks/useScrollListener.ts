import { useEffect } from "react"

interface UseScrollListenerProps {
	viewerRef: React.RefObject<HTMLDivElement>
	numPages: number
	pageNumber: number
	setPageNumber: (page: number) => void
}

export function useScrollListener({
	viewerRef,
	numPages,
	pageNumber,
	setPageNumber,
}: UseScrollListenerProps) {
	// Scroll listener to automatically update current page number
	useEffect(() => {
		const viewer = viewerRef.current
		if (!viewer || numPages === 0) return

		const handleScroll = () => {
			const viewerRect = viewer.getBoundingClientRect()
			const viewerCenter = viewerRect.top + viewerRect.height / 2

			// Find the page closest to the viewer center
			let closestPage = 1
			let minDistance = Infinity

			for (let i = 1; i <= numPages; i++) {
				const pageElement = viewer.querySelector(`[data-page-number="${i}"]`)
				if (pageElement) {
					const pageRect = pageElement.getBoundingClientRect()
					const pageCenter = pageRect.top + pageRect.height / 2
					const distance = Math.abs(pageCenter - viewerCenter)

					if (distance < minDistance) {
						minDistance = distance
						closestPage = i
					}
				}
			}

			if (closestPage !== pageNumber) {
				setPageNumber(closestPage)
			}
		}

		viewer.addEventListener("scroll", handleScroll)
		return () => viewer.removeEventListener("scroll", handleScroll)
	}, [numPages, pageNumber, setPageNumber, viewerRef])
}
