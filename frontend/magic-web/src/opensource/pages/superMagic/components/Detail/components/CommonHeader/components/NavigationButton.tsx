import { Flex } from "antd"
import { memo } from "react"
import type { ForwardRefExoticComponent, RefAttributes } from "react"
import type { Icon, IconProps } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useStyles } from "../ActionButton.style"

interface NavigationButtonProps {
	icon: ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>>
	title?: string
	onClick?: () => void
	disabled?: boolean
	size?: number
	stroke?: number
}

export default memo(function NavigationButton({
	icon,
	title,
	onClick,
	disabled = false,
	size = 20,
	stroke = 2,
}: NavigationButtonProps) {
	const { styles } = useStyles()

	return (
		<Flex
			gap={4}
			align="center"
			style={{
				padding: "0 4px",
				height: "24px",
				borderRadius: "8px",
				cursor: "pointer",
			}}
			onClick={disabled ? undefined : onClick}
			title={title}
			className={styles.iconWrapper}
		>
			<MagicIcon
				size={size}
				component={icon}
				stroke={stroke}
				className={`${styles.iconCommon} ${disabled ? styles.disabled : ""}`}
			/>
		</Flex>
	)
})
