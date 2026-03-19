import type { MenuProps } from "antd"
import { useMemo } from "react"
import type { TFunction } from "i18next"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { useTranslation } from "react-i18next"
import { type PresetFileType } from "../../constant"

interface CreateFileMenuItemsParams {
	t: TFunction
	/**
	 * Callback when creating a file
	 * @param type - File type
	 */
	onAddFile?: (type: PresetFileType | "design") => void
	/**
	 * Optional callback for creating design project
	 * If provided, design file option will be included
	 */
	onAddDesign?: () => void
}

/**
 * Factory function for generating file operation menu items
 * Includes create file submenu for various file types
 */
export function createFileMenuItems({
	t,
	onAddFile,
	onAddDesign,
}: CreateFileMenuItemsParams): MenuProps["items"] {
	return [
		{
			key: "createTxt",
			label: t("topicFiles.contextMenu.createSubMenu.txtFile"),
			onClick: () => onAddFile?.("txt"),
			icon: <MagicFileIcon type="txt" size={18} />,
		},
		{
			key: "createMd",
			label: t("topicFiles.contextMenu.createSubMenu.mdFile"),
			onClick: () => onAddFile?.("md"),
			icon: <MagicFileIcon type="md" size={18} />,
		},
		{ type: "divider" as const },
		{
			key: "createHtml",
			label: t("topicFiles.contextMenu.createSubMenu.htmlFile"),
			onClick: () => onAddFile?.("html"),
			icon: <MagicFileIcon type="html" size={18} />,
		},
		{
			key: "createPython",
			label: t("topicFiles.contextMenu.createSubMenu.pythonFile"),
			onClick: () => onAddFile?.("py"),
			icon: <MagicFileIcon type="py" size={18} />,
		},
		{
			key: "createGo",
			label: t("topicFiles.contextMenu.createSubMenu.goFile"),
			onClick: () => onAddFile?.("go"),
			icon: <MagicFileIcon type="go" size={18} />,
		},
		{
			key: "createPhp",
			label: t("topicFiles.contextMenu.createSubMenu.phpFile"),
			onClick: () => onAddFile?.("php"),
			icon: <MagicFileIcon type="php" size={18} />,
		},
		{ type: "divider" as const },
		...(onAddDesign
			? [
				{
					key: "createDesign",
					label: t("topicFiles.contextMenu.createSubMenu.designFile"),
					onClick: () => onAddDesign(),
					icon: <MagicFileIcon type="design" size={18} />,
				},
				{ type: "divider" as const },
			]
			: []),
		{
			key: "createCustom",
			label: t("topicFiles.contextMenu.createSubMenu.customFile"),
			onClick: () => onAddFile?.("custom"),
			icon: <MagicFileIcon type="custom" size={18} />,
		},
	]
}

interface UseFileMenuItemsParams {
	/**
	 * Callback when creating a file
	 * @param type - File type
	 */
	onAddFile?: (type: PresetFileType | "design") => void
	/**
	 * Optional callback for creating design project
	 * If provided, design file option will be included
	 */
	onAddDesign?: () => void
}

/**
 * Hook for generating file operation menu items
 * Includes create file submenu for various file types
 */
function useFileMenuItems({ onAddFile, onAddDesign }: UseFileMenuItemsParams): MenuProps["items"] {
	const { t } = useTranslation("super")

	// File operation menu items
	const fileMenuItems: MenuProps["items"] = useMemo(
		() => createFileMenuItems({ t, onAddFile, onAddDesign }),
		[t, onAddFile, onAddDesign],
	)

	return fileMenuItems
}

export default useFileMenuItems
