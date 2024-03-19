import { useCallback, useEffect, useId, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useStyles } from "./style"

interface AnimatedGridPatternProps extends React.HTMLAttributes<HTMLDivElement> {
	width?: number
	height?: number
	x?: number
	y?: number
	strokeDasharray?: any
	numSquares?: number
	className?: string
	maxOpacity?: number
	duration?: number
	repeatDelay?: number
}

/**
 * 动画网格图案
 * @param width - 宽度
 * @param height - 高度
 * @param x - x坐标
 * @param y - y坐标
 * @param strokeDasharray - 描边虚线数组
 * @param numSquares - 方块数量
 * @param className - 类名
 * @param maxOpacity - 最大透明度
 * @param duration - 动画持续时间
 * @param repeatDelay - 重复延迟时间
 * @param props - 其他属性
 */
export function AnimatedGridPattern({
	width = 40,
	height = 40,
	x = -1,
	y = -1,
	strokeDasharray = 0,
	numSquares = 50,
	maxOpacity = 0.05,
	duration = 4,
	repeatDelay = 0.5,
	className,
	children,
	...props
}: AnimatedGridPatternProps) {
	const { styles, cx } = useStyles()
	const id = useId()
	const containerRef = useRef(null)
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

	const getPos = useCallback(() => {
		return [
			Math.floor((Math.random() * dimensions.width) / width),
			Math.floor((Math.random() * dimensions.height) / height),
		]
	}, [dimensions.width, dimensions.height, width, height])

	const generateSquares = useCallback(
		(count: number) => {
			return Array.from({ length: count }, (_, i) => ({
				id: i,
				pos: getPos(),
			}))
		},
		[getPos],
	)

	const [squares, setSquares] = useState(() => generateSquares(numSquares))

	// Function to update a single square's position
	const updateSquarePosition = (squareId: number) => {
		setSquares((currentSquares) =>
			currentSquares.map((sq) =>
				sq.id === squareId
					? {
							...sq,
							pos: getPos(),
						}
					: sq,
			),
		)
	}

	// Update squares to animate in
	useEffect(() => {
		if (dimensions.width && dimensions.height) {
			setSquares(generateSquares(numSquares))
		}
	}, [dimensions, numSquares, generateSquares])

	// Resize observer to update container dimensions
	useEffect(() => {
		const resizeObserver = new ResizeObserver((entries) => {
			entries.forEach((entry) => {
				setDimensions({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				})
			})
		})

		const ref = containerRef.current

		if (ref) {
			resizeObserver.observe(ref)
		}

		return () => {
			if (ref) {
				resizeObserver.unobserve(ref)
			}
		}
	}, [containerRef])

	return (
		<div className={cx(styles.wrapper, className)} {...props}>
			<svg ref={containerRef} aria-hidden="true" className={styles.container}>
				<defs>
					<pattern
						id={id}
						width={width}
						height={height}
						patternUnits="userSpaceOnUse"
						x={x}
						y={y}
					>
						<path
							d={`M.5 ${height}V.5H${width}`}
							fill="none"
							strokeDasharray={strokeDasharray}
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill={`url(#${id})`} />
				<svg x={x} y={y} className={styles.overflowSvg}>
					{squares.map(({ pos: [posX, posY], id: squareId }, index) => (
						<motion.rect
							initial={{ opacity: 0 }}
							animate={{ opacity: maxOpacity }}
							transition={{
								duration,
								repeat: 1,
								delay: index * 0.1,
								repeatType: "reverse",
							}}
							onAnimationComplete={() => updateSquarePosition(squareId)}
							key={`${posX}-${posY}-${squareId}`}
							width={width}
							height={height}
							x={posX * width}
							y={posY * height}
							fill="currentColor"
							strokeWidth="0"
						/>
					))}
				</svg>
			</svg>
			<div className={styles.content}>{children}</div>
		</div>
	)
}
