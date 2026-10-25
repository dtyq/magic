import { useState } from "react"

interface UseGuideTourProps {
	isMobile: boolean
}

const HTMLGuideTourElementId = {} as const
const setNeedHTMLGuideTour = () => undefined

const useHTMLGuideTour = ({ isMobile }: UseGuideTourProps) => {
	const [guideTourOpen, setGuideTourOpen] = useState(false)
	const guideTourSteps = []
	void isMobile

	return {
		guideTourOpen,
		setGuideTourOpen,
		guideTourSteps,
	}
}

export { useHTMLGuideTour, HTMLGuideTourElementId, setNeedHTMLGuideTour }
