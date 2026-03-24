import { memo } from "react"
import { PlatformPackage } from "@/types/platformPackage"
import { addAlphaToHex } from "@/utils/color"
import { IconComponent } from "../../utils"

interface ModeIconProps {
	item: PlatformPackage.Mode
	size?: number
	className?: string
}
const defaultIcon = "IconSuperMagic"
const defaultColor = "#000"
const defaultBgColor = "#aaa"

const ModeIcon = ({ item, size = 28, className }: ModeIconProps) => {
	const { icon_type, icon_url, icon, color } = item

	const opacity = icon_type === PlatformPackage.IconType.Image ? 0.1 : 0.1
	const bgColor = addAlphaToHex(color || defaultBgColor, opacity)

	const renderIcon = () => {
		if (icon_type === PlatformPackage.IconType.Image && icon_url) {
			return <img src={icon_url} alt="mode icon" width={size} height={size} />
		}

		if (icon_type === PlatformPackage.IconType.Icon && icon) {
			return IconComponent(icon || defaultIcon, size + 2, color)
		}

		return IconComponent(defaultIcon, size + 2, defaultColor)
	}

	return (
		<div className={className} style={{ backgroundColor: bgColor }}>
			{renderIcon()}
		</div>
	)
}

export default memo(ModeIcon)
