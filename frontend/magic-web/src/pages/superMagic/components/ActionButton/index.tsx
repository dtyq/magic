import { memo, PropsWithChildren } from "react"
import { useStyles } from "./styles"

interface ActionButtonProps extends React.HTMLAttributes<HTMLDivElement> {
	size?: number
	style?: React.CSSProperties
	className?: string
}

export default memo(function ActionButton({
	size,
	style,
	className,
	children,
	...htmlProps
}: PropsWithChildren<ActionButtonProps>) {
	const { cx, styles } = useStyles()
	return (
		<div
			className={cx(styles.actionButton, className)}
			style={{
				width: size,
				height: size,
				...style,
			}}
			{...htmlProps}
		>
			{children}
		</div>
	)
})
