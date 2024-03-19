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
			className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground shadow-sm"
			style={{
				top: -24,
			}}
		>
			{Math.round(normalizeAngle(rotation))}°
		</div>
	)
}
