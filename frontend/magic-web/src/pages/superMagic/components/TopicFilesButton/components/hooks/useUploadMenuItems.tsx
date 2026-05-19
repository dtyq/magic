import { IconUpload, IconFolderUp, IconFolderSymlink } from "@tabler/icons-react"
import type { MenuProps } from "antd"
import { useMemo } from "react"
import MagicIcon from "@/components/base/MagicIcon"
import { useTranslation } from "react-i18next"

interface UseUploadMenuItemsParams {
	onUploadFile?: () => void
	onUploadFolder?: () => void
	onImportFromOtherProject?: () => void
}

/**
 * Hook for generating upload operation menu items
 * Includes upload file, upload folder, and import from other project options
 */
function useUploadMenuItems({
	onUploadFile,
	onUploadFolder,
	onImportFromOtherProject,
}: UseUploadMenuItemsParams): MenuProps["items"] {
	const { t } = useTranslation("super")

	const uploadMenuItems: MenuProps["items"] = useMemo(() => {
		const items: MenuProps["items"] = []

		if (onUploadFile) {
			items.push({
				key: "uploadFile",
				label: t("topicFiles.contextMenu.uploadFile"),
				icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
				onClick: onUploadFile,
			})
		}

		if (onUploadFolder) {
			items.push({
				key: "uploadFolder",
				label: t("topicFiles.contextMenu.uploadFolder"),
				icon: <MagicIcon component={IconFolderUp} stroke={2} size={18} />,
				onClick: onUploadFolder,
			})
		}

		// 添加分隔线和导入选项
		if (onImportFromOtherProject && (onUploadFile || onUploadFolder)) {
			items.push({
				type: "divider",
				key: "divider",
			})
		}

		if (onImportFromOtherProject) {
			items.push({
				key: "importFromOtherProject",
				label: t("topicFiles.contextMenu.importFromOtherProject"),
				icon: <MagicIcon component={IconFolderSymlink} stroke={2} size={18} />,
				onClick: onImportFromOtherProject,
			})
		}

		return items
	}, [t, onUploadFile, onUploadFolder, onImportFromOtherProject])

	return uploadMenuItems
}

export default useUploadMenuItems
