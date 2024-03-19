import { memo } from "react"
import useStyles from "../styles"

function ShortcutKey({
	keys,
	className,
	style,
}: {
	keys: string[]
	className?: string
	style?: React.CSSProperties
}) {
	const { styles, cx } = useStyles()

	return (
		<div className={cx(styles.shortcutKeys, className)} style={style}>
			{keys.map((key, index) => (
				<span key={index} className={styles.shortcutKey}>
					{key}
				</span>
			))}
		</div>
	)
}

export default memo(ShortcutKey)
