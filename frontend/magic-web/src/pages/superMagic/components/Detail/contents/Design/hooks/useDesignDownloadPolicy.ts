import { useMemoizedFn } from "ahooks"
import type { CanvasFileElement } from "@/components/CanvasDesign/canvas/types"
import type { MagicPermissions } from "@/components/CanvasDesign/types.magic"

export interface HandleHighQualityDownloadOptions {
	fileElements: CanvasFileElement[]
	skipAgreementCheck?: boolean
	executeDownload: () => Promise<void>
}

export interface UseDesignDownloadPolicyResult {
	permissions: MagicPermissions
	waterMarkFreeModalVisible: boolean
	setWaterMarkFreeModalVisible: (visible: boolean) => void
	downloadFileElements: CanvasFileElement[]
	setDownloadFileElements: (fileElements: CanvasFileElement[]) => void
	waterMarkFreeModalInitialized: boolean
	handleHighQualityDownload: (options: HandleHighQualityDownloadOptions) => Promise<void>
	handleAgreementConfirm: (executeDownload: () => Promise<void>) => Promise<void>
}

export function useDesignDownloadPolicy(): UseDesignDownloadPolicyResult {
	const handleSetWaterMarkFreeModalVisible = useMemoizedFn(() => undefined)
	const handleSetDownloadFileElements = useMemoizedFn(() => undefined)
	const handleHighQualityDownload = useMemoizedFn(
		async (options: HandleHighQualityDownloadOptions) => {
			await options.executeDownload()
		},
	)
	const handleAgreementConfirm = useMemoizedFn(async (executeDownload: () => Promise<void>) => {
		await executeDownload()
	})

	return {
		permissions: {
			disabledMarker: false,
			singleDownloadUsesNoWatermark: false,
		},
		waterMarkFreeModalVisible: false,
		setWaterMarkFreeModalVisible: handleSetWaterMarkFreeModalVisible,
		downloadFileElements: [],
		setDownloadFileElements: handleSetDownloadFileElements,
		waterMarkFreeModalInitialized: false,
		handleHighQualityDownload,
		handleAgreementConfirm,
	}
}
