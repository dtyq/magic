import { useEffect, useSyncExternalStore } from "react"
import { useResponsive } from "ahooks"
import { interfaceStore } from "@/stores/interface"
import { isMobile as isMobileDevice } from "@/utils/devices"
import { useMagicWidgetConfig } from "@/providers/MagicWidgetProvider/context"
import {
	isMobilePresentationLayoutLocked,
	subscribeMobilePresentationLayout,
} from "@/stores/layout/mobilePresentationLayout"

/** Resolves mobile semantics with device-aware detection enabled by default for Widget embeds. */
export const useIsMobile = () => {
	const { md } = useResponsive()
	const { embedContext, config } = useMagicWidgetConfig()
	const isSmallViewport = !md
	const isDeviceAwareDetectionEnabled =
		Boolean(embedContext) && config.responsive?.mobileDetection !== "viewport"
	const viewportIsMobile = isDeviceAwareDetectionEnabled
		? isMobileDevice && isSmallViewport
		: isSmallViewport
	const presentationIsMobile = useSyncExternalStore(
		subscribeMobilePresentationLayout,
		isMobilePresentationLayoutLocked,
		() => false,
	)
	// Rotation must resize the slide, not replace the route/dialog that owns its fullscreen state.
	const isMobile = presentationIsMobile || viewportIsMobile

	useEffect(() => {
		interfaceStore.setIsMobile(isMobile)
	}, [isMobile])

	return isMobile
}
