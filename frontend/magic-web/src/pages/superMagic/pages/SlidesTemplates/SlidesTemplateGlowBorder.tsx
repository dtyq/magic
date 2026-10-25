import { useReducedMotion } from "framer-motion"
import { useId } from "react"
import { cn } from "@/utils/cn"

interface SlidesTemplateGlowBorderProps {
	className?: string
	emphasized?: boolean
	radius?: number
}

export default function SlidesTemplateGlowBorder({
	className,
	emphasized = false,
	radius = 10,
}: SlidesTemplateGlowBorderProps) {
	const reduceMotion = Boolean(useReducedMotion())
	const id = useId().replaceAll(":", "")
	const gradientId = `slides-template-glow-gradient-${id}`
	const filterId = `slides-template-glow-filter-${id}`
	const frameInset = emphasized ? "2.5" : "0"
	const frameSize = emphasized ? "calc(100% - 5px)" : "100%"

	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 z-30 transition-opacity duration-300",
				className,
			)}
			data-emphasized={emphasized || undefined}
			data-testid="slides-template-glow-border"
		>
			<svg
				className={cn(
					"absolute inset-px size-[calc(100%-2px)] overflow-visible",
					emphasized && "inset-0 size-full",
				)}
				preserveAspectRatio="none"
			>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="#79c7ff" />
						<stop offset="18%" stopColor="#7785ff" />
						<stop offset="38%" stopColor="#ad72ff" />
						<stop offset="58%" stopColor="#ed72c4" />
						<stop offset="76%" stopColor="#ff8d8d" />
						<stop offset="90%" stopColor="#e7b66d" />
						<stop offset="100%" stopColor="#79c7ff" />
						{reduceMotion ? null : (
							<animateTransform
								attributeName="gradientTransform"
								type="rotate"
								from="0 0.5 0.5"
								to="360 0.5 0.5"
								dur="7.5s"
								repeatCount="indefinite"
							/>
						)}
					</linearGradient>
					<filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
						<feGaussianBlur stdDeviation={emphasized ? "4" : "3.2"} />
					</filter>
				</defs>
				<rect
					x={frameInset}
					y={frameInset}
					width={frameSize}
					height={frameSize}
					rx={radius}
					fill="none"
					stroke={`url(#${gradientId})`}
					strokeWidth={emphasized ? "7" : "5"}
					opacity={emphasized ? "0.72" : "0.58"}
					filter={`url(#${filterId})`}
					vectorEffect="non-scaling-stroke"
				/>
				<rect
					x={frameInset}
					y={frameInset}
					width={frameSize}
					height={frameSize}
					rx={radius}
					fill="none"
					stroke={`url(#${gradientId})`}
					strokeWidth={emphasized ? "3.2" : "1.8"}
					opacity="0.98"
					vectorEffect="non-scaling-stroke"
				/>
				<rect
					x={frameInset}
					y={frameInset}
					width={frameSize}
					height={frameSize}
					rx={radius}
					fill="none"
					stroke="rgba(255,255,255,0.34)"
					strokeWidth={emphasized ? "0.8" : "0.55"}
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
		</div>
	)
}
