import { useCallback, useEffect, useState } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SuperMagicOpenMicroAppTabPayload } from "@/pages/superMagic/events/openFileTab"
import type { PublishedMicroAppTabData } from "@/pages/superMagic/components/Detail/components/FilesViewer/hooks/usePublishedMicroAppTab"

function normalizeMicroAppPreviewData(
	payload: Partial<SuperMagicOpenMicroAppTabPayload>,
): PublishedMicroAppTabData | null {
	const appId = payload.appId?.trim()
	if (!appId) return null

	const appName = payload.appName?.trim() || undefined
	return { appId, appName }
}

export function useMobileMicroAppPreview() {
	const [visible, setVisible] = useState(false)
	const [previewData, setPreviewData] = useState<PublishedMicroAppTabData | null>(null)

	const close = useCallback(() => {
		setVisible(false)
	}, [])

	useEffect(() => {
		const handleOpenMicroAppPreview = (data: unknown) => {
			const nextData = normalizeMicroAppPreviewData(
				data as Partial<SuperMagicOpenMicroAppTabPayload>,
			)
			if (!nextData) return

			setPreviewData(nextData)
			setVisible(true)
		}

		pubsub.subscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppPreview)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppPreview)
		}
	}, [])

	return {
		visible,
		previewData,
		close,
	}
}

export type UseMobileMicroAppPreviewReturn = ReturnType<typeof useMobileMicroAppPreview>
