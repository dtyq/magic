import type { ReactNode } from "react"

interface ProgressIndicatorProps {
	value?: number
	icon: ReactNode
	label: string
}

/** 只展示调用方提供的进度；准备阶段省略 value，不把未知进度表示为 0%。 */
export default function ProgressIndicator({ value, icon, label }: ProgressIndicatorProps) {
	const progress =
		value !== undefined && Number.isFinite(value)
			? Math.min(Math.max(value, 0), 100)
			: undefined

	return (
		<span
			className="relative inline-flex size-5 shrink-0 items-center justify-center"
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={progress}
		>
			<svg className="absolute inset-0 size-5" viewBox="0 0 24 24" fill="none" aria-hidden>
				<circle
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					strokeWidth="2"
					opacity="0.15"
				/>
				<circle
					cx="12"
					cy="12"
					r="10"
					pathLength="100"
					stroke="currentColor"
					strokeWidth="2"
					strokeDasharray={`${progress ?? 25} 100`}
					transform="rotate(-90 12 12)"
				/>
			</svg>
			<span
				className="flex size-2.5 items-center justify-center [&>svg]:!size-2.5"
				aria-hidden
			>
				{icon}
			</span>
		</span>
	)
}
