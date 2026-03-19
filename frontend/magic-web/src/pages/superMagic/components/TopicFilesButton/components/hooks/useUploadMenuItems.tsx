import { IconUpload, IconFolderUp } from "@tabler/icons-react"
import type { MenuProps } from "antd"
import { useMemo } from "react"
import MagicIcon from "@/components/base/MagicIcon"
import { useTranslation } from "react-i18next"

interface UseUploadMenuItemsParams {
	onUploadFile?: () => void
	onUploadFolder?: () => void
}

/**
 * Hook for generating upload operation menu items
 * Includes upload file and upload folder options
 */
function useUploadMenuItems({
	onUploadFile,
	onUploadFolder,
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

		return items
	}, [t, onUploadFile, onUploadFolder])

	return uploadMenuItems
}

export default useUploadMenuItems
