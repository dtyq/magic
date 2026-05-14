import MagicDropdown from "@/components/base/MagicDropdown"
import {
	IconDownload,
	IconFile,
	IconFileTypePdf,
	IconFileTypePpt,
	IconPhoto,
} from "@tabler/icons-react"
import { MenuProps } from "antd"
import { createStyles } from "antd-style"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { HTMLGuideTourElementId } from "@/pages/superMagic/hooks/useHTMLGuideTour"
import ActionButton from "@/pages/superMagic/components/Detail/components/CommonHeader/components/ActionButton"
import { Download } from "lucide-react"
import type { ImageExportFormat } from "../../../../../../../packages/pdf-export/src"

const useStyles = createStyles(({ css, token }) => ({
	downloadText: css`
		/* color: ${token.magicColorUsages.text[2]}; */
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	`,
}))

export function useExportMenuItems({
	handleExportSource,
	handleExportPDF,
	handleExportPPT,
	handleExportImage,
	isExporting = false,
	showButtonText = true,
	supportPPT = true,
	handleExportPptx,
	showExportPptx = false,
	showExportImage = false,
}: {
	handleExportSource: () => void
	handleExportPDF: (pagination: "slice" | "none") => void
	handleExportPPT?: () => void
	handleExportImage?: (format: ImageExportFormat) => void
	isExporting?: boolean
	showButtonText?: boolean
	supportPPT?: boolean
	handleExportPptx?: () => void
	showExportPptx?: boolean
	showExportImage?: boolean
}) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const exportMenuItems: MenuProps["items"] = useMemo(
		() => [
			{
				key: "source",
				label: t("topicFiles.exportSource"),
				icon: <IconFile size={16} stroke={1.5} />,
				onClick: handleExportSource,
			},
			{
				key: "pdf",
				label: t("topicFiles.exportPdf"),
				icon: <IconFileTypePdf size={16} stroke={1.5} />,
				children: [
					{
						key: "pdf-paginated",
						label: t("topicFiles.exportPdfPaginated"),
						onClick: () => handleExportPDF("slice"),
					},
					{
						key: "pdf-fullpage",
						label: t("topicFiles.exportPdfFullPage"),
						onClick: () => handleExportPDF("none"),
					},
				],
			},
			...(showExportImage && handleExportImage
				? [
						{
							key: "image",
							label: t("topicFiles.exportImage"),
							icon: <IconPhoto size={16} stroke={1.5} />,
							children: [
								{
									key: "image-png",
									label: t("topicFiles.exportImagePng"),
									onClick: () => handleExportImage("png"),
								},
								{
									key: "image-jpeg",
									label: t("topicFiles.exportImageJpeg"),
									onClick: () => handleExportImage("jpeg"),
								},
							],
						},
					]
				: []),
			...(showExportPptx && handleExportPptx
				? [
						{
							key: "pptx",
							label: t("topicFiles.exportPptx"),
							icon: <IconFileTypePpt size={16} stroke={1.5} />,
							onClick: handleExportPptx,
						},
					]
				: []),
			...(supportPPT && handleExportPPT
				? [
						{
							key: "ppt",
							label: t("topicFiles.exportPpt"),
							icon: <IconFileTypePpt size={16} stroke={1.5} />,
							onClick: handleExportPPT,
						},
					]
				: []),
		],
		[
			handleExportPDF,
			handleExportPPT,
			handleExportPptx,
			handleExportImage,
			handleExportSource,
			showExportPptx,
			showExportImage,
			supportPPT,
			t,
		],
	)

	const ExportDropdownButton = (
		<MagicDropdown
			menu={{ items: exportMenuItems }}
			placement="bottomRight"
			disabled={isExporting}
			trigger={["click"]}
			overlayStyle={{ zIndex: 1050 }}
		>
			<span>
				<ActionButton
					id={HTMLGuideTourElementId.HTMLFileDownloadButton}
					icon={<Download size={16} strokeWidth={1.5} />}
					title={t("topicFiles.download")}
					text={t("topicFiles.download")}
					showText={showButtonText}
					disabled={isExporting}
					size={18}
					style={{
						borderRadius: 8,
					}}
					textClassName={styles.downloadText}
					gap={4}
				/>
			</span>
		</MagicDropdown>
	)

	return { ExportDropdownButton, exportMenuItems }
}

export default useExportMenuItems
