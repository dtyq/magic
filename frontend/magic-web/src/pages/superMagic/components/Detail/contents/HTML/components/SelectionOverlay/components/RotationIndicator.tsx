import { normalizeAngle } from "../utils/transform"

interface RotationIndicatorProps {
	rotation: number
}

/**
 * Rotation angle indicator
 */
export function RotationIndicator({ rotation }: RotationIndicatorProps) {
	if (rotation === 0) return null

	return (
		<div
			className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-primary px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums tracking-[0.14em] text-primary-foreground"
			style={{
				top: -24,
			}}
		>
			{Math.round(normalizeAngle(rotation))}°
		</div>
	)
}
