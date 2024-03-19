import { IconFolderPlus, IconUpload } from "@tabler/icons-react"
import type { MenuProps } from "antd"
import { useMemo } from "react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import { useTranslation } from "react-i18next"
import { type PresetFileType } from "../../constant"

interface UseMobileFileMenuItemsParams {
	onAddFile?: (extraType?: PresetFileType) => void
	onUploadFile?: () => void
	onAddFolder?: () => void
}

/**
 * Hook for generating mobile file operation menu items
 * Simplified flat menu structure optimized for mobile touch interactions
 */
function useMobileFileMenuItems({
	onAddFile,
	onUploadFile,
	onAddFolder,
}: UseMobileFileMenuItemsParams): MenuProps["items"] {
	const { t } = useTranslation("super")

	const mobileFileMenuItems: MenuProps["items"] = useMemo(
		() => [
			{
				key: "createTxt",
				label: "TXT",
				onClick: () => onAddFile?.("txt"),
				icon: <MagicFileIcon type="txt" size={18} />,
			},
			{
				key: "createMd",
				label: "Markdown",
				onClick: () => onAddFile?.("md"),
				icon: <MagicFileIcon type="md" size={18} />,
			},
			{
				key: "createHtml",
				label: "HTML",
				onClick: () => onAddFile?.("html"),
				icon: <MagicFileIcon type="html" size={18} />,
			},
			{
				key: "createCustom",
				label: t("topicFiles.contextMenu.createSubMenu.customFile"),
				onClick: () => onAddFile?.("custom"),
				icon: <MagicFileIcon type="custom" size={18} />,
			},
			...(onAddFolder
				? [
						{
							type: "divider" as const,
						},
						{
							key: "createFolder",
							label: t("topicFiles.contextMenu.createFolder"),
							icon: <MagicIcon component={IconFolderPlus} stroke={2} size={18} />,
							onClick: onAddFolder,
						},
					]
				: []),
			...(onUploadFile
				? [
						{
							type: "divider" as const,
						},
						{
							key: "upload",
							label: t("topicFiles.contextMenu.uploadFile"),
							icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
							onClick: onUploadFile,
						},
					]
				: []),
		],
		[t, onAddFile, onUploadFile, onAddFolder],
	)

	return mobileFileMenuItems
}

export default useMobileFileMenuItems
