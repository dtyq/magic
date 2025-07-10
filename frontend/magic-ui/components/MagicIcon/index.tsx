import { colorScales, colorUsages } from "../ThemeProvider/colors"
import type { Icon, IconProps } from "@tabler/icons-react"
import { useThemeMode } from "antd-style"
import { memo } from "react"
import type { ForwardRefExoticComponent, RefAttributes } from "react"

type Props = Omit<IconProps, "ref"> & RefAttributes<Icon>

export interface MagicIconProps extends Props {
	component?: ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>>
	active?: boolean
	animation?: boolean
}

const MagicIcon = memo(function MagicIcon({ component: Comp, ...props }: MagicIconProps) {
	const { isDarkMode } = useThemeMode()

	if (!Comp) {
		return null
	}

	return (
		<Comp
			stroke={1.5}
			color={isDarkMode ? colorScales.grey[6] : colorUsages.text[1]}
			{...props}
		/>
	)
})

export default MagicIcon
