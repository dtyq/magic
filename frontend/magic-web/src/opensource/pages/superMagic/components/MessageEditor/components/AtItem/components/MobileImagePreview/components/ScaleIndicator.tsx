import { memo } from "react"
import { useStyles } from "../styles"

interface ScaleIndicatorProps {
	scale: number
	visible: boolean
}

function ScaleIndicatorComponent({ scale, visible }: ScaleIndicatorProps) {
	const { styles, cx } = useStyles()

	const percentage = Math.round(scale * 100)

	return <div className={cx(styles.scaleIndicator, { visible })}>{percentage}%</div>
}

export const ScaleIndicator = memo(ScaleIndicatorComponent)
