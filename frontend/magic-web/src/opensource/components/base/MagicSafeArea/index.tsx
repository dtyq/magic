import type { CSSProperties } from "react"
import { useStyles } from "./styles"

interface MagicSafeAreaProps {
	position: "top" | "bottom"
	style?: CSSProperties
	className?: string
}

function MagicSafeArea(props: MagicSafeAreaProps) {
	const { styles, cx } = useStyles()
	return (
		<div
			style={props?.style}
			className={cx(styles.safeArea, props?.className, {
				[styles.top]: props.position === "top",
				[styles.bottom]: props.position === "bottom",
			})}
		/>
	)
}

export default MagicSafeArea
