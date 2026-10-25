import { useEffect } from "react"
import type { ReactNode } from "react"
import type { CanvasFileElement } from "@/components/CanvasDesign/runtime/document/types"
import type { MagicPermissions } from "@/components/CanvasDesign/public/magic-types"
import { useAiImageDownloadPolicy } from "@/pages/superMagic/hooks/useAiImageDownloadPolicy"

export interface HandleHighQualityDownloadOptions {
	fileElements: CanvasFileElement[]
	skipAgreementCheck?: boolean
	executeDownload: () => Promise<void>
}

export interface UseDesignDownloadPolicyResult {
	permissions: MagicPermissions
	agreementModal: ReactNode
	handleHighQualityDownload: (options: HandleHighQualityDownloadOptions) => Promise<void>
}

export function useDesignDownloadPolicy(): UseDesignDownloadPolicyResult {
	type PendingCanvasDownload = HandleHighQualityDownloadOptions
	const {
		agreementModal,
		isFreeTrialVersion,
		preloadWaterMarkFreeModal,
		shouldUseSingleDownloadEntry,
		handleDownloadNoWaterMark,
	} = useAiImageDownloadPolicy<PendingCanvasDownload>({
		onDownload: async (_mode, pendingDownload) => {
			await pendingDownload?.executeDownload()
		},
	})

	// 预加载无水印协议弹窗，避免首次点击时懒加载卡顿/失败导致无响应。
	useEffect(() => {
		preloadWaterMarkFreeModal()
	}, [preloadWaterMarkFreeModal])

	const handleHighQualityDownload = async (options: HandleHighQualityDownloadOptions) => {
		if (options.skipAgreementCheck) {
			await options.executeDownload()
			return
		}

		handleDownloadNoWaterMark(options)
	}

	return {
		permissions: {
			disabledMarker: false,
			singleDownloadUsesNoWatermark: shouldUseSingleDownloadEntry,
			isFreeTrialVersion,
		},
		agreementModal,
		handleHighQualityDownload,
	}
}
