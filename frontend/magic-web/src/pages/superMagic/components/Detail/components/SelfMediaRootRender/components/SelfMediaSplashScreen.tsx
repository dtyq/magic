import { useEffect, useState, useMemo } from "react"
import type { CSSProperties } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"

const galleryImageModules = import.meta.glob<string>("./splash-gallery/open-art-*.jpg", {
	eager: true,
	query: "?url",
	import: "default",
})

const GALLERY_IMAGES = Object.entries(galleryImageModules)
	.sort(([a], [b]) => a.localeCompare(b))
	.map(([, src]) => src)

type RingConfig = {
	count: number
	radius: string
	size: number
	opacity: number
	duration?: number
	reverse?: boolean
}

type GalleryTile = {
	id: number
	imageUrl: string
	ringIndex: number
	angle: number
	tileRotation: number
	width: number
	height: number
	opacity: number
	blur?: number
}

const RING_CONFIGS: RingConfig[] = [
	{ count: 16, radius: "clamp(270px, 32vmin, 380px)", size: 88, opacity: 0.76, duration: 86 },
	{
		count: 20,
		radius: "clamp(390px, 48vmin, 560px)",
		size: 82,
		opacity: 0.58,
		duration: 118,
		reverse: true,
	},
	{ count: 24, radius: "clamp(520px, 64vmin, 760px)", size: 96, opacity: 0.42, duration: 150 },
	{
		count: 28,
		radius: "clamp(650px, 78vmin, 920px)",
		size: 104,
		opacity: 0.24,
		duration: 190,
		reverse: true,
	},
]

const TILE_SHAPES = [
	{ width: 0.86, height: 1.18 },
	{ width: 1.32, height: 0.84 },
	{ width: 1, height: 1 },
	{ width: 1.48, height: 0.78 },
	{ width: 0.78, height: 1.32 },
	{ width: 1.18, height: 1.02 },
	{ width: 1.58, height: 0.72 },
	{ width: 0.92, height: 1.42 },
]

interface SelfMediaSplashScreenProps {
	onComplete: () => void
}

const EXIT_ANIMATION_MS = 1180
const OUTWARD_TOP_ROTATION_DEG = 90
const SPLASH_STAGE_STYLE = {
	"--self-media-splash-stage-y": "calc(50% - clamp(8px, 1.8vmin, 24px))",
} as CSSProperties
const RING_CONTRACT_SCALES = [0.96, 0.92, 0.88, 0.84]
const RING_RELEASE_SCALES = [0.94, 0.9, 0.86, 0.82]
const RING_CONTRACT_TRANSITION = {
	type: "spring",
	stiffness: 420,
	damping: 34,
	mass: 0.48,
} as const
const RING_RELEASE_TRANSITION = {
	type: "tween",
	duration: 0.18,
	times: [0, 0.7, 1],
	ease: [0.24, 0.58, 0.18, 1],
} as const

function getRingScale(ringIndex: number, exiting: boolean, isActionEngaged: boolean) {
	if (exiting) {
		const releaseScale =
			RING_RELEASE_SCALES[ringIndex] ?? RING_RELEASE_SCALES[RING_RELEASE_SCALES.length - 1]
		return [releaseScale, releaseScale, releaseScale]
	}
	if (isActionEngaged) {
		return (
			RING_CONTRACT_SCALES[ringIndex] ?? RING_CONTRACT_SCALES[RING_CONTRACT_SCALES.length - 1]
		)
	}
	return 1
}

function getRingScaleLabel(ringScale: number | number[]) {
	return Array.isArray(ringScale) ? ringScale.join(",") : String(ringScale)
}

export default function SelfMediaSplashScreen({ onComplete }: SelfMediaSplashScreenProps) {
	const { t } = useTranslation("super")
	const [stage, setStage] = useState(0)
	const [exiting, setExiting] = useState(false)
	const [isActionEngaged, setIsActionEngaged] = useState(false)

	useEffect(() => {
		const t1 = setTimeout(() => setStage(1), 250)
		const t2 = setTimeout(() => setStage(2), 520)
		return () => {
			clearTimeout(t1)
			clearTimeout(t2)
		}
	}, [])

	useEffect(() => {
		if (!exiting) return
		const timer = setTimeout(() => {
			onComplete()
		}, EXIT_ANIMATION_MS)
		return () => clearTimeout(timer)
	}, [exiting, onComplete])

	const cards = useMemo<GalleryTile[]>(() => {
		if (!GALLERY_IMAGES.length) return []

		const nextCards: GalleryTile[] = []
		RING_CONFIGS.forEach((ring, ringIndex) => {
			for (let i = 0; i < ring.count; i += 1) {
				const id = nextCards.length
				const angle = (360 / ring.count) * i
				const tilt = ((id % 7) - 3) * 4
				const shape = TILE_SHAPES[id % TILE_SHAPES.length]
				const sizeJitter = 1 + ((id % 5) - 2) * 0.035
				nextCards.push({
					id,
					ringIndex,
					angle,
					tileRotation: OUTWARD_TOP_ROTATION_DEG + tilt,
					imageUrl: GALLERY_IMAGES[id % GALLERY_IMAGES.length],
					width: ring.size * shape.width * sizeJitter,
					height: ring.size * shape.height * sizeJitter,
					opacity: Math.max(0.12, ring.opacity - (id % 6) * 0.025),
					blur: ringIndex >= 2 && id % 4 === 0 ? 0.6 : undefined,
				})
			}
		})
		return nextCards
	}, [])

	const handleStart = () => {
		if (exiting) return
		setExiting(true)
	}

	const ringMotionState = exiting ? "release" : isActionEngaged ? "contracted" : "rest"

	return (
		<div
			className={cn(
				"relative flex h-full w-full items-center justify-center overflow-hidden bg-white",
				exiting && "self-media-splash-root-exit pointer-events-none",
				isActionEngaged && !exiting && "self-media-splash-action-engaged",
			)}
			style={SPLASH_STAGE_STYLE}
			data-testid="self-media-splash-root"
		>
			<style>{`
				@keyframes splash-orbit-spin {
					from {
						transform: rotate(0deg);
					}
					to {
						transform: rotate(360deg);
					}
				}
				@keyframes splash-root-exit {
					0% {
						opacity: 1;
					}
					34% {
						opacity: 0.96;
					}
					100% {
						opacity: 0;
					}
				}
				@keyframes splash-tile-exit {
					0% {
						opacity: var(--tile-opacity);
						transform: translate(-50%, -50%) rotate(var(--tile-angle)) translateX(var(--tile-radius)) rotate(var(--tile-rotation)) scale(1);
					}
					9% {
						opacity: var(--tile-opacity);
						transform: translate(-50%, -50%) rotate(var(--tile-angle)) translateX(calc(var(--tile-radius) - 22px)) rotate(var(--tile-rotation)) scale(1.04);
					}
					13% {
						opacity: var(--tile-opacity);
						transform: translate(-50%, -50%) rotate(var(--tile-angle)) translateX(calc(var(--tile-radius) - 20px)) rotate(var(--tile-rotation)) scale(1.03);
					}
					100% {
						opacity: 0;
						transform: translate(-50%, -50%) rotate(var(--tile-angle)) translateX(calc(var(--tile-radius) + var(--tile-exit-distance))) rotate(calc(var(--tile-rotation) + var(--tile-exit-rotate))) scale(0.68);
					}
				}
				@keyframes splash-copy-exit {
					0% {
						opacity: 1;
						transform: translate3d(0, 0, 0);
					}
					34% {
						opacity: 1;
						transform: translate3d(0, 16px, 0);
					}
					100% {
						opacity: 0;
						transform: translate3d(0, -92px, 0);
					}
				}
				@keyframes splash-action-exit {
					0% {
						opacity: 1;
						transform: translate3d(0, 0, 0) scale(1);
					}
					32% {
						opacity: 1;
						transform: translate3d(0, -14px, 0) scale(1.04);
					}
					100% {
						opacity: 0;
						transform: translate3d(0, 86px, 0) scale(0.96);
					}
				}
				@keyframes splash-system-flow {
					0% {
						opacity: 0;
						transform: translateX(-120%) scaleX(0.42);
					}
					18% {
						opacity: 0.52;
					}
					54% {
						opacity: 0.82;
					}
					100% {
						opacity: 0;
						transform: translateX(185%) scaleX(0.72);
					}
				}
				@keyframes splash-action-dot {
					0%, 100% {
						opacity: 0.48;
						transform: scale(0.82);
					}
					50% {
						opacity: 1;
						transform: scale(1.16);
					}
				}
				.self-media-splash-root-exit {
					animation: splash-root-exit ${EXIT_ANIMATION_MS}ms ease-out forwards;
				}
				.self-media-splash-ring-shell {
					will-change: transform;
				}
				.self-media-splash-ring {
					will-change: transform;
				}
				.self-media-splash-gallery-exit .self-media-splash-tile {
					animation-name: splash-tile-exit;
					animation-duration: 1180ms;
					animation-timing-function: cubic-bezier(0.34, 1.42, 0.42, 1);
					animation-fill-mode: forwards;
				}
				.self-media-splash-copy-exit {
					animation: splash-copy-exit 900ms cubic-bezier(0.34, 1.34, 0.42, 1) forwards;
				}
				.self-media-splash-action-exit {
					animation: splash-action-exit 900ms cubic-bezier(0.34, 1.34, 0.42, 1) forwards;
				}
				.self-media-splash-system-flow::after {
					animation: splash-system-flow 2.8s ease-in-out 360ms infinite;
				}
				.self-media-splash-action-dot {
					animation: splash-action-dot 1.8s ease-in-out infinite;
				}
				@media (prefers-reduced-motion: reduce) {
					.self-media-splash-system-flow::after,
					.self-media-splash-action-dot {
						animation: none;
					}
				}
			`}</style>

			<div
				className={cn(
					"pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out",
					stage >= 2 || exiting ? "opacity-100" : "opacity-0",
					exiting && "self-media-splash-gallery-exit",
				)}
				data-testid="self-media-splash-gallery"
			>
				<div className="absolute inset-0 bg-white" />
				{RING_CONFIGS.map((ring, ringIndex) => {
					const ringScale = getRingScale(ringIndex, exiting, isActionEngaged)
					return (
						<motion.div
							key={ring.radius}
							className="self-media-splash-ring-shell absolute left-1/2 top-[var(--self-media-splash-stage-y)] h-0 w-0"
							data-engaged={isActionEngaged && !exiting ? "true" : "false"}
							data-motion-state={ringMotionState}
							data-target-scale={getRingScaleLabel(ringScale)}
							data-testid="self-media-splash-ring-shell"
							initial={false}
							animate={{
								x: "-50%",
								y: "-50%",
								scale: ringScale,
							}}
							transition={
								exiting ? RING_RELEASE_TRANSITION : RING_CONTRACT_TRANSITION
							}
						>
							<div
								className="self-media-splash-ring h-0 w-0"
								style={{
									animation: `splash-orbit-spin ${ring.duration}s linear infinite ${ring.reverse ? "reverse" : "normal"}`,
								}}
							>
								{cards
									.filter((card) => card.ringIndex === ringIndex)
									.map((card) => {
										const tileStyle = {
											width: `clamp(${Math.round(card.width * 0.72)}px, ${Math.round(card.width / 13)}vmin, ${Math.round(card.width)}px)`,
											height: `clamp(${Math.round(card.height * 0.72)}px, ${Math.round(card.height / 13)}vmin, ${Math.round(card.height)}px)`,
											opacity: card.opacity,
											filter: card.blur ? `blur(${card.blur}px)` : undefined,
											transform: `translate(-50%, -50%) rotate(${card.angle}deg) translateX(${ring.radius}) rotate(${card.tileRotation}deg)`,
											"--tile-angle": `${card.angle}deg`,
											"--tile-radius": ring.radius,
											"--tile-rotation": `${card.tileRotation}deg`,
											"--tile-opacity": card.opacity,
											"--tile-exit-distance": `clamp(${120 + card.ringIndex * 44}px, ${18 + card.ringIndex * 5}vmin, ${220 + card.ringIndex * 72}px)`,
											"--tile-exit-rotate": `${card.id % 2 === 0 ? 18 : -18}deg`,
											animationDelay: exiting
												? `${(card.id % 9) * 18}ms`
												: undefined,
										} as CSSProperties

										return (
											<div
												key={card.id}
												data-testid="self-media-splash-tile"
												className="self-media-splash-tile absolute left-1/2 top-1/2 overflow-hidden rounded-[18px] border border-zinc-950/25 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),inset_0_1px_0_rgba(255,255,255,0.9),0_18px_46px_rgba(24,24,27,0.18)] ring-1 ring-zinc-950/[0.16]"
												style={tileStyle}
											>
												<img
													src={card.imageUrl}
													alt=""
													className="h-full w-full object-cover"
													draggable={false}
													data-testid="self-media-splash-screen-image"
												/>
											</div>
										)
									})}
							</div>
						</motion.div>
					)
				})}
				<div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-transparent via-white/80 to-white" />
			</div>

			<div className="absolute left-1/2 top-[var(--self-media-splash-stage-y)] z-10 flex w-full max-w-[680px] -translate-x-1/2 -translate-y-1/2 flex-col items-center px-6 text-center">
				<div
					className={cn(
						stage >= 1
							? "translate-y-0 opacity-100 transition-all duration-700 ease-out"
							: "translate-y-6 opacity-0",
						exiting && "self-media-splash-copy-exit",
					)}
					data-testid="self-media-splash-copy"
				>
					<p className="mb-5 text-[13px] font-[800] uppercase text-[#18181b]">
						{t("detail.selfMedia.splash.subtitle")}
					</p>
					<h2 className="mb-6 text-[42px] font-[760] leading-[1.12] text-[#09090b] sm:text-[58px]">
						<span className="block">
							{t("detail.selfMedia.splash.headingFirstLine")}
						</span>
						<span className="block">
							{t("detail.selfMedia.splash.headingSecondLine")}
						</span>
					</h2>
					<p className="mb-5 text-[14px] font-[650] text-zinc-500 sm:text-[15px]">
						{t("detail.selfMedia.splash.description")}
					</p>
					<div
						aria-hidden="true"
						className="self-media-splash-system-flow relative mx-auto mb-9 h-px w-[min(360px,72vw)] overflow-hidden rounded-full bg-zinc-950/10 before:absolute before:left-1/2 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-zinc-950/55 before:shadow-[0_0_18px_rgba(24,24,27,0.32)] after:absolute after:left-0 after:top-1/2 after:h-[3px] after:w-[44%] after:-translate-y-1/2 after:rounded-full after:bg-gradient-to-r after:from-transparent after:via-zinc-950/45 after:to-transparent"
						data-testid="self-media-splash-system-flow"
					/>
				</div>
				<div
					className={cn(
						stage >= 1
							? "translate-y-0 opacity-100 transition-all duration-700 ease-out"
							: "translate-y-6 opacity-0",
						exiting && "self-media-splash-action-exit",
					)}
					data-testid="self-media-splash-action"
					onPointerEnter={() => setIsActionEngaged(true)}
					onPointerLeave={() => setIsActionEngaged(false)}
					onFocus={() => setIsActionEngaged(true)}
					onBlur={() => setIsActionEngaged(false)}
				>
					<button
						type="button"
						disabled={exiting}
						className="flex h-[54px] items-center gap-3 rounded-full bg-[#09090b] px-10 text-[15px] font-[700] text-white shadow-[0_18px_40px_rgba(24,24,27,0.16)] transition-transform hover:-translate-y-0.5 active:scale-95"
						onClick={handleStart}
						data-testid="handle-start"
					>
						<span
							aria-hidden="true"
							className="self-media-splash-action-dot h-1.5 w-1.5 rounded-full bg-white"
							data-testid="self-media-splash-action-dot"
						/>
						{t("detail.selfMedia.splash.startCreating")}
					</button>
				</div>
			</div>
		</div>
	)
}
