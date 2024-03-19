import { createStyles } from "antd-style"

interface MagicSkeletonProps {
	/** Width of the skeleton */
	width?: string | number
	/** Height of the skeleton */
	height?: string | number
	/** Border radius */
	borderRadius?: string | number
	/** Whether to show animation */
	animated?: boolean
	/** Custom className */
	className?: string
	/** Number of rows for multi-line skeleton */
	rows?: number
	/** Gap between rows */
	gap?: number
	/** Width array for each row, or percentage for last row */
	rowWidths?: (string | number)[] | number
}

const useStyles = createStyles(({ token, css }) => {
	const shimmer = css`
		@keyframes shimmer {
			0% {
				transform: translateX(-100%);
			}
			100% {
				transform: translateX(100%);
			}
		}
	`

	return {
		container: css`
			display: flex;
			flex-direction: column;
		`,

		skeleton: css`
			${shimmer}
			background-color: ${token.colorFillQuaternary};
			border-radius: ${token.borderRadius}px;
			position: relative;
			overflow: hidden;

			&::after {
				content: "";
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: linear-gradient(
					90deg,
					transparent,
					${token.colorFillSecondary},
					transparent
				);
				transform: translateX(-100%);
			}
		`,

		animated: css`
			&::after {
				animation: shimmer 1.5s infinite ease-in-out;
			}
		`,
	}
})

function MagicSkeleton({
	width = "100%",
	height = 16,
	borderRadius,
	animated = true,
	className,
	rows = 1,
	gap = 8,
	rowWidths,
}: MagicSkeletonProps) {
	const { styles, cx } = useStyles()

	// Generate row widths
	const getRowWidths = () => {
		if (Array.isArray(rowWidths)) {
			return rowWidths
		}

		if (rows === 1) {
			return [width]
		}

		// Generate default widths for multiple rows
		const widths: (string | number)[] = []
		const lastRowWidth = typeof rowWidths === "number" ? `${rowWidths}%` : "70%"

		for (let i = 0; i < rows; i++) {
			if (i === rows - 1) {
				// Last row is typically shorter
				widths.push(lastRowWidth)
			} else {
				widths.push(width)
			}
		}

		return widths
	}

	const generatedWidths = getRowWidths()

	// Single row mode
	if (rows === 1) {
		return (
			<div
				className={cx(styles.skeleton, animated && styles.animated, className)}
				style={{
					width: generatedWidths[0],
					height,
					borderRadius,
				}}
			/>
		)
	}

	// Multi-row mode
	return (
		<div className={cx(styles.container, className)} style={{ gap }}>
			{Array.from({ length: rows }).map((_, index) => (
				<div
					key={index}
					className={cx(styles.skeleton, animated && styles.animated)}
					style={{
						width: generatedWidths[index] || width,
						height,
						borderRadius,
					}}
				/>
			))}
		</div>
	)
}

export default MagicSkeleton
