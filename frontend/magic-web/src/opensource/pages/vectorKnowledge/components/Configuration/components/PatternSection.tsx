import { ReactNode, ForwardRefExoticComponent, RefAttributes } from "react"
import { Flex } from "antd"
import { useVectorKnowledgeConfigurationStyles } from "../styles"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { cx } from "antd-style"
import { Icon, IconProps } from "@tabler/icons-react"

interface PatternSectionProps {
	title: string
	description: string
	icon: ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>>
	iconColor: "blue" | "yellow" | "green"
	isActive: boolean
	onClick: () => void
	children?: ReactNode
}

/**
 * 通用模式选择区块组件
 */
export default function PatternSection({
	title,
	description,
	icon,
	iconColor,
	isActive,
	onClick,
	children,
}: PatternSectionProps) {
	const { styles } = useVectorKnowledgeConfigurationStyles()

	// 根据iconColor选择样式
	const getIconColorClass = () => {
		switch (iconColor) {
			case "blue":
				return styles.blueIcon
			case "yellow":
				return styles.yellowIcon
			case "green":
				return styles.greenIcon
			default:
				return styles.blueIcon
		}
	}

	return (
		<div
			className={cx(styles.patternSection, isActive && styles.activeSection)}
			onClick={onClick}
		>
			<Flex className="sectionHeader" align="center" gap={10}>
				<Flex
					align="center"
					justify="center"
					className={cx(styles.patternIcon, getIconColorClass())}
				>
					<MagicIcon component={icon} color="currentColor" />
				</Flex>
				<div style={{ flex: 1 }}>
					<div className={styles.patternTitle}>{title}</div>
					<div className={styles.patternDesc}>{description}</div>
				</div>
			</Flex>

			{isActive && children && <div className={styles.patternSectionContent}>{children}</div>}
		</div>
	)
}
