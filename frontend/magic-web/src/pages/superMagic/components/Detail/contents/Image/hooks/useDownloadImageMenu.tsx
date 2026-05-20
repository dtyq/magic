import { useTranslation } from "react-i18next"
import { lazy, Suspense, useMemo, useState } from "react"
import { Flex } from "antd"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import { useMemoizedFn } from "ahooks"
import { isInternationalEnv } from "@/utils/env"
import { useAiWatermarkPreference } from "@/hooks/useAiWatermarkPreference"

const loadWaterMarkFreeModal = () => {
	return import("../../../../WaterMarkFreeModal").then((module) => ({
		default: module.WaterMarkFreeModal,
	}))
}

const WaterMarkFreeModal = lazy(() => loadWaterMarkFreeModal())

interface UseDownloadImageMenuProps {
	/* 下载回调 */
	onDownload?: (mode?: DownloadImageMode, item?: AttachmentItem) => void
}

/**
 * AI image download menu: routes no-watermark action through agreement modal when required.
 */
export function useDownloadImageMenu({ onDownload }: UseDownloadImageMenuProps) {
	const { t } = useTranslation("super")
	const [visible, setVisible] = useState(false)
	const [downloadItem, setDownloadItem] = useState<AttachmentItem | undefined>()
	const isInternationalSite = useMemo(() => isInternationalEnv(), [])
	const [initialized, setInitialized] = useState(false)
	const { hasGlobalAgreement, isFreeTrialVersion } = useAiWatermarkPreference()

	const preloadWaterMarkFreeModal = useMemoizedFn(() => {
		void loadWaterMarkFreeModal().then(() => {
			setInitialized(true)
		})
	})

	const shouldUseSingleDownloadEntry =
		!isInternationalSite && hasGlobalAgreement && !isFreeTrialVersion

	const downloadImageDropdownItems = useMemo(() => {
		if (shouldUseSingleDownloadEntry) {
			return [
				{
					key: "download",
					label: t("fileViewer.downloadImage"),
				},
			]
		}

		return [
			{
				key: "download",
				label: t("fileViewer.downloadImage"),
			},
			{
				key: "downloadNoWaterMark",
				label: (
					<Flex align="center" gap={4}>
						<span>{t("fileViewer.downloadNoWaterMark")}</span>
					</Flex>
				),
			},
		]
	}, [shouldUseSingleDownloadEntry, t])

	/** Open agreement modal or download directly depending on site and user agreement state. */
	const handleDownloadNoWaterMark = (item?: AttachmentItem) => {
		if (isInternationalSite || hasGlobalAgreement) {
			onDownload?.(DownloadImageMode.HighQuality, item)
			return
		}

		setDownloadItem(item)
		setVisible(true)
	}

	const downloadMenuClick = ({ key }: { key: string }) => {
		switch (key) {
			case "download":
				if (shouldUseSingleDownloadEntry) {
					onDownload?.(DownloadImageMode.HighQuality)
					break
				}
				onDownload?.(DownloadImageMode.NormalDownload)
				break
			case "downloadNoWaterMark":
				handleDownloadNoWaterMark()
				break
		}
	}

	const agreementModal = useMemo(() => {
		return (
			(initialized || visible) && (
				<Suspense fallback={null}>
					<WaterMarkFreeModal
						visible={visible}
						onClose={() => {
							setVisible(false)
							setDownloadItem(undefined)
						}}
						onConfirm={() => {
							setVisible(false)
							onDownload?.(DownloadImageMode.HighQuality, downloadItem)
							setDownloadItem(undefined)
						}}
					/>
				</Suspense>
			)
		)
	}, [downloadItem, initialized, onDownload, visible])

	return {
		agreementModal,
		downloadImageDropdownItems,
		isFreeTrialVersion,
		downloadMenuClick,
		handleDownloadNoWaterMark,
		preloadWaterMarkFreeModal,
		shouldUseSingleDownloadEntry,
	}
}
