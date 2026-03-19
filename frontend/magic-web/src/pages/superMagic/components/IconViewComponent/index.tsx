import SuperMagicIcon from "@/enhance/tabler/icons-react/icons/IconSuperMagic"
import { IconType } from "../AgentSelector/types"
import { useTheme } from "antd-style"
import { TablerIcon } from "@/utils/tablerIconLoader"
import OfficialTablerIcons from "@/assets/tabler-icons/tabler-icons-tags.json"

interface IconComponentProps {
	selectedIcon?: string
	iconColor?: string
	iconType?: IconType
	iconUrl?: string
	size?: number
	style?: React.CSSProperties
	showBorder?: boolean
}

/* 将RGBA颜色转换为指定透明度的颜色 */
export function convertRgbaOpacity(rgbaColor: string, opacity: number): string {
	if (!rgbaColor) return "transparent"

	// 匹配RGBA格式：rgba(r, g, b, a) 或 rgb(r, g, b)
	const rgbaMatch = rgbaColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
	if (rgbaMatch) {
		const [, r, g, b] = rgbaMatch
		return `rgba(${r}, ${g}, ${b}, ${opacity})`
	}

	// 如果是十六进制格式，转换为rgba
	const hexMatch = rgbaColor.match(/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)
	if (hexMatch) {
		const hex = hexMatch[1]
		const expandedHex =
			hex.length === 3
				? hex
					.split("")
					.map((char) => char + char)
					.join("")
				: hex

		const r = parseInt(expandedHex.slice(0, 2), 16)
		const g = parseInt(expandedHex.slice(2, 4), 16)
		const b = parseInt(expandedHex.slice(4, 6), 16)
		return `rgba(${r}, ${g}, ${b}, ${opacity})`
	}

	// 如果无法解析，返回透明
	return "transparent"
}

/* 根据icon名称获取icon组件,兜底使用超级麦吉的icon */
const IconComponent = (props: IconComponentProps) => {
	const {
		selectedIcon,
		size = 24,
		iconColor,
		iconType,
		iconUrl,
		showBorder = false,
		style = {},
	} = props
	const { magicColorUsages } = useTheme()

	const containerStyle = {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: "1000px",
		border: "1px solid transparent",
		width: "fit-content",
		height: "fit-content",
	}

	const containerWithBorderStyle = {
		padding: "1px",
		border: `1px solid ${magicColorUsages.border}`,
		borderRadius: "4px",
	}

	// 如果icon类型为图片，则显示图片
	if (iconUrl) {
		return (
			<div
				style={{
					...containerStyle,
					...(showBorder ? containerWithBorderStyle : {}),
					...style,
				}}
			>
				<img
					src={iconUrl}
					alt="icon"
					style={{ width: size, height: size, flexShrink: 0 }}
				/>
			</div>
		)
	}

	const officialIcons = Object.keys(OfficialTablerIcons || {})
	if (selectedIcon && officialIcons.includes(selectedIcon))
		return (
			<div
				style={{
					...containerStyle,
					...(showBorder ? containerWithBorderStyle : {}),
					...style,
				}}
			>
				<TablerIcon name={selectedIcon} size={size} color={iconColor || "black"} />
			</div>
		)

	// 否则使用MagicAvatar组件
	return (
		<div
			style={{
				...containerStyle,
				...(showBorder ? containerWithBorderStyle : {}),
				...style,
			}}
		>
			<SuperMagicIcon color={iconColor || "black"} size={size} />
		</div>
	)
}
export default IconComponent
