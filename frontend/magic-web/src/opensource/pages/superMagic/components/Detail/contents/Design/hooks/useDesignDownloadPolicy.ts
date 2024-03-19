import { useMemoizedFn } from "ahooks"
import type { ImageElement } from "@/opensource/components/CanvasDesign/canvas/types"
import type { MagicPermissions } from "@/opensource/components/CanvasDesign/types.magic"

export interface HandleHighQualityDownloadOptions {
	imageElements: ImageElement[]
	skipAgreementCheck?: boolean
	executeDownload: () => Promise<void>
}

export interface UseDesignDownloadPolicyResult {
	permissions: MagicPermissions
	waterMarkFreeModalVisible: boolean
	setWaterMarkFreeModalVisible: (visible: boolean) => void
	downloadImageElements: ImageElement[]
	setDownloadImageElements: (imageElements: ImageElement[]) => void
	waterMarkFreeModalInitialized: boolean
	handleHighQualityDownload: (options: HandleHighQualityDownloadOptions) => Promise<void>
}

export function useDesignDownloadPolicy(): UseDesignDownloadPolicyResult {
	const handleSetWaterMarkFreeModalVisible = useMemoizedFn(() => undefined)
	const handleSetDownloadImageElements = useMemoizedFn(() => undefined)
	const handleHighQualityDownload = useMemoizedFn(
		async (options: HandleHighQualityDownloadOptions) => {
			await options.executeDownload()
		},
	)

	return {
		permissions: {
			disabledMarker: false,
			downloadMenuMode: "single",
		},
		waterMarkFreeModalVisible: false,
		setWaterMarkFreeModalVisible: handleSetWaterMarkFreeModalVisible,
		downloadImageElements: [],
		setDownloadImageElements: handleSetDownloadImageElements,
		waterMarkFreeModalInitialized: false,
		handleHighQualityDownload,
	}
}
