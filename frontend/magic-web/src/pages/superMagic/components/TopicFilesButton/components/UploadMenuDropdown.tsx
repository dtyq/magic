import { memo, type ReactNode } from "react"
import MagicDropdown from "@/components/base/MagicDropdown"
import useUploadMenuItems from "./hooks/useUploadMenuItems"

interface UploadMenuDropdownProps {
	onUploadFile?: () => void
	onUploadFolder?: () => void
	onImportFromOtherProject?: () => void
	children: ReactNode
}

/**
 * Upload menu dropdown component
 * Displays upload operation menu (file/folder/import) with custom trigger
 */
function UploadMenuDropdown({
	onUploadFile,
	onUploadFolder,
	onImportFromOtherProject,
	children,
}: UploadMenuDropdownProps) {
	const uploadMenuItems = useUploadMenuItems({
		onUploadFile,
		onUploadFolder,
		onImportFromOtherProject,
	})

	return (
		<MagicDropdown
			menu={{ items: uploadMenuItems }}
			trigger={["click"]}
			placement="bottomRight"
		>
			{children}
		</MagicDropdown>
	)
}

export default memo(UploadMenuDropdown)
