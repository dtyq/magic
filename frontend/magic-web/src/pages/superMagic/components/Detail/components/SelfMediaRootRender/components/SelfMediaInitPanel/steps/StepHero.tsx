import { Check } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/utils/cn"
import { STEPS } from "../constants"

type StepKey = (typeof STEPS)[number]["key"]

interface StepHeroProps {
	currentStep: number
	compact?: boolean
}

interface StepVisualConfig {
	accentClassName: string
	accentFillClassName: string
	accentStrokeClassName: string
	washClassName: string
}

const stepVisuals: Record<StepKey, StepVisualConfig> = {
	brand: {
		accentClassName: "bg-[#00a88f]",
		accentFillClassName: "fill-[#00a88f]",
		accentStrokeClassName: "stroke-[#00a88f]",
		washClassName: "before:from-[#e8fff9] before:via-transparent before:to-[#fff0e8]",
	},
	topics: {
		accentClassName: "bg-[#ff7a45]",
		accentFillClassName: "fill-[#ff7a45]",
		accentStrokeClassName: "stroke-[#ff7a45]",
		washClassName: "before:from-[#fff5e8] before:via-transparent before:to-[#eef7ff]",
	},
	confirm: {
		accentClassName: "bg-[#6b7cff]",
		accentFillClassName: "fill-[#6b7cff]",
		accentStrokeClassName: "stroke-[#6b7cff]",
		washClassName: "before:from-[#eef1ff] before:via-transparent before:to-[#eafff4]",
	},
}

const topicsNodes = [
	{ cx: 58, cy: 98 },
	{ cx: 178, cy: 62 },
	{ cx: 308, cy: 104 },
] as const

const brandSignals = [
	{ label: "Voice", x: 36, y: 46, delay: 0 },
	{ label: "Tone", x: 220, y: 30, delay: 0.6 },
	{ label: "People", x: 278, y: 118, delay: 1.2 },
	{ label: "Assets", x: 92, y: 126, delay: 1.8 },
] as const

const confirmChecks = [
	{ x: 74, y: 50, width: 132, delay: 0 },
	{ x: 58, y: 82, width: 176, delay: 0.4 },
	{ x: 92, y: 114, width: 118, delay: 0.8 },
] as const

function BrandAnimation({
	reduceMotion,
	visual,
}: {
	reduceMotion: boolean
	visual: StepVisualConfig
}) {
	return (
		<motion.svg
			className="absolute inset-0 h-full w-full overflow-visible"
			viewBox="0 0 360 160"
			data-testid="self-media-step-brand-orbit"
			initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
			animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
			transition={{ duration: reduceMotion ? 0 : 0.34, ease: "easeOut" }}
		>
			<motion.circle
				cx="180"
				cy="82"
				r="34"
				className={cn(visual.accentStrokeClassName, "fill-white/80")}
				strokeWidth="2"
				animate={reduceMotion ? undefined : { r: [32, 38, 32], opacity: [0.62, 1, 0.62] }}
				transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
			/>
			{[58, 84, 112].map((radius, index) => (
				<motion.circle
					key={radius}
					cx="180"
					cy="82"
					r={radius}
					className="fill-none stroke-[#18181b]/10"
					strokeDasharray={index === 1 ? "3 9" : "2 12"}
					strokeWidth={index === 0 ? 1.5 : 1}
					animate={reduceMotion ? undefined : { rotate: index % 2 ? -360 : 360 }}
					style={{ originX: "180px", originY: "82px" }}
					transition={{
						duration: 34 + index * 9,
						repeat: Infinity,
						ease: "linear",
					}}
				/>
			))}
			{brandSignals.map((item) => (
				<motion.g
					key={item.label}
					data-testid="self-media-step-brand-signal"
					animate={reduceMotion ? undefined : { y: [0, -8, 0], opacity: [0.64, 1, 0.64] }}
					transition={{
						duration: 4.8,
						delay: item.delay,
						repeat: Infinity,
						ease: "easeInOut",
					}}
				>
					<circle
						cx={item.x}
						cy={item.y}
						r="4"
						className={cn(visual.accentFillClassName, "opacity-90")}
					/>
					<path
						d={`M${item.x} ${item.y} C ${item.x + 34} ${item.y - 18}, ${150} ${74}, 180 82`}
						className="stroke-[#18181b]/12 fill-none"
						strokeLinecap="round"
						strokeWidth="1.5"
					/>
				</motion.g>
			))}
		</motion.svg>
	)
}

function TopicsAnimation({
	reduceMotion,
	visual,
}: {
	reduceMotion: boolean
	visual: StepVisualConfig
}) {
	return (
		<>
			<motion.svg
				key="topics-flow"
				className="absolute inset-0 h-full w-full overflow-visible"
				viewBox="0 0 360 160"
				initial={reduceMotion ? false : { opacity: 0, y: 12 }}
				animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
				transition={{ duration: reduceMotion ? 0 : 0.32, ease: "easeOut" }}
				data-testid="self-media-step-topics-flow"
			>
				<path
					d="M18 118 C 74 48, 122 46, 174 78 S 260 144, 338 62"
					className="stroke-[#18181b]/10"
					fill="none"
					strokeLinecap="round"
					strokeWidth="18"
				/>
				<motion.path
					d="M18 118 C 74 48, 122 46, 174 78 S 260 144, 338 62"
					className={cn("drop-shadow-sm", visual.accentStrokeClassName)}
					fill="none"
					strokeLinecap="round"
					strokeWidth="5"
					initial={reduceMotion ? false : { pathLength: 0.42, opacity: 0.58 }}
					animate={
						reduceMotion
							? { opacity: 0.72 }
							: { pathLength: [0.42, 0.92, 0.42], opacity: [0.5, 0.86, 0.5] }
					}
					transition={{
						duration: 5.8,
						repeat: reduceMotion ? 0 : Infinity,
						ease: "easeInOut",
					}}
				/>
				{topicsNodes.map((node, index) => (
					<motion.circle
						key={`${node.cx}-${node.cy}`}
						cx={node.cx}
						cy={node.cy}
						r={index === 1 ? 7 : 5}
						className={cn(
							index === 1 ? visual.accentFillClassName : "fill-white",
							"stroke-[#18181b]/16",
						)}
						strokeWidth="2"
						data-testid="self-media-step-topics-node"
						animate={
							reduceMotion
								? undefined
								: {
										scale: index === 1 ? [1, 1.18, 1] : [1, 1.08, 1],
										opacity: [0.72, 1, 0.72],
									}
						}
						transition={{
							duration: 3.4 + index * 0.5,
							repeat: Infinity,
							ease: "easeInOut",
						}}
					/>
				))}
			</motion.svg>
			<motion.div
				className={cn(
					"absolute size-3 rounded-full shadow-[0_0_22px_rgba(255,122,69,0.46)]",
					visual.accentClassName,
				)}
				animate={
					reduceMotion
						? undefined
						: {
								x: [20, 124, 238, 330],
								y: [118, 48, 118, 62],
								opacity: [0, 1, 1, 0],
							}
				}
				transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
			/>
		</>
	)
}

function ConfirmAnimation({
	reduceMotion,
	visual,
}: {
	reduceMotion: boolean
	visual: StepVisualConfig
}) {
	return (
		<div className="absolute inset-0" data-testid="self-media-step-confirm-launch">
			<motion.svg
				className="absolute inset-0 h-full w-full overflow-visible"
				viewBox="0 0 360 160"
				initial={reduceMotion ? false : { opacity: 0, y: 10 }}
				animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
				transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
			>
				<path
					d="M58 128 C 128 92, 218 104, 306 36"
					className="fill-none stroke-[#18181b]/10"
					strokeLinecap="round"
					strokeWidth="18"
				/>
				<motion.path
					d="M58 128 C 128 92, 218 104, 306 36"
					className={visual.accentStrokeClassName}
					fill="none"
					strokeLinecap="round"
					strokeWidth="5"
					initial={reduceMotion ? false : { pathLength: 0.34, opacity: 0.58 }}
					animate={
						reduceMotion
							? { opacity: 0.74 }
							: { pathLength: [0.34, 1, 0.34], opacity: [0.5, 0.9, 0.5] }
					}
					transition={{
						duration: 5.2,
						repeat: reduceMotion ? 0 : Infinity,
						ease: "easeInOut",
					}}
				/>
			</motion.svg>
			{confirmChecks.map((item) => (
				<motion.div
					key={item.y}
					className="absolute flex h-7 items-center gap-2 rounded-full border border-[#18181b]/8 bg-white/70 px-2 shadow-[0_12px_24px_rgba(24,24,27,0.07)] backdrop-blur"
					style={{ left: item.x, top: item.y, width: item.width }}
					data-testid="self-media-step-confirm-check"
					animate={reduceMotion ? undefined : { x: [0, 7, 0], opacity: [0.68, 1, 0.68] }}
					transition={{
						duration: 4.4,
						delay: item.delay,
						repeat: Infinity,
						ease: "easeInOut",
					}}
				>
					<span
						className={cn(
							"flex size-4 items-center justify-center rounded-full text-white",
							visual.accentClassName,
						)}
					>
						<Check className="size-2.5" strokeWidth={3} />
					</span>
					<span className="h-1 flex-1 rounded-full bg-[#18181b]/10" />
				</motion.div>
			))}
			<motion.div
				className={cn(
					"absolute right-9 top-7 h-9 w-5 rounded-full shadow-[0_16px_30px_rgba(24,24,27,0.13)]",
					visual.accentClassName,
				)}
				animate={reduceMotion ? undefined : { y: [8, -12, 8], rotate: [-8, 4, -8] }}
				transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
			/>
		</div>
	)
}

function StepThemeAnimation({
	reduceMotion,
	stepKey,
	visual,
}: {
	reduceMotion: boolean
	stepKey: StepKey
	visual: StepVisualConfig
}) {
	if (stepKey === "brand") {
		return <BrandAnimation reduceMotion={reduceMotion} visual={visual} />
	}
	if (stepKey === "confirm") {
		return <ConfirmAnimation reduceMotion={reduceMotion} visual={visual} />
	}
	return <TopicsAnimation reduceMotion={reduceMotion} visual={visual} />
}

export default function StepHero({ currentStep, compact = false }: StepHeroProps) {
	const reduceMotion = useReducedMotion()
	const activeStep = STEPS[currentStep] ?? STEPS[0]
	const stepKey = activeStep.key
	const visual = stepVisuals[stepKey]

	return (
		<section
			className={cn(
				"pointer-events-none absolute inset-x-0 top-0 overflow-hidden transition-[height,opacity] duration-300 ease-out",
				"before:absolute before:inset-x-[-32px] before:top-[-96px] before:bg-gradient-to-br before:blur-2xl before:transition-[height,opacity] before:duration-300 before:ease-out before:content-['']",
				compact
					? "h-[76px] opacity-65 before:h-[104px] before:opacity-60"
					: "h-[380px] opacity-100 before:h-[396px] before:opacity-100",
				visual.washClassName,
			)}
			aria-hidden="true"
			data-active-step={stepKey}
			data-compact={compact ? "true" : undefined}
			data-testid="self-media-step-hero"
		>
			<div
				className={cn(
					"pointer-events-none absolute inset-x-[-12px] top-0 bg-[repeating-linear-gradient(118deg,rgba(24,24,27,0.035)_0,rgba(24,24,27,0.035)_1px,transparent_1px,transparent_18px)] transition-[height,opacity] duration-300 ease-out",
					compact ? "h-[54px] opacity-35" : "h-[252px] opacity-80",
				)}
				aria-hidden="true"
				data-testid="self-media-step-hero-backdrop"
			/>
			{!compact ? (
				<div className="absolute -bottom-1 right-4 top-4 hidden w-[380px] sm:block">
					<div aria-hidden="true">
						<StepThemeAnimation
							reduceMotion={reduceMotion}
							stepKey={stepKey}
							visual={visual}
						/>
					</div>
				</div>
			) : null}
		</section>
	)
}
