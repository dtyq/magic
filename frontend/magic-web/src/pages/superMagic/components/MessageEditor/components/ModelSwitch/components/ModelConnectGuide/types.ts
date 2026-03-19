import type { RefObject } from "react"

export interface ModelConnectGuideProps {
	enabled?: boolean
	anchorRef?: RefObject<HTMLElement>
	onConnect?: () => void
}
