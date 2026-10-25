import { useCallback, useRef } from "react"
import { SuperMagicApi } from "@/apis"

export function useMicroAppVisit(appId: string) {
	const recordedAppIdRef = useRef<string | null>(null)

	return useCallback(() => {
		if (!appId || recordedAppIdRef.current === appId) return
		recordedAppIdRef.current = appId
		void SuperMagicApi.recordMicroAppVisit(appId).catch((error) => {
			recordedAppIdRef.current = null
			console.error("Failed to record micro app visit:", error)
		})
	}, [appId])
}
