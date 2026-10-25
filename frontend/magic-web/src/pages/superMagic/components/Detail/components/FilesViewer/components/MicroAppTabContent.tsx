import { memo } from "react"
import MicroAppPreviewContent from "../../MicroAppPreviewContent"
import type { PublishedMicroAppTabData } from "../hooks/usePublishedMicroAppTab"

export interface MicroAppTabContentProps {
	data: PublishedMicroAppTabData
	onLeave?: () => void
}

function MicroAppTabContent({ data, onLeave }: MicroAppTabContentProps) {
	return <MicroAppPreviewContent appId={data.appId} appName={data.appName} onLeave={onLeave} />
}

export default memo(MicroAppTabContent)
