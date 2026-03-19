import { memo, type ReactNode } from "react"
import MagicDropdown from "@/components/base/MagicDropdown"
import useMobileFileMenuItems from "./hooks/useMobileFileMenuItems"
import { type PresetFileType } from "../constant"
import { useTranslation } from "react-i18next"

interface MobileFileMenuDropdownProps {
	onAddFile?: (extraType?: PresetFileType) => void
	onUploadFile?: () => void
	onAddFolder?: () => void
	enabled: boolean
	children: ReactNode
}

/**
 * Mobile file menu dropdown component
 * Renders file operation menu via portal to mobile header
 */
function MobileFileMenuDropdown({
	onAddFile,
	onUploadFile,
	onAddFolder,
	children,
}: MobileFileMenuDropdownProps) {
	const fileMenuItems = useMobileFileMenuItems({ onAddFile, onUploadFile, onAddFolder })
	const { t } = useTranslation("super")

	return (
		<MagicDropdown
			mobileProps={{ title: t("topicFiles.createMenu") }}
			menu={{ items: fileMenuItems }}
			trigger={["click"]}
			placement="bottomRight"
		>
			{children}
		</MagicDropdown>
	)
}

export default memo(MobileFileMenuDropdown)
