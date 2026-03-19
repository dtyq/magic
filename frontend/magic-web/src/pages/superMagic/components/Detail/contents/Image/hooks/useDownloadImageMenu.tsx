import { useTranslation } from "react-i18next"
import { lazy, Suspense, useMemo, useState } from "react"
import { Flex } from "antd"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import { useMemoizedFn } from "ahooks"

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

export function useDownloadImageMenu({ onDownload }: UseDownloadImageMenuProps) {
	const { t } = useTranslation("super")
	const [visible, setVisible] = useState(false)
	const [downloadItem, setDownloadItem] = useState<AttachmentItem | undefined>()
	const [initialized, setInitialized] = useState(false)

	const preloadWaterMarkFreeModal = useMemoizedFn(() => {
		void loadWaterMarkFreeModal().then(() => {
			setInitialized(true)
		})
	})

	const downloadImageDropdownItems = useMemo(() => {
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
	}, [t])

	const handleDownloadNoWaterMark = (item?: AttachmentItem) => {
		onDownload?.(DownloadImageMode.HighQuality, item)
	}

	const downloadMenuClick = ({ key }: { key: string }) => {
		switch (key) {
			case "download":
				onDownload?.()
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
						onClose={() => setVisible(false)}
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
		isFreeTrialVersion: false,
		downloadMenuClick,
		handleDownloadNoWaterMark,
		preloadWaterMarkFreeModal,
	}
}
