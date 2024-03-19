import React from "react"

interface StatusIndicatorProps {
	/** Component size, defaults to 16 */
	size?: number
	/** Dot color, defaults to green */
	color?: string
	/** Border color, defaults to white */
	borderColor?: string
	/** Border width, defaults to 1 */
	borderWidth?: number
	/** Whether to enable fade animation, defaults to false */
	animate?: boolean
	/** Animation duration in seconds, defaults to 2 seconds */
	duration?: number
	/** Additional class name */
	className?: string
	/** Additional styles */
	style?: React.CSSProperties
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
	size = 16,
	color = "#52c41a",
	borderColor = "#ffffff",
	borderWidth = 1,
	animate = false,
	duration = 2,
	className,
	style,
}) => {
	// Calculate dot radius (considering border)
	const dotRadius = (size - borderWidth * 2) / 2
	const centerX = size / 2
	const centerY = size / 2

	// Generate unique animation ID
	const animationId = `fade-${Math.random().toString(36).substr(2, 9)}`

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className={className}
			style={style}
		>
			{animate && (
				<defs>
					<style>
						{`
							@keyframes ${animationId} {
								0%, 100% { opacity: 1; }
								50% { opacity: 0.3; }
							}
							.fade-circle {
								animation: ${animationId} ${duration}s ease-in-out infinite;
							}
						`}
					</style>
				</defs>
			)}
			<circle
				cx={centerX}
				cy={centerY}
				r={dotRadius}
				fill={color}
				stroke={borderColor}
				strokeWidth={borderWidth}
				className={animate ? "fade-circle" : undefined}
			/>
		</svg>
	)
}

export default StatusIndicator
