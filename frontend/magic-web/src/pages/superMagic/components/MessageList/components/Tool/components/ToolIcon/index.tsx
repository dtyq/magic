import { createStyles } from "antd-style"
import { memo, useEffect, useState } from "react"
import {
	defaultToolIcon,
	loadToolIcon,
} from "@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/ToolIcon"

const useStyles = createStyles(({ css }) => {
	return {
		icon: css`
			display: inline-block;
			width: 20px;
			height: 20px;
			border-radius: 4px;
		`,
	}
})

interface ToolIconProps {
	type: string
	className?: string
	style?: React.CSSProperties
}

function ToolIcon({ type, className, style }: ToolIconProps) {
	const { styles } = useStyles()
	const [iconSrc, setIconSrc] = useState<string>(defaultToolIcon)

	useEffect(() => {
		let isMounted = true

		loadToolIcon(type)
			.then((src) => {
				if (!isMounted) return
				setIconSrc(src)
			})
			.catch(() => {
				if (isMounted) setIconSrc(defaultToolIcon)
			})

		return () => {
			isMounted = false
		}
	}, [type])

	return (
		<img
			src={iconSrc}
			alt={type}
			className={`${styles.icon} ${className || ""}`}
			style={style}
		/>
	)
}

export default memo(ToolIcon)
