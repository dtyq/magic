import PublishedMicroAppPreviewSurface from "@/pages/share/microApp/components/PublishedMicroAppPreviewSurface"
import { usePublishedMicroAppPreview } from "@/pages/share/microApp/hooks/usePublishedMicroAppPreview"

export interface MicroAppPreviewContentProps {
	appId: string
	appName?: string
	onLeave?: () => void
}

function MicroAppPreviewContent({ appId, appName, onLeave }: MicroAppPreviewContentProps) {
	const preview = usePublishedMicroAppPreview({ appId, appName })

	return (
		<PublishedMicroAppPreviewSurface
			preview={preview}
			onLeave={onLeave}
			testIdPrefix="micro-app-tab"
			rootTestId="micro-app-tab-content"
		/>
	)
}

export default MicroAppPreviewContent
