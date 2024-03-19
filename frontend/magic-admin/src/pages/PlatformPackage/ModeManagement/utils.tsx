import { MagicAvatar, IconSuperMagic } from "components"
import { TablerIcon } from "@/utils/tablerIconLoader"
import OfficialTablerIcons from "./tabler-icons-tags.json"

export interface IconInfo {
	name: string
	tags: string[]
	type: "official" | "custom"
}

export const getAllIcons = () => {
	const icons: IconInfo[] = []
	icons.push({
		name: "IconSuperMagic",
		tags: [],
		type: "custom",
	})

	// 添加官方 Tabler Icons
	Object.entries(OfficialTablerIcons as Record<string, { tags: string[] }>).forEach(
		([iconName, iconData]) => {
			icons.push({
				name: iconName,
				tags: iconData.tags || [],
				type: "official",
			})
		},
	)

	return icons
}

/* 根据icon名称获取icon组件 */
export const IconComponent = (selectedIcon?: string, size: number = 24, iconColor?: string) => {
	if (!selectedIcon) return null

	if (selectedIcon === "IconSuperMagic") return <IconSuperMagic size={size} color={iconColor} />

	const iconNames = Object.keys(OfficialTablerIcons || {})
	if (iconNames.includes(selectedIcon))
		return <TablerIcon name={selectedIcon} size={size} color={iconColor} />

	// 否则使用MagicAvatar组件
	return <MagicAvatar size={size} shape="circle" src={selectedIcon} />
}
