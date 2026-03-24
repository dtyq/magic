import MagicDropdown from "@/components/base/MagicDropdown"
import { IconDownload, IconFile, IconFileTypePdf, IconFileTypePpt } from "@tabler/icons-react"
import { MenuProps } from "antd"
import { createStyles } from "antd-style"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { HTMLGuideTourElementId } from "@/pages/superMagic/hooks/useHTMLGuideTour"
import ActionButton from "@/pages/superMagic/components/Detail/components/CommonHeader/components/ActionButton"
import { Download } from "lucide-react"

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
	isExporting = false,
	showButtonText = true,
	supportPPT = true,
	handleExportPptx,
}: {
	handleExportSource: () => void
	handleExportPDF: () => void
	handleExportPPT?: () => void
	isExporting?: boolean
	showButtonText?: boolean
	supportPPT?: boolean
	handleExportPptx?: () => void
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
				onClick: handleExportPDF,
			},
			...(supportPPT && handleExportPPT
				? [
						{
							key: "ppt",
							label: t("topicFiles.exportPpt"),
							icon: <IconFileTypePpt size={16} stroke={1.5} />,
							onClick: handleExportPPT,
						},
						{
							key: "pptx",
							label: t("topicFiles.exportPptx"),
							icon: <IconFileTypePpt size={16} stroke={1.5} />,
							onClick: handleExportPptx,
						},
					]
				: []),
		],
		[handleExportPDF, handleExportPPT, handleExportSource, supportPPT, t],
	)

	const ExportDropdownButton = (
		<MagicDropdown
			menu={{ items: exportMenuItems }}
			placement="bottomRight"
			disabled={isExporting}
			trigger={["click"]}
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
