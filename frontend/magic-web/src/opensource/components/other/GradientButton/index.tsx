import { useMemo } from "react"
import type { ButtonHTMLAttributes } from "react"
import type { IconProps } from "@tabler/icons-react"
import { useStyles } from "./styles"

interface GradientButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	icon?: React.ComponentType<IconProps>
	children?: React.ReactNode
}

function GradientButton({
	icon: IconComponent,
	children,
	className,
	...props
}: GradientButtonProps) {
	const { styles, cx } = useStyles()

	const gradientId = useMemo(() => `gradient-btn-${Math.random().toString(36).substr(2, 9)}`, [])

	return (
		<>
			{IconComponent && (
				<svg
					style={{
						position: "absolute",
						width: 0,
						height: 0,
						pointerEvents: "none",
					}}
					aria-hidden="true"
				>
					<defs>
						<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="5.59%" stopColor="#3f8fff" />
							<stop offset="95.08%" stopColor="#ef2fdf" />
						</linearGradient>
					</defs>
				</svg>
			)}
			<button className={cx(styles.wrapper, className)} {...props}>
				<div className={styles.content}>
					{IconComponent && (
						<span
							className={styles.iconWrapper}
							style={
								{
									"--gradient-id": `url(#${gradientId})`,
								} as React.CSSProperties
							}
						>
							<IconComponent size={16} stroke={1.5} />
						</span>
					)}
					{children && <span className={styles.text}>{children}</span>}
				</div>
			</button>
		</>
	)
}

export default GradientButton
